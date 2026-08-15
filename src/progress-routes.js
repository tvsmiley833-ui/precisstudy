import { getSession } from "./auth.js";

const SUBJECTS = ["geometry", "chemistry", "algebra1", "algebra2", "aplang", "globalhistory"];

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
  const blob = { goal: null, updatedAt: null, enrolledSubjects: [], pushSubscriptions: [], schedule: null };
  for (const subject of SUBJECTS) blob[subject] = emptySubject();
  return blob;
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
