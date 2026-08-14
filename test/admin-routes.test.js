import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleAdminMe, handleAdminListGuideRequests, handleAdminDeleteGuideRequest, handleAdminStats } from "../src/admin-routes.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
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
    async list() {
      return { keys: [...store.keys()].map(name => ({ name })) };
    },
    _store: store
  };
}

async function sessionCookieFor(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

function req(url, cookie, method) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(url, { method: method || "GET", headers });
}

describe("/api/admin/me", () => {
  it("reports not logged in with no cookie", async () => {
    const res = await handleAdminMe(req("https://example.com/api/admin/me"), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ loggedIn: false, isAdmin: false });
  });

  it("reports logged in but not admin for a non-admin session", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleAdminMe(req("https://example.com/api/admin/me", cookie), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(await res.json()).toEqual({ loggedIn: true, isAdmin: false });
  });

  it("reports isAdmin true for an allowed email, case-insensitively", async () => {
    const cookie = await sessionCookieFor("Admin@Example.com");
    const res = await handleAdminMe(req("https://example.com/api/admin/me", cookie), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(await res.json()).toEqual({ loggedIn: true, isAdmin: true });
  });
});

describe("handleAdminListGuideRequests", () => {
  it("401s with no session", async () => {
    const res = await handleAdminListGuideRequests(req("https://example.com/api/admin/guide-requests"), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(res.status).toBe(401);
  });

  it("403s for a logged-in non-admin", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleAdminListGuideRequests(req("https://example.com/api/admin/guide-requests", cookie), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(res.status).toBe(403);
  });

  it("lists requests newest-first for an admin", async () => {
    const kv = fakeKV({
      "req:1:aaa": JSON.stringify({ className: "Old One", notes: "", email: "", submittedAt: "2026-01-01T00:00:00.000Z" }),
      "req:2:bbb": JSON.stringify({ className: "New One", notes: "", email: "", submittedAt: "2026-02-01T00:00:00.000Z" })
    });
    const cookie = await sessionCookieFor("admin@example.com");
    const res = await handleAdminListGuideRequests(req("https://example.com/api/admin/guide-requests", cookie), {
      SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com", GUIDE_REQUESTS: kv
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requests.map(r => r.className)).toEqual(["New One", "Old One"]);
  });
});

describe("handleAdminStats", () => {
  it("401s with no session", async () => {
    const res = await handleAdminStats(req("https://example.com/api/admin/stats"), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(res.status).toBe(401);
  });

  it("403s for a logged-in non-admin", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleAdminStats(req("https://example.com/api/admin/stats", cookie), { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" });
    expect(res.status).toBe(403);
  });

  it("aggregates login records by provider, ignoring unrelated keys", async () => {
    const kv = fakeKV({
      "login:a@example.com": JSON.stringify({ providers: { google: 3 }, loginCount: 3 }),
      "login:b@example.com": JSON.stringify({ providers: { github: 1, google: 1 }, loginCount: 2 }),
      "login:c@example.com": JSON.stringify({ providers: { email: 5 }, loginCount: 5 }),
      "progress:a@example.com": JSON.stringify({ geometry: {} })
    });
    const cookie = await sessionCookieFor("admin@example.com");
    const res = await handleAdminStats(req("https://example.com/api/admin/stats", cookie), {
      SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com", PROGRESS: kv
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalHumans).toBe(3);
    expect(data.logins).toEqual({ google: 4, github: 1, email: 5 });
    expect(data.humansByProvider).toEqual({ google: 2, github: 1, email: 1 });
  });

  it("returns zeroed stats when there are no logins yet", async () => {
    const cookie = await sessionCookieFor("admin@example.com");
    const res = await handleAdminStats(req("https://example.com/api/admin/stats", cookie), {
      SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com", PROGRESS: fakeKV()
    });
    const data = await res.json();
    expect(data).toEqual({ totalHumans: 0, logins: {}, humansByProvider: {} });
  });
});

describe("handleAdminDeleteGuideRequest", () => {
  it("403s for a non-admin", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleAdminDeleteGuideRequest(
      req("https://example.com/api/admin/guide-requests?key=req:1:aaa", cookie, "DELETE"),
      { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com" }
    );
    expect(res.status).toBe(403);
  });

  it("rejects a key that doesn't look like a guide request", async () => {
    const cookie = await sessionCookieFor("admin@example.com");
    const res = await handleAdminDeleteGuideRequest(
      req("https://example.com/api/admin/guide-requests?key=not-a-req-key", cookie, "DELETE"),
      { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com", GUIDE_REQUESTS: fakeKV() }
    );
    expect(res.status).toBe(400);
  });

  it("deletes an existing request for an admin", async () => {
    const kv = fakeKV({ "req:1:aaa": JSON.stringify({ className: "X", submittedAt: "2026-01-01T00:00:00.000Z" }) });
    const cookie = await sessionCookieFor("admin@example.com");
    const res = await handleAdminDeleteGuideRequest(
      req("https://example.com/api/admin/guide-requests?key=req:1:aaa", cookie, "DELETE"),
      { SESSION_SECRET: SECRET, ADMIN_EMAILS: "admin@example.com", GUIDE_REQUESTS: kv }
    );
    expect(res.status).toBe(200);
    expect(kv._store.has("req:1:aaa")).toBe(false);
  });
});

describe("routing", () => {
  it("returns 401 for GET /api/admin/guide-requests with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/guide-requests");
    expect(res.status).toBe(401);
  });

  it("returns 405 for POST /api/admin/guide-requests", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/guide-requests", { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("returns 405 for POST /api/admin/me", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/me", { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("returns 401 for GET /api/admin/stats with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/stats");
    expect(res.status).toBe(401);
  });

  it("returns 405 for POST /api/admin/stats", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/stats", { method: "POST" });
    expect(res.status).toBe(405);
  });
});
