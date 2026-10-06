// Ratchet: the number of "correct answer is by far the longest option" questions per guide may only go down.
// See scripts/audit-answer-length.mjs. After rewriting distractors, run it with --write to lock in the lower number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditAll } from "../scripts/audit-answer-length.mjs";

test("no guide gains answer-length giveaway questions", () => {
  const base = JSON.parse(readFileSync(new URL("./answer-length-baseline.json", import.meta.url), "utf8"));
  const worse = Object.entries(auditAll()).filter(([k, v]) => v.giveaway > (base[k] ?? 0)).map(([k, v]) => `${k}: ${v.giveaway} > ${base[k] ?? 0}`);
  assert.deepEqual(worse, []);
});
