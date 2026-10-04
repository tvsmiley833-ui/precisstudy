import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { isOldEnough, validBirth, handleAgePost, ageGate, ageStatus, AGE_COOKIE } from "../src/age-gate.js";

const env = { SESSION_SECRET: "test-session-secret" };
const NOW = new Date("2026-10-04T12:00:00Z");

describe("isOldEnough", () => {
  it("counts the birth as the last day of the month, so borderline answers are never let through", () => {
    expect(isOldEnough(10, 2013, new Date("2026-10-30T00:00:00Z"))).toBe(false); // turns 13 on 31 Oct at the earliest
    expect(isOldEnough(10, 2013, new Date("2026-10-31T00:00:00Z"))).toBe(true);
    expect(isOldEnough(11, 2013, NOW)).toBe(false);
    expect(isOldEnough(9, 2013, NOW)).toBe(true);
    expect(isOldEnough(1, 2015, NOW)).toBe(false);
    expect(isOldEnough(6, 2009, NOW)).toBe(true);
  });
  it("handles February and leap years", () => {
    expect(isOldEnough(2, 2012, new Date("2025-02-27T00:00:00Z"))).toBe(false);
    expect(isOldEnough(2, 2012, new Date("2025-02-28T00:00:00Z"))).toBe(true); // 2025 has no 29 Feb, so the birthday lands on the 28th
    expect(isOldEnough(2, 2011, new Date("2024-02-28T00:00:00Z"))).toBe(false); // 2024 is a leap year: 29 Feb is the last day
    expect(isOldEnough(2, 2011, new Date("2024-02-29T00:00:00Z"))).toBe(true);
  });
});

describe("validBirth", () => {
  it("accepts a real month/year and rejects nonsense", () => {
    expect(validBirth(5, 2010, NOW)).toEqual({ month: 5, year: 2010 });
    for (const [m, y] of [[0, 2010], [13, 2010], [5, 1800], [5, 2027], [11, 2026], ["5", 2010], [5.5, 2010], [null, undefined]]) expect(validBirth(m, y, NOW)).toBeNull();
  });
});

async function answer(month, year, cookie) {
  const req = new Request("https://precisstudy.com/api/age", { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ month, year }) });
  const res = await handleAgePost(req, env);
  const set = res.headers.get("Set-Cookie");
  return { res, body: await res.json(), cookie: set ? set.split(";")[0] : null, set };
}

describe("age answer", () => {
  it("an old-enough answer sets a signed HttpOnly cookie and nothing about the birth date", async () => {
    const { body, cookie, set } = await answer(1, 2000);
    expect(body).toEqual({ allowed: true });
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
    expect(cookie).toMatch(new RegExp(`^${AGE_COOKIE}=`));
    expect(cookie).not.toContain("2000");
    expect(await ageStatus(new Request("https://x.test/", { headers: { Cookie: cookie } }), env)).toBe("ok");
  });
  it("an under-13 answer is remembered, and cannot be changed by answering again", async () => {
    const first = await answer(1, new Date().getUTCFullYear() - 10);
    expect(first.body).toEqual({ allowed: false });
    expect(await ageStatus(new Request("https://x.test/", { headers: { Cookie: first.cookie } }), env)).toBe("under");
    const retry = await answer(1, 1990, first.cookie);
    expect(retry.body).toEqual({ allowed: false });
  });
  it("rejects a malformed answer with 400 and sets no cookie", async () => {
    const { res, set } = await answer(13, 2000);
    expect(res.status).toBe(400);
    expect(set).toBeNull();
  });
  it("a forged cookie is not trusted", async () => {
    expect(await ageStatus(new Request("https://x.test/", { headers: { Cookie: `${AGE_COOKIE}=eyJwdXJwb3NlIjoiYWdlIiwib2siOnRydWV9.AAAA` } }), env)).toBe("unknown");
  });
});

describe("the gate on sign-in", () => {
  const url = (p) => new URL("https://precisstudy.com" + p);
  const get = (p, cookie) => new Request("https://precisstudy.com" + p, { headers: cookie ? { Cookie: cookie } : {} });
  it("sends an unanswered visitor to the age page, remembering where they were going", async () => {
    const res = await ageGate(get("/auth/google/start?next=%2Fbiology%2F"), env, url("/auth/google/start?next=%2Fbiology%2F"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/age/?next=" + encodeURIComponent("/auth/google/start?next=%2Fbiology%2F"));
  });
  it("lets an old-enough visitor through and blocks an under-13 one on both providers", async () => {
    const ok = (await answer(1, 1999)).cookie, under = (await answer(1, new Date().getUTCFullYear() - 9)).cookie;
    for (const p of ["/auth/google/start", "/auth/github/start"]) {
      expect(await ageGate(get(p, ok), env, url(p))).toBeNull();
      const blocked = await ageGate(get(p, under), env, url(p));
      expect(blocked.headers.get("Location")).toBe("https://precisstudy.com/age/?blocked=1");
    }
  });
  it("the email form gets a 403 until the age is confirmed", async () => {
    const post = (cookie) => new Request("https://precisstudy.com/auth/email/start", { method: "POST", headers: cookie ? { Cookie: cookie } : {} });
    const res = await ageGate(post(), env, url("/auth/email/start"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("age_required");
    expect(await ageGate(post((await answer(1, 1999)).cookie), env, url("/auth/email/start"))).toBeNull();
  });
  it("does not touch the callbacks, sign-out, or ordinary pages", async () => {
    for (const p of ["/auth/google/callback", "/auth/me", "/auth/logout", "/", "/biology/"]) expect(await ageGate(get(p), env, url(p))).toBeNull();
  });
});

describe("through the real worker", () => {
  it("the age page is served, and /api/age only accepts POST", async () => {
    expect((await SELF.fetch("https://precisstudy.com/age/")).status).toBe(200);
    expect((await SELF.fetch("https://precisstudy.com/api/age")).status).toBe(405);
  });
});
