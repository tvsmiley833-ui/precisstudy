import { getSession } from "./auth.js";

const SUBJECTS = ["geometry", "chemistry", "algebra1"];

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
  const blob = { goal: null, updatedAt: null };
  for (const subject of SUBJECTS) blob[subject] = emptySubject();
  return blob;
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
