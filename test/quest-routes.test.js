import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGetQuest, handlePostQuestSwap, handlePostQuestClaim, DAILY_POOL, WEEKLY_POOL } from "../src/quest-routes.js";
import { mondayUTC } from "../src/leaderboard-routes.js";

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

function todayLocal() {
  return new Date().toISOString().slice(0, 10);
}

function getBlob(kv, email) {
  return JSON.parse(kv._store.get("progress:" + email));
}
function putBlob(kv, email, blob) {
  kv._store.set("progress:" + email, JSON.stringify(blob));
}

// Mutates the saved blob so the given daily quest key's progress condition is
// satisfied, regardless of which 3 were seeded in for this student/day.
function satisfyDaily(kv, email, key) {
  const blob = getBlob(kv, email);
  blob.geometry = blob.geometry || { mastery: {}, examples: {}, cardsKnown: [] };
  if (key === "answer10" || key === "answer20") {
    const need = key === "answer10" ? 10 : 20;
    blob.geometry.mastery["1"] = { correct: need, total: need };
  } else if (key === "cards5" || key === "cards10") {
    const need = key === "cards5" ? 5 : 10;
    blob.geometry.cardsKnown = Array.from({ length: need }, (_, i) => "card" + i);
  } else if (key === "score80") {
    blob.geometry.mastery["1"] = { correct: 8, total: 10 };
  }
  putBlob(kv, email, blob);
}

describe("handleGetQuest", () => {
  it("401s with no session", async () => {
    const res = await handleGetQuest(req("https://example.com/api/quest"), envWith(fakeKV()));
    expect(res.status).toBe(401);
  });

  it("initializes a fresh player with 3 daily quests, 2 weekly quests, xp 0, no boss", async () => {
    const cookie = await sessionCookieFor("new@example.com");
    const kv = fakeKV();
    const res = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.quest.xp).toBe(0);
    expect(data.quest.daily.quests).toHaveLength(3);
    expect(data.quest.weekly.quests).toHaveLength(2);
    expect(data.quest.boss).toBeNull();
    expect(data.quest.level.level).toBe(1);
    // no duplicate keys within a scope
    expect(new Set(data.quest.daily.quests.map(q => q.key)).size).toBe(3);
    expect(new Set(data.quest.weekly.quests.map(q => q.key)).size).toBe(2);
  });

  it("is stable across repeated GETs on the same day (no reroll)", async () => {
    const cookie = await sessionCookieFor("stable@example.com");
    const kv = fakeKV();
    const res1 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data1 = await res1.json();
    const res2 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data2 = await res2.json();
    expect(data2.quest.daily.quests.map(q => q.key)).toEqual(data1.quest.daily.quests.map(q => q.key));
  });

  it("regenerates daily quests when the stored date has rolled over", async () => {
    const cookie = await sessionCookieFor("rollover@example.com");
    const kv = fakeKV();
    await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const blob = getBlob(kv, "rollover@example.com");
    const staleDate = blob.quest.daily.date;
    blob.quest.daily.date = "2000-01-01"; // force staleness
    blob.quest.daily.bonusClaimed = true; // would be wrong to carry this forward
    putBlob(kv, "rollover@example.com", blob);

    const res = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data = await res.json();
    expect(data.quest.daily.date).not.toBe("2000-01-01");
    expect(data.quest.daily.date).toBe(todayLocal());
    expect(data.quest.daily.bonusClaimed).toBe(false);
    expect(data.quest.daily.swapsUsed).toBe(0);
  });

  it("regenerates weekly quests when the stored weekStart has rolled over", async () => {
    const cookie = await sessionCookieFor("weekroll@example.com");
    const kv = fakeKV();
    await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const blob = getBlob(kv, "weekroll@example.com");
    blob.quest.weekly.weekStart = "2000-01-03"; // a long-past Monday
    blob.quest.weekly.swapsUsed = 1;
    putBlob(kv, "weekroll@example.com", blob);

    const res = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data = await res.json();
    const expectedMonday = mondayUTC(new Date());
    expect(data.quest.weekly.weekStart).toBe(expectedMonday);
    expect(data.quest.weekly.swapsUsed).toBe(0);
  });
});

