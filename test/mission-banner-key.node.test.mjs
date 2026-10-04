import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the banner script and the Worker's head script use the same dismissal key", () => {
  const js = readFileSync(new URL("../public/shared/mission-banner.js", import.meta.url), "utf8");
  const ts = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  const key = /DISMISS_KEY = "([^"]+)"/.exec(js)[1];
  assert.ok(ts.includes(`getItem('${key}')`));
});
