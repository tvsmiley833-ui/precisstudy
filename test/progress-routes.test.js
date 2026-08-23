import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGetProgress, handlePostProgress, handlePostGoal, handlePostEnrolledSubjects, handlePostSchedule, handlePostStreak } from "../src/progress-routes.js";

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
      apbiology: { mastery: {}, examples: {}, cardsKnown: [] },
      apush: { mastery: {}, examples: {}, cardsKnown: [] },
      physics: { mastery: {}, examples: {}, cardsKnown: [] },
      biology: { mastery: {}, examples: {}, cardsKnown: [] },
      precalc: { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: null,
      enrolledSubjects: [],
      pushSubscriptions: [],
      schedule: null,
      streak: null
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
      apbiology: { mastery: {}, examples: {}, cardsKnown: [] },
      apush: { mastery: {}, examples: {}, cardsKnown: [] },
      physics: { mastery: {}, examples: {}, cardsKnown: [] },
      biology: { mastery: {}, examples: {}, cardsKnown: [] },
      precalc: { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: "2026-08-14T00:00:00.000Z",
      enrolledSubjects: ["geometry"],
      pushSubscriptions: [],
      schedule: null,
      streak: null
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
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", { subject: "nonexistent", mastery: {}, examples: {}, cardsKnown: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
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

describe("handlePostEnrolledSubjects", () => {
  it("401s with no session", async () => {
    const res = await handlePostEnrolledSubjects(req("https://example.com/api/enrolled-subjects", null, "POST", { subjects: ["geometry"] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const badReq = new Request("https://example.com/api/enrolled-subjects", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "not json" });
    const res = await handlePostEnrolledSubjects(badReq, { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("saves a valid subset of subjects and preserves existing progress", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = {
      geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      updatedAt: "2026-08-01T00:00:00.000Z"
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostEnrolledSubjects(req("https://example.com/api/enrolled-subjects", cookie, "POST", { subjects: ["geometry", "chemistry"] }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, enrolledSubjects: ["geometry", "chemistry"] });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
    expect(saved.enrolledSubjects).toEqual(["geometry", "chemistry"]);
  });

  it("silently drops unknown subjects and de-duplicates", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostEnrolledSubjects(req("https://example.com/api/enrolled-subjects", cookie, "POST", { subjects: ["geometry", "nonexistent", "geometry", "aplang"] }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enrolledSubjects).toEqual(["geometry", "aplang"]);
  });

  it("treats a missing subjects array as clearing the list", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ enrolledSubjects: ["geometry"] }) });
    const res = await handlePostEnrolledSubjects(req("https://example.com/api/enrolled-subjects", cookie, "POST", {}), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enrolledSubjects).toEqual([]);
  });
});

describe("handlePostSchedule", () => {
  const validBlock = { day: "mon", start: "15:00", end: "16:00", subjectKey: "geometry", subjectLabel: "Geometry" };

  it("401s with no session", async () => {
    const res = await handlePostSchedule(req("https://example.com/api/schedule", null, "POST", { blocks: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const badReq = new Request("https://example.com/api/schedule", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "not json" });
    const res = await handlePostSchedule(badReq, { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("rejects a block with a bad day, time, or unknown subject", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const bad = [
      { ...validBlock, day: "someday" },
      { ...validBlock, start: "9:00" },
      { ...validBlock, end: "25:00" },
      { ...validBlock, subjectKey: "nonexistent" }
    ];
    for (const block of bad) {
      const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks: [block] }), { SESSION_SECRET: SECRET, PROGRESS: kv });
      expect(res.status).toBe(400);
    }
  });

  it("saves blocks with notifications off and no timezone required", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks: [validBlock], notifyEnabled: false }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.schedule.blocks).toEqual([validBlock]);
    expect(data.schedule.notifyEnabled).toBe(false);
    expect(data.schedule.timezone).toBe(null);
  });

  it("requires a valid IANA timezone when notifications are enabled", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks: [validBlock], notifyEnabled: true, timezone: "Not/AZone" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(400);
  });

  it("saves blocks with notifications on and a valid timezone, preserving other progress", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks: [validBlock], notifyEnabled: true, timezone: "America/New_York" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.schedule.notifyEnabled).toBe(true);
    expect(data.schedule.timezone).toBe("America/New_York");

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
  });

  it("rejects more than 50 blocks", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const blocks = Array.from({ length: 51 }, () => validBlock);
    const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(400);
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

describe("handlePostStreak", () => {
  it("401s with no session", async () => {
    const res = await handlePostStreak(req("https://example.com/api/streak", null, "POST", { localDate: "2026-08-15" }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const badReq = new Request("https://example.com/api/streak", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "not json" });
    const res = await handlePostStreak(badReq, { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed or missing localDate", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res1 = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", {}), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res1.status).toBe(400);
    const res2 = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "08/15/2026" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res2.status).toBe(400);
  });

  it("starts a streak at 1 on first-ever activity", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.streak).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-08-15", timezone: null });
    expect(data.changed).toBe(true);
  });

  it("stores a valid timezone alongside a streak-changing update", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15", timezone: "America/New_York" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.streak).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-08-15", timezone: "America/New_York" });
  });

  it("ignores an invalid timezone rather than erroring, falling back to null", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15", timezone: "Not/AZone" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.streak.timezone).toBe(null);
  });

  it("carries forward the previous timezone when a later call omits it", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 3, longest: 5, lastActiveDate: "2026-08-15", timezone: "America/New_York" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-16" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.streak.timezone).toBe("America/New_York");
  });

  it("refreshes the timezone on a same-day call if it changed", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 3, longest: 5, lastActiveDate: "2026-08-15", timezone: "America/New_York" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15", timezone: "America/Los_Angeles" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.changed).toBe(false);
    expect(data.streak).toEqual({ current: 3, longest: 5, lastActiveDate: "2026-08-15", timezone: "America/Los_Angeles" });
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.streak.timezone).toBe("America/Los_Angeles");
  });

  it("is a no-op when called again the same day", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 3, longest: 5, lastActiveDate: "2026-08-15" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.changed).toBe(false);
    expect(data.streak).toEqual(existing.streak);
  });

  it("increments the streak on the very next consecutive day", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 3, longest: 5, lastActiveDate: "2026-08-15" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-16" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.streak).toEqual({ current: 4, longest: 5, lastActiveDate: "2026-08-16", timezone: null });
  });

  it("raises longest when current exceeds the prior record", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 5, longest: 5, lastActiveDate: "2026-08-15" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-16" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.streak).toEqual({ current: 6, longest: 6, lastActiveDate: "2026-08-16", timezone: null });
  });

  it("resets the streak to 1 after a gap of 2+ days", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 8, longest: 8, lastActiveDate: "2026-08-10" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.streak).toEqual({ current: 1, longest: 8, lastActiveDate: "2026-08-15", timezone: null });
  });

  it("ignores a localDate older than what's on record instead of corrupting the streak", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { streak: { current: 8, longest: 8, lastActiveDate: "2026-08-15" } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const res = await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-14" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data.changed).toBe(false);
    expect(data.streak).toEqual(existing.streak);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.streak).toEqual(existing.streak);
  });

  it("preserves existing subject progress when saving a streak", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = {
      geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] },
      streak: null
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    await handlePostStreak(req("https://example.com/api/streak", cookie, "POST", { localDate: "2026-08-15" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
    expect(saved.streak).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-08-15", timezone: null });
  });
});
