import { getSession } from "./auth.js";
import { buildPushPayload } from "@block65/webcrypto-web-push";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function isValidSubscription(sub) {
  return !!(
    sub &&
    typeof sub.endpoint === "string" &&
    sub.endpoint.length > 0 &&
    sub.keys &&
    typeof sub.keys.p256dh === "string" &&
    typeof sub.keys.auth === "string"
  );
}

async function loadBlob(env, email) {
  const raw = await env.PROGRESS.get("progress:" + email);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function handlePushSubscribe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const sub = body && body.subscription;
  if (!isValidSubscription(sub)) return json({ error: "Invalid push subscription" }, 400);

  const blob = (await loadBlob(env, session.email)) || {};
  const existing = Array.isArray(blob.pushSubscriptions) ? blob.pushSubscriptions : [];
  const withoutDupe = existing.filter(s => s.endpoint !== sub.endpoint);
  blob.pushSubscriptions = [...withoutDupe, {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    expirationTime: sub.expirationTime || null
  }];
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}

export async function handlePushUnsubscribe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const endpoint = body && body.endpoint;
  const blob = (await loadBlob(env, session.email)) || {};
  const existing = Array.isArray(blob.pushSubscriptions) ? blob.pushSubscriptions : [];
  blob.pushSubscriptions = endpoint ? existing.filter(s => s.endpoint !== endpoint) : [];
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// A push endpoint occasionally fails transiently (network blip, momentary 5xx
// from the push service) -- retry a couple of times with a short backoff
// before giving up. A 4xx (e.g. 404/410, an expired subscription) means the
// request itself is permanently rejected, so retrying it would be pointless;
// only 5xx/network errors are retried.
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastResponse, lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status < 500) return res;
      lastResponse = res;
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxRetries) await sleep(200 * 2 ** attempt);
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}

async function sendToSubscription(env, subscription, message) {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };
  const payload = await buildPushPayload(message, subscription, vapid);
  return fetchWithRetry(subscription.endpoint, payload);
}

