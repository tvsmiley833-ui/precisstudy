import { describe, it, expect } from "vitest";
import { computeUnitStatus, computeReadiness, recommendNext } from "../public/shared/mastery.js";

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
