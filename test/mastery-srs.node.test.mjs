import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSrs, shiftUnitKeys, migrateLocalAlgebra2 } from "../public/shared/mastery.js";

test("mergeSrs keeps the most recently reviewed side per card", () => {
  const local = { a: [2, 200, 100], b: [3, 300, 50] };
  const server = { a: [4, 900, 400], b: [1, 10, 10], c: [1, 5, 5] };
  assert.deepEqual(mergeSrs(local, server), { a: [4, 900, 400], b: [3, 300, 50], c: [1, 5, 5] });
});

test("mergeSrs: a real review beats a never-reviewed (t = 0 or missing) entry, in either direction", () => {
  assert.deepEqual(mergeSrs({ a: [2, 200, 0] }, { a: [3, 300, 7] }), { a: [3, 300, 7] });
  assert.deepEqual(mergeSrs({ a: [3, 300, 7] }, { a: [2, 200] }), { a: [3, 300, 7] });
});

test("mergeSrs: ties keep the first argument", () => {
  assert.deepEqual(mergeSrs({ a: [2, 200, 5] }, { a: [4, 400, 5] }), { a: [2, 200, 5] });
});

test("mergeSrs tolerates missing or malformed input and does not mutate its arguments", () => {
  const local = { a: [2, 200, 5] };
  assert.deepEqual(mergeSrs(undefined, undefined), {});
  assert.deepEqual(mergeSrs(local, undefined), local);
  assert.deepEqual(mergeSrs(undefined, { a: [1, 2, 3] }), { a: [1, 2, 3] });
  assert.deepEqual(mergeSrs(local, { b: "junk", c: null }), local);
  mergeSrs(local, { a: [9, 9, 99] });
  assert.deepEqual(local, { a: [2, 200, 5] });
});

// ---- Algebra II gained a new Unit 2: saved unit keys 2-12 must move to 3-13 (Unit 1 stays).
function withLocalStorage(initial, fn) {
  const data = { ...initial };
  globalThis.localStorage = { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; } };
  try { return fn(data); } finally { delete globalThis.localStorage; }
}

test("shiftUnitKeys(from) only moves keys at or after the inserted unit", () => {
  assert.deepEqual(shiftUnitKeys({ 1: "a", 2: "b", 12: "c", x: "d" }, 2), { 1: "a", 3: "b", 13: "c", x: "d" });
  assert.deepEqual(shiftUnitKeys({ 1: "a", 2: "b" }), { 2: "a", 3: "b" }, "default still shifts everything (Physics)");
});

test("migrateLocalAlgebra2 shifts old local mastery once", () => {
  withLocalStorage({}, data => {
    const state = { mastery: { 1: { correct: 1, total: 1 }, 2: { correct: 2, total: 3 }, 12: { correct: 4, total: 5 } }, examples: {}, cardsKnown: [], srs: {} };
    assert.equal(migrateLocalAlgebra2(state), true);
    assert.deepEqual(Object.keys(state.mastery).sort((a, b) => a - b), ["1", "3", "13"]);
    assert.deepEqual(state.mastery[3], { correct: 2, total: 3 });
    assert.equal(data["ssMigrated_algebra2-units-v2"], "1");
    assert.equal(migrateLocalAlgebra2(state), false, "second run does nothing");
    assert.deepEqual(Object.keys(state.mastery).sort((a, b) => a - b), ["1", "3", "13"]);
  });
});

test("migrateLocalAlgebra2 leaves already-new data (has a unit 13) and empty state alone, but still sets the flag", () => {
  withLocalStorage({}, data => {
    const fresh = { mastery: { 2: { correct: 1, total: 1 }, 13: { correct: 1, total: 2 } }, examples: {}, cardsKnown: [], srs: {} };
    assert.equal(migrateLocalAlgebra2(fresh), false);
    assert.deepEqual(Object.keys(fresh.mastery).sort((a, b) => a - b), ["2", "13"]);
    assert.equal(data["ssMigrated_algebra2-units-v2"], "1");
  });
  withLocalStorage({}, () => {
    assert.equal(migrateLocalAlgebra2({ mastery: {}, examples: {}, cardsKnown: [], srs: {} }), false);
  });
});

test("migrateLocalAlgebra2 survives blocked storage without changing anything", () => {
  globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  try {
    const state = { mastery: { 2: { correct: 1, total: 1 } }, examples: {}, cardsKnown: [], srs: {} };
    assert.equal(migrateLocalAlgebra2(state), false);
    assert.deepEqual(Object.keys(state.mastery), ["2"]);
  } finally { delete globalThis.localStorage; }
});
