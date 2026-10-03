import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
// Reads --token:#hex from a CSS block (before or after the dark-theme rule).
const tokens = (css, dark) => {
  const [light, darkPart = ""] = css.split(/\[data-theme="dark"\]\s*\{/);
  const block = dark ? darkPart.split("}")[0] : light;
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map(m => [m[1], m[2].length === 4 ? "#" + [...m[2].slice(1)].map(c => c + c).join("") : m[2]]));
};
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("guide text tokens meet AA on every surface they sit on", () => {
  const css = read("../scripts/guide-template/style.css");
  for (const dark of [false, true]) {
    const t = tokens(css, dark);
    for (const fg of ["ink", "ink-muted", "ink-dim"])
      for (const bg of ["bg", "surface", "surface-2"])
        assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${dark ? "dark" : "light"} ${fg} on ${bg}: ${ratio(t[fg], t[bg]).toFixed(2)}`);
  }
});

test("homepage status and tier text meets AA; status dots meet 3:1", () => {
  const css = read("../public/index.html");
  for (const dark of [false, true]) {
    const t = tokens(css, dark);
    const label = dark ? "dark" : "light";
    for (const fg of ["badge-green", "status-green", "status-amber", "status-red"])
      assert.ok(ratio(t[fg], t["bg-card"]) >= 4.5, `${label} ${fg} on card`);
    assert.ok(ratio(t["status-none"], t["bg-card"]) >= 3, `${label} status-none`);
  }
  const l = tokens(css, false);
  assert.ok(ratio(l["tier-ready-text"], l["tier-ready-bg"]) >= 4.5);
  assert.ok(ratio(l["tier-ontrack-text"], l["tier-ontrack-bg"]) >= 4.5);
  assert.ok(ratio(l["tier-start-text"], l["tier-start-bg"]) >= 4.5);
});
