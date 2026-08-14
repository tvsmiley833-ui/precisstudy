import { isValidEmail } from "./auth.js";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

const MAX_CLASS_LEN = 120;
const MAX_NOTES_LEN = 1000;

export async function handleRequestGuideSubmit(request, env) {
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const className = body && typeof body.className === "string" ? body.className.trim() : "";
  if (!className) return json({ error: "Tell us which class or subject you need" }, 400);
  if (className.length > MAX_CLASS_LEN) return json({ error: "That class name is too long" }, 400);

  const notes = body && typeof body.notes === "string" ? body.notes.trim().slice(0, MAX_NOTES_LEN) : "";

  const emailRaw = body && typeof body.email === "string" ? body.email.trim() : "";
  if (emailRaw && !isValidEmail(emailRaw)) return json({ error: "Enter a valid email address, or leave it blank" }, 400);

  const key = "req:" + Date.now() + ":" + crypto.randomUUID();
  await env.GUIDE_REQUESTS.put(key, JSON.stringify({
    className,
    notes,
    email: emailRaw,
    submittedAt: new Date().toISOString()
  }));

  return json({ ok: true });
}
