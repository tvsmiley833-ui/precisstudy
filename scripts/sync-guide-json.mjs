#!/usr/bin/env node
// Refresh the study data in guides/<slug>.json from the live page
// (public/<slug>/index.html), which is where content edits actually land.
// Only the data fields below are replaced; config such as title, accent,
// qrefHtml and memoryHtml is left alone. Developer-run, not imported.
//
//   node scripts/sync-guide-json.mjs            # every guide
//   node scripts/sync-guide-json.mjs physics    # one guide
//   node scripts/sync-guide-json.mjs --check    # exit 1 if any JSON is stale
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { extractArrayLiteral, extractMergedArray } from "./lib/extract-literals.mjs";

const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter(a => !a.startsWith("--"));
const slugs = only.length ? only : readdirSync("guides").filter(f => f.endsWith(".json") && !f.endsWith(".draft.json")).map(f => f.slice(0, -5));

function pageData(src) {
  const lit = (name) => {
    const l = extractArrayLiteral(src, name);
    return l ? new Function(`return (${l.replace(new RegExp(`^const ${name}=`), "")});`)() : undefined;
  };
  const merged = (name) => {
    const v = extractMergedArray(src, name);
    return Array.isArray(v) ? v : undefined;
  };
  const diagrams = lit("DIAGRAMS");
  return {
    units: lit("UNITS"),
    flashcards: merged("FLASHCARDS"),
    quiz: merged("QUIZ"),
    hardQuiz: lit("HARD_Q"),
    workedExamples: merged("WORKED"),
    examParts: {
      PART_A: lit("PART_A") || [],
      PART_B1: lit("PART_B1") || [],
      PART_B2: lit("PART_B2") || [],
      PART_C: lit("PART_C") || [],
    },
    diagrams: diagrams && typeof diagrams === "object" ? diagrams : undefined,
  };
}

let stale = 0;
for (const slug of slugs) {
  const page = `public/${slug}/index.html`;
  const file = `guides/${slug}.json`;
  if (!existsSync(page) || !existsSync(file)) { console.warn(`skip ${slug}: missing page or JSON`); continue; }
  const before = readFileSync(file, "utf8");
  const json = JSON.parse(before);
  const original = JSON.stringify(json);
  const data = pageData(readFileSync(page, "utf8"));
  if (!Array.isArray(data.units) || !data.units.length) { console.warn(`skip ${slug}: no UNITS on page`); continue; }
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    // Don't add empty optional sections the JSON never had.
    const empty = Array.isArray(value) ? !value.length : !Object.keys(value).length;
    if (empty && !(key in json)) continue;
    json[key] = value;
  }
  if (JSON.stringify(json) === original) continue;
  // Keep each file's existing style: some are minified, most use 1-space indent.
  const minified = !before.trimStart().startsWith("{\n");
  const after = minified ? JSON.stringify(json) : JSON.stringify(json, null, 1) + "\n";
  stale++;
  if (check) { console.log(`stale: ${file}`); continue; }
  writeFileSync(file, after);
  console.log(`updated ${file}`);
}
if (check && stale) process.exit(1);
console.log(`${stale} guide JSON file(s) ${check ? "stale" : "updated"}`);
