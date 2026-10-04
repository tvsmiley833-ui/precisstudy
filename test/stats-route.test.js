import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGetStats } from "../src/progress-routes.js";

const SECRET = "s";
const kv = (init) => { const m = new Map(Object.entries(init || {})); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; };
const req = async (email) => { const now = Math.floor(Date.now() / 1000); return new Request("https://x.test/api/stats", { headers: email ? { Cookie: `${SESSION_COOKIE}=${await signSession({ email, name: "n", provider: "google", iat: now, exp: now + 600 }, SECRET)}` } : {} }); };

describe("GET /api/stats", () => {
  it("needs a session", async () => { expect((await handleGetStats(await req(null), { SESSION_SECRET: SECRET, PROGRESS: kv() })).status).toBe(401); });
  it("returns level 1 and 0 XP for a new account", async () => {
    const r = await handleGetStats(await req("a@b.co"), { SESSION_SECRET: SECRET, PROGRESS: kv() });
    expect(await r.json()).toEqual({ streak: 0, xp: 0, level: 1 });
  });
  it("uses the dashboard's XP and level curve", async () => {
    const blob = { geometry: { mastery: { 1: { correct: 30, total: 40 } }, cardsKnown: ["a", "b"] }, enrolledSubjects: [] };
    const r = await handleGetStats(await req("a@b.co"), { SESSION_SECRET: SECRET, PROGRESS: kv({ "progress:a@b.co": JSON.stringify(blob) }) });
    const j = await r.json();
    expect(j.xp).toBe(304); // 30 correct x 10 + 2 cards x 2
    expect(j.level).toBe(3); // level 3 starts at round(100 * 2^1.6) = 303
  });
  it("adds claimed quest XP to the one total", async () => {
    const blob = { quest: { xp: 120 }, enrolledSubjects: [] };
    const r = await handleGetStats(await req("a@b.co"), { SESSION_SECRET: SECRET, PROGRESS: kv({ "progress:a@b.co": JSON.stringify(blob) }) });
    expect((await r.json()).xp).toBe(120);
  });
});
