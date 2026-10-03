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
