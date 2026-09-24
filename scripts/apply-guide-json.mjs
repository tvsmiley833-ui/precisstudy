#!/usr/bin/env node
// Push content from guides/<slug>.json onto public/<slug>/index.html without
// regenerating the whole page. The live pages carry layout fixes the
// generator template doesn't have, so a full regenerate would undo them;
// instead this generates the page in memory and copies over only the regions
// that come from guide data (head metadata, counts, unit list, flashcard and
// question archives, Quick Reference, Memory Tricks, Worked Examples and the
// inline data script). Everything else on the page is left byte-for-byte.
//
//   node scripts/apply-guide-json.mjs <slug> [<slug>...]
//   node scripts/apply-guide-json.mjs --check <slug>...   # report, don't write
import { readFileSync, writeFileSync } from "node:fs";
import { generateGuide } from "./generate-guide.mjs";

/** Index just past the </div> closing the <div> whose open tag starts at `open`. */
function divEnd(src, open) {
  let i = src.indexOf(">", open) + 1, depth = 1;
  while (depth > 0) {
    const nd = src.indexOf("<div", i), cd = src.indexOf("</div>", i);
    if (cd === -1) throw new Error("unbalanced <div> at " + open);
    if (nd !== -1 && nd < cd) { depth++; i = nd + 4; } else { depth--; i = cd + 6; }
  }
  return i;
}

/** [start, end) of a region in `src`, or null when absent. */
const REGIONS = {
  title: (s) => span(s, /<title>[^<]*<\/title>/),
  description: (s) => span(s, /<meta name="description" content="[^"]*"\s*\/?>/),
  ogDescription: (s) => span(s, /<meta property="og:description" content="[^"]*"\s*\/?>/),
  twitterDescription: (s) => span(s, /<meta name="twitter:description" content="[^"]*"\s*\/?>/),
  jsonLd: (s) => span(s, /<script type="application\/ld\+json">[\s\S]*?<\/script>/),
  subtitle: (s) => span(s, /<p class="subtitle"[^>]*>[\s\S]*?<\/p>/),
  filterRow: (s) => divAt(s, '<div class="filter-row" id="filter-row"'),
  filterSelect: (s) => span(s, /<select id="filter-select"[\s\S]*?<\/select>/),
  units: (s) => divAt(s, '<div id="units"'),
  spcIntro: (s) => span(s, /<p>Based on this guide's real question bank — [^<]*<\/p>/),
  fcArchive: (s) => after(s, 'id="view-cards"', /<details class="practice-archive">[\s\S]*?<\/details>/),
  qbankArchive: (s) => after(s, 'id="view-quiz"', /<details class="practice-archive">[\s\S]*?<\/details>/, 'id="view-exam"'),
  examples: (s) => divAt(s, '<div id="view-examples"'),
  qref: (s) => divAt(s, '<div id="view-qref"'),
  memory: (s) => divAt(s, '<div id="view-memory"'),
  data: (s) => {
    const a = s.indexOf("const UNITS="), b = s.indexOf("const EXAM_CSS=");
    return a !== -1 && b > a ? [a, b] : null;
  },
};

function span(s, re) {
  const m = re.exec(s);
  return m ? [m.index, m.index + m[0].length] : null;
}
function divAt(s, openTag) {
  const i = s.indexOf(openTag);
  return i === -1 ? null : [i, divEnd(s, i)];
}
function after(s, marker, re, before) {
  const from = s.indexOf(marker);
  if (from === -1) return null;
  const limit = before ? s.indexOf(before, from) : s.length;
  const m = re.exec(s.slice(from, limit === -1 ? s.length : limit));
  return m ? [from + m.index, from + m.index + m[0].length] : null;
}

export function applyGuideJson(page, generated) {
  const changed = [];
  let out = page;
  for (const [name, find] of Object.entries(REGIONS)) {
    const g = find(generated), p = find(out);
    if (!g && !p) continue;
    const next = g ? generated.slice(g[0], g[1]) : "";
    if (!p) {
      // Region the page lacks entirely (e.g. a first Worked Examples tab):
      // callers add those by hand, so just report it.
      changed.push(name + " (missing on page, not inserted)");
      continue;
    }
    if (out.slice(p[0], p[1]) === next) continue;
    out = out.slice(0, p[0]) + next + out.slice(p[1]);
    changed.push(name);
  }
  return { html: out, changed };
}

if (process.argv[1] && process.argv[1].endsWith("apply-guide-json.mjs")) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  for (const slug of args.filter(a => !a.startsWith("--"))) {
    const config = JSON.parse(readFileSync(`guides/${slug}.json`, "utf8"));
    const path = `public/${slug}/index.html`;
    const page = readFileSync(path, "utf8");
    const { html, changed } = applyGuideJson(page, generateGuide(config));
    console.log(`${slug}: ${changed.length ? changed.join(", ") : "up to date"}`);
    if (!check && html !== page) writeFileSync(path, html);
  }
}