describe("swap caps", () => {
  it("allows one daily swap then rejects a second", async () => {
    const cookie = await sessionCookieFor("swapd@example.com");
    const kv = fakeKV();
    const res0 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data0 = await res0.json();
    const key = data0.quest.daily.quests[0].key;

    const res1 = await handlePostQuestSwap(req("https://example.com/api/quest/swap", cookie, "POST", { scope: "daily", key }), envWith(kv));
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.quest.daily.swapsUsed).toBe(1);
    const newKey = data1.quest.daily.quests.find(q => !data0.quest.daily.quests.some(o => o.key === q.key))?.key
      || data1.quest.daily.quests[0].key;

    const res2 = await handlePostQuestSwap(req("https://example.com/api/quest/swap", cookie, "POST", { scope: "daily", key: newKey }), envWith(kv));
    expect(res2.status).toBe(400);
  });

  it("allows one weekly swap then rejects a second", async () => {
    const cookie = await sessionCookieFor("swapw@example.com");
    const kv = fakeKV();
    const res0 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data0 = await res0.json();
    const key = data0.quest.weekly.quests[0].key;

    const res1 = await handlePostQuestSwap(req("https://example.com/api/quest/swap", cookie, "POST", { scope: "weekly", key }), envWith(kv));
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.quest.weekly.swapsUsed).toBe(1);

    const res2 = await handlePostQuestSwap(req("https://example.com/api/quest/swap", cookie, "POST", { scope: "weekly", key: data1.quest.weekly.quests[0].key }), envWith(kv));
    expect(res2.status).toBe(400);
  });
});

describe("claim", () => {
  it("rejects claiming a quest whose progress hasn't met its target", async () => {
    const cookie = await sessionCookieFor("noclaim@example.com");
    const kv = fakeKV();
    const res0 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data0 = await res0.json();
    const key = data0.quest.daily.quests[0].key;

    const res = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key }), envWith(kv));
    expect(res.status).toBe(400);
  });

  it("pays out xp once real progress is met, and is idempotent on a second claim", async () => {
    const cookie = await sessionCookieFor("claim@example.com");
    const kv = fakeKV();
    const res0 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data0 = await res0.json();
    const target = data0.quest.daily.quests[0];
    satisfyDaily(kv, "claim@example.com", target.key);

    const res1 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data1 = await res1.json();
    const reconciled = data1.quest.daily.quests.find(q => q.key === target.key);
    expect(reconciled.progress).toBeGreaterThanOrEqual(reconciled.target);

    const claim1 = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key: target.key }), envWith(kv));
    expect(claim1.status).toBe(200);
    const claimData1 = await claim1.json();
    const def = DAILY_POOL.find(d => d.key === target.key);
    expect(claimData1.xpAwarded).toBe(def.xp);
    expect(claimData1.quest.xp).toBe(def.xp);

    const claim2 = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key: target.key }), envWith(kv));
    expect(claim2.status).toBe(200);
    const claimData2 = await claim2.json();
    expect(claimData2.alreadyClaimed).toBe(true);
    expect(claimData2.quest.xp).toBe(def.xp); // no double payout
  });

  it("pays the all-three bonus only once all three daily quests are claimed", async () => {
    const cookie = await sessionCookieFor("bonus@example.com");
    const kv = fakeKV();
    const res0 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data0 = await res0.json();

    const early = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key: "bonus" }), envWith(kv));
    expect(early.status).toBe(400);

    let expectedXp = 0;
    for (const q of data0.quest.daily.quests) {
      satisfyDaily(kv, "bonus@example.com", q.key);
      await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
      const claimRes = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key: q.key }), envWith(kv));
      const claimData = await claimRes.json();
      expectedXp += DAILY_POOL.find(d => d.key === q.key).xp;
      expect(claimData.quest.xp).toBe(expectedXp);
    }

    const bonusRes = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key: "bonus" }), envWith(kv));
    expect(bonusRes.status).toBe(200);
    const bonusData = await bonusRes.json();
    expect(bonusData.xpAwarded).toBe(30);
    expect(bonusData.quest.xp).toBe(expectedXp + 30);

    const bonusAgain = await handlePostQuestClaim(req("https://example.com/api/quest/claim", cookie, "POST", { scope: "daily", key: "bonus" }), envWith(kv));
    const bonusAgainData = await bonusAgain.json();
    expect(bonusAgainData.alreadyClaimed).toBe(true);
    expect(bonusAgainData.quest.xp).toBe(expectedXp + 30); // no double payout
  });
});

