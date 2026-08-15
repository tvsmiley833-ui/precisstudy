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

  const list = await env.GUIDE_REQUESTS.list({ prefix: "req:" });
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

export async function handleAdminStats(request, env) {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res;
  if (!env.PROGRESS) return json({ error: "Stats aren't configured yet" }, 503);

  const stats = { totalHumans: 0, logins: {}, humansByProvider: {} };
  let cursor;
  for (;;) {
    const list = await env.PROGRESS.list({ prefix: "login:", cursor });
    for (const k of list.keys) {
      if (!k.name.startsWith("login:")) continue;
      const raw = await env.PROGRESS.get(k.name);
      if (!raw) continue;
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      stats.totalHumans += 1;
      const providers = (data && data.providers) || {};
      for (const [p, count] of Object.entries(providers)) {
        if (!(count > 0)) continue;
        stats.logins[p] = (stats.logins[p] || 0) + count;
        stats.humansByProvider[p] = (stats.humansByProvider[p] || 0) + 1;
      }
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }

  return json(stats);
}

export async function handleAdminDeleteGuideRequest(request, env) {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("req:")) return json({ error: "Invalid key" }, 400);

  const raw = await env.GUIDE_REQUESTS.get(key);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data.files)) {
        await Promise.all(data.files.map(f => (f && f.key ? env.GUIDE_REQUESTS.delete(f.key) : null)));
      }
    } catch (e) {
      // malformed record — still delete the primary key below
    }
  }

  await env.GUIDE_REQUESTS.delete(key);
  return json({ ok: true });
}

export async function handleAdminGetGuideRequestFile(request, env) {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("reqfile:")) return json({ error: "Invalid key" }, 400);

  const obj = await env.GUIDE_REQUESTS.getWithMetadata(key, { type: "arrayBuffer" });
  if (!obj || !obj.value) return json({ error: "File not found" }, 404);

  const meta = obj.metadata || {};
  const filename = String(meta.filename || "attachment").replace(/["\r\n]/g, "");
  const contentType = meta.contentType || "application/octet-stream";

  return new Response(obj.value, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
