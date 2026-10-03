import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const lum = (hex) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const whiteOn = (hex) => 1.05 / (lum(hex) + 0.05);

const dash = read("../public/dashboard/index.html");
const dashColors = Object.fromEntries([...dash.match(/const SUBJECT_COLORS = \{([\s\S]*?)\};/)[1].matchAll(/'?([a-z0-9-]+)'?: '(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]));
const settingsColors = Object.fromEntries([...read("../public/settings/index.html").matchAll(/key: '([a-z0-9-]+)', cat: '[a-z]+', label: '[^']*', color: '(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]));

test("every subject colour carries white text at 4.5:1, on the dashboard and in settings", () => {
  for (const [k, v] of Object.entries({ ...dashColors, ...settingsColors })) assert.ok(whiteOn(v) >= 4.5, `${k} ${v} ${whiteOn(v).toFixed(2)}`);
});
test("french-2 and french-3 have a colour, and dashboard and settings agree", () => {
  assert.ok(dashColors["french-2"] && dashColors["french-3"]);
  for (const [k, v] of Object.entries(settingsColors)) if (dashColors[k]) assert.equal(dashColors[k], v, k);
});
