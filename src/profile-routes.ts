import { getSession, signSession, SESSION_COOKIE, listSessions, revokeSession } from "./auth.js";
import type { SessionPayload } from "./auth.js";
import { json } from "./http.js";
import { loadBlob, putBlob, isValidTimezone } from "./progress-routes.js";
import { CANVAS_SYNC_MODES } from "./canvas-sync.js";

const MAX_NAME = 40;
const MAX_AVATAR_BYTES = 60 * 1024;

function avatarKey(email: string): string { return "avatar:" + email.toLowerCase(); }

/** A new account's first sign-in: remember the date so Settings can show "Member since". */
export async function stampMemberSince(env: Env, email: string): Promise<void> {
  if (!env.PROGRESS) return;
  try {
    const blob = await loadBlob(env, email, { history: false });
    blob.profile = { ...(blob.profile || {}), createdAt: new Date().toISOString() };
    await putBlob(env, email, blob);
  } catch (e) { /* cosmetic */ }
}

/** The name and avatar flag live in the signed session cookie: re-issue it (same expiry, version and sid) instead of reading KV on every /auth/me. */
async function reissue(env: Env, session: SessionPayload, changes: Partial<SessionPayload>, headers: Headers): Promise<void> {
  const maxAge = Math.max(1, session.exp - Math.floor(Date.now() / 1000));
  const next = { ...session, ...changes } as Record<string, unknown>;
  if (next.av === 0) delete next.av;
  headers.append("Set-Cookie", `${SESSION_COOKIE}=${await signSession(next, env.SESSION_SECRET)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

/** GET/POST /api/profile: display name, timezone, time format, default study length, Canvas sync frequency. Empty string / null clears. */
export async function handleProfile(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const blob = await loadBlob(env, session.email, { history: request.method === "GET" });
  const profile = { ...(blob.profile || {}) };

  if (request.method === "GET") {
    const firstActive = Array.isArray(blob.history) && blob.history.length ? blob.history[0]?.date ?? null : null;
    return json({
      email: session.email, provider: session.provider, name: session.name,
      displayName: profile.displayName ?? null, timezone: profile.timezone ?? null,
      timeFormat: profile.timeFormat ?? null, studyMinutes: profile.studyMinutes ?? null, canvasSync: profile.canvasSync ?? "always",
      hasAvatar: !!profile.hasAvatar,
      memberSince: profile.createdAt ?? null, firstActivity: profile.createdAt ? null : firstActive
    });
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
  if ("timeFormat" in rec) {
    if (rec.timeFormat !== null && rec.timeFormat !== "12h" && rec.timeFormat !== "24h") return json({ error: "timeFormat must be 12h or 24h" }, 400);
    profile.timeFormat = rec.timeFormat as "12h" | "24h" | null;
  }
  if ("studyMinutes" in rec) {
    const m = rec.studyMinutes;
    if (m !== null && !(typeof m === "number" && Number.isInteger(m) && m >= 10 && m <= 180)) return json({ error: "studyMinutes must be a whole number from 10 to 180" }, 400);
    profile.studyMinutes = m as number | null;
  }
  if ("canvasSync" in rec) {
    if (typeof rec.canvasSync !== "string" || !CANVAS_SYNC_MODES.includes(rec.canvasSync as never)) return json({ error: "canvasSync must be always, hourly, daily or manual" }, 400);
    profile.canvasSync = rec.canvasSync as (typeof CANVAS_SYNC_MODES)[number];
  }
  blob.profile = profile;
  blob.updatedAt = new Date().toISOString();
  await putBlob(env, session.email, blob);

  const headers = new Headers({ "Content-Type": "application/json" });
  if (nameChanged) await reissue(env, session, { name: profile.displayName || session.email }, headers);
  return new Response(JSON.stringify({ ok: true, displayName: profile.displayName ?? null, timezone: profile.timezone ?? null, timeFormat: profile.timeFormat ?? null, studyMinutes: profile.studyMinutes ?? null, canvasSync: profile.canvasSync ?? "always" }), { status: 200, headers });
}

/** GET /api/sessions lists this account's recorded sign-ins; POST /api/sessions/revoke {id} signs one device out. */
export async function handleSessions(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  if (request.method === "GET") {
    const list = await listSessions(env, session.email);
    return json({ sessions: list.map(s => ({ id: s.id, device: s.device, createdAt: s.createdAt, current: s.id === session.sid })).reverse(), canList: !!session.sid });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON body" }, 400); }
  const id = body && typeof body === "object" ? (body as Record<string, unknown>).id : null;
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);
  if (id === session.sid) return json({ error: "Use Sign out to end this session" }, 400);
  await revokeSession(env, session.email, id);
  return json({ ok: true });
}

/** GET/PUT/DELETE /api/avatar: your own small JPEG (resized in the browser to 128px). Private to the signed-in account. */
export async function handleAvatar(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const key = avatarKey(session.email);
  if (request.method === "GET") {
    const buf = await env.PROGRESS.get(key, "arrayBuffer");
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(buf, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  }
  const headers = new Headers({ "Content-Type": "application/json" });
  if (request.method === "PUT") {
    const buf = await request.arrayBuffer();
    if (buf.byteLength < 100 || buf.byteLength > MAX_AVATAR_BYTES) return json({ error: "Picture must be under 60 KB (it is resized for you)" }, 400);
    const b = new Uint8Array(buf);
    if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return json({ error: "Picture must be a JPEG" }, 400);
    await env.PROGRESS.put(key, buf);
  } else if (request.method === "DELETE") {
    await env.PROGRESS.delete(key);
  } else return json({ error: "Method not allowed" }, 405);
  const has = request.method === "PUT";
  const blob = await loadBlob(env, session.email, { history: false });
  blob.profile = { ...(blob.profile || {}), hasAvatar: has };
  await putBlob(env, session.email, blob);
  await reissue(env, session, { av: has ? 1 : 0 }, headers);
  return new Response(JSON.stringify({ ok: true, hasAvatar: has }), { status: 200, headers });
}
