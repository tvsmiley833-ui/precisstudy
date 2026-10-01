#!/usr/bin/env node
// Regenerate guide pages from guides/<slug>.json with the generator template.
//
//   node scripts/regen-guides.mjs              # every guide
//   node scripts/regen-guides.mjs algebra2 ... # just these
//   node scripts/regen-guides.mjs --check      # report drift, write nothing (exit 1 if any)
//
// Use this after changing the template (scripts/guide-template/*, scripts/generate-guide.mjs)
// so every page picks it up. For a content-only edit, apply-guide-json.mjs is enough.
// test/pages-match-generator.node.test.mjs fails if a page and the generator ever disagree,
// so never hand-edit a guide page: change the template or the JSON, then run this.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { generateGuide } from "./generate-guide.mjs";

const args = process.argv.slice(2);
const check = args.includes("--check");
const wanted = args.filter(a => !a.startsWith("--"));
const slugs = (wanted.length ? wanted : readdirSync("guides").filter(f => f.endsWith(".json")).map(f => f.slice(0, -5))).sort();

let changed = 0;
for (const slug of slugs) {
  const path = `public/${slug}/index.html`;
  const html = generateGuide(JSON.parse(readFileSync(`guides/${slug}.json`, "utf8")));
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === html) continue;
  changed++;
  console.log(`${check ? "drift" : "updated"}: ${slug}`);
  if (!check) writeFileSync(path, html);
}
console.log(changed ? `${changed} of ${slugs.length} page(s) ${check ? "differ from the generator" : "regenerated"}` : `all ${slugs.length} page(s) match the generator`);
if (check && changed) process.exit(1);
