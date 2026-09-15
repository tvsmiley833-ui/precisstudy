import { SELF } from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGetProgress, handlePostProgress, handlePostGoal, handlePostEnrolledSubjects, handlePostSchedule, handlePostStreak, handlePostNotificationPrefs, recordDailySnapshots, handlePostShareGenerate, handlePostShareRevoke, handleGetShare, handlePostCalendarGenerate, handlePostCalendarRevoke, handleGetCalendarFeed, handlePostInviteGenerate, creditInviteIfAny } from "../src/progress-routes.js";
import { putGoogleToken } from "../src/google-token.js";
import { googleSettingsKey } from "../src/google-routes.js";

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
    async list({ prefix, cursor } = {}) {
      const keys = [...store.keys()]
        .filter(k => !prefix || k.startsWith(prefix))
        .map(name => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
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
      "act-prep": { mastery: {}, examples: {}, cardsKnown: [] },
      anatomy: { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-chemistry": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-csa": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-euro": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-human-geography": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-macro": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-micro": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-physics": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-psych": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-stats": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-usgov": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-world": { mastery: {}, examples: {}, cardsKnown: [] },
      "art-history": { mastery: {}, examples: {}, cardsKnown: [] },
      astronomy: { mastery: {}, examples: {}, cardsKnown: [] },
      "computer-science": { mastery: {}, examples: {}, cardsKnown: [] },
      "creative-writing": { mastery: {}, examples: {}, cardsKnown: [] },
      "earth-science": { mastery: {}, examples: {}, cardsKnown: [] },
      economics: { mastery: {}, examples: {}, cardsKnown: [] },
      "english-10": { mastery: {}, examples: {}, cardsKnown: [] },
      "english-9": { mastery: {}, examples: {}, cardsKnown: [] },
      "environmental-science": { mastery: {}, examples: {}, cardsKnown: [] },
      "french-1": { mastery: {}, examples: {}, cardsKnown: [] },
      geography: { mastery: {}, examples: {}, cardsKnown: [] },
      "german-1": { mastery: {}, examples: {}, cardsKnown: [] },
      health: { mastery: {}, examples: {}, cardsKnown: [] },
      journalism: { mastery: {}, examples: {}, cardsKnown: [] },
      "music-theory": { mastery: {}, examples: {}, cardsKnown: [] },
      psychology: { mastery: {}, examples: {}, cardsKnown: [] },
      "sat-math": { mastery: {}, examples: {}, cardsKnown: [] },
      "sat-reading": { mastery: {}, examples: {}, cardsKnown: [] },
      sociology: { mastery: {}, examples: {}, cardsKnown: [] },
      "spanish-1": { mastery: {}, examples: {}, cardsKnown: [] },
      "spanish-2": { mastery: {}, examples: {}, cardsKnown: [] },
      "spanish-3": { mastery: {}, examples: {}, cardsKnown: [] },
      "speech-debate": { mastery: {}, examples: {}, cardsKnown: [] },
      statistics: { mastery: {}, examples: {}, cardsKnown: [] },
      "study-skills": { mastery: {}, examples: {}, cardsKnown: [] },
      "us-government": { mastery: {}, examples: {}, cardsKnown: [] },
      "world-history": { mastery: {}, examples: {}, cardsKnown: [] },
      calculus: { mastery: {}, examples: {}, cardsKnown: [] },
      "calc-ab": { mastery: {}, examples: {}, cardsKnown: [] },
      "calc-bc": { mastery: {}, examples: {}, cardsKnown: [] },
      "us-history": { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: null,
      enrolledSubjects: [],
      pushSubscriptions: [],
      schedule: null,
      streak: null,
      notificationPrefs: null
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
      "act-prep": { mastery: {}, examples: {}, cardsKnown: [] },
      anatomy: { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-chemistry": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-csa": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-euro": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-human-geography": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-macro": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-micro": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-physics": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-psych": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-stats": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-usgov": { mastery: {}, examples: {}, cardsKnown: [] },
      "ap-world": { mastery: {}, examples: {}, cardsKnown: [] },
      "art-history": { mastery: {}, examples: {}, cardsKnown: [] },
      astronomy: { mastery: {}, examples: {}, cardsKnown: [] },
      "computer-science": { mastery: {}, examples: {}, cardsKnown: [] },
      "creative-writing": { mastery: {}, examples: {}, cardsKnown: [] },
      "earth-science": { mastery: {}, examples: {}, cardsKnown: [] },
      economics: { mastery: {}, examples: {}, cardsKnown: [] },
      "english-10": { mastery: {}, examples: {}, cardsKnown: [] },
      "english-9": { mastery: {}, examples: {}, cardsKnown: [] },
      "environmental-science": { mastery: {}, examples: {}, cardsKnown: [] },
      "french-1": { mastery: {}, examples: {}, cardsKnown: [] },
      geography: { mastery: {}, examples: {}, cardsKnown: [] },
      "german-1": { mastery: {}, examples: {}, cardsKnown: [] },
      health: { mastery: {}, examples: {}, cardsKnown: [] },
      journalism: { mastery: {}, examples: {}, cardsKnown: [] },
      "music-theory": { mastery: {}, examples: {}, cardsKnown: [] },
      psychology: { mastery: {}, examples: {}, cardsKnown: [] },
      "sat-math": { mastery: {}, examples: {}, cardsKnown: [] },
      "sat-reading": { mastery: {}, examples: {}, cardsKnown: [] },
      sociology: { mastery: {}, examples: {}, cardsKnown: [] },
      "spanish-1": { mastery: {}, examples: {}, cardsKnown: [] },
      "spanish-2": { mastery: {}, examples: {}, cardsKnown: [] },
      "spanish-3": { mastery: {}, examples: {}, cardsKnown: [] },
      "speech-debate": { mastery: {}, examples: {}, cardsKnown: [] },
      statistics: { mastery: {}, examples: {}, cardsKnown: [] },
      "study-skills": { mastery: {}, examples: {}, cardsKnown: [] },
      "us-government": { mastery: {}, examples: {}, cardsKnown: [] },
      "world-history": { mastery: {}, examples: {}, cardsKnown: [] },
      calculus: { mastery: {}, examples: {}, cardsKnown: [] },
      "calc-ab": { mastery: {}, examples: {}, cardsKnown: [] },
      "calc-bc": { mastery: {}, examples: {}, cardsKnown: [] },
      "us-history": { mastery: {}, examples: {}, cardsKnown: [] },
      goal: null,
      updatedAt: "2026-08-14T00:00:00.000Z",
      enrolledSubjects: ["geometry"],
      pushSubscriptions: [],
      schedule: null,
      streak: null,
      notificationPrefs: null
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

  it("saves a valid unitOrder", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const body = { subject: "geometry", mastery: {}, examples: {}, cardsKnown: [], unitOrder: [3, 1, 2] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry.unitOrder).toEqual([3, 1, 2]);
  });

  it("dedupes and strips malformed entries from unitOrder, capping at 100", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const manyIds = Array.from({ length: 120 }, (_, i) => i + 1);
    const body = { subject: "geometry", mastery: {}, examples: {}, cardsKnown: [], unitOrder: [1, 1, -2, 0, "not a number", 2, ...manyIds] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry.unitOrder.length).toBe(100);
    expect(saved.geometry.unitOrder[0]).toBe(1);
    expect(saved.geometry.unitOrder[1]).toBe(2);
    expect(new Set(saved.geometry.unitOrder).size).toBe(100);
  });

  it("preserves an existing unitOrder when a save omits the field", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { geometry: { mastery: {}, examples: {}, cardsKnown: [], unitOrder: [5, 6, 7] } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const body = { subject: "geometry", mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry.unitOrder).toEqual([5, 6, 7]);
    expect(saved.geometry.mastery).toEqual({ "1": { correct: 1, total: 2 } });
  });

  it("clears unitOrder when explicitly saved as an empty array", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { geometry: { mastery: {}, examples: {}, cardsKnown: [], unitOrder: [5, 6, 7] } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const body = { subject: "geometry", mastery: {}, examples: {}, cardsKnown: [], unitOrder: [] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry.unitOrder).toBeUndefined();
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

  describe("Google Calendar push", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("never touches the network when pushScheduleToCalendar is off (the default) -- regression coverage", async () => {
      const cookie = await sessionCookieFor("student@example.com");
      const kv = fakeKV();
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks: [validBlock], notifyEnabled: true, timezone: "America/New_York" }), { SESSION_SECRET: SECRET, PROGRESS: kv, GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret" });
      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("pushes to Calendar and persists googleEventIds when pushScheduleToCalendar is on and Google is connected", async () => {
      const email = "student@example.com";
      const cookie = await sessionCookieFor(email);
      const kv = fakeKV({ [googleSettingsKey(email)]: JSON.stringify({ calendarIds: ["primary"], schoolworkOnly: true, pushScheduleToCalendar: true }) });
      const envObj = { SESSION_SECRET: SECRET, PROGRESS: kv, GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret" };
      await putGoogleToken(envObj, email, { refreshToken: "1//rt", googleEmail: email, scopes: [], connectedAt: "x" });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
        if (String(url).includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "at-1" }), { status: 200 });
        if (String(url).includes("/events") && opts?.method === "POST") return new Response(JSON.stringify({ id: "evt-created" }), { status: 200 });
        throw new Error("unexpected fetch: " + url);
      });

      const res = await handlePostSchedule(req("https://example.com/api/schedule", cookie, "POST", { blocks: [validBlock], notifyEnabled: false, timezone: "America/New_York" }), envObj);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.schedule.googleEventIds).toEqual({ "mon|15:00|geometry": "evt-created" });

      const saved = JSON.parse(kv._store.get("progress:" + email));
      expect(saved.schedule.googleEventIds).toEqual({ "mon|15:00|geometry": "evt-created" });
    });
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

describe("recordDailySnapshots", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("records today's readiness for an assessed subject", async () => {
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        geometry: { mastery: { "1": { correct: 1, total: 2 }, "2": { correct: 2, total: 2 } }, examples: {}, cardsKnown: [] }
      })
    });

    const result = await recordDailySnapshots({ PROGRESS: kv });

    expect(result).toEqual({ checked: 1, recorded: 1 });
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.history).toEqual([{ date: today, subjects: { geometry: 75 }, totalAnswered: 4 }]);
  });

  it("skips a subject with nothing assessed yet, and a student with no subjects assessed at all", async () => {
    const kv = fakeKV({
      "progress:untouched@example.com": JSON.stringify({
        geometry: { mastery: { "1": { correct: 1, total: 1 } }, examples: {}, cardsKnown: [] } // total:1 - below the assessed threshold
      })
    });

    const result = await recordDailySnapshots({ PROGRESS: kv });

    expect(result).toEqual({ checked: 1, recorded: 0 });
    const saved = JSON.parse(kv._store.get("progress:untouched@example.com"));
    expect(saved.history).toBeUndefined();
  });

  it("does not double-record a student already snapshotted today", async () => {
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        geometry: { mastery: { "1": { correct: 2, total: 2 } }, examples: {}, cardsKnown: [] },
        history: [{ date: today, subjects: { geometry: 40 } }]
      })
    });

    const result = await recordDailySnapshots({ PROGRESS: kv });

    expect(result).toEqual({ checked: 1, recorded: 0 });
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.history).toEqual([{ date: today, subjects: { geometry: 40 } }]);
  });

  it("caps history at 60 entries, dropping the oldest", async () => {
    const oldHistory = Array.from({ length: 60 }, (_, i) => ({ date: `2025-01-${String(i + 1).padStart(2, "0")}`, subjects: { geometry: i } }));
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] },
        history: oldHistory
      })
    });

    await recordDailySnapshots({ PROGRESS: kv });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.history.length).toBe(60);
    expect(saved.history[saved.history.length - 1]).toEqual({ date: today, subjects: { geometry: 50 }, totalAnswered: 2 });
    expect(saved.history[0].date).toBe("2025-01-02"); // oldest (01-01) was dropped to make room
  });

  it("returns zeroed counts when KV isn't configured", async () => {
    const result = await recordDailySnapshots({});
    expect(result).toEqual({ checked: 0, recorded: 0 });
  });
});

