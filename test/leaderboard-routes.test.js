import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import {
  handlePostOptIn, handlePostOptOut, handlePostNickname,
  handlePostGroupCreate, handlePostGroupJoin, handlePostGroupLeave,
  handleGetLeaderboard, computeLeaderboards, weeklyDelta, loadGroup
} from "../src/leaderboard-routes.js";

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

function envWith(kv) {
  return { SESSION_SECRET: SECRET, PROGRESS: kv };
}

describe("handlePostOptIn", () => {
  it("401s with no session", async () => {
    const res = await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in"), envWith(fakeKV()));
    expect(res.status).toBe(401);
  });

  it("opts a student in and assigns a stable handle", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leaderboard.optedIn).toBe(true);
    expect(typeof data.leaderboard.handle).toBe("string");
    expect(data.leaderboard.handle.length).toBeGreaterThan(0);
  });

  it("is idempotent -- re-opting in keeps the same handle", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res1 = await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const data1 = await res1.json();
    const res2 = await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const data2 = await res2.json();
    expect(data2.leaderboard.handle).toBe(data1.leaderboard.handle);
  });
});

describe("handlePostOptOut", () => {
  it("401s with no session", async () => {
    const res = await handlePostOptOut(req("https://example.com/api/leaderboard/opt-out"), envWith(fakeKV()));
    expect(res.status).toBe(401);
  });

  it("marks optedIn false without deleting the handle", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const res = await handlePostOptOut(req("https://example.com/api/leaderboard/opt-out", cookie, "POST"), envWith(kv));
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.leaderboard.optedIn).toBe(false);
    expect(typeof saved.leaderboard.handle).toBe("string");
  });
});

describe("handlePostNickname", () => {
  it("requires opting in first", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handlePostNickname(req("https://example.com/api/leaderboard/nickname", cookie, "POST", { nickname: "Ace" }), envWith(kv));
    expect(res.status).toBe(400);
  });

  it("sets and validates length/strips control characters", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const res = await handlePostNickname(req("https://example.com/api/leaderboard/nickname", cookie, "POST", { nickname: "A\u0007ce\u0000Study Star Supreme" }), envWith(kv));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.leaderboard.nickname.length).toBeLessThanOrEqual(24);
    expect(data.leaderboard.nickname).not.toMatch(/[\x00-\x1f]/);
  });

  it("clears the nickname with null", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    await handlePostNickname(req("https://example.com/api/leaderboard/nickname", cookie, "POST", { nickname: "Ace" }), envWith(kv));
    const res = await handlePostNickname(req("https://example.com/api/leaderboard/nickname", cookie, "POST", { nickname: null }), envWith(kv));
    const data = await res.json();
    expect(data.leaderboard.nickname).toBeNull();
  });
});

describe("group create/join/leave", () => {
  it("create requires opt-in", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handlePostGroupCreate(req("https://example.com/api/leaderboard/group/create", cookie, "POST"), envWith(fakeKV()));
    expect(res.status).toBe(400);
  });

  it("creates a group with the caller as first member", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const res = await handlePostGroupCreate(req("https://example.com/api/leaderboard/group/create", cookie, "POST"), envWith(kv));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect((await loadGroup({ PROGRESS: kv }, data.groupCode)).members).toEqual(["student@example.com"]);
    expect(kv._store.has("lbgm:" + data.groupCode + ":student@example.com")).toBe(true);
  });

  it("a second student can join by code", async () => {
    const cookieA = await sessionCookieFor("a@example.com");
    const cookieB = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookieA, "POST"), envWith(kv));
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookieB, "POST"), envWith(kv));
    const createRes = await handlePostGroupCreate(req("https://example.com/api/leaderboard/group/create", cookieA, "POST"), envWith(kv));
    const { groupCode } = await createRes.json();

    const joinRes = await handlePostGroupJoin(req("https://example.com/api/leaderboard/group/join", cookieB, "POST", { code: groupCode }), envWith(kv));
    expect(joinRes.status).toBe(200);
    expect((await loadGroup({ PROGRESS: kv }, groupCode)).members.sort()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("rejects joining a nonexistent code", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const res = await handlePostGroupJoin(req("https://example.com/api/leaderboard/group/join", cookie, "POST", { code: "NOPE99" }), envWith(kv));
    expect(res.status).toBe(404);
  });

  it("rejects joining a full group", async () => {
    const kv = fakeKV();
    const ownerCookie = await sessionCookieFor("owner@example.com");
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", ownerCookie, "POST"), envWith(kv));
    const createRes = await handlePostGroupCreate(req("https://example.com/api/leaderboard/group/create", ownerCookie, "POST"), envWith(kv));
    const { groupCode } = await createRes.json();

    // Fill to the 50-member cap directly (owner already counts as 1).
    const group = JSON.parse(kv._store.get("lbgroup:" + groupCode));
    for (let i = 0; i < 49; i++) group.members.push(`member${i}@example.com`);
    kv._store.set("lbgroup:" + groupCode, JSON.stringify(group));

    const lateCookie = await sessionCookieFor("late@example.com");
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", lateCookie, "POST"), envWith(kv));
    const res = await handlePostGroupJoin(req("https://example.com/api/leaderboard/group/join", lateCookie, "POST", { code: groupCode }), envWith(kv));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/full/i);
  });

  it("leave removes membership and clears groupCode", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookie, "POST"), envWith(kv));
    const createRes = await handlePostGroupCreate(req("https://example.com/api/leaderboard/group/create", cookie, "POST"), envWith(kv));
    const { groupCode } = await createRes.json();

    await handlePostGroupLeave(req("https://example.com/api/leaderboard/group/leave", cookie, "POST"), envWith(kv));
    const group = JSON.parse(kv._store.get("lbgroup:" + groupCode));
    expect(group.members).toEqual([]);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.leaderboard.groupCode).toBeNull();
  });
});

