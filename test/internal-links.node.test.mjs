// Every static internal link and asset reference in public/**/*.html must resolve (see scripts/check-links.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("no broken internal links in the built pages", () => {
  let out = "";
  try { out = execFileSync("node", ["scripts/check-links.mjs"], { encoding: "utf8" }); }
  catch (e) { assert.fail(String(e.stdout || e.message).split("\n").slice(0, 15).join("\n")); }
  assert.match(out, /0 broken/);
});
