// Outbound requests must never hang a Worker request: every call gets a deadline. A slow third party then fails fast and the
// caller's existing error handling runs, instead of the student staring at a spinner.
export const OUTBOUND_TIMEOUT_MS = 8000;

export function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}, ms = OUTBOUND_TIMEOUT_MS): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(ms) });
}