describe("computeLeaderboards + GET /api/leaderboard", () => {
  function blobFor({ optedIn, xpHistory, totalAnsweredHistory, recentActiveDates, subject }) {
    const today = new Date().toISOString().slice(0, 10);
    // Baseline snapshot from before any possible week start, so the weekly
    // delta is (today - baseline) on every weekday. Without it, a Monday run
    // measures today against itself and every board comes out empty.
    const baseline = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    return {
      [subject || "geometry"]: { mastery: { "1": { correct: 5, total: 5 } }, examples: {}, cardsKnown: [] },
      leaderboard: optedIn ? { optedIn: true, handle: "Quick Fox 42", nickname: null, groupCode: null } : { optedIn: false, handle: "Quick Fox 42" },
      streak: { current: 1, longest: 1, lastActiveDate: today, timezone: null, recentActiveDates: recentActiveDates || [today] },
      history: [
        { date: baseline, subjects: { [subject || "geometry"]: 0 }, totalAnswered: 0, xp: 0 },
        { date: today, subjects: { [subject || "geometry"]: 90 }, totalAnswered: totalAnsweredHistory ?? 10, xp: xpHistory ?? 100 }
      ]
    };
  }

  it("blanks a subject board that nobody is on any more, so stale rankings and opted-out handles disappear", async () => {
    const kv = fakeKV({
      "lb:subject:geometry:xp": JSON.stringify([{ handle: "Old Owl", value: 50, rank: 1 }]),
      "progress:out@example.com": JSON.stringify(blobFor({ optedIn: false, xpHistory: 500 }))
    });
    await computeLeaderboards({ PROGRESS: kv });
    expect(JSON.parse(kv._store.get("lb:subject:geometry:xp"))).toEqual([]);
  });

  it("a non-opted-in student's data never appears in a computed board, even with lots of progress", async () => {
    const kv = fakeKV({
      "progress:optedin@example.com": JSON.stringify(blobFor({ optedIn: true, xpHistory: 500 })),
      "progress:secret@example.com": JSON.stringify(blobFor({ optedIn: false, xpHistory: 999999 }))
    });

    const result = await computeLeaderboards({ PROGRESS: kv });
    expect(result.checked).toBe(2);

    const board = JSON.parse(kv._store.get("lb:global:xp"));
    const handles = board.map(r => r.handle);
    // Only the opted-in student's data should ever have entered the board.
    expect(board.length).toBe(1);
    expect(board[0].value).toBe(500);
    expect(handles).not.toContain(999999);
    // No email ever appears anywhere in the cached board.
    expect(JSON.stringify(board)).not.toMatch(/@example\.com/);
  });

  it("builds separate global boards per metric and per-subject boards only for subjects with data", async () => {
    const kv = fakeKV({
      "progress:a@example.com": JSON.stringify(blobFor({ optedIn: true, xpHistory: 300, totalAnsweredHistory: 20, subject: "geometry" })),
      "progress:b@example.com": JSON.stringify(blobFor({ optedIn: true, xpHistory: 100, totalAnsweredHistory: 5, subject: "chemistry" }))
    });

    await computeLeaderboards({ PROGRESS: kv });

    expect(kv._store.has("lb:global:xp")).toBe(true);
    expect(kv._store.has("lb:global:questions")).toBe(true);
    expect(kv._store.has("lb:global:activedays")).toBe(true);
    expect(kv._store.has("lb:subject:geometry:xp")).toBe(true);
    expect(kv._store.has("lb:subject:chemistry:xp")).toBe(true);
    // A subject nobody has data in should never get a cached board.
    expect(kv._store.has("lb:subject:physics:xp")).toBe(false);

    const globalXp = JSON.parse(kv._store.get("lb:global:xp"));
    expect(globalXp[0].rank).toBe(1);
    expect(globalXp[0].value).toBe(300);
  });

  it("GET returns global board, scope/metric combos, and the caller's own status", async () => {
    const kv = fakeKV({
      "progress:a@example.com": JSON.stringify(blobFor({ optedIn: true, xpHistory: 300 }))
    });
    await computeLeaderboards({ PROGRESS: kv });

    const cookie = await sessionCookieFor("a@example.com");
    // restore the caller's own saved blob (computeLeaderboards doesn't mutate progress: entries)
    const res = await handleGetLeaderboard(req("https://example.com/api/leaderboard?scope=global&metric=xp", cookie), envWith(kv));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scope).toBe("global");
    expect(data.metric).toBe("xp");
    expect(data.board.length).toBe(1);
    expect(data.self.optedIn).toBe(true);
  });

  it("GET rejects an invalid metric or scope", async () => {
    const kv = fakeKV();
    const res1 = await handleGetLeaderboard(req("https://example.com/api/leaderboard?scope=global&metric=bogus"), envWith(kv));
    expect(res1.status).toBe(400);
    const res2 = await handleGetLeaderboard(req("https://example.com/api/leaderboard?scope=bogus&metric=xp"), envWith(kv));
    expect(res2.status).toBe(400);
  });

  it("GET group scope requires the caller to be an opted-in member of a group", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const res = await handleGetLeaderboard(req("https://example.com/api/leaderboard?scope=group&metric=xp", cookie), envWith(kv));
    expect(res.status).toBe(401);
  });

  it("GET group scope computes live from member snapshots", async () => {
    const kv = fakeKV();
    const cookieA = await sessionCookieFor("a@example.com");
    const cookieB = await sessionCookieFor("b@example.com");
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookieA, "POST"), envWith(kv));
    await handlePostOptIn(req("https://example.com/api/leaderboard/opt-in", cookieB, "POST"), envWith(kv));
    const createRes = await handlePostGroupCreate(req("https://example.com/api/leaderboard/group/create", cookieA, "POST"), envWith(kv));
    const { groupCode } = await createRes.json();
    await handlePostGroupJoin(req("https://example.com/api/leaderboard/group/join", cookieB, "POST", { code: groupCode }), envWith(kv));

    // Give each member some history directly.
    const today = new Date().toISOString().slice(0, 10);
    const blobA = JSON.parse(kv._store.get("progress:a@example.com"));
    blobA.history = [{ date: today, subjects: {}, totalAnswered: 1, xp: 200 }];
    kv._store.set("progress:a@example.com", JSON.stringify(blobA));

    const res = await handleGetLeaderboard(req(`https://example.com/api/leaderboard?scope=group&metric=xp`, cookieA), envWith(kv));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.board.some(r => r.value === 200)).toBe(true);
  });
});

