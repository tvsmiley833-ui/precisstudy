// guides/<slug>.json must carry the same study data as the live page, or the
// generator would silently regenerate an older guide. Fix a failure with:
//   node scripts/sync-guide-json.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("guides/*.json match the data on the live pages", () => {
  try {
    execFileSync(process.execPath, ["scripts/sync-guide-json.mjs", "--check"], { stdio: "pipe" });
  } catch (e) {
    assert.fail("stale guide JSON — run `node scripts/sync-guide-json.mjs`\n" + e.stdout);
  }
});
