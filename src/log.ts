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
