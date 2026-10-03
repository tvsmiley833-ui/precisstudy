import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../public/", import.meta.url);
const snippet = readFileSync(new URL("index.html", root), "utf8").match(/var saved = localStorage\.getItem\('ss-theme'\);\s*\n\s*(if \(saved === 'dark'[^\n]*)/)[1];

function theme(saved, osLight) {
  let attr = null;
  vm.runInNewContext(`var saved = ${JSON.stringify(saved)}; ${snippet}`, {
    window: { matchMedia: true }, matchMedia: () => ({ matches: osLight }),
    document: { documentElement: { setAttribute: (_k, v) => { attr = v; } } },
  });
  return attr;
}

test("saved choice wins, otherwise the device preference, dark when it says nothing", () => {
  assert.equal(theme("light", false), null);
  assert.equal(theme("dark", true), "dark");
  assert.equal(theme(null, true), null);
  assert.equal(theme(null, false), "dark");
});

test("no page still forces dark for everyone who hasn't chosen light", () => {
  const dirs = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const d of dirs) {
    let html; try { html = readFileSync(new URL(`${d}/index.html`, root), "utf8"); } catch { continue; }
    assert.ok(!html.includes("if (saved !== 'light') document"), d);
  }
});
