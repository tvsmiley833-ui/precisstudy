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

async function sendToSubscription(env, subscription, message) {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };
  const payload = await buildPushPayload(message, subscription, vapid);
  return fetch(subscription.endpoint, payload);
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
