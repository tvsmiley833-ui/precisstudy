import { getSession } from "./auth.js";
import {
  SITE_ORIGIN, makeState, checkState, stateCookie, clearStateCookie,
  safeNext, nextCookie, clearNextCookie, consumeNext
} from "./auth-state.js";
import { putGoogleToken, type GoogleTokenRecord } from "./google-token.js";

export const CONNECT_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];

export const CONNECT_REDIRECT_URI = SITE_ORIGIN + "/auth/google/connect/callback";

function redirect(location: string, cookies?: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const c of cookies || []) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function settings(flag: "connected" | "error" | "norefresh", cookies?: string[]): Response {
  return redirect(SITE_ORIGIN + "/settings?google=" + flag, cookies);
}

function notConfigured(): Response {
  return new Response(JSON.stringify({ error: "Google connect isn't configured yet" }), {
    status: 503,
    headers: { "Content-Type": "application/json" }
  });
}

export async function handleGoogleConnectStart(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return settings("error");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) return notConfigured();

  const state = await makeState(env);
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: CONNECT_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: CONNECT_SCOPES.join(" "),
    state
  });
  const cookies = next ? [stateCookie(state), nextCookie(next)] : [stateCookie(state)];
  return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(), cookies);
}

export async function handleGoogleConnectCallback(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return settings("error", [clearStateCookie(), clearNextCookie()]);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) return notConfigured();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await checkState(env, request, state))) {
    return settings("error", [clearStateCookie(), clearNextCookie()]);
  }

  let tokenData: any;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: CONNECT_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) return settings("error", [clearStateCookie(), clearNextCookie()]);
    tokenData = await tokenRes.json();
  } catch (e) {
    return settings("error", [clearStateCookie(), clearNextCookie()]);
  }

  if (!tokenData || typeof tokenData.refresh_token !== "string" || !tokenData.refresh_token) {
    // User had already granted consent and Google withheld a new refresh token
    // despite prompt=consent. Tell them how to fix it.
    return settings("norefresh", [clearStateCookie(), clearNextCookie()]);
  }

  let googleEmail = "";
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + String(tokenData.access_token) }
    });
    if (infoRes.ok) {
      const info: any = await infoRes.json();
      if (typeof info?.email === "string") googleEmail = info.email;
    }
  } catch (e) {
    // Informational only -- a missing display email must not fail the connect.
  }

  const record: GoogleTokenRecord = {
    refreshToken: tokenData.refresh_token,
    googleEmail,
    scopes: typeof tokenData.scope === "string" ? tokenData.scope.split(" ").filter(Boolean) : [],
    connectedAt: new Date().toISOString()
  };
  await putGoogleToken(env, session.email, record);

  const dest = consumeNext(request) || "/settings";
  const sep = dest.includes("?") ? "&" : "?";
  return redirect(SITE_ORIGIN + dest + sep + "google=connected", [clearStateCookie(), clearNextCookie()]);
}
