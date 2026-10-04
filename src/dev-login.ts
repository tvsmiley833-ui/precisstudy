import { issueSessionCookie } from "./auth.js";
import { putBlob } from "./progress-routes.js";

export const DEV_LOGIN_EMAIL = "dev-tester@precisstudy.test";

/** True only for `wrangler dev` on this machine with DEV_LOGIN=1 in .dev.vars. Both must hold: the flag is never set in production, and Cloudflare never routes "localhost" to the deployed Worker. */
export function devLoginAllowed(env: { DEV_LOGIN?: string }, url: URL): boolean {
  return env.DEV_LOGIN === "1" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

/**
 * GET /auth/dev-login[?seed=1][&next=/path]: signs the local browser in as a fixed test student, so signed-in pages can be
 * checked without a real Google account. `seed=1` also writes two weeks of sample progress. Answers 404 anywhere else.
 */
export async function handleDevLogin(request: Request, env: Env, url: URL): Promise<Response> {
  if (!devLoginAllowed(env as { DEV_LOGIN?: string }, url)) return new Response("Not found", { status: 404 });
  if (url.searchParams.get("seed") === "1" && env.PROGRESS) await putBlob(env, DEV_LOGIN_EMAIL, sampleProgress());
  const cookie = await issueSessionCookie(env, { email: DEV_LOGIN_EMAIL, name: "Dev Tester", provider: "dev" }, request);
  const next = url.searchParams.get("next") || "/dashboard/";
  const dest = /^\/(?![\/\\])/.test(next) ? next : "/dashboard/";
  return new Response(null, { status: 302, headers: { Location: dest, "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}

function sampleProgress(): Record<string, unknown> {
  const day = (back: number) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
  const history = [];
  let total = 0, xp = 0;
  for (let back = 13; back >= 0; back--) {
    const n = [0, 6, 12, 0, 22, 4, 31, 9, 0, 15, 3, 18, 7, 11][13 - back] ?? 0;
    total += n; xp += n * 10;
    history.push({ date: day(back), subjects: { geometry: Math.min(95, 40 + (13 - back) * 3), chemistry: 55 }, totalAnswered: total, xp });
  }
  return {
    goal: null, updatedAt: new Date().toISOString(), enrolledSubjects: ["geometry", "chemistry", "apbiology"], pushSubscriptions: [], schedule: null,
    streak: { current: 4, longest: 9, lastActiveDate: day(0), timezone: "America/New_York" }, notificationPrefs: null, history,
    geometry: { mastery: { "1": { correct: 9, total: 10 }, "2": { correct: 6, total: 10 }, "3": { correct: 3, total: 8 } }, cardsKnown: ["Point", "Line", "Plane"] },
    chemistry: { mastery: { "1": { correct: 5, total: 9 }, "2": { correct: 6, total: 11 } }, cardsKnown: ["Mole"] }
  };
}
