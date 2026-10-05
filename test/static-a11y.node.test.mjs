// Static accessibility lint over every built page (see scripts/check-a11y.mjs): lang, title, one h1, main landmark, image alt,
// named controls, labelled fields and unique ids.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("built pages pass the static accessibility lint", () => {
  try { execFileSync("node", ["scripts/check-a11y.mjs"], { encoding: "utf8" }); }
  catch (e) { assert.fail(String(e.stdout || e.message).split("\n").slice(0, 25).join("\n")); }
});
