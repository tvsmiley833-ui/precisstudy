import { describe, it, expect } from "vitest";
import { computeUnitStatus, computeReadiness, recommendNext, topWeakUnits, buildSchedule, migrateLocalPhysics } from "../public/shared/mastery.js";

describe("computeUnitStatus", () => {
  it("is not-assessed with no record", () => {
    expect(computeUnitStatus(undefined)).toBe("not-assessed");
  });

  it("is not-assessed below the 2-question threshold", () => {
    expect(computeUnitStatus({ correct: 1, total: 1 })).toBe("not-assessed");
  });

  it("is red below 50%", () => {
    expect(computeUnitStatus({ correct: 1, total: 3 })).toBe("red");
  });

  it("is amber between 50% and 80%", () => {
    expect(computeUnitStatus({ correct: 3, total: 5 })).toBe("amber");
  });

  it("is green at or above 80%", () => {
    expect(computeUnitStatus({ correct: 4, total: 5 })).toBe("green");
  });
});

describe("computeReadiness", () => {
  it("returns null pct when nothing is assessed", () => {
    const result = computeReadiness({}, [1, 2, 3]);
    expect(result).toEqual({ pct: null, assessedCount: 0, totalCount: 3 });
  });

  it("averages only assessed units", () => {
    const mastery = {
      1: { correct: 4, total: 4 },  // 100%, assessed
      2: { correct: 1, total: 1 },  // not assessed (total < 2)
      3: { correct: 1, total: 4 }   // 25%, assessed
    };
    const result = computeReadiness(mastery, [1, 2, 3]);
    expect(result).toEqual({ pct: 63, assessedCount: 2, totalCount: 3 });
  });
});

describe("recommendNext", () => {
  const unitNames = { 1: "Foundations", 2: "Circle Geometry", 3: "Transformations" };

  it("recommends the diagnostic when nothing is assessed", () => {
    expect(recommendNext({}, [1, 2, 3], unitNames)).toEqual({ type: "diagnostic" });
  });

  it("recommends the single weakest assessed unit", () => {
    const mastery = {
      1: { correct: 4, total: 5 },  // 80%, green
      2: { correct: 1, total: 4 },  // 25%, red - weakest
      3: { correct: 3, total: 5 }   // 60%, amber
    };
    expect(recommendNext(mastery, [1, 2, 3], unitNames)).toEqual({ type: "practice", unitId: 2, unitName: "Circle Geometry", pct: 25 });
  });

  it("recommends review when every assessed unit is >= 80%", () => {
    const mastery = {
      1: { correct: 4, total: 5 },  // 80%
      2: { correct: 5, total: 5 }   // 100%
    };
    expect(recommendNext(mastery, [1, 2], unitNames)).toEqual({ type: "review" });
  });
});

describe("topWeakUnits", () => {
  const unitNames = { 1: "Foundations", 2: "Circle Geometry", 3: "Transformations", 4: "Proofs" };

  it("ranks assessed units weakest-first, capped at n", () => {
    const mastery = {
      1: { correct: 4, total: 5 },  // 80%
      2: { correct: 1, total: 4 },  // 25%
      3: { correct: 3, total: 5 },  // 60%
      4: { correct: 2, total: 5 }   // 40%
    };
    expect(topWeakUnits(mastery, [1, 2, 3, 4], unitNames, 3)).toEqual([
      { unitId: 2, unitName: "Circle Geometry", pct: 25 },
      { unitId: 4, unitName: "Proofs", pct: 40 },
      { unitId: 3, unitName: "Transformations", pct: 60 }
    ]);
  });

  it("excludes not-yet-assessed units (total < 2)", () => {
    const mastery = { 1: { correct: 1, total: 1 }, 2: { correct: 1, total: 4 } };
    expect(topWeakUnits(mastery, [1, 2], unitNames)).toEqual([
      { unitId: 2, unitName: "Circle Geometry", pct: 25 }
    ]);
  });

  it("returns an empty array when nothing is assessed", () => {
    expect(topWeakUnits({}, [1, 2, 3], unitNames)).toEqual([]);
  });
});

describe("buildSchedule", () => {
  const unitNames = { 1: "Foundations", 2: "Circle Geometry", 3: "Triangles", 4: "Polygons" };

  it("returns empty days array when days is 0", () => {
    const mastery = { 1: { correct: 3, total: 5 } };
    const result = buildSchedule(mastery, [1], unitNames, 0, 30);
    expect(result).toEqual({ allMastered: false, days: [] });
  });

  it("returns allMastered true when every assessed unit is >= 80%", () => {
    const mastery = {
      1: { correct: 4, total: 5 },
      2: { correct: 5, total: 5 }
    };
    const result = buildSchedule(mastery, [1, 2], unitNames, 5, 30);
    expect(result).toEqual({ allMastered: true, days: [] });
  });

  it("cycles through weak units round robin with no exam day when days < 5", () => {
    const mastery = {
      1: { correct: 1, total: 5 },
      2: { correct: 3, total: 5 }
    };
    const result = buildSchedule(mastery, [1, 2], unitNames, 4, 30);
    expect(result.allMastered).toBe(false);
    expect(result.days).toHaveLength(4);
    expect(result.days[0].unitId).toBe(1);
    expect(result.days[1].unitId).toBe(2);
    expect(result.days[2].unitId).toBe(1);
    expect(result.days[3].unitId).toBe(2);
  });

  it("reserves a final exam day when days >= 5", () => {
    const mastery = {
      1: { correct: 2, total: 5 },
      2: { correct: 3, total: 5 }
    };
    const result = buildSchedule(mastery, [1, 2], unitNames, 5, 30);
    expect(result.allMastered).toBe(false);
    expect(result.days).toHaveLength(5);
    expect(result.days[4]).toEqual({ day: 5, type: "exam" });
  });
});

describe("migrateLocalPhysics", () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };

  it("shifts old-numbered local progress once", () => {
    mem.clear();
    const state = { mastery: { "1": { correct: 1, total: 2 }, "11": { correct: 2, total: 2 } }, examples: {}, cardsKnown: [] };
    expect(migrateLocalPhysics(state)).toBe(true);
    expect(state.mastery).toEqual({ "2": { correct: 1, total: 2 }, "12": { correct: 2, total: 2 } });
    expect(migrateLocalPhysics(state)).toBe(false);
    expect(Object.keys(state.mastery)).toEqual(["2", "12"]);
  });

  it("leaves new-style progress (has unit 12) alone", () => {
    mem.clear();
    const state = { mastery: { "1": { correct: 1, total: 2 }, "12": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] };
    expect(migrateLocalPhysics(state)).toBe(false);
    expect(Object.keys(state.mastery)).toEqual(["1", "12"]);
  });
});
