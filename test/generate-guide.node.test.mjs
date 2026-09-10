// Run with: node --test test/generate-guide.node.test.mjs
// (Kept out of the vitest suite: vitest runs in the Cloudflare Workers pool,
// which has no node:fs, and generate-guide.mjs reads template files on import.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateGuide } from "../scripts/generate-guide.mjs";

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

test("emits hard-mode questions and keeps the 7-tab index map", () => {
  const html = generateGuide({
    ...base(),
    hardQuiz: [{ u: 1, q: "hard?", o: ["a", "b", "c", "d"], a: 1, e: "he" }],
  });
  assert.ok(html.includes('"hard?"'), "hard question emitted");
  assert.ok(html.includes("examples:3,exam:4,qref:5,memory:6"), "tab index map updated");
});

test("uses masteryKey when provided, slug otherwise", () => {
  assert.ok(generateGuide({ ...base(), masteryKey: "aplang" }).includes("__ssCreateMastery('aplang'"));
  assert.ok(generateGuide(base()).includes("__ssCreateMastery('demo'"));
});

test("rejects malformed workedExamples / hardQuiz", () => {
  assert.throws(() => generateGuide({ ...base(), workedExamples: [{ u: 1, title: "x" }] }), /workedExamples/);
  assert.throws(() => generateGuide({ ...base(), hardQuiz: [{ u: 1, q: "x", o: ["a"], a: 0 }] }), /hardQuiz/);
});

test("output is stable across repeated runs", () => {
  const cfg = { ...base(), workedExamples: [{ u: 1, title: "T", prompt: "P", steps: ["s"], answer: "A" }] };
  assert.equal(generateGuide(cfg), generateGuide(cfg));
});