describe("weeklyDelta week boundary", () => {
  const monday = "2026-09-21";

  it("counts Monday's own activity toward the week (baseline is Sunday's snapshot)", () => {
    const history = [
      { date: "2026-09-20", subjects: {}, totalAnswered: 100, xp: 400 },
      { date: "2026-09-21", subjects: {}, totalAnswered: 130, xp: 460 }
    ];
    expect(weeklyDelta(history, "xp", monday)).toBe(60);
    expect(weeklyDelta(history, "totalAnswered", monday)).toBe(30);
  });

  it("gives a new student with no pre-week snapshot full credit for their history", () => {
    const history = [{ date: "2026-09-21", subjects: {}, totalAnswered: 12, xp: 150 }];
    expect(weeklyDelta(history, "xp", monday)).toBe(150);
  });
});

describe("leaderboards after the history move and the opt-in index", () => {
  const today = new Date().toISOString().slice(0, 10);
  const baseline = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const histOf = (xp) => [{ date: baseline, subjects: { geometry: 0 }, totalAnswered: 0, xp: 0 }, { date: today, subjects: { geometry: 90 }, totalAnswered: 10, xp }];
  const blob = (optedIn, handle) => JSON.stringify({
    geometry: { mastery: { "1": { correct: 5, total: 5 } }, examples: {}, cardsKnown: [] },
    leaderboard: { optedIn, handle, nickname: null, groupCode: null },
    streak: { current: 1, longest: 1, lastActiveDate: today, timezone: null, recentActiveDates: [today] },
  });

  it("reads each student's weekly numbers from the separate history key (the blob no longer carries history)", async () => {
    const kv = fakeKV({
      "progress:a@example.com": blob(true, "Quick Fox"),
      "history:a@example.com": JSON.stringify(histOf(420)),
    });
    await computeLeaderboards({ PROGRESS: kv });
    expect(JSON.parse(kv._store.get("lb:global:xp"))).toEqual([{ handle: "Quick Fox", value: 420, rank: 1 }]);
  });

  it("falls back to history still inside an older blob", async () => {
    const kv = fakeKV({ "progress:a@example.com": JSON.stringify({ ...JSON.parse(blob(true, "Old Owl")), history: histOf(77) }) });
    await computeLeaderboards({ PROGRESS: kv });
    expect(JSON.parse(kv._store.get("lb:global:xp"))[0].value).toBe(77);
  });

  it("once the index is ready, only indexed students are read, and a stale entry for someone who opted out still can't get on a board", async () => {
    const reads = [];
    const kv = fakeKV({
      "cron:idx-ready": "1",
      "lbopt:in@example.com": "1", "progress:in@example.com": blob(true, "In Fox"), "history:in@example.com": JSON.stringify(histOf(300)),
      "lbopt:stale@example.com": "1", "progress:stale@example.com": blob(false, "Stale Fox"), "history:stale@example.com": JSON.stringify(histOf(999999)),
      "progress:unindexed@example.com": blob(true, "Unindexed Fox"), "history:unindexed@example.com": JSON.stringify(histOf(5)),
    });
    const origGet = kv.get; kv.get = async (k) => { reads.push(k); return origGet(k); };
    const result = await computeLeaderboards({ PROGRESS: kv });
    expect(result.checked).toBe(2); // the two indexed students, not all three
    expect(reads).not.toContain("progress:unindexed@example.com");
    const board = JSON.parse(kv._store.get("lb:global:xp"));
    expect(board).toEqual([{ handle: "In Fox", value: 300, rank: 1 }]);
  });

  it("opting in adds the index entry and opting out removes it", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV();
    const env = { SESSION_SECRET: SECRET, PROGRESS: kv };
    await handlePostOptIn(new Request("https://example.com/api/leaderboard/opt-in", { method: "POST", headers: { Cookie: cookie } }), env);
    expect(kv._store.get("lbopt:student@example.com")).toBe("1");
    await handlePostOptOut(new Request("https://example.com/api/leaderboard/opt-out", { method: "POST", headers: { Cookie: cookie } }), env);
    expect(kv._store.has("lbopt:student@example.com")).toBe(false);
  });

  it("one unreadable record does not stop the boards from being built", async () => {
    const kv = fakeKV({ "progress:bad@example.com": "{nope", "progress:a@example.com": blob(true, "Fine Fox"), "history:a@example.com": JSON.stringify(histOf(10)) });
    await computeLeaderboards({ PROGRESS: kv });
    expect(JSON.parse(kv._store.get("lb:global:xp"))[0].handle).toBe("Fine Fox");
  });
});