export async function handlePushTest(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);
  if (!env.VAPID_PRIVATE_KEY) return json({ error: "Push notifications aren't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const subs = (blob && Array.isArray(blob.pushSubscriptions) && blob.pushSubscriptions) || [];
  if (!subs.length) return json({ error: "No push subscription found for this browser" }, 400);

  const message = {
    data: JSON.stringify({
      title: "StudyStacks",
      body: "Notifications are working! You'll get a reminder like this to keep studying.",
      url: "/dashboard"
    }),
    options: { ttl: 60 }
  };

  let sent = 0;
  for (const sub of subs) {
    try {
      const res = await sendToSubscription(env, sub, message);
      if (res.ok || res.status === 201) sent++;
    } catch (e) { /* ignore individual failures for a test send */ }
  }

  return json({ ok: true, sent });
}

export async function sendDailyReminders(env) {
  if (!env.PROGRESS || !env.VAPID_PRIVATE_KEY) return { checked: 0, sent: 0 };

  let cursor;
  let checked = 0;
  let sent = 0;
  const message = {
    data: JSON.stringify({
      title: "Time to study 📚",
      body: "Keep your streak going — a few minutes now adds up.",
      url: "/dashboard"
    }),
    options: { ttl: 3600 }
  };

  do {
    const list = await env.PROGRESS.list({ prefix: "progress:", cursor });
    for (const key of list.keys) {
      checked++;
      const raw = await env.PROGRESS.get(key.name);
      if (!raw) continue;
      let blob;
      try {
        blob = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      const subs = Array.isArray(blob.pushSubscriptions) ? blob.pushSubscriptions : [];
      if (!subs.length || !blob.goal) continue;

      const stillValid = [];
      for (const sub of subs) {
        try {
          const res = await sendToSubscription(env, sub, message);
          if (res.ok || res.status === 201) {
            sent++;
            stillValid.push(sub);
          } else if (res.status !== 404 && res.status !== 410) {
            // transient failure - keep the subscription for next time
            stillValid.push(sub);
          }
          // 404/410 means the push service says this subscription is gone - drop it
        } catch (e) {
          stillValid.push(sub); // network error - keep it, don't punish for a transient blip
        }
      }
      if (stillValid.length !== subs.length) {
        blob.pushSubscriptions = stillValid;
        await env.PROGRESS.put(key.name, JSON.stringify(blob));
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { checked, sent };
}

const WEEKDAY_TO_DAY_KEY = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };

function localDayAndMinutes(timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const weekday = parts.find(p => p.type === "weekday").value;
  let hour = parseInt(parts.find(p => p.type === "hour").value, 10);
  const minute = parseInt(parts.find(p => p.type === "minute").value, 10);
  if (hour === 24) hour = 0; // some ICU locales format midnight as "24" with hour12:false
  return { day: WEEKDAY_TO_DAY_KEY[weekday], minutes: hour * 60 + minute };
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function localDateString(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;
  return `${year}-${month}-${day}`;
}

const STREAK_REMINDER_MINUTES = 20 * 60; // 8:00 PM local

// Runs on the same frequent cron as sendScheduledBlockReminders. For each
// student with an active streak and a known timezone (captured the last time
// their streak was touched), sends a "don't lose your streak" nudge once,
// around 8pm in THEIR local time, but only if they haven't been active yet
// that local day -- so a student who already studied gets nothing.
export async function sendStreakReminders(env) {
  if (!env.PROGRESS || !env.VAPID_PRIVATE_KEY) return { checked: 0, sent: 0 };

  let cursor;
  let checked = 0;
  let sent = 0;

  do {
    const list = await env.PROGRESS.list({ prefix: "progress:", cursor });
    for (const key of list.keys) {
      checked++;
      const raw = await env.PROGRESS.get(key.name);
      if (!raw) continue;
      let blob;
      try {
        blob = JSON.parse(raw);
      } catch (e) {
        continue;
      }

      const streak = blob.streak;
      const subs = Array.isArray(blob.pushSubscriptions) ? blob.pushSubscriptions : [];
      if (!streak || !(streak.current > 0) || !streak.timezone || !subs.length) continue;

      let local, today;
      try {
        local = localDayAndMinutes(streak.timezone);
        today = localDateString(streak.timezone);
      } catch (e) {
        continue; // stale/invalid timezone saved before validation was added - skip rather than crash
      }

      if (local.minutes < STREAK_REMINDER_MINUTES || local.minutes >= STREAK_REMINDER_MINUTES + 5) continue;
      if (streak.lastActiveDate === today) continue; // already active today - don't nag

      const message = {
        data: JSON.stringify({
          title: `🔥 Don't lose your ${streak.current}-day streak!`,
          body: "A few minutes of practice before midnight keeps it going.",
          url: "/dashboard"
        }),
        options: { ttl: 3600 }
      };

      const deadEndpoints = new Set();
      for (const sub of subs) {
        try {
          const res = await sendToSubscription(env, sub, message);
          if (res.ok || res.status === 201) sent++;
          else if (res.status === 404 || res.status === 410) deadEndpoints.add(sub.endpoint);
        } catch (e) { /* transient failure - keep the subscription for next time */ }
      }
      if (deadEndpoints.size) {
        blob.pushSubscriptions = subs.filter(s => !deadEndpoints.has(s.endpoint));
        await env.PROGRESS.put(key.name, JSON.stringify(blob));
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { checked, sent };
}

// Runs on a frequent cron (every 5 minutes). For each student with notifications
// enabled on their study schedule, checks whether any block starts within the
// current 5-minute window in THEIR local time (using the IANA timezone captured
// when they built the schedule) and sends a reminder naming that block's subject.
export async function sendScheduledBlockReminders(env) {
  if (!env.PROGRESS || !env.VAPID_PRIVATE_KEY) return { checked: 0, sent: 0 };

  let cursor;
  let checked = 0;
  let sent = 0;

  do {
    const list = await env.PROGRESS.list({ prefix: "progress:", cursor });
    for (const key of list.keys) {
      checked++;
      const raw = await env.PROGRESS.get(key.name);
      if (!raw) continue;
      let blob;
      try {
        blob = JSON.parse(raw);
      } catch (e) {
        continue;
      }

      const schedule = blob.schedule;
      const subs = Array.isArray(blob.pushSubscriptions) ? blob.pushSubscriptions : [];
      if (!schedule || !schedule.notifyEnabled || !schedule.timezone || !subs.length) continue;
      const blocks = Array.isArray(schedule.blocks) ? schedule.blocks : [];
      if (!blocks.length) continue;

      let local;
      try {
        local = localDayAndMinutes(schedule.timezone);
      } catch (e) {
        continue; // stale/invalid timezone saved before validation was added - skip rather than crash
      }

      const dueBlocks = blocks.filter(b => {
        if (b.day !== local.day) return false;
        const startMin = timeToMinutes(b.start);
        return startMin >= local.minutes && startMin < local.minutes + 5;
      });
      if (!dueBlocks.length) continue;

      const deadEndpoints = new Set();
      for (const block of dueBlocks) {
        const message = {
          data: JSON.stringify({
            title: `Time to study ${block.subjectLabel}! 📚`,
            body: `Your ${block.start}–${block.end} study block just started.`,
            url: "/dashboard"
          }),
          options: { ttl: 900 }
        };
        for (const sub of subs) {
          if (deadEndpoints.has(sub.endpoint)) continue;
          try {
            const res = await sendToSubscription(env, sub, message);
            if (res.ok || res.status === 201) sent++;
            else if (res.status === 404 || res.status === 410) deadEndpoints.add(sub.endpoint);
          } catch (e) { /* transient failure - keep the subscription for next time */ }
        }
      }
      if (deadEndpoints.size) {
        blob.pushSubscriptions = subs.filter(s => !deadEndpoints.has(s.endpoint));
        await env.PROGRESS.put(key.name, JSON.stringify(blob));
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { checked, sent };
}
