#!/usr/bin/env node
// Build-time migration tool: pull a hand-authored guide page's inline data
// (public/<slug>/index.html) into guides/<slug>.draft.json so it can be driven
// by generate-guide.mjs. Developer-run, one-shot, over our own source — not
// imported by anything. Delete once all legacy pages are migrated.
//
//   node scripts/extract-legacy-guide.mjs <slug>
//
// Resolve every "UNCAPTURED const" warning by hand before finalizing the JSON.
import { readFileSync, writeFileSync } from "node:fs";
import { extractArrayLiteral, extractMergedArray, extractElementInner } from "./lib/extract-literals.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/extract-legacy-guide.mjs <slug>");
  process.exit(1);
}
const src = readFileSync(`public/${slug}/index.html`, "utf8");

const evalLiteral = (name) => {
  const lit = extractArrayLiteral(src, name);
  if (!lit) return undefined;
  return new Function(`return (${lit.replace(new RegExp(`^const ${name}=`), "")});`)();
};
const arr = (name, { merged = true } = {}) => {
  const v = merged ? extractMergedArray(src, name) : evalLiteral(name);
  const out = Array.isArray(v) ? v : [];
  if (v !== undefined && v !== null) console.log(`  ${name}: ${out.length}`);
  return out;
};

// Template / runtime constants that are NOT guide data — never captured.
const SKIP = new Set([
  "EXAM_CSS", "REQUEUE_DELAY", "SEARCH_BADGE", "R", "GEO_KEY",
  "CBOT_KEY", "CBOT_OMNIROUTE_MODEL", "CBOT_OMNIROUTE_URL", "CBOT_PUBLISHED", "CBOT_STOPWORDS",
]);
// Consts folded into the output (directly or via .push.apply merges).
const CAPTURED = new Set([
  "UNITS", "FLASHCARDS", "QUIZ", "HARD_Q", "WORKED", "DIAGRAMS",
  "PART_A", "PART_B1", "PART_B2", "PART_C",
  "EXTRA_FC", "EXTRA_QUIZ", "EXTRA_QUIZ2", "EXTRA2_QUIZ", "EXTRA3_QUIZ", "QUIZ_EXTRA",
  "EXTRA_WORKED", "IMG_QUIZ", "REGENTS_UP", "GEN_BANK", "BANK_V15", "WORKED_SVGS",
]);
for (const m of src.matchAll(/const ([A-Z_0-9]+)=/g)) {
  const n = m[1];
  if (!SKIP.has(n) && !CAPTURED.has(n)) {
    console.warn(`  UNCAPTURED const ${n}= — inspect public/${slug}/index.html by hand`);
  }
}

const accentColor = (src.match(/--accent:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || null;
const masteryKey = (src.match(/__ssCreateMastery\('([^']+)'/) || [])[1] || slug;
const title = (src.match(/<title>([^<]+?)\s+Study Guide/) || [])[1] || slug;
console.log(`  title=${title}  accent=${accentColor}  masteryKey=${masteryKey}`);

const out = {
  slug,
  title,
  accentColor,
  masteryKey,
  units: arr("UNITS", { merged: false }),
  flashcards: arr("FLASHCARDS"),
  quiz: arr("QUIZ"),
  hardQuiz: arr("HARD_Q", { merged: false }),
  workedExamples: arr("WORKED"),
  examParts: {
    PART_A: arr("PART_A", { merged: false }),
    PART_B1: arr("PART_B1", { merged: false }),
    PART_B2: arr("PART_B2", { merged: false }),
    PART_C: arr("PART_C", { merged: false }),
  },
  diagrams: (() => {
    const v = evalLiteral("DIAGRAMS");
    return v && typeof v === "object" ? v : {};
  })(),
  // Verbatim hand-authored Quick Reference / Memory Tricks markup. Keep in the
  // final JSON only for pages whose qref/memory is NOT just unit-derived cards
  // (the generator's buildQref/buildMemory); drop otherwise.
  qrefHtml: (extractElementInner(src, 'id="view-qref"') || "").trim() || null,
  memoryHtml: (extractElementInner(src, 'id="view-memory"') || "").trim() || null,
};
console.log(`  qrefHtml: ${out.qrefHtml ? out.qrefHtml.length + " chars" : "none"}  memoryHtml: ${out.memoryHtml ? out.memoryHtml.length + " chars" : "none"}`);

writeFileSync(`guides/${slug}.draft.json`, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote guides/${slug}.draft.json`);
