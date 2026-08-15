import { describe, it, expect } from "vitest";
import {
  signSession,
  verifySession,
  issueSessionCookie,
  clearSessionCookie,
  getSessionCookie,
  getSession,
  createMagicLinkToken,
  consumeMagicLinkToken,
  isValidEmail,
  recordLogin,
  SESSION_COOKIE
} from "../src/auth.js";

function fakeKV() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store
  };
}

describe("signSession / verifySession", () => {
  it("round-trips a payload signed and verified with the same secret", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession({ email: "a@b.com", exp: now + 60 }, "secret1");
    const payload = await verifySession(token, "secret1");
    expect(payload).toEqual({ email: "a@b.com", exp: now + 60 });
  });

  it("rejects a token signed with a different secret", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession({ email: "a@b.com", exp: now + 60 }, "secret1");
    const payload = await verifySession(token, "wrong-secret");
    expect(payload).toBeNull();
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession({ email: "a@b.com", exp: now - 10 }, "secret1");
    const payload = await verifySession(token, "secret1");
    expect(payload).toBeNull();
  });

  it("rejects a tampered token body", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession({ email: "a@b.com", exp: now + 60 }, "secret1");
    const [body, sig] = token.split(".");
    const tampered = body + "x." + sig;
    const payload = await verifySession(tampered, "secret1");
    expect(payload).toBeNull();
  });

  it("rejects malformed input", async () => {
    expect(await verifySession(null, "secret1")).toBeNull();
    expect(await verifySession("", "secret1")).toBeNull();
    expect(await verifySession("no-dot-here", "secret1")).toBeNull();
  });
});

describe("session cookie helpers", () => {
  it("issues a cookie containing the signed session and expected attributes", async () => {
    const cookie = await issueSessionCookie(
      { SESSION_SECRET: "secret1" },
      { email: "a@b.com", name: "A", provider: "google" }
    );
    expect(cookie).toContain(SESSION_COOKIE + "=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("clearSessionCookie expires immediately", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("Max-Age=0");
  });

  it("getSessionCookie extracts the token from a Cookie header among others", () => {
    const request = new Request("https://example.com", {
      headers: { Cookie: "foo=bar; " + SESSION_COOKIE + "=abc123; baz=qux" }
    });
    expect(getSessionCookie(request)).toBe("abc123");
  });

  it("getSessionCookie returns null when the cookie is absent", () => {
    const request = new Request("https://example.com");
    expect(getSessionCookie(request)).toBeNull();
  });

  it("getSession returns the verified payload for a request carrying a valid cookie", async () => {
    const env = { SESSION_SECRET: "secret1" };
    const cookie = await issueSessionCookie(env, { email: "a@b.com", name: "A", provider: "google" });
    const token = cookie.split(";")[0].split("=")[1];
    const request = new Request("https://example.com", { headers: { Cookie: SESSION_COOKIE + "=" + token } });
    const session = await getSession(request, env);
    expect(session.email).toBe("a@b.com");
    expect(session.provider).toBe("google");
  });

  it("getSession returns null when there is no cookie", async () => {
    const request = new Request("https://example.com");
    const session = await getSession(request, { SESSION_SECRET: "secret1" });
    expect(session).toBeNull();
  });
});

describe("magic link tokens", () => {
  it("creates a token that consumeMagicLinkToken resolves back to the email, once", async () => {
    const env = { MAGIC_LINKS: fakeKV() };
    const token = await createMagicLinkToken(env, "student@school.edu");
    const email = await consumeMagicLinkToken(env, token);
    expect(email).toBe("student@school.edu");
    // one-time use: consuming again must fail
    const second = await consumeMagicLinkToken(env, token);
    expect(second).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const env = { MAGIC_LINKS: fakeKV() };
    const email = await consumeMagicLinkToken(env, "not-a-real-token");
    expect(email).toBeNull();
  });

  it("returns null for a missing token", async () => {
    const env = { MAGIC_LINKS: fakeKV() };
    expect(await consumeMagicLinkToken(env, null)).toBeNull();
    expect(await consumeMagicLinkToken(env, "")).toBeNull();
  });

  it("rejects an expired stored token", async () => {
    const env = { MAGIC_LINKS: fakeKV() };
    const now = Math.floor(Date.now() / 1000);
    await env.MAGIC_LINKS.put("expired-token", JSON.stringify({ email: "a@b.com", exp: now - 10 }));
    const email = await consumeMagicLinkToken(env, "expired-token");
    expect(email).toBeNull();
  });
});

describe("recordLogin", () => {
  it("creates a new login record on first login", async () => {
    const env = { PROGRESS: fakeKV() };
    await recordLogin(env, "Student@School.edu", "google");
    const saved = JSON.parse(env.PROGRESS._store.get("login:student@school.edu"));
    expect(saved.providers).toEqual({ google: 1 });
    expect(saved.loginCount).toBe(1);
    expect(saved.lastProvider).toBe("google");
    expect(typeof saved.firstLoginAt).toBe("string");
  });

  it("increments counts across repeated and mixed-provider logins", async () => {
    const env = { PROGRESS: fakeKV() };
    await recordLogin(env, "student@school.edu", "google");
    await recordLogin(env, "student@school.edu", "google");
    await recordLogin(env, "student@school.edu", "github");
    const saved = JSON.parse(env.PROGRESS._store.get("login:student@school.edu"));
    expect(saved.providers).toEqual({ google: 2, github: 1 });
    expect(saved.loginCount).toBe(3);
    expect(saved.lastProvider).toBe("github");
  });

  it("does nothing without a PROGRESS binding or email", async () => {
    await recordLogin({}, "a@b.com", "google");
    const env = { PROGRESS: fakeKV() };
    await recordLogin(env, null, "google");
    expect(env.PROGRESS._store.size).toBe(0);
  });

  it("returns true for a first-ever login and false for every login after", async () => {
    const env = { PROGRESS: fakeKV() };
    expect(await recordLogin(env, "student@school.edu", "google")).toBe(true);
    expect(await recordLogin(env, "student@school.edu", "google")).toBe(false);
    expect(await recordLogin(env, "student@school.edu", "github")).toBe(false);
  });

  it("returns false when there's no PROGRESS binding or email to persist", async () => {
    expect(await recordLogin({}, "a@b.com", "google")).toBe(false);
    expect(await recordLogin({ PROGRESS: fakeKV() }, null, "google")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("student@school.edu")).toBe(true);
    expect(isValidEmail("a.b+c@sub.example.com")).toBe(true);
  });

  it("rejects malformed or non-string input", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a".repeat(260) + "@b.com")).toBe(false);
  });
});
