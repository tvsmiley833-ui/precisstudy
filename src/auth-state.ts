import { signSession, verifySession, getCookie } from "./auth.js";

export const SITE_ORIGIN = "https://precisstudy.com";
export const STATE_TTL = 60 * 10; // 10 minutes
const STATE_COOKIE = "ss_oauth_state";
const NEXT_COOKIE = "ss_next";

export function stateCookie(state: string): string {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL}`;
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function makeState(env: { SESSION_SECRET: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signSession({ purpose: "oauth_state", exp: now + STATE_TTL }, env.SESSION_SECRET);
}

export async function checkState(
  env: { SESSION_SECRET: string },
  request: Request,
  state: string
): Promise<boolean> {
  if (!state) return false;
  const cookieState = getCookie(request, STATE_COOKIE);
  if (!cookieState || cookieState !== state) return false;
  const payload = await verifySession(state, env.SESSION_SECRET);
  return !!(payload && payload.purpose === "oauth_state");
}

// A post-flow destination is only accepted if it is a same-origin absolute
// path (no scheme, no protocol-relative "//host", no "\" tricks). Anything
// else falls back to the caller's default, so this can't become an open
// redirect.
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return null;
  if (raw.includes("://") || raw.includes("\n") || raw.includes("\r")) return null;
  return raw.length <= 512 ? raw : null;
}

export function nextCookie(path: string): string {
  return `${NEXT_COOKIE}=${encodeURIComponent(path)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL}`;
}

export function clearNextCookie(): string {
  return `${NEXT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function consumeNext(request: Request): string | null {
  const raw = getCookie(request, NEXT_COOKIE);
  return raw ? safeNext(decodeURIComponent(raw)) : null;
}
