import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import {
  handlePostChallengeCreate,
  handlePostChallengeClaim,
  handlePostChallengeSubmit,
  handleGetChallenge,
  handleGetChallenges
} from "../src/challenge-routes.js";

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

async function createChallenge(kv, creatorCookie, overrides) {
  const body = { subjectKey: "geometry", questionNumbers: [1, 2, 3, 4, 5], ...overrides };
  const res = await handlePostChallengeCreate(req("https://example.com/api/challenge/create", creatorCookie, "POST", body), envWith(kv));
  return res.json();
}

describe("handlePostChallengeCreate", () => {
  it("401s with no session", async () => {
    const res = await handlePostChallengeCreate(req("https://example.com/api/challenge/create"), envWith(fakeKV()));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid subject", async () => {
    const cookie = await sessionCookieFor("a@example.com");
    const res = await handlePostChallengeCreate(
      req("https://example.com/api/challenge/create", cookie, "POST", { subjectKey: "not-real", questionNumbers: [1] }),
      envWith(fakeKV())
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty or too-large question list", async () => {
    const cookie = await sessionCookieFor("a@example.com");
    const kv = fakeKV();
    const empty = await handlePostChallengeCreate(req("https://example.com/api/challenge/create", cookie, "POST", { subjectKey: "geometry", questionNumbers: [] }), envWith(kv));
    expect(empty.status).toBe(400);
    const tooMany = await handlePostChallengeCreate(
      req("https://example.com/api/challenge/create", cookie, "POST", { subjectKey: "geometry", questionNumbers: Array.from({ length: 25 }, (_, i) => i) }),
      envWith(kv)
    );
    expect(tooMany.status).toBe(400);
  });

  it("creates a challenge and returns a 6-char code", async () => {
    const cookie = await sessionCookieFor("a@example.com");
    const kv = fakeKV();
    const data = await createChallenge(kv, cookie);
    expect(data.ok).toBe(true);
    expect(data.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(data.questionCount).toBe(5);

    const stored = JSON.parse(kv._store.get("challenge:" + data.code));
    expect(stored.creatorEmail).toBe("a@example.com");
    expect(stored.subjectKey).toBe("geometry");
    expect(stored.questionNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(stored.expiresAt).toBeTruthy();
  });

  it("assigns the creator a handle even without opting into leaderboards", async () => {
    const cookie = await sessionCookieFor("a@example.com");
    const kv = fakeKV();
    await createChallenge(kv, cookie);
    const blob = JSON.parse(kv._store.get("progress:a@example.com"));
    expect(blob.leaderboard.handle).toBeTruthy();
    expect(blob.leaderboard.optedIn).toBe(false);
  });
});

describe("handlePostChallengeClaim", () => {
  it("401s with no session", async () => {
    const res = await handlePostChallengeClaim(req("https://example.com/api/challenge/ABC123/claim"), envWith(fakeKV()), "ABC123");
    expect(res.status).toBe(401);
  });

  it("404s an unknown code", async () => {
    const cookie = await sessionCookieFor("b@example.com");
    const res = await handlePostChallengeClaim(req("https://example.com/api/challenge/ZZZZZZ/claim", cookie, "POST"), envWith(fakeKV()), "ZZZZZZ");
    expect(res.status).toBe(404);
  });

  it("rejects the creator claiming their own challenge", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    const res = await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, creatorCookie, "POST"), envWith(kv), code);
    expect(res.status).toBe(400);
  });

  it("lets an opponent claim an unclaimed challenge", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    const res = await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.subjectKey).toBe("geometry");
    const stored = JSON.parse(kv._store.get("challenge:" + code));
    expect(stored.opponentEmail).toBe("b@example.com");
  });

  it("rejects double-claim by a second, different student", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const thirdCookie = await sessionCookieFor("c@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);
    const res = await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, thirdCookie, "POST"), envWith(kv), code);
    expect(res.status).toBe(409);
  });

  it("is idempotent for the same opponent claiming again", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);
    const res = await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);
    expect(res.status).toBe(200);
  });
});

describe("handlePostChallengeSubmit", () => {
  async function setup() {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);
    return { kv, code, creatorCookie, opponentCookie };
  }

  it("401s with no session", async () => {
    const res = await handlePostChallengeSubmit(req("https://example.com/api/challenge/ABC123/submit", null, "POST", { correct: 3, total: 5 }), envWith(fakeKV()), "ABC123");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid result body", async () => {
    const { kv, code, creatorCookie } = await setup();
    const res = await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, creatorCookie, "POST", { correct: 6, total: 5 }), envWith(kv), code);
    expect(res.status).toBe(400);
  });

  it("rejects submission from a non-participant", async () => {
    const { kv, code } = await setup();
    const outsiderCookie = await sessionCookieFor("c@example.com");
    const res = await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, outsiderCookie, "POST", { correct: 3, total: 5 }), envWith(kv), code);
    expect(res.status).toBe(403);
  });

  it("accepts one submission per role and rejects a second from the same role", async () => {
    const { kv, code, creatorCookie } = await setup();
    const first = await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, creatorCookie, "POST", { correct: 4, total: 5 }), envWith(kv), code);
    expect(first.status).toBe(200);
    const second = await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, creatorCookie, "POST", { correct: 5, total: 5 }), envWith(kv), code);
    expect(second.status).toBe(409);

    const stored = JSON.parse(kv._store.get("challenge:" + code));
    expect(stored.creatorResult.correct).toBe(4);
  });

  it("both participants can submit independently", async () => {
    const { kv, code, creatorCookie, opponentCookie } = await setup();
    await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, creatorCookie, "POST", { correct: 4, total: 5 }), envWith(kv), code);
    await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, opponentCookie, "POST", { correct: 5, total: 5 }), envWith(kv), code);
    const stored = JSON.parse(kv._store.get("challenge:" + code));
    expect(stored.creatorResult.correct).toBe(4);
    expect(stored.opponentResult.correct).toBe(5);
  });
});