describe("group membership is one key per member (no lost joins)", () => {
  const envWith = (kv) => ({ SESSION_SECRET: SECRET, PROGRESS: kv });
  const post = (path, cookie, body) => new Request("https://example.com" + path, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });

  async function groupWith(kv, owner) {
    const cookie = await sessionCookieFor(owner);
    await handlePostOptIn(post("/api/leaderboard/opt-in", cookie), envWith(kv));
    const { groupCode } = await (await handlePostGroupCreate(post("/api/leaderboard/group/create", cookie), envWith(kv))).json();
    return groupCode;
  }

  it("twenty students joining at the same moment all end up in the group", async () => {
    const kv = fakeKV();
    const code = await groupWith(kv, "owner@example.com");
    const joiners = Array.from({ length: 20 }, (_, i) => `kid${i}@example.com`);
    await Promise.all(joiners.map(async (email) => {
      const cookie = await sessionCookieFor(email);
      await handlePostOptIn(post("/api/leaderboard/opt-in", cookie), envWith(kv));
      return handlePostGroupJoin(post("/api/leaderboard/group/join", cookie, { code }), envWith(kv));
    }));
    const members = (await loadGroup({ PROGRESS: kv }, code)).members;
    expect(members.length).toBe(21);
    for (const e of joiners) expect(members).toContain(e);
  });

  it("leaving removes only the leaver", async () => {
    const kv = fakeKV();
    const code = await groupWith(kv, "owner@example.com");
    const b = await sessionCookieFor("b@example.com");
    await handlePostOptIn(post("/api/leaderboard/opt-in", b), envWith(kv));
    await handlePostGroupJoin(post("/api/leaderboard/group/join", b, { code }), envWith(kv));
    await handlePostGroupLeave(post("/api/leaderboard/group/leave", b), envWith(kv));
    expect((await loadGroup({ PROGRESS: kv }, code)).members).toEqual(["owner@example.com"]);
  });

  it("a group created before the change (member array inside the group record) still works, for joining and leaving", async () => {
    const kv = fakeKV({ "lbgroup:OLDGRP": JSON.stringify({ members: ["old1@example.com", "Old2@Example.com"], createdAt: "2026-09-01T00:00:00Z", name: "Legacy" }) });
    const c = await sessionCookieFor("new@example.com");
    await handlePostOptIn(post("/api/leaderboard/opt-in", c), envWith(kv));
    await handlePostGroupJoin(post("/api/leaderboard/group/join", c, { code: "OLDGRP" }), envWith(kv));
    let group = await loadGroup({ PROGRESS: kv }, "OLDGRP");
    expect(group.name).toBe("Legacy");
    expect(group.members.map(m => m.toLowerCase()).sort()).toEqual(["new@example.com", "old1@example.com", "old2@example.com"]);
    const o = await sessionCookieFor("old2@example.com");
    await handlePostOptIn(post("/api/leaderboard/opt-in", o), envWith(kv));
    await handlePostGroupJoin(post("/api/leaderboard/group/join", o, { code: "OLDGRP" }), envWith(kv)); // already a member: unchanged
    await handlePostGroupLeave(post("/api/leaderboard/group/leave", o), envWith(kv));
    group = await loadGroup({ PROGRESS: kv }, "OLDGRP");
    expect(group.members.map(m => m.toLowerCase()).sort()).toEqual(["new@example.com", "old1@example.com"]);
  });

  it("enforces the 50-member cap and counts both kinds of membership", async () => {
    const legacy = Array.from({ length: 49 }, (_, i) => `l${i}@example.com`);
    const kv = fakeKV({ "lbgroup:FULLGP": JSON.stringify({ members: legacy, createdAt: "2026-09-01T00:00:00Z" }) });
    const a = await sessionCookieFor("a@example.com");
    const b = await sessionCookieFor("b@example.com");
    for (const c of [a, b]) await handlePostOptIn(post("/api/leaderboard/opt-in", c), envWith(kv));
    expect((await handlePostGroupJoin(post("/api/leaderboard/group/join", a, { code: "FULLGP" }), envWith(kv))).status).toBe(200);
    expect((await handlePostGroupJoin(post("/api/leaderboard/group/join", b, { code: "FULLGP" }), envWith(kv))).status).toBe(400);
  });
});

describe("unique handles", () => {
  it("never gives two students the same handle while one is reserved", async () => {
    const { reserveHandle } = await import("../src/leaderboard-routes.js");
    const kv = fakeKV();
    const seen = new Set();
    for (let i = 0; i < 300; i++) seen.add(await reserveHandle({ PROGRESS: kv }, `s${i}@example.com`));
    expect(seen.size).toBe(300);
    for (const h of seen) expect(h).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{3}\d?$/);
  });
});
