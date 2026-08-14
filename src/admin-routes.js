import { getSession } from "./auth.js";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function isAdminEmail(env, email) {
  if (!email || !env.ADMIN_EMAILS) return false;
  const allowed = env.ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(email).toLowerCase());
}

async function requireAdmin(request, env) {
  const session = await getSession(request, env);
  if (!session) return { ok: false, res: json({ error: "Sign in required" }, 401) };
  if (!isAdminEmail(env, session.email)) return { ok: false, res: json({ error: "Not authorized" }, 403) };
  return { ok: true, session };
}

export async function handleAdminMe(request, env) {
  const session = await getSession(request, env);
  const isAdmin = !!session && isAdminEmail(env, session.email);
  return json({ loggedIn: !!session, isAdmin });
}

export async function handleAdminListGuideRequests(request, env) {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  const list = await env.GUIDE_REQUESTS.list();
  const items = await Promise.all(list.keys.map(async k => {
    const raw = await env.GUIDE_REQUESTS.get(k.name);
    if (!raw) return null;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    return Object.assign({ key: k.name }, data);
  }));

  const requests = items.filter(Boolean).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  return json({ requests });
}

export async function handleAdminDeleteGuideRequest(request, env) {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("req:")) return json({ error: "Invalid key" }, 400);

  await env.GUIDE_REQUESTS.delete(key);
  return json({ ok: true });
}
