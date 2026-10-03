// Shared abuse limits: strongly consistent native rate limits, daily quotas for the routes that cost money (Workers AI),
// and a cheap request-size check that runs before a body is buffered.
//
// The older KV-based limiter in auth.ts is eventually consistent, so a fast burst can slip past it. The native limiter
// (wrangler.jsonc "ratelimits") is consistent within a data centre; every helper here treats a missing binding as
// "allowed" so local runs and tests without the bindings keep working.

/** True when the request is allowed. */
export async function allowedBy(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (e) {
    return true; // never lock everyone out because the limiter itself failed
  }
}

/** UTC calendar day, used to scope daily counters. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Counts one use against a daily quota stored in KV and returns whether it was within the cap. KV is eventually
 * consistent, so this is a cost ceiling, not an exact meter: fine for "at most ~N AI jobs per person per day".
 */
export async function withinDailyQuota(kv: KVNamespace | undefined, key: string, max: number): Promise<boolean> {
  if (!kv) return true;
  try {
    const full = `${key}:${utcDay()}`;
    const used = parseInt((await kv.get(full)) ?? "0", 10) || 0;
    if (used >= max) return false;
    await kv.put(full, String(used + 1), { expirationTtl: 2 * 24 * 60 * 60 });
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * True when the declared Content-Length is over the limit. Rejecting here means an oversized upload is refused before
 * request.formData() buffers it. A request with no Content-Length (chunked) can't be judged here; handlers still check
 * the parsed file sizes.
 */
export function declaredTooLarge(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get("Content-Length");
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

const MB = 1024 * 1024;

/** Largest body each state-changing route accepts; anything else under /api is capped at the default. */
export const BODY_LIMITS: Array<[RegExp, number]> = [
  [/^\/api\/request-guide$/, 16 * MB], // up to 3 files, 15 MB total, plus fields
  [/^\/api\/(flashcards\/generate|syllabus\/parse)$/, 8.5 * MB],
  [/^\/api\/progress$/, 1 * MB],
];
export const DEFAULT_BODY_LIMIT = 256 * 1024;

export function bodyLimitFor(pathname: string): number {
  for (const [re, max] of BODY_LIMITS) if (re.test(pathname)) return max;
  return DEFAULT_BODY_LIMIT;
}
