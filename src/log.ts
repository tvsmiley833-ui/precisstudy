// Structured, single-line JSON error logging.
//
// wrangler.jsonc enables `observability`, so Cloudflare retains console output
// in Workers Logs (queryable in the dashboard, no external service). Emitting
// one JSON object per error makes those logs filterable by `context` and ready
// to forward to Sentry/Datadog/etc. via Logpush later without code changes.
export function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
  const base = err instanceof Error
    ? { message: err.message, name: err.name, stack: err.stack }
    : { message: String(err) };
  console.error(JSON.stringify({
    level: "error",
    context,
    ...base,
    ...extra,
    ts: new Date().toISOString(),
  }));
}

// Structured, single-line JSON info logging -- same shape/venue as logError
// (Workers Logs), but for non-error events (e.g. Core Web Vitals reports)
// where routing them through console.error would mislabel them as errors.
export function logInfo(context: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({
    level: "info",
    context,
    ...extra,
    ts: new Date().toISOString(),
  }));
}
