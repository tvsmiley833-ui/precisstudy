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

test("homepage class-card counts match each guide's real data", () => {
  try {
    execFileSync(process.execPath, ["scripts/sync-home-counts.mjs", "--check"], { stdio: "pipe" });
  } catch (e) {
    assert.fail("homepage counts out of date — run `node scripts/sync-home-counts.mjs`\n" + e.stdout);
  }
});

// Generator scaffold text must never ship as study content (see the
// content-quality skill's "scaffold check").
test("no guide contains generator placeholder text", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const tells = [
    /Which best describes a central idea of/, /must know cold/, /Unit \d+ core term/,
    /The definition your teacher will test/, /The essential framework of/,
    /It provides foundational concepts later units build on/, /Practice exam question \d+/,
  ];
  const bad = [];
  for (const f of readdirSync("guides").filter(f => f.endsWith(".json"))) {
    const text = readFileSync(`guides/${f}`, "utf8");
    for (const re of tells) if (re.test(text)) bad.push(`${f}: ${re}`);
  }
  assert.deepEqual(bad, []);
});
