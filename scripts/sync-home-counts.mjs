#!/usr/bin/env node
// Keep the homepage class cards' "N units · M practice questions" line in
// step with each guide's real data (UNITS and the merged QUIZ bank).
//   node scripts/sync-home-counts.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extractArrayLiteral, extractMergedArray } from "./lib/extract-literals.mjs";

const check = process.argv.includes("--check");
const HOME = "public/index.html";
let home = readFileSync(HOME, "utf8");
let changed = 0;

home = home.replace(/(<a href="\/([a-z0-9-]+)\/?" class="class-card"[\s\S]*?">)(\d+) units · (\d+) practice questions(<\/div>)/g,
  (whole, pre, slug, units, qs, post) => {
    const page = `public/${slug}/index.html`;
    if (!existsSync(page)) return whole;
    const src = readFileSync(page, "utf8");
    const lit = extractArrayLiteral(src, "UNITS");
    const u = lit ? new Function(`return (${lit.replace(/^const UNITS=/, "")});`)().length : Number(units);
    const quiz = extractMergedArray(src, "QUIZ");
    // Count unique questions: several banks repeat items.
    const q = Array.isArray(quiz) ? new Set(quiz.map(x => x.q)).size : Number(qs);
    if (u === Number(units) && q === Number(qs)) return whole;
    changed++;
    console.log(`${slug}: ${units} units · ${qs} → ${u} units · ${q}`);
    return `${pre}${u} units · ${q} practice questions${post}`;
  });

if (check && changed) process.exit(1);
if (!check && changed) writeFileSync(HOME, home);
console.log(`${changed} card(s) ${check ? "out of date" : "updated"}`);
