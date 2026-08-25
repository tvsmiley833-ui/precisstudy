import { getSession } from "./auth.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function isAdminEmail(env: Env, email: string | undefined): boolean {
  if (!email || !env.ADMIN_EMAILS) return false;
  const allowed = env.ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(email).toLowerCase());
}

async function requireAdmin(request: Request, env: Env): Promise<{ ok: boolean; session?: { email: string; name: string; provider: string }; res?: Response }> {
  const session = await getSession(request, env);
  if (!session) return { ok: false, res: json({ error: "Sign in required" }, 401) };
  if (!isAdminEmail(env, session.email)) return { ok: false, res: json({ error: "Not authorized" }, 403) };
  return { ok: true, session };
}

export async function handleAdminMe(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ admin: false, loggedIn: false }, 200);
  const admin = isAdminEmail(env, session.email);
  return json({ admin, loggedIn: true, email: session.email, name: session.name });
}

export async function handleAdminListGuideRequests(request: Request, env: Env): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res!;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  let cursor: string | undefined;
  const requests: Array<Record<string, unknown>> = [];

  do {
    const list = await env.GUIDE_REQUESTS.list({ prefix: "req:", cursor });
    for (const key of list.keys) {
      const raw = await env.GUIDE_REQUESTS.get(key.name);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        requests.push({ id: key.name.slice(4), ...data });
      } catch (e) {
        continue;
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  requests.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return json({ requests });
}

export async function handleAdminDeleteGuideRequest(request: Request, env: Env): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res!;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("req:")) return json({ error: "Invalid key" }, 400);

  await env.GUIDE_REQUESTS.delete(key);
  return json({ ok: true });
}

export async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res!;
  if (!env.PROGRESS) return json({ error: "Stats aren't configured yet" }, 503);

  let cursor: string | undefined;
  let totalUsers = 0;
  let totalProgress = 0;

  do {
    const list = await env.PROGRESS.list({ prefix: "progress:", cursor });
    for (const key of list.keys) {
      totalUsers++;
      const raw = await env.PROGRESS.get(key.name);
      if (raw) totalProgress++;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return json({ totalUsers, totalProgress });
}

export async function handleAdminGetGuideRequestFile(request: Request, env: Env): Promise<Response> {
  const gate = await requireAdmin(request, env);
  if (!gate.ok) return gate.res!;
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("reqfile:")) return json({ error: "Invalid key" }, 400);

  const obj = await env.GUIDE_REQUESTS.getWithMetadata(key, { type: "arrayBuffer" });
  if (!obj || !obj.value) return json({ error: "File not found" }, 404);

  const meta = (obj.metadata ?? {}) as Record<string, unknown>;
  const filename = String(meta.filename || "attachment").replace(/["\\\r\n]/g, "");
  const contentType = String(meta.contentType || "application/octet-stream");

  return new Response(obj.value, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}