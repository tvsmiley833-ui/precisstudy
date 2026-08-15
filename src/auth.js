const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL = 60 * 15; // 15 minutes
export const SESSION_COOKIE = "ss_session";

function toBase64Url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload, secret) {
  if (!secret) throw new Error("signSession: missing signing secret");
  const key = await hmacKey(secret);
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const sig = toBase64Url(new Uint8Array(sigBuf));
  return `${body}.${sig}`;
}

export async function verifySession(token, secret) {
  if (!secret) return null;
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let sigBytes;
  try {
    sigBytes = fromBase64Url(sig);
  } catch (e) {
    return null;
  }
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(body));
  if (!valid) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function issueSessionCookie(env, profile) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    email: profile.email,
    name: profile.name || profile.email,
    provider: profile.provider,
    iat: now,
    exp: now + SESSION_MAX_AGE
  };
  const token = await signSession(payload, env.SESSION_SECRET);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export function getSessionCookie(request) {
  return getCookie(request, SESSION_COOKIE);
}

export async function getSession(request, env) {
  const token = getSessionCookie(request);
  if (!token) return null;
  return verifySession(token, env.SESSION_SECRET);
}

// Best-effort fixed-window limiter on top of KV (no atomic increment available,
// so a race under heavy concurrent load could let one or two extra requests
// through -- an acceptable tradeoff for blocking sustained abuse, which is the
// actual threat this guards against).
export async function checkRateLimit(kv, key, max, windowSeconds) {
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= max) return false;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

const EMAIL_RATE_LIMIT_MAX = 3;
const EMAIL_RATE_LIMIT_WINDOW = 60 * 15; // 15 minutes

export async function checkEmailRateLimit(env, email) {
  return checkRateLimit(env.MAGIC_LINKS, "ratelimit:email:" + email.toLowerCase(), EMAIL_RATE_LIMIT_MAX, EMAIL_RATE_LIMIT_WINDOW);
}

export function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

export async function createMagicLinkToken(env, email) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = toBase64Url(bytes);
  const now = Math.floor(Date.now() / 1000);
  await env.MAGIC_LINKS.put(token, JSON.stringify({ email, exp: now + MAGIC_LINK_TTL }), {
    expirationTtl: MAGIC_LINK_TTL
  });
  return token;
}

export async function consumeMagicLinkToken(env, token) {
  if (!token) return null;
  const raw = await env.MAGIC_LINKS.get(token);
  if (!raw) return null;
  await env.MAGIC_LINKS.delete(token);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!data || typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data.email;
}

export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function recordLogin(env, email, provider) {
  if (!env.PROGRESS || !email) return false;
  const key = "login:" + String(email).toLowerCase();
  const now = new Date().toISOString();
  let record = null;
  try {
    const raw = await env.PROGRESS.get(key);
    record = raw ? JSON.parse(raw) : null;
  } catch (e) {
    record = null;
  }
  const isNewUser = !record || typeof record !== "object";
  if (isNewUser) {
    record = { providers: {}, firstLoginAt: now, loginCount: 0 };
  }
  record.providers = record.providers || {};
  record.providers[provider] = (record.providers[provider] || 0) + 1;
  record.loginCount = (record.loginCount || 0) + 1;
  record.lastLoginAt = now;
  record.lastProvider = provider;
  await env.PROGRESS.put(key, JSON.stringify(record));
  return isNewUser;
}
