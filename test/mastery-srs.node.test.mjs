import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSrs } from "../public/shared/mastery.js";

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
