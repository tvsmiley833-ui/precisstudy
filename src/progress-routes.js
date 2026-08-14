import { getSession } from "./auth.js";

const SUBJECTS = ["geometry", "chemistry"];

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
  return { geometry: emptySubject(), chemistry: emptySubject(), updatedAt: null };
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
