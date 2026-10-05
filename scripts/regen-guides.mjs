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
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateGuide } from "./generate-guide.mjs";

// Paths come from this file's location, so it works from any working directory.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const check = args.includes("--check");
const wanted = args.filter(a => !a.startsWith("--"));
const slugs = (wanted.length ? wanted : readdirSync(join(ROOT, "guides")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5))).sort();

let changed = 0;
for (const slug of slugs) {
  const path = join(ROOT, "public", slug, "index.html");
  const html = generateGuide(JSON.parse(readFileSync(join(ROOT, "guides", `${slug}.json`), "utf8")));
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === html) continue;
  changed++;
  console.log(`${check ? "drift" : "updated"}: ${slug}`);
  if (!check) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, html); } // a brand-new guide has no folder yet
}
// Pages that look generated (they carry the guide wiring) but have no guides/<slug>.json are orphans: report them.
const known = new Set(readdirSync(join(ROOT, "guides")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)));
for (const d of readdirSync(join(ROOT, "public"), { withFileTypes: true })) {
  if (!d.isDirectory() || known.has(d.name)) continue;
  const page = join(ROOT, "public", d.name, "index.html");
  if (existsSync(page) && readFileSync(page, "utf8").includes("const SS_GUIDE=")) console.log(`orphan: public/${d.name}/index.html has no guides/${d.name}.json`);
}
console.log(changed ? `${changed} of ${slugs.length} page(s) ${check ? "differ from the generator" : "regenerated"}` : `all ${slugs.length} page(s) match the generator`);
if (check && changed) process.exit(1);
