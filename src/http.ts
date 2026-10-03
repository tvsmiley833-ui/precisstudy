// Outbound requests must never hang a Worker request: every call gets a deadline. A slow third party then fails fast and the
// caller's existing error handling runs, instead of the student staring at a spinner.
export const OUTBOUND_TIMEOUT_MS = 8000;

export function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}, ms = OUTBOUND_TIMEOUT_MS): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(ms) });
}

/** JSON response; the one shared copy (extra headers: use new Response directly or the auth/chat variants). */
export function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
