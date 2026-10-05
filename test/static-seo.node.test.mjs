// Static SEO lint over every indexable page (see scripts/check-seo.mjs): unique titles and descriptions of sensible length,
// canonical URLs that match the path, Open Graph tags and JSON-LD that parses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("indexable pages pass the static SEO lint", () => {
  try { execFileSync("node", ["scripts/check-seo.mjs"], { encoding: "utf8" }); }
  catch (e) { assert.fail(String(e.stdout || e.message).split("\n").slice(0, 25).join("\n")); }
});
