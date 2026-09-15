// POST /api/client-log — anonymous client-side error + Core Web Vitals
// intake. No auth (errors happen for signed-out visitors too, and this
// shouldn't leak sign-in state), which makes it a public unauthenticated
// write endpoint -- a real abuse surface. Rate-limited, size-capped, and
// strictly validated before anything reaches the logger.
import { logError, logInfo } from "./log.js";
import { getClientIp } from "./auth.js";

const MAX_BODY_BYTES = 4096;
const MAX_STRING_LEN = 500;
const MAX_VITALS = 10;
const VITAL_NAMES = new Set(["LCP", "CLS", "INP", "TTFB", "FCP"]);

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function clampString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_STRING_LEN);
}

export async function handleClientLogPost(request: Request, env: { CLIENT_LOG_RATE_LIMIT?: RateLimit }): Promise<Response> {
  if (env.CLIENT_LOG_RATE_LIMIT) {
    const { success } = await env.CLIENT_LOG_RATE_LIMIT.limit({ key: "client-log:" + getClientIp(request) });
    if (!success) return json({ error: "Too many requests" }, 429);
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return json({ error: "Body too large" }, 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch (e) {
    return json({ error: "Invalid body" }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Body too large" }, 413);

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);

  const record = body as Record<string, unknown>;
  const kind = record.kind;
  const url = clampString(record.url) || "";

  if (kind === "error") {
    const message = clampString(record.message);
    if (!message) return json({ error: "Missing message" }, 400);
    const stack = clampString(record.stack);
    const line = typeof record.line === "number" && Number.isFinite(record.line) ? record.line : undefined;
    const col = typeof record.col === "number" && Number.isFinite(record.col) ? record.col : undefined;
    logError("client-error", new Error(message), { stack, url, line, col });
    return json({ ok: true });
  }

  if (kind === "vitals") {
    const rawMetrics = Array.isArray(record.metrics) ? record.metrics.slice(0, MAX_VITALS) : [];
    const metrics = rawMetrics
      .filter((m): m is { name: unknown; value: unknown } => !!m && typeof m === "object")
      .map(m => ({ name: (m as Record<string, unknown>).name, value: (m as Record<string, unknown>).value }))
      .filter(m => typeof m.name === "string" && VITAL_NAMES.has(m.name) && typeof m.value === "number" && Number.isFinite(m.value));
    if (!metrics.length) return json({ error: "No valid metrics" }, 400);
    logInfo("client-vitals", { url, metrics });
    return json({ ok: true });
  }

  return json({ error: "Invalid kind" }, 400);
}
