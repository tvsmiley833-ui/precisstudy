import { getSession, signSession, SESSION_COOKIE } from "./auth.js";
import { json } from "./http.js";
import { loadBlob, putBlob, isValidTimezone } from "./progress-routes.js";

const MAX_NAME = 40;

/** GET /api/profile and POST /api/profile: display name and timezone override (empty string clears either). */
export async function handleProfile(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const blob = await loadBlob(env, session.email, { history: false });
  const profile = { ...(blob.profile || {}) };

  if (request.method === "GET") {
    return json({ email: session.email, provider: session.provider, name: session.name, displayName: profile.displayName ?? null, timezone: profile.timezone ?? null });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: unknown;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON body" }, 400); }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  let nameChanged = false;
  if ("displayName" in rec) {
    if (typeof rec.displayName !== "string") return json({ error: "displayName must be text" }, 400);
    const name = rec.displayName.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
    if (name.length > MAX_NAME) return json({ error: `Keep your name to ${MAX_NAME} characters or fewer` }, 400);
    profile.displayName = name || null;
    nameChanged = true;
  }
  if ("timezone" in rec) {
    if (typeof rec.timezone !== "string") return json({ error: "timezone must be text" }, 400);
    const tz = rec.timezone.trim();
    if (tz && !isValidTimezone(tz)) return json({ error: "That is not a valid timezone" }, 400);
    profile.timezone = tz || null;
    if (tz && blob.streak) blob.streak = { ...blob.streak, timezone: tz };
  }
  blob.profile = profile;
  blob.updatedAt = new Date().toISOString();
  await putBlob(env, session.email, blob);

  const headers = new Headers({ "Content-Type": "application/json" });
  if (nameChanged) {
    // The name lives in the signed session cookie, so re-issue it (same expiry and session version) instead of reading KV on every /auth/me.
    const shown = profile.displayName || session.email;
    const maxAge = Math.max(1, session.exp - Math.floor(Date.now() / 1000));
    const token = await signSession({ ...session, name: shown }, env.SESSION_SECRET);
    headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  }
  return new Response(JSON.stringify({ ok: true, displayName: profile.displayName ?? null, timezone: profile.timezone ?? null }), { status: 200, headers });
}