describe("handleGetChallenge state machine and privacy", () => {
  it("unclaimed: shows creator handle, no opponent, no real emails", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);

    const res = await handleGetChallenge(req(`https://example.com/api/challenge/${code}`), envWith(kv), code);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.claimed).toBe(false);
    expect(data.opponentHandle).toBeNull();
    expect(data.creatorHandle).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain("a@example.com");
    expect(data.role).toBe("none");
  });

  it("claimed-waiting: both handles visible, no results yet", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);

    const res = await handleGetChallenge(req(`https://example.com/api/challenge/${code}`, opponentCookie), envWith(kv), code);
    const data = await res.json();
    expect(data.claimed).toBe(true);
    expect(data.opponentHandle).toBeTruthy();
    expect(data.creatorResult).toBeNull();
    expect(data.opponentResult).toBeNull();
    expect(data.role).toBe("opponent");
  });

  it("both-submitted: full head-to-head comparison available", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);
    await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, creatorCookie, "POST", { correct: 4, total: 5 }), envWith(kv), code);
    await handlePostChallengeSubmit(req(`https://example.com/api/challenge/${code}/submit`, opponentCookie, "POST", { correct: 3, total: 5 }), envWith(kv), code);

    const res = await handleGetChallenge(req(`https://example.com/api/challenge/${code}`, creatorCookie), envWith(kv), code);
    const data = await res.json();
    expect(data.creatorResult.correct).toBe(4);
    expect(data.opponentResult.correct).toBe(3);
    expect(data.role).toBe("creator");
  });

  it("404s for an expired/unknown code", async () => {
    const res = await handleGetChallenge(req("https://example.com/api/challenge/ZZZZZZ"), envWith(fakeKV()), "ZZZZZZ");
    expect(res.status).toBe(404);
  });

  it("a non-participant sees handles but never real emails or the private questionNumbers field", async () => {
    const creatorCookie = await sessionCookieFor("a@example.com");
    const opponentCookie = await sessionCookieFor("b@example.com");
    const outsiderCookie = await sessionCookieFor("c@example.com");
    const kv = fakeKV();
    const { code } = await createChallenge(kv, creatorCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code}/claim`, opponentCookie, "POST"), envWith(kv), code);

    const res = await handleGetChallenge(req(`https://example.com/api/challenge/${code}`, outsiderCookie), envWith(kv), code);
    const data = await res.json();
    expect(data.role).toBe("none");
    expect(JSON.stringify(data)).not.toContain("a@example.com");
    expect(JSON.stringify(data)).not.toContain("b@example.com");
  });
});

describe("handleGetChallenges", () => {
  it("401s with no session", async () => {
    const res = await handleGetChallenges(req("https://example.com/api/challenges"), envWith(fakeKV()));
    expect(res.status).toBe(401);
  });

  it("lists a student's own challenges as both creator and opponent", async () => {
    const aCookie = await sessionCookieFor("a@example.com");
    const bCookie = await sessionCookieFor("b@example.com");
    const kv = fakeKV();
    const { code: code1 } = await createChallenge(kv, aCookie);
    const { code: code2 } = await createChallenge(kv, bCookie);
    await handlePostChallengeClaim(req(`https://example.com/api/challenge/${code2}/claim`, aCookie, "POST"), envWith(kv), code2);

    const res = await handleGetChallenges(req("https://example.com/api/challenges", aCookie), envWith(kv));
    const data = await res.json();
    expect(res.status).toBe(200);
    const codes = data.challenges.map(c => c.code);
    expect(codes).toContain(code1);
    expect(codes).toContain(code2);
    expect(data.challenges.find(c => c.code === code1).role).toBe("creator");
    expect(data.challenges.find(c => c.code === code2).role).toBe("opponent");
  });

  it("does not list challenges the student has no part in", async () => {
    const aCookie = await sessionCookieFor("a@example.com");
    const cCookie = await sessionCookieFor("c@example.com");
    const kv = fakeKV();
    await createChallenge(kv, aCookie);

    const res = await handleGetChallenges(req("https://example.com/api/challenges", cCookie), envWith(kv));
    const data = await res.json();
    expect(data.challenges).toEqual([]);
  });
});
