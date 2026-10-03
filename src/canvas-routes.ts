import { fetchWithTimeout, json } from "./http.js";
import { getSession } from "./auth.js";
import { getCanvasToken, putCanvasToken, deleteCanvasToken } from "./canvas-token.js";

const MAX_DOMAIN_LEN = 253;
const MAX_TOKEN_LEN = 2000;
// Hostname-shaped: no protocol prefix, no path, no port -- a bare domain
// like "school.instructure.com". Rejecting anything else up front avoids a
// confusing failure later from e.g. a pasted "https://school.instructure.com/"
// silently becoming a malformed API URL.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

// The student's token is sent to this host, so only Canvas's own hosting domains are accepted by default. A school with its
// own domain can be added through CANVAS_EXTRA_DOMAINS (comma-separated suffixes) without a code change.
const CANVAS_HOST_SUFFIXES = [".instructure.com", ".canvaslms.com"];

function isAllowedCanvasHost(domain: string, extra: string | undefined): boolean {
  const d = domain.toLowerCase();
  const suffixes = CANVAS_HOST_SUFFIXES.concat((extra || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
  return suffixes.some(s => { const bare = s.replace(/^\./, ""); return d === bare || d.endsWith("." + bare); });
}

function normalizeCanvasDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");   // protocol
  d = d.split(/[/?#]/)[0] ?? "";                  // path, query, fragment
  d = d.replace(/:\d+$/, "");                     // port
  return d;
}

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
  // Students paste whatever is in the address bar: accept a full URL and keep just the host.
  const domain = typeof rec.domain === "string" ? normalizeCanvasDomain(rec.domain) : rec.domain;
  const apiToken = rec.apiToken;

  if (!isValidDomain(domain)) {
    return json({ error: "Enter your Canvas domain, e.g. yourschool.instructure.com (no https:// or path)" }, 400);
  }
  if (!isAllowedCanvasHost(domain, (env as { CANVAS_EXTRA_DOMAINS?: string }).CANVAS_EXTRA_DOMAINS)) {
    return json({ error: "That doesn't look like a Canvas address. Use your school's instructure.com address, or ask us to add yours." }, 400);
  }
  if (typeof apiToken !== "string" || !apiToken.trim() || apiToken.length > MAX_TOKEN_LEN) {
    return json({ error: "Enter a Canvas access token" }, 400);
  }

  // Verify before saving -- storing an unverified token that silently fails
  // every sync afterward is a worse experience than one extra round-trip
  // here.
  try {
    const probe = await fetchWithTimeout(`https://${domain}/api/v1/users/self`, {
      headers: { Authorization: "Bearer " + apiToken.trim() },
      redirect: "manual" // a redirect would carry the token to another host
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
