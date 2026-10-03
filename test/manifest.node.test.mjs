import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const m = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
const file = (src) => new URL("../public" + src, import.meta.url);

test("manifest is installable: 192 + 512 + maskable icons that exist", () => {
  const has = (size, purpose) => m.icons.some(i => i.sizes === size && (i.purpose || "any") === purpose);
  assert.ok(has("192x192", "any") && has("512x512", "any") && has("512x512", "maskable"));
  for (const i of m.icons) assert.ok(existsSync(file(i.src)), i.src);
});

test("start_url stays in scope and shortcuts point at real pages", () => {
  assert.ok(m.start_url.startsWith("/") && !m.start_url.startsWith("//"));
  for (const s of m.shortcuts) assert.ok(existsSync(file(s.url.split("?")[0] + "index.html")), s.url);
});
