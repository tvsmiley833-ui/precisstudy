import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("class-counts.json matches the guides", () => {
  assert.doesNotThrow(() => execFileSync("node", ["scripts/gen-class-counts.mjs", "--check"], { stdio: "pipe" }));
});
