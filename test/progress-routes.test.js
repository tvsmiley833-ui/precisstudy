import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGetProgress, handlePostProgress, handlePostGoal } from "../src/progress-routes.js";

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
    _store: store
  };
}

async function sessionCookieFor(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

function req(url, cookie, method, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  return new Request(url, { method: method || "GET", headers, body: body ? JSON.stringify(body) : undefined });
}

describe("handleGetProgress", () => {
  it("401s with no session", async () => {
    const res = await handleGetProgress(req("https://example.com/api/progress"), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("returns an empty default shape for a student with no saved progress", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleGetProgress(req("https://example.com/api/progress", cookie), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      geometry: { mastery: {}, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      algebra1: { mastery: {}, examples: {}, cardsKnown: [] },
      algebra2: { mastery: {}, examples: {}, cardsKnown: [] },
      aplang: { mastery: {}, examples: {}, cardsKnown: [] },
      globalhistory: { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: null
    });
  });

  it("returns saved progress for a returning student", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const saved = {
      geometry: { mastery: { "1": { correct: 3, total: 4 } }, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      algebra1: { mastery: {}, examples: {}, cardsKnown: [] },
      algebra2: { mastery: {}, examples: {}, cardsKnown: [] },
      aplang: { mastery: {}, examples: {}, cardsKnown: [] },
      globalhistory: { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: "2026-08-14T00:00:00.000Z"
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(saved) });
    const res = await handleGetProgress(req("https://example.com/api/progress", cookie), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data).toEqual(saved);
  });
});

describe("handlePostProgress", () => {
  it("401s with no session", async () => {
    const res = await handlePostProgress(req("https://example.com/api/progress", null, "POST", { subject: "geometry", mastery: {}, examples: {}, cardsKnown: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects a missing or invalid subject", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", { subject: "biology", mastery: {}, examples: {}, cardsKnown: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const badReq = new Request("https://example.com/api/progress", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "not json" });
    const res = await handlePostProgress(badReq, { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("saves progress for a subject and preserves the other subject's existing data", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = {
      geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      updatedAt: "2026-08-01T00:00:00.000Z"
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const body = { subject: "chemistry", mastery: { "3": { correct: 2, total: 2 } }, examples: { "1": true }, cardsKnown: ["c1"] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
    expect(saved.chemistry).toEqual({ mastery: { "3": { correct: 2, total: 2 } }, examples: { "1": true }, cardsKnown: ["c1"] });
    expect(typeof saved.updatedAt).toBe("string");
  });

  it("creates a fresh blob for a student's first-ever save", async () => {
    const cookie = await sessionCookieFor("newstudent@example.com");
    const kv = fakeKV();
    const body = { subject: "geometry", mastery: { "1": { correct: 2, total: 2 } }, examples: {}, cardsKnown: [] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:newstudent@example.com"));
    expect(saved.geometry.mastery).toEqual({ "1": { correct: 2, total: 2 } });
    expect(saved.chemistry).toEqual({ mastery: {}, examples: {}, cardsKnown: [] });
  });
});

describe("handlePostGoal", () => {
  it("401s with no session", async () => {
    const res = await handlePostGoal(req("https://example.com/api/goal", null, "POST", { days: 14, minutesPerDay: 30 }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const badReq = new Request("https://example.com/api/goal", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "not json" });
    const res = await handlePostGoal(badReq, { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("rejects non-positive days or minutesPerDay", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res1 = await handlePostGoal(req("https://example.com/api/goal", cookie, "POST", { days: 0, minutesPerDay: 30 }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res1.status).toBe(400);
    const res2 = await handlePostGoal(req("https://example.com/api/goal", cookie, "POST", { days: 14, minutesPerDay: -5 }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res2.status).toBe(400);
  });

  it("saves a goal and preserves existing subject progress", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = {
      geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: "2026-08-01T00:00:00.000Z"
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostGoal(req("https://example.com/api/goal", cookie, "POST", { days: 14, minutesPerDay: 30 }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.goal.days).toBe(14);
    expect(data.goal.minutesPerDay).toBe(30);

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
    expect(saved.goal.days).toBe(14);
    expect(saved.goal.minutesPerDay).toBe(30);
    expect(typeof saved.goal.savedAt).toBe("string");
  });
});