describe("share link", () => {
  it("generate 401s with no session, and requires sign-in like every other progress route", async () => {
    const res = await handlePostShareGenerate(req("https://example.com/api/share/generate", null, "POST"), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("generates a token, stores the reverse KV mapping, and a public request resolves it without auth", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        geometry: { mastery: { "1": { correct: 4, total: 5 } }, examples: {}, cardsKnown: [] },
        streak: { current: 3, longest: 10 }
      })
    });
    const genRes = await handlePostShareGenerate(req("https://example.com/api/share/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(genRes.status).toBe(200);
    const { token } = await genRes.json();
    expect(typeof token).toBe("string");
    expect(kv._store.get("share:" + token)).toBe("student@example.com");

    const publicRes = await handleGetShare(req("https://example.com/api/share?t=" + token), { PROGRESS: kv });
    expect(publicRes.status).toBe(200);
    const data = await publicRes.json();
    expect(data.streak).toEqual({ current: 3, longest: 10 });
    expect(data.subjects).toEqual([{ key: "geometry", pct: 80, assessedUnits: 1 }]);
    // never leaks the owning email in the public response
    expect(JSON.stringify(data)).not.toContain("student@example.com");
  });

  it("regenerating invalidates the old token", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({}) });
    const first = await (await handlePostShareGenerate(req("https://example.com/api/share/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    const second = await (await handlePostShareGenerate(req("https://example.com/api/share/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    expect(first.token).not.toBe(second.token);
    expect(kv._store.get("share:" + first.token)).toBeUndefined();

    const oldRes = await handleGetShare(req("https://example.com/api/share?t=" + first.token), { PROGRESS: kv });
    expect(oldRes.status).toBe(404);
    const newRes = await handleGetShare(req("https://example.com/api/share?t=" + second.token), { PROGRESS: kv });
    expect(newRes.status).toBe(200);
  });

  it("revoking deletes the reverse mapping and the link stops resolving", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({}) });
    const { token } = await (await handlePostShareGenerate(req("https://example.com/api/share/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();

    const revokeRes = await handlePostShareRevoke(req("https://example.com/api/share/revoke", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(revokeRes.status).toBe(200);
    expect(kv._store.get("share:" + token)).toBeUndefined();

    const afterRes = await handleGetShare(req("https://example.com/api/share?t=" + token), { PROGRESS: kv });
    expect(afterRes.status).toBe(404);
  });

  it("rejects a malformed or missing token", async () => {
    const kv = fakeKV();
    const missing = await handleGetShare(req("https://example.com/api/share"), { PROGRESS: kv });
    expect(missing.status).toBe(400);
    const malformed = await handleGetShare(req("https://example.com/api/share?t=" + encodeURIComponent("not valid!")), { PROGRESS: kv });
    expect(malformed.status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    const res = await handleGetShare(req("https://example.com/api/share?t=doesnotexist1234567890"), { PROGRESS: fakeKV() });
    expect(res.status).toBe(404);
  });
});

describe("calendar feed", () => {
  const validBlock = { day: "mon", start: "09:00", end: "10:00", subjectKey: "geometry", subjectLabel: "Geometry" };

  it("generate 401s with no session, and requires sign-in like every other progress route", async () => {
    const res = await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", null, "POST"), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("generates a token, stores the reverse KV mapping, and a public .ics request resolves it without auth", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        schedule: { blocks: [validBlock], timezone: "America/New_York", notifyEnabled: false, savedAt: new Date().toISOString() }
      })
    });
    const genRes = await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(genRes.status).toBe(200);
    const { token } = await genRes.json();
    expect(typeof token).toBe("string");
    expect(kv._store.get("cal:" + token)).toBe("student@example.com");

    const publicRes = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + token), { PROGRESS: kv });
    expect(publicRes.status).toBe(200);
    expect(publicRes.headers.get("Content-Type")).toContain("text/calendar");
    const body = await publicRes.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(body).toContain("DTSTART;TZID=America/New_York:20240101T090000");
    expect(body).toContain("SUMMARY:Geometry study block");
    // never leaks the owning email in the public feed
    expect(body).not.toContain("student@example.com");
  });

  it("falls back to Etc/UTC when no timezone is saved", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        schedule: { blocks: [validBlock], timezone: null, notifyEnabled: false, savedAt: new Date().toISOString() }
      })
    });
    const { token } = await (await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    const res = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + token), { PROGRESS: kv });
    const body = await res.text();
    expect(body).toContain("DTSTART;TZID=Etc/UTC:20240101T090000");
  });

  it("regenerating invalidates the old token", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({}) });
    const first = await (await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    const second = await (await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    expect(first.token).not.toBe(second.token);
    expect(kv._store.get("cal:" + first.token)).toBeUndefined();

    const oldRes = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + first.token), { PROGRESS: kv });
    expect(oldRes.status).toBe(404);
    const newRes = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + second.token), { PROGRESS: kv });
    expect(newRes.status).toBe(200);
  });

  it("revoking deletes the reverse mapping and the link stops resolving", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({}) });
    const { token } = await (await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();

    const revokeRes = await handlePostCalendarRevoke(req("https://example.com/api/calendar/revoke", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(revokeRes.status).toBe(200);
    expect(kv._store.get("cal:" + token)).toBeUndefined();

    const afterRes = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + token), { PROGRESS: kv });
    expect(afterRes.status).toBe(404);
  });

  it("rejects a malformed or missing token", async () => {
    const kv = fakeKV();
    const missing = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics"), { PROGRESS: kv });
    expect(missing.status).toBe(400);
    const malformed = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + encodeURIComponent("not valid!")), { PROGRESS: kv });
    expect(malformed.status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    const res = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=doesnotexist1234567890"), { PROGRESS: fakeKV() });
    expect(res.status).toBe(404);
  });

  it("emits a valid, event-free calendar when the schedule has no blocks", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ schedule: { blocks: [], timezone: null, notifyEnabled: false, savedAt: new Date().toISOString() } }) });
    const { token } = await (await handlePostCalendarGenerate(req("https://example.com/api/calendar/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    const res = await handleGetCalendarFeed(req("https://example.com/api/calendar.ics?t=" + token), { PROGRESS: kv });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).not.toContain("BEGIN:VEVENT");
  });
});

