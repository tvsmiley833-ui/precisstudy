import {
  signSession,
  verifySession,
  issueSessionCookie,
  clearSessionCookie,
  getSession,
  createMagicLinkToken,
  consumeMagicLinkToken,
  isValidEmail
} from "./auth.js";

const SITE_ORIGIN = "https://studystacks.org";
const STATE_TTL = 60 * 10; // 10 minutes

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders || {})
  });
}

function redirect(location, extraHeaders) {
  return new Response(null, {
    status: 302,
    headers: Object.assign({ Location: location }, extraHeaders || {})
  });
}

async function makeState(env) {
  const now = Math.floor(Date.now() / 1000);
  return signSession({ purpose: "oauth_state", exp: now + STATE_TTL }, env.SESSION_SECRET);
}

async function checkState(env, state) {
  const payload = await verifySession(state, env.SESSION_SECRET);
  return !!(payload && payload.purpose === "oauth_state");
}

function notConfigured(provider) {
  return json({ error: provider + " sign-in isn't configured yet" }, 503);
}

// SESSION_SECRET signs every session cookie and OAuth CSRF state token, so
// every sign-in path (not just OAuth) needs it before touching auth.js.
function sessionSecretMissing(env) {
  return !env.SESSION_SECRET;
}

// ===== Google =====

export async function handleGoogleStart(request, env) {
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
  return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
}

export async function handleGoogleCallback(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return notConfigured("Google");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !(await checkState(env, state))) return redirect(SITE_ORIGIN + "/?auth_error=1");

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
  if (!tokenRes.ok) return redirect(SITE_ORIGIN + "/?auth_error=1");
  const tokenData = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + tokenData.access_token }
  });
  if (!profileRes.ok) return redirect(SITE_ORIGIN + "/?auth_error=1");
  const profile = await profileRes.json();
  if (!profile.email) return redirect(SITE_ORIGIN + "/?auth_error=1");

  const cookie = await issueSessionCookie(env, {
    email: profile.email,
    name: profile.name,
    provider: "google"
  });
  return redirect(SITE_ORIGIN + "/", { "Set-Cookie": cookie });
}

// ===== GitHub =====

export async function handleGithubStart(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return notConfigured("GitHub");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const state = await makeState(env);
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: SITE_ORIGIN + "/auth/github/callback",
    scope: "read:user user:email",
    state
  });
  return redirect("https://github.com/login/oauth/authorize?" + params.toString());
}

export async function handleGithubCallback(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return notConfigured("GitHub");
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !(await checkState(env, state))) return redirect(SITE_ORIGIN + "/?auth_error=1");

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
  if (!tokenRes.ok) return redirect(SITE_ORIGIN + "/?auth_error=1");
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return redirect(SITE_ORIGIN + "/?auth_error=1");

  const ghHeaders = {
    Authorization: "Bearer " + tokenData.access_token,
    "User-Agent": "studystacks-app",
    Accept: "application/vnd.github+json"
  };
  const profileRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
  if (!profileRes.ok) return redirect(SITE_ORIGIN + "/?auth_error=1");
  const profile = await profileRes.json();

  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      const primary = Array.isArray(emails) && (emails.find(e => e.primary && e.verified) || emails.find(e => e.verified));
      if (primary) email = primary.email;
    }
  }
  if (!email) return redirect(SITE_ORIGIN + "/?auth_error=1");

  const cookie = await issueSessionCookie(env, {
    email,
    name: profile.name || profile.login,
    provider: "github"
  });
  return redirect(SITE_ORIGIN + "/", { "Set-Cookie": cookie });
}

// ===== Email magic link =====

export async function handleEmailStart(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const email = body && body.email;
  if (!isValidEmail(email)) return json({ error: "Enter a valid email address" }, 400);
  if (!env.MAGIC_LINKS) return json({ error: "Email sign-in isn't configured yet" }, 503);
  if (sessionSecretMissing(env)) return json({ error: "Sign-in isn't configured yet" }, 503);

  const token = await createMagicLinkToken(env, email);
  const link = SITE_ORIGIN + "/auth/verify?token=" + encodeURIComponent(token);

  try {
    await sendMagicLinkEmail(env, email, link);
  } catch (e) {
    return json({ error: "Couldn't send the email — try again in a moment" }, 502);
  }
  return json({ ok: true });
}

async function sendMagicLinkEmail(env, toEmail, link) {
  if (!env.EMAIL) throw new Error("EMAIL binding is not configured");
  const text = "Click to sign in to StudyStacks:\n\n" + link
    + "\n\nThis link expires in 15 minutes. If you didn't request this, you can ignore this email.";
  const html = "<p>Click to sign in to StudyStacks:</p><p><a href=\"" + link + "\">" + link + "</a></p>"
    + "<p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>";
  await env.EMAIL.send({
    to: toEmail,
    from: "login@studystacks.org",
    subject: "Sign in to StudyStacks",
    text,
    html
  });
}

export async function handleVerify(request, env) {
  if (sessionSecretMissing(env)) return notConfigured("Sign-in");
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = await consumeMagicLinkToken(env, token);
  if (!email) return redirect(SITE_ORIGIN + "/?auth_error=expired");

  const cookie = await issueSessionCookie(env, { email, name: email, provider: "email" });
  return redirect(SITE_ORIGIN + "/", { "Set-Cookie": cookie });
}

// ===== Session status / logout =====

export async function handleMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ loggedIn: false }, 200);
  return json({ loggedIn: true, email: session.email, name: session.name, provider: session.provider });
}

export async function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
