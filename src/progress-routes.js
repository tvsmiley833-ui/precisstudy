import { getSession } from "./auth.js";

const SUBJECTS = ["geometry", "chemistry", "algebra1", "algebra2", "aplang", "globalhistory", "apbiology", "apush", "physics", "biology", "precalc"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function emptySubject() {
  return { mastery: {}, examples: {}, cardsKnown: [] };
}

function emptyBlob() {
  const blob = { goal: null, updatedAt: null, enrolledSubjects: [], pushSubscriptions: [], schedule: null, streak: null };
  for (const subject of SUBJECTS) blob[subject] = emptySubject();
  return blob;
}

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

const DAY_KEYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTimezone(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

function isValidBlock(b) {
  return !!(
    b &&
    DAY_KEYS.has(b.day) &&
    TIME_RE.test(b.start) &&
    TIME_RE.test(b.end) &&
    SUBJECTS.includes(b.subjectKey) &&
    typeof b.subjectLabel === "string" &&
    b.subjectLabel.length > 0 &&
    b.subjectLabel.length <= 120
  );
}

async function loadBlob(env, email) {
  if (!env.PROGRESS) return null;
  const raw = await env.PROGRESS.get("progress:" + email);
  if (!raw) return emptyBlob();
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(emptyBlob(), parsed);
  } catch (e) {
    return emptyBlob();
  }
}

export async function handleGetProgress(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  return json(blob);
}

export async function handlePostProgress(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const subject = body && body.subject;
  if (!SUBJECTS.includes(subject)) return json({ error: "Unknown subject" }, 400);

  const mastery = (body && typeof body.mastery === "object" && body.mastery) || {};
  const examples = (body && typeof body.examples === "object" && body.examples) || {};
  const cardsKnown = (body && Array.isArray(body.cardsKnown) && body.cardsKnown) || [];

  const blob = await loadBlob(env, session.email);
  blob[subject] = { mastery, examples, cardsKnown };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}

export async function handlePostEnrolledSubjects(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const raw = (body && Array.isArray(body.subjects) && body.subjects) || [];
  const enrolledSubjects = [...new Set(raw.filter(s => SUBJECTS.includes(s)))];

  const blob = await loadBlob(env, session.email);
  blob.enrolledSubjects = enrolledSubjects;
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, enrolledSubjects });
}

export async function handlePostSchedule(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const rawBlocks = (body && Array.isArray(body.blocks) && body.blocks) || [];
  if (rawBlocks.length > 50) return json({ error: "Too many blocks" }, 400);
  if (!rawBlocks.every(isValidBlock)) return json({ error: "Invalid schedule block" }, 400);

  const notifyEnabled = !!(body && body.notifyEnabled);
  const timezone = body && body.timezone;
  if (notifyEnabled && !isValidTimezone(timezone)) {
    return json({ error: "A valid timezone is required to enable notifications" }, 400);
  }

  const blocks = rawBlocks.map(b => ({
    day: b.day,
    start: b.start,
    end: b.end,
    subjectKey: b.subjectKey,
    subjectLabel: b.subjectLabel.slice(0, 120)
  }));

  const blob = await loadBlob(env, session.email);
  blob.schedule = {
    blocks,
    timezone: isValidTimezone(timezone) ? timezone : null,
    notifyEnabled,
    savedAt: new Date().toISOString()
  };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, schedule: blob.schedule });
}

export async function handlePostStreak(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const localDate = body && body.localDate;
  if (typeof localDate !== "string" || !LOCAL_DATE_RE.test(localDate)) {
    return json({ error: "localDate must be an ISO date string (YYYY-MM-DD)" }, 400);
  }

  const requestedTimezone = body && body.timezone;
  const timezone = isValidTimezone(requestedTimezone) ? requestedTimezone : null;

  const blob = await loadBlob(env, session.email);
  const prev = blob.streak || { current: 0, longest: 0, lastActiveDate: null, timezone: null };

  if (prev.lastActiveDate === localDate) {
    // Same day as last recorded -- no streak change, but still refresh the
    // timezone in case it drifted (e.g. the student is traveling).
    const streak = timezone ? { ...prev, timezone } : prev;
    if (timezone && timezone !== prev.timezone) {
      blob.streak = streak;
      blob.updatedAt = new Date().toISOString();
      await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
    }
    return json({ ok: true, streak, changed: false });
  }

  const gap = prev.lastActiveDate ? daysBetween(prev.lastActiveDate, localDate) : null;
  if (gap !== null && gap < 0) {
    // localDate is older than what's on record (clock skew or an out-of-order
    // request) -- ignore rather than let it reset or corrupt an existing streak.
    return json({ ok: true, streak: prev, changed: false });
  }
  const current = gap === 1 ? prev.current + 1 : 1;
  const streak = { current, longest: Math.max(prev.longest, current), lastActiveDate: localDate, timezone: timezone || prev.timezone || null };

  blob.streak = streak;
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, streak, changed: true });
}

export async function handlePostGoal(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const days = Number(body && body.days);
  const minutesPerDay = Number(body && body.minutesPerDay);
  if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(minutesPerDay) || minutesPerDay <= 0) {
    return json({ error: "days and minutesPerDay must be positive numbers" }, 400);
  }

  const blob = await loadBlob(env, session.email);
  blob.goal = { days, minutesPerDay, savedAt: new Date().toISOString() };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, goal: blob.goal });
}