describe("boss", () => {
  const monday = mondayUTC(new Date());
  // A pre-week baseline snapshot dated strictly before Monday -- per the
  // fc0a06e lesson, weeklyDelta's baseline must be a day before the week
  // starts, not a same-day snapshot, or a run on Monday itself reads zero.
  function beforeMonday() {
    const d = new Date(monday + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 3);
    return d.toISOString().slice(0, 10);
  }

  it("stays unsummoned until there's assessed activity this week", async () => {
    const cookie = await sessionCookieFor("nobossyet@example.com");
    const kv = fakeKV();
    const blob = {
      history: [{ date: beforeMonday(), totalAnswered: 5, xp: 10, subjects: {} }],
      geometry: { mastery: {}, examples: {}, cardsKnown: [] }
    };
    putBlob(kv, "nobossyet@example.com", blob);

    const res = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data = await res.json();
    expect(data.quest.boss).toBeNull();
  });

  it("summons targeting the student's current weakest assessed unit once there's activity this week", async () => {
    const cookie = await sessionCookieFor("bosssummon@example.com");
    const kv = fakeKV();
    const blob = {
      history: [{ date: beforeMonday(), totalAnswered: 5, xp: 10, subjects: {} }],
      streak: { current: 1, longest: 1, lastActiveDate: todayLocal(), timezone: null, recentActiveDates: [todayLocal()] },
      geometry: { mastery: { "1": { correct: 9, total: 10 }, "2": { correct: 3, total: 10 } }, examples: {}, cardsKnown: [] }
    };
    putBlob(kv, "bosssummon@example.com", blob);

    const res = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data = await res.json();
    expect(data.quest.boss).not.toBeNull();
    expect(data.quest.boss.subject).toBe("geometry");
    expect(data.quest.boss.defeated).toBe(false);
  });

  it("defeats the boss at 80%+ on a fresh assessment, and it stays defeated even if the % later dips", async () => {
    const cookie = await sessionCookieFor("bossdefeat@example.com");
    const kv = fakeKV();
    const blob = {
      history: [{ date: beforeMonday(), totalAnswered: 5, xp: 10, subjects: {} }],
      streak: { current: 1, longest: 1, lastActiveDate: todayLocal(), timezone: null, recentActiveDates: [todayLocal()] },
      geometry: { mastery: { "2": { correct: 3, total: 10 } }, examples: {}, cardsKnown: [] }
    };
    putBlob(kv, "bossdefeat@example.com", blob);
    const res0 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data0 = await res0.json();
    const unitId = data0.quest.boss.unitId || "2";

    // Fresh assessment on that exact unit at >=80%.
    const blob1 = getBlob(kv, "bossdefeat@example.com");
    blob1.geometry.mastery["2"] = { correct: 13, total: 15 }; // was total 10, now 15 -- fresh activity, 86.6%
    putBlob(kv, "bossdefeat@example.com", blob1);

    const res1 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data1 = await res1.json();
    expect(data1.quest.boss.defeated).toBe(true);

    // % dips afterward -- should NOT un-defeat it this week.
    const blob2 = getBlob(kv, "bossdefeat@example.com");
    blob2.geometry.mastery["2"] = { correct: 13, total: 20 }; // now 65%
    putBlob(kv, "bossdefeat@example.com", blob2);

    const res2 = await handleGetQuest(req("https://example.com/api/quest", cookie), envWith(kv));
    const data2 = await res2.json();
    expect(data2.quest.boss.defeated).toBe(true);
  });
});
