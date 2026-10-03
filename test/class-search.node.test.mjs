import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const start = html.indexOf("var SS_ABBR");
const end = html.indexOf("/* Phones: the value proposition");
const ctx = {};
vm.runInNewContext(html.slice(start, end), ctx);
const names = [...html.matchAll(/data-name="([^"]*)"/g)].map(m => m[1]);
const find = q => names.filter(n => ctx.ssClassMatches(n, q));

test("students' shorthand finds the right class", () => {
  assert.deepEqual(find("algebra 2"), ["Algebra II"]);
  assert.deepEqual(find("algebra i"), ["Algebra I"]);
  assert.ok(find("ap lang").includes("AP English Language and Composition"));
  assert.ok(find("ap gov").includes("AP US Government"));
  assert.deepEqual(find("calc ab"), ["AP Calculus AB"]);
  assert.ok(find("anatomy and phys").includes("Anatomy & Physiology"));
  assert.ok(find("apush").includes("APUSH"));
  assert.ok(find("ap stats").includes("AP Statistics"));
});
test("no match for a class that isn't there, empty query matches all", () => {
  assert.deepEqual(find("underwater basket weaving"), []);
  assert.equal(find("").length, names.length);
});

test("filtering hides a subject group's heading when none of its cards match", () => {
  assert.match(html, /querySelectorAll\('\.class-group'\)\.forEach/);
  assert.match(html, /g\.style\.display = any \? '' : 'none'/);
});

test("on phones How It Works is moved above the class list", () => {
  assert.match(html, /classes\.parentNode\.insertBefore\(how, classes\)/);
});
