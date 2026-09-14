import { getSession } from "./auth.js";
import { getCanvasToken, putCanvasToken, deleteCanvasToken } from "./canvas-token.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

const MAX_DOMAIN_LEN = 253;
const MAX_TOKEN_LEN = 2000;
// Hostname-shaped: no protocol prefix, no path, no port -- a bare domain
// like "school.instructure.com". Rejecting anything else up front avoids a
// confusing failure later from e.g. a pasted "https://school.instructure.com/"
// silently becoming a malformed API URL.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function isValidDomain(domain: unknown): domain is string {
  return typeof domain === "string" && domain.length > 0 && domain.length <= MAX_DOMAIN_LEN && DOMAIN_RE.test(domain);
}

export async function handleCanvasConnect(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const domain = rec.domain;
  const apiToken = rec.apiToken;

  if (!isValidDomain(domain)) {
    return json({ error: "Enter your Canvas domain, e.g. yourschool.instructure.com (no https:// or path)" }, 400);
  }
  if (typeof apiToken !== "string" || !apiToken.trim() || apiToken.length > MAX_TOKEN_LEN) {
    return json({ error: "Enter a Canvas access token" }, 400);
  }

  // Verify before saving -- storing an unverified token that silently fails
  // every sync afterward is a worse experience than one extra round-trip
  // here.
  try {
    const probe = await fetch(`https://${domain}/api/v1/users/self`, {
      headers: { Authorization: "Bearer " + apiToken.trim() }
    });
    if (!probe.ok) {
      return json({ error: "Couldn't verify that Canvas domain and token — check both and try again." }, 400);
    }
  } catch (e) {
    return json({ error: "Couldn't verify that Canvas domain and token — check both and try again." }, 400);
  }

  await putCanvasToken(env, session.email, { domain, apiToken: apiToken.trim(), connectedAt: new Date().toISOString() });
  return json({ ok: true, connected: true, domain });
}

export async function handleCanvasDisconnect(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  await deleteCanvasToken(env, session.email);
  return json({ ok: true });
}

export async function handleCanvasStatus(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  const token = await getCanvasToken(env, session.email);
  return json({ connected: !!token, domain: token?.domain ?? null });
}
