// Run with: node --test test/generate-guide.node.test.mjs
// (Kept out of the vitest suite: vitest runs in the Cloudflare Workers pool,
// which has no node:fs, and generate-guide.mjs reads template files on import.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateGuide } from "../scripts/generate-guide.mjs";
import { readFileSync } from "node:fs";
const APP = readFileSync(new URL("../public/shared/guide-app.js", import.meta.url), "utf8");

const base = () => ({
  slug: "demo",
  title: "Demo",
  accentColor: "#4338ca",
  units: [{ id: 1, name: "One", concepts: [{ l: "C", intro: "i", b: [] }] }],
  quiz: [{ u: 1, q: "q", o: ["a", "b", "c", "d"], a: 0, e: "e" }],
  flashcards: [{ u: 1, t: "t", d: "d" }],
  examParts: { PART_A: [], PART_B1: [], PART_B2: [], PART_C: [] },
});

test("omits the Worked Examples tab when workedExamples is empty", () => {
  const html = generateGuide(base());
  assert.ok(!html.includes('id="tab-examples"'), "no examples tab button");
  assert.ok(!html.includes('id="view-examples"'), "no examples panel");
  assert.ok(html.includes("const WORKED=[];"), "WORKED emitted empty");
  assert.ok(html.includes("const HARD_Q=[];"), "HARD_Q emitted empty");
});

test("renders the Worked Examples tab + static cards when present", () => {
  const html = generateGuide({
    ...base(),
    workedExamples: [{ u: 1, title: "WT", prompt: "WP", steps: ["s1", "s2"], answer: "WA" }],
  });
  assert.ok(html.includes('id="tab-examples"'), "examples tab button");
  assert.ok(html.includes('id="view-examples"'), "examples panel");
  assert.ok(html.includes("WT") && html.includes("WP"), "example content inlined");
  assert.ok(html.includes('class="ex2-card"'), "static prerender for crawlers");
  assert.ok(html.includes('const WORKED=[{'), "WORKED data emitted");
});

test("emits hard-mode questions; switchTab derives index from DOM id", () => {
  const html = generateGuide({
    ...base(),
    hardQuiz: [{ u: 1, q: "hard?", o: ["a", "b", "c", "d"], a: 1, e: "he" }],
  });
  assert.ok(html.includes('"hard?"'), "hard question emitted");
  // switchTab must not use a hardcoded positional map (breaks on 6-tab pages)
  assert.ok(!/idx=\{guide:0,cards:1/.test(APP), "no hardcoded tab index map");
  assert.ok(APP.includes("if(b.id==='tab-'+id)idx=i"), "index derived from DOM (shared guide-app.js)");
  assert.ok(html.includes('<script src="/shared/guide-app.js">'), "page loads the shared app logic");
});

test("uses masteryKey when provided, slug otherwise", () => {
  assert.ok(generateGuide({ ...base(), masteryKey: "aplang" }).includes('"key":"aplang"'));
  assert.ok(generateGuide(base()).includes('"slug":"demo","key":"demo"'));
});

test("rejects malformed workedExamples / hardQuiz", () => {
  assert.throws(() => generateGuide({ ...base(), workedExamples: [{ u: 1, title: "x" }] }), /workedExamples/);
  assert.throws(() => generateGuide({ ...base(), hardQuiz: [{ u: 1, q: "x", o: ["a"], a: 0 }] }), /hardQuiz/);
});

test("output is stable across repeated runs", () => {
  const cfg = { ...base(), workedExamples: [{ u: 1, title: "T", prompt: "P", steps: ["s"], answer: "A" }] };
  assert.equal(generateGuide(cfg), generateGuide(cfg));
});

test("question-bank archive renders diagram figures and SVG options as markup", () => {
  const fig = '<svg class="vec" role="img" aria-label="a graph"><line/></svg>';
  const opt = '<svg class="vec" role="img" aria-label="an arrow"><line/></svg>';
  const html = generateGuide({ ...base(), qbankArchive: true, quiz: [{ u: 1, q: "Which <b>arrow</b>?", o: [opt, "2 m", "3 m", "4 m"], a: 0, e: "e", fig }] });
  assert.ok(html.includes(`<figure class="q-fig">${fig}</figure>`), "figure rendered as SVG");
  assert.ok(html.includes(`<li class="qb-correct">${opt}</li>`), "SVG option rendered as SVG");
  assert.ok(html.includes("Which &lt;b&gt;arrow&lt;/b&gt;?"), "question text still escaped");
});
