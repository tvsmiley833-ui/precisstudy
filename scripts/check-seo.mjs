#!/usr/bin/env node
// Static SEO lint over public/**/index.html: title and description present, sensible length and unique across indexable
// pages, canonical URL matching the page path, Open Graph tags, and JSON-LD that parses. Pages marked noindex are skipped.
//   node scripts/check-seo.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PUB = resolve("public");
const ORIGIN = "https://precisstudy.com";
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p); else if (f === "index.html") yield p;
  }
}
const meta = (h, attrName, attrVal) => {
  const m = h.match(new RegExp(`<meta[^>]*\\b${attrName}=["']${attrVal}["'][^>]*>`, "i"));
  const c = m && m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i);
  return c ? (c[2] ?? c[3]) : null;
};
const issues = [], titles = new Map(), descs = new Map();
let indexable = 0;
for (const file of walk(PUB)) {
  const html = readFileSync(file, "utf8");
  const path = "/" + relative(PUB, file).replace(/index\.html$/, "");
  const robots = meta(html, "name", "robots") || "";
  if (/noindex/i.test(robots)) continue;
  indexable++;
  const add = (rule, detail) => issues.push({ path, rule, detail });
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim();
  const desc = meta(html, "name", "description");
  if (!title) add("title", "missing"); else {
    if (title.length > 70) add("title-length", `${title.length} chars: ${title.slice(0, 60)}…`);
    (titles.get(title) || titles.set(title, []).get(title)).push(path);
  }
  if (!desc) add("description", "missing"); else {
    if (desc.length < 50 || desc.length > 175) add("description-length", `${desc.length} chars`);
    (descs.get(desc) || descs.set(desc, []).get(desc)).push(path);
  }
  const canon = (html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1];
  if (!canon) add("canonical", "missing");
  else if (canon !== ORIGIN + path && !(path === "/" && canon === ORIGIN + "/")) add("canonical", `${canon} does not match ${ORIGIN + path}`);
  if (!meta(html, "property", "og:title")) add("og:title", "missing");
  if (!meta(html, "property", "og:description")) add("og:description", "missing");
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(m[1]); } catch (e) { add("json-ld", "does not parse: " + e.message.slice(0, 60)); }
  }
}
for (const [t, pages] of titles) if (pages.length > 1) issues.push({ path: pages.join(", "), rule: "duplicate-title", detail: t.slice(0, 70) });
for (const [d, pages] of descs) if (pages.length > 1) issues.push({ path: pages.join(", "), rule: "duplicate-description", detail: d.slice(0, 70) });
const by = {};
for (const i of issues) (by[i.rule] = by[i.rule] || []).push(i);
for (const [rule, list] of Object.entries(by)) {
  console.log(`\n${rule}: ${list.length}`);
  for (const i of list.slice(0, 8)) console.log(`  ${i.path}  ${i.detail}`);
}
console.log(`\n${indexable} indexable pages, ${issues.length} issue(s)`);
process.exit(issues.length ? 1 : 0);
