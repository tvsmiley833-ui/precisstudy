import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSrs, shiftUnitKeys, migrateLocalAlgebra2, dueCards, daysUntil } from "../public/shared/mastery.js";

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

// ---- dashboard "what's next": due flashcards and the exam countdown
test("dueCards counts cards due now per subject and names the subject with the most", () => {
  const now = 1_000;
  const blob = {
    algebra2: { srs: { a: [1, 500, 1], b: [2, 1_000, 1], c: [3, 5_000, 1] } }, // a and b are due (due time <= now)
    physics: { srs: { x: [1, 100, 1] } },
    chemistry: { mastery: {} }, // no schedule
    aplang: { srs: "junk" }
  };
  const r = dueCards(blob, ["algebra2", "physics", "chemistry", "aplang", "missing"], now);
  assert.equal(r.total, 3);
  assert.deepEqual(r.best, { key: "algebra2", n: 2 });
});

test("dueCards is empty when nothing is due, and tolerates a missing blob", () => {
  assert.deepEqual(dueCards({ algebra2: { srs: { a: [1, 9_999, 1] } } }, ["algebra2"], 1_000), { total: 0, best: null });
  assert.deepEqual(dueCards(undefined, ["algebra2"], 1_000), { total: 0, best: null });
  assert.deepEqual(dueCards({}, [], 1_000), { total: 0, best: null });
});

test("daysUntil counts whole local days, is 0 today, negative once passed, and null for bad input", () => {
  const today = new Date(2026, 9, 1, 15, 30); // 1 Oct 2026, mid-afternoon
  assert.equal(daysUntil("2026-10-01", today), 0);
  assert.equal(daysUntil("2026-10-02", today), 1);
  assert.equal(daysUntil("2026-10-15", today), 14);
  assert.equal(daysUntil("2026-09-30", today), -1);
  assert.equal(daysUntil("2026-11-01", today), 31);
  assert.equal(daysUntil("tomorrow", today), null);
  assert.equal(daysUntil("", today), null);
  assert.equal(daysUntil(undefined, today), null);
});

// ── progress sync: adopting the server's merged counters, and not dropping answers made while a save is in flight ──
import { createMastery } from "../public/shared/mastery.js";

function syncHarness({ merged, delaySave = false }) {
  const store = new Map();
  const posts = [];
  let release;
  globalThis.window = { __ssMe: Promise.resolve({ loggedIn: true }), dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.fetch = async (url, opts) => {
    if (url === "/api/progress" && opts && opts.method === "POST") {
      posts.push(JSON.parse(opts.body));
      if (delaySave) await new Promise(r => { release = r; });
      return { ok: true, json: async () => merged };
    }
    if (url === "/api/progress") return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => ({}) }; // /api/streak
  };
  return { posts, release: () => release && release() };
}

test("a save adopts the server's merged per-unit counters, keeping whichever total is larger", async () => {
  const h = syncHarness({ merged: { mastery: { "1": { correct: 9, total: 10 }, "2": { correct: 1, total: 1 } }, examples: { ex1: true } } });
  const m = createMastery("chemistry", [1, 2], {});
  await m.init();
  m.recordAnswer(1, true); // local unit 1 is 1/1, the server already has 9/10 from another device
  m.flushSyncNow();
  await new Promise(r => setTimeout(r, 20));
  const snap = m.getSnapshot();
  assert.deepEqual(snap.mastery["1"], { correct: 9, total: 10 });
  assert.deepEqual(snap.mastery["2"], { correct: 1, total: 1 });
  assert.equal(snap.examples.ex1, true);
  assert.equal(h.posts.length, 1);
});

test("an answer recorded while a save is in flight is not marked as synced", async () => {
  const h = syncHarness({ merged: { mastery: { "1": { correct: 1, total: 1 } }, examples: {} }, delaySave: true });
  const m = createMastery("chemistry", [1], {});
  await m.init();
  m.recordAnswer(1, true);
  m.flushSyncNow();
  await new Promise(r => setTimeout(r, 10)); // request is now in flight
  m.recordAnswer(1, true); // second answer during the flight
  h.release();
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(m.getSnapshot().mastery["1"], { correct: 2, total: 2 }, "the newer local total survives the merge");
  m.flushSyncNow(); // dirty must still be set, so this sends the second answer
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.posts.length, 2, "the second answer is sent in a follow-up save");
  assert.deepEqual(h.posts[1].mastery["1"], { correct: 2, total: 2 });
  h.release();
});
