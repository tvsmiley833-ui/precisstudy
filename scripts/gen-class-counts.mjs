#!/usr/bin/env node
// public/shared/class-counts.json: one {slug, title, units, questions} row per guide, for the planner's pace calculator.
//   node scripts/gen-class-counts.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const rows = readdirSync("guides").filter(f => f.endsWith(".json")).sort().map(f => {
  const g = JSON.parse(readFileSync(`guides/${f}`, "utf8"));
  return { slug: g.slug, title: g.title, units: g.units.length, questions: new Set(g.quiz.map(q => q.q)).size };
}).sort((a, b) => a.title.localeCompare(b.title));
const out = JSON.stringify(rows) + "\n", path = "public/shared/class-counts.json";
if (process.argv.includes("--check")) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== out) { console.error("class-counts.json is out of date: run node scripts/gen-class-counts.mjs"); process.exit(1); }
} else { writeFileSync(path, out); console.log(`${rows.length} classes`); }
