import { describe, it, expect } from "vitest";
import { effectiveStreak, localDays } from "../src/streak.js";

const NOW = new Date("2026-10-03T15:00:00Z");

describe("effectiveStreak", () => {
  it("counts a streak active today or yesterday", () => {
    expect(effectiveStreak({ current: 12, lastActiveDate: "2026-10-03", timezone: "UTC" }, NOW)).toBe(12);
    expect(effectiveStreak({ current: 12, lastActiveDate: "2026-10-02", timezone: "UTC" }, NOW)).toBe(12);
  });
  it("is zero once a day has been missed, whatever number was stored", () => {
    expect(effectiveStreak({ current: 12, lastActiveDate: "2026-10-01", timezone: "UTC" }, NOW)).toBe(0);
    expect(effectiveStreak({ current: 12, lastActiveDate: null }, NOW)).toBe(0);
    expect(effectiveStreak(null, NOW)).toBe(0);
  });
  it("uses the student's own time zone for today and yesterday", () => {
    // 2026-10-03T15:00Z is already Oct 4 in Auckland, so Oct 3 is "yesterday" there and Oct 2 has lapsed.
    expect(localDays("Pacific/Auckland", NOW)).toEqual({ today: "2026-10-04", yesterday: "2026-10-03" });
    expect(effectiveStreak({ current: 5, lastActiveDate: "2026-10-03", timezone: "Pacific/Auckland" }, NOW)).toBe(5);
    expect(effectiveStreak({ current: 5, lastActiveDate: "2026-10-02", timezone: "Pacific/Auckland" }, NOW)).toBe(0);
  });
  it("falls back to UTC for a bad time zone instead of throwing", () => {
    expect(effectiveStreak({ current: 3, lastActiveDate: "2026-10-03", timezone: "Not/AZone" }, NOW)).toBe(3);
  });
});

import { icsEscape, icsFold } from "../src/progress-routes.js";

describe("ICS output", () => {
  it("escapes every kind of line break so a label can't inject calendar properties", () => {
    expect(icsEscape("a\r\nEND:VEVENT\rX;Y,Z")).toBe("a\\nEND:VEVENT\\nX\\;Y\\,Z");
  });
  it("folds long lines at 75 octets without splitting a character", () => {
    const line = "SUMMARY:" + "é".repeat(60);
    const folded = icsFold(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

import { sm2 } from "../src/flashcards-routes.js";

describe("flashcard due dates use the student's day", () => {
  it("counts from the supplied local date instead of the server's UTC date", () => {
    expect(sm2({}, "again", "2026-03-10").due).toBe("2026-03-11");
    expect(sm2({ reps: 1, interval: 1, ease: 2.5 }, "good", "2026-03-10").due).toBe("2026-03-16");
  });
  it("falls back to the server date without one", () => {
    expect(sm2({}, "again").due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { handleFeedbackSubmit } from "../src/feedback.js";

describe("feedback length", () => {
  it("refuses an over-long message instead of silently cutting it", async () => {
    const res = await handleFeedbackSubmit(new Request("https://example.com/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "x".repeat(2500) }) }), { FEEDBACK: { put: async () => {}, get: async () => null }, PROGRESS: { put: async () => {}, get: async () => null } });
    expect(res.status).toBe(400);
  });
});

import { signSession, SESSION_COOKIE } from "../src/auth.js";

describe("feedback and the account email", () => {
  async function submit(extra) {
    const stored = [];
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession({ email: "kid@example.com", name: "Kid", provider: "google", iat: now, exp: now + 3600 }, "sec");
    const env = { SESSION_SECRET: "sec", FEEDBACK: { put: async (k, v) => { if (k.startsWith("fb:")) stored.push(JSON.parse(v)); }, get: async () => null }, PROGRESS: { put: async () => {}, get: async () => null } };
    const res = await handleFeedbackSubmit(new Request("https://example.com/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `${SESSION_COOKIE}=${token}` }, body: JSON.stringify({ message: "hello", ...extra }) }), env);
    expect(res.status).toBe(200);
    return stored[0];
  }
  it("does not attach the signed-in email unless the visitor opts in", async () => {
    expect((await submit({})).email).toBe("");
    expect((await submit({ contactMe: true })).email).toBe("kid@example.com");
  });
});

import { scrubUrl, scrubText } from "../src/client-log-routes.js";

describe("client log scrubbing", () => {
  it("keeps only origin and path of a URL", () => {
    expect(scrubUrl("https://precisstudy.com/share/?t=abcdef123456&x=1#frag")).toBe("https://precisstudy.com/share/");
  });
  it("redacts emails, token parameters and long key-like strings", () => {
    const out = scrubText("fail for kid@example.com at /api?token=abc123XYZ and key QWERTYUIOPASDFGHJKLZXCVBNM123456");
    expect(out).not.toMatch(/kid@|abc123XYZ|QWERTYUIOP/);
    expect(out).toContain("[email]");
  });
});

import { shiftExampleKeys, migrateAlgebra2Units, ALGEBRA2_SHIFT_CUTOFF } from "../src/progress-routes.js";

describe("unit migrations and worked examples", () => {
  it("moves example ids with their unit", () => {
    expect(shiftExampleKeys({ "1-0": true, "2-0": true, "3-1": true }, 2)).toEqual({ "1-0": true, "3-0": true, "4-1": true });
  });
  it("shifts Algebra II examples and clears the boss with the mastery", () => {
    const blob = { updatedAt: "2026-09-01T00:00:00.000Z", algebra2: { mastery: { "2": { correct: 1, total: 2 } }, examples: { "2-0": true }, cardsKnown: [] }, quest: { boss: { unit: 2 } }, migrations: [] };
    expect(blob.updatedAt < ALGEBRA2_SHIFT_CUTOFF).toBe(true);
    migrateAlgebra2Units(blob);
    expect(Object.keys(blob.algebra2.examples)).toEqual(["3-0"]);
    expect(blob.quest.boss).toBeNull();
  });
});
