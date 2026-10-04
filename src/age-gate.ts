// Age gate: PrecisStudy accounts are for students 13 and older (COPPA). Before anyone can start a sign-in we ask for the month
// and year of birth. Nothing about the birth date is stored on our side: the answer becomes one signed, HttpOnly cookie that
// says only "old enough" or "not old enough" for that browser. Guides, flashcards, quizzes and the AI helper work without an
// account, so a visitor under 13 loses nothing except the ability to create one.
import { getCookie, signSession, verifySession } from "./auth.js";
import { json } from "./http.js";

export const AGE_COOKIE = "ss_age";
export const MIN_AGE = 13;
const COOKIE_TTL = 365 * 24 * 3600;

export type AgeStatus = "ok" | "under" | "unknown";

/** Month is 1-12. The person counts as born on the LAST day of that month, so a borderline answer is never wrongly let through. */
export function isOldEnough(month: number, year: number, now: Date = new Date()): boolean {
  const birthdayLastDay = Date.UTC(year + MIN_AGE, month, 0); // day 0 of the next month = last day of `month`
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return today >= birthdayLastDay;
}

export function validBirth(month: unknown, year: unknown, now: Date = new Date()): { month: number; year: number } | null {
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null;
  const m = month as number, y = year as number;
  if (m < 1 || m > 12) return null;
  const thisYear = now.getUTCFullYear();
  if (y < thisYear - 100 || y > thisYear) return null;
  if (Date.UTC(y, m - 1, 1) > now.getTime()) return null; // born in the future
  return { month: m, year: y };
}

function cookieHeader(value: string): string {
  return `${AGE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_TTL}`;
}

export async function ageStatus(request: Request, env: { SESSION_SECRET?: string }): Promise<AgeStatus> {
  const raw = getCookie(request, AGE_COOKIE);
  if (!raw || !env.SESSION_SECRET) return "unknown";
  const payload = await verifySession(raw, env.SESSION_SECRET);
  if (!payload || (payload as unknown as Record<string, unknown>).purpose !== "age") return "unknown";
  return (payload as unknown as Record<string, unknown>).ok === true ? "ok" : "under";
}

/** POST /api/age { month, year } -> { allowed }. Once a browser has answered "under", the answer can't be changed here. */
export async function handleAgePost(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET) return json({ error: "Sign-in isn't configured yet" }, 503);
  if ((await ageStatus(request, env)) === "under") return json({ allowed: false });

  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const birth = validBirth(body?.month, body?.year);
  if (!birth) return json({ error: "Choose the month and year you were born." }, 400);

  const allowed = isOldEnough(birth.month, birth.year);
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL;
  const token = await signSession({ purpose: "age", ok: allowed, exp }, env.SESSION_SECRET);
  return new Response(JSON.stringify({ allowed }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookieHeader(token), "Cache-Control": "private, no-store" },
  });
}

const GATED_GET = new Set(["/auth/google/start", "/auth/github/start"]);
const GATED_POST = new Set(["/auth/email/start"]);

/**
 * Called before the sign-in routes. Returns a response to send instead (a redirect to the age page, or a 403 for the email form),
 * or null when the visitor may go on. Callbacks and magic-link confirmation are not gated: they can only follow a start that was.
 */
export async function ageGate(request: Request, env: Env, url: URL): Promise<Response | null> {
  const gatedGet = request.method === "GET" && GATED_GET.has(url.pathname);
  const gatedPost = request.method === "POST" && GATED_POST.has(url.pathname);
  if (!gatedGet && !gatedPost) return null;
  if (!env.SESSION_SECRET) return null; // sign-in itself reports "not configured"

  const status = await ageStatus(request, env);
  if (status === "ok") return null;
  if (gatedPost) return json({ error: "age_required", redirect: "/age/" }, 403);
  if (status === "under") return Response.redirect(`${url.origin}/age/?blocked=1`, 302);
  return Response.redirect(`${url.origin}/age/?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
}
