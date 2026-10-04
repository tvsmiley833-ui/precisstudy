import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("class-counts.json matches the guides", () => {
  assert.doesNotThrow(() => execFileSync("node", ["scripts/gen-class-counts.mjs", "--check"], { stdio: "pipe" }));
});

test("every class lists its units with question counts that match the total", () => {
  const rows = JSON.parse(readFileSync("public/shared/class-counts.json", "utf8"));
  for (const r of rows) {
    assert.equal(r.unitQs.length, r.units, r.slug);
    // a question repeated in two units counts once in the total but once per unit here
    const sum = r.unitQs.reduce((a, u) => a + u[2], 0);
    assert.ok(sum >= r.questions && sum - r.questions <= 3, r.slug);
  }
});