describe("classmate invite links", () => {
  it("401s with no session", async () => {
    const res = await handlePostInviteGenerate(req("https://example.com/api/invite/generate", null, "POST"), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("generates a token, stores the reverse KV mapping, and starts invitesAccepted at 0", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({}) });
    const res = await handlePostInviteGenerate(req("https://example.com/api/invite/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.token).toBe("string");
    expect(data.invitesAccepted).toBe(0);
    expect(kv._store.get("invite:" + data.token)).toBe("student@example.com");
  });

  it("is idempotent -- a second call returns the same token", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({}) });
    const first = await (await handlePostInviteGenerate(req("https://example.com/api/invite/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    const second = await (await handlePostInviteGenerate(req("https://example.com/api/invite/generate", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv })).json();
    expect(first.token).toBe(second.token);
  });

  it("creditInviteIfAny is a no-op with no ss_ref cookie", async () => {
    const kv = fakeKV();
    await creditInviteIfAny({ PROGRESS: kv }, req("https://example.com/"), "newstudent@example.com");
    expect(kv._store.size).toBe(0);
  });

  it("creditInviteIfAny is a no-op for an unknown token", async () => {
    const kv = fakeKV();
    const r = new Request("https://example.com/", { headers: { Cookie: "ss_ref=doesnotexist1234567890" } });
    await creditInviteIfAny({ PROGRESS: kv }, r, "newstudent@example.com");
    expect(kv._store.size).toBe(0);
  });
});

describe("handlePostNotificationPrefs", () => {
  it("401s with no session", async () => {
    const res = await handlePostNotificationPrefs(req("https://example.com/api/notification-prefs", null, "POST", { daily: false }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("sets a single pref and leaves the others at their default (true)", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostNotificationPrefs(req("https://example.com/api/notification-prefs", cookie, "POST", { daily: false }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notificationPrefs).toEqual({ daily: false });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.notificationPrefs).toEqual({ daily: false });
  });

  it("partial merges -- setting one pref doesn't reset a previously-set one", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({ notificationPrefs: { daily: false } })
    });
    const res = await handlePostNotificationPrefs(req("https://example.com/api/notification-prefs", cookie, "POST", { streak: false }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.notificationPrefs).toEqual({ daily: false, streak: false });
  });

  it("rejects a non-boolean value", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handlePostNotificationPrefs(req("https://example.com/api/notification-prefs", cookie, "POST", { daily: "nope" }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });
});
