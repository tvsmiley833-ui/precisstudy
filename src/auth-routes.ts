import {
  signSession,
  verifySession,
  issueSessionCookie,
  clearSessionCookie,
  getSession,
  getCookie,
  createMagicLinkToken,
  consumeMagicLinkToken,
  isValidEmail,
  recordLogin,
  checkEmailRateLimit
} from "./auth.js";

const SITE_ORIGIN = "https://precisstudy.com";
const STATE_TTL = 60 * 10; // 10 minutes
const STATE_COOKIE = "ss_oauth_state";

type ExtraHeaders = Record<string, string | string[]>;

function json(body: unknown, status?: number, extraHeaders?: ExtraHeaders): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(extraHeaders || {})) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

function redirect(location: string, extraHeaders?: ExtraHeaders): Response {
  const headers = new Headers({ Location: location });
  for (const [key, value] of Object.entries(extraHeaders || {})) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return new Response(null, { status: 302, headers });
}

function stateCookie(state: string): string {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL}`;
}

function clearStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function authErrorRedirect(): Response {
  return redirect(SITE_ORIGIN + "/?auth_error=1", { "Set-Cookie": clearStateCookie() });
}

async function makeState(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signSession({ purpose: "oauth_state", exp: now + STATE_TTL }, env.SESSION_SECRET);
}

async function checkState(env: Env, request: Request, state: string): Promise<boolean> {
  if (!state) return false;
  const cookieState = getCookie(request, STATE_COOKIE);
  if (!cookieState || cookieState !== state) return false;
  const payload = await verifySession(state, env.SESSION_SECRET);
  return !!(payload && payload.purpose === "oauth_state");
}

// The Worker serves several custom domains (studystacks.org, precisstudy.com,
// and their www variants), but the OAuth state cookie is host-only and
// redirect_uri is fixed to SITE_ORIGIN -- if /start ran on a different
// domain than SITE_ORIGIN, the cookie it sets would never reach the
// callback on SITE_ORIGIN. Bouncing through SITE_ORIGIN before the cookie
// is set keeps every domain's "Sign In" link working, no matter where it's
// clicked from.
function canonicalizeOrigin(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.origin === SITE_ORIGIN) return null;
  return redirect(SITE_ORIGIN + url.pathname + url.search);
}

function notConfigured(provider: string): Response {
  return json({ error: provider + " sign-in isn't configured yet" }, 503);
}

function sessionSecretMissing(env: Env): boolean {
  return !env.SESSION_SECRET;
}

// ===== Google =====

export async function handleGoogleStart(request: Request, env: Env): Promise<Response> {
  const bounce = canonicalizeOrigin(request);
  if (bounce) return bounce;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return notConfigured("Google");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const state = await makeState(env);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: SITE_ORIGIN + "/auth/google/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });
  return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(), { "Set-Cookie": stateCookie(state) });
}

export async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return notConfigured("Google");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await checkState(env, request, state))) {
    return authErrorRedirect();
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: SITE_ORIGIN + "/auth/google/callback",
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) return authErrorRedirect();
  const tokenData: any = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + String(tokenData?.access_token) }
  });
  if (!profileRes.ok) return authErrorRedirect();
  const profile: any = await profileRes.json();
  if (!profile.email) return authErrorRedirect();

  const cookie = await issueSessionCookie(env, {
    email: profile.email,
    name: profile.name,
    provider: "google"
  });
  const isNewUser = await recordLogin(env, profile.email, "google");
  return redirect(SITE_ORIGIN + (isNewUser ? "/settings?welcome=1" : "/"), { "Set-Cookie": [cookie, clearStateCookie()] });
}

// ===== GitHub =====

export async function handleGithubStart(request: Request, env: Env): Promise<Response> {
  const bounce = canonicalizeOrigin(request);
  if (bounce) return bounce;
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return notConfigured("GitHub");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const state = await makeState(env);
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: SITE_ORIGIN + "/auth/github/callback",
    scope: "read:user user:email",
    state
  });
  return redirect("https://github.com/login/oauth/authorize?" + params.toString(), { "Set-Cookie": stateCookie(state) });
}

export async function handleGithubCallback(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return notConfigured("GitHub");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await checkState(env, request, state))) {
    return authErrorRedirect();
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: SITE_ORIGIN + "/auth/github/callback"
    })
  });
  if (!tokenRes.ok) return authErrorRedirect();
  const tokenData: any = await tokenRes.json();
  if (!tokenData?.access_token) return authErrorRedirect();

  const ghHeaders = {
    Authorization: "Bearer " + tokenData.access_token,
    "User-Agent": "studystacks-app",
    Accept: "application/vnd.github+json"
  };
  const profileRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
  if (!profileRes.ok) return authErrorRedirect();
  const profile: any = await profileRes.json();

  let email: string | undefined = typeof profile.email === "string" ? profile.email : undefined;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
    if (emailsRes.ok) {
      const emails: any = await emailsRes.json();
      const list = Array.isArray(emails) ? emails : [];
      const primary = list.find((e: any) => e.primary && e.verified && typeof e.email === "string") || list.find((e: any) => e.verified && typeof e.email === "string");
      if (primary) email = primary.email;
    }
  }
  if (!email) {
    console.error("github callback: no verified email available for this GitHub account");
    return authErrorRedirect();
  }

  const cookie = await issueSessionCookie(env, {
    email,
    name: profile.name || profile.login,
    provider: "github"
  });
  const isNewUser = await recordLogin(env, email, "github");
  return redirect(SITE_ORIGIN + (isNewUser ? "/settings?welcome=1" : "/"), { "Set-Cookie": [cookie, clearStateCookie()] });
}

// ===== Email magic link =====

export async function handleEmailStart(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  if (!isValidEmail(email)) return json({ error: "Enter a valid email address" }, 400);
  if (!env.MAGIC_LINKS) return json({ error: "Email sign-in isn't configured yet" }, 503);
  if (sessionSecretMissing(env)) return json({ error: "Sign-in isn't configured yet" }, 503);

  const withinLimit = await checkEmailRateLimit(env, email!);
  if (!withinLimit) return json({ error: "Too many sign-in requests for this email — try again in a few minutes" }, 429);

  const token = await createMagicLinkToken(env, email!);
  const link = SITE_ORIGIN + "/auth/verify?token=" + encodeURIComponent(token);

  try {
    await sendMagicLinkEmail(env, email!, link);
  } catch (e) {
    return json({ error: "Couldn't send the email — try again in a moment" }, 502);
  }
  return json({ ok: true });
}

async function sendMagicLinkEmail(env: Env, toEmail: string, link: string): Promise<void> {
  if (!env.EMAIL) throw new Error("EMAIL binding is not configured");
  const text = "Click to sign in to PrecisStudy:\n\n" + link
    + "\n\nThis link expires in 15 minutes. If you didn't request this, you can ignore this email.";
  const html = "<p>Click to sign in to PrecisStudy:</p><p><a href=\"" + link + "\">" + link + "</a></p>"
    + "<p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>";
  await env.EMAIL.send({
    to: toEmail,
    from: "login@precisstudy.com",
    subject: "Sign in to PrecisStudy",
    text,
    html
  });
}

export async function handleVerify(request: Request, env: Env): Promise<Response> {
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = token ? await consumeMagicLinkToken(env, token) : null;
  if (!email) return redirect(SITE_ORIGIN + "/?auth_error=expired");

  const cookie = await issueSessionCookie(env, { email, name: email, provider: "email" });
  const isNewUser = await recordLogin(env, email, "email");
  return redirect(SITE_ORIGIN + (isNewUser ? "/settings?welcome=1" : "/"), { "Set-Cookie": cookie });
}

// ===== Session status / logout =====

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ loggedIn: false }, 200);
  return json({ loggedIn: true, email: session.email, name: session.name, provider: session.provider });
}

export async function handleLogout(): Promise<Response> {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}