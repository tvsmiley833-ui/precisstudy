#!/usr/bin/env node
// Register a new guide (guides/<slug>.json must already exist) everywhere the site lists courses, by cloning the entries of a
// sibling guide. Idempotent: running it twice changes nothing the second time. Prints what it did and what it could not do.
//
//   node scripts/add-guide.mjs <slug> --like <sibling-slug> --cat <ap|math|science|humanities|english|languages|electives|testprep>
//        --group <math|science|humanities|english|languages|electives|testprep|ap> --color '#1d4ed8'
//        [--chalk <group>] [--facts "fact one|fact two|fact three"] [--dry]
//
// After it runs: node scripts/gen-subject-units.mjs && npm run guides:regen && node scripts/sync-home-counts.mjs && npm test.
// (Replaces the old sync-guides-registry.py, which re-appended every export and was not safe to re-run.)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const slug = argv[0];
const opt = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const dry = argv.includes("--dry");
if (!slug || slug.startsWith("--")) { console.error("usage: add-guide.mjs <slug> --like <sibling> --cat <cat> --group <group> --color '#hex'"); process.exit(2); }

const camel = s => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const guide = s => JSON.parse(readFileSync(`guides/${s}.json`, "utf8"));
if (!existsSync(`guides/${slug}.json`)) { console.error(`guides/${slug}.json does not exist`); process.exit(2); }
const sib = opt("like"); if (!sib || !existsSync(`guides/${sib}.json`)) { console.error("--like <existing guide slug> is required"); process.exit(2); }

const G = guide(slug), SG = guide(sib);
const N = { slug, label: G.title, units: camel(slug) + "Units", color: opt("color", "#1d4ed8"), cat: opt("cat", "electives"), group: opt("group", "electives") };
const S = { slug: sib, label: SG.title, units: camel(sib) + "Units" };

const results = [];
function edit(file, fn, note) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch (e) { results.push({ file, note, status: "MISSING FILE" }); return; }
  let out;
  try { out = fn(src); } catch (e) { results.push({ file, note, status: "ERROR " + e.message }); return; }
  if (out === null) { results.push({ file, note, status: "no match for the sibling's entry" }); return; }
  if (out === src) { results.push({ file, note, status: "already registered" }); return; }
  if (!dry) writeFileSync(file, out);
  results.push({ file, note, status: "added" });
}
// Insert `add` immediately after the first match of `re`, unless `already` is found in the file.
const after = (re, add, already) => src => { if (src.includes(already)) return src; const m = src.match(re); if (!m) return null; return src.replace(re, m[0] + add); };
// Clone a whole line that contains the sibling's entry.
const cloneLine = (needle, make, already) => src => {
  if (src.includes(already)) return src;
  const lines = src.split("\n"), i = lines.findIndex(l => l.includes(needle));
  if (i === -1) return null;
  lines.splice(i + 1, 0, make(lines[i]));
  return lines.join("\n");
};
const swapAll = line => line.split(S.slug).join(N.slug).split(S.label).join(N.label).split(S.units).join(N.units);

// ---- units: shared/unit-titles.js (the data generator reads it) ----
edit("public/shared/unit-titles.js", src => {
  if (src.includes(`export const ${N.units} =`)) return src;
  const re = new RegExp(`export const ${esc(S.units)} = \\[[\\s\\S]*?\\n\\];\\n`);
  const m = src.match(re); if (!m) return null;
  const rows = G.units.map(u => `  { id: ${u.id}, name: ${JSON.stringify(u.name)} }`).join(",\n");
  return src.replace(re, m[0] + `\n/** @type {Unit[]} */\nexport const ${N.units} = [\n${rows}\n];\n`);
}, "unit list export");

// ---- dashboard-app.js, concepts page: import + entry lines ----
for (const f of ["public/shared/dashboard-app.js", "public/concepts/index.html"]) {
  edit(f, src => {
    if (src.includes(`${N.units},`) || src.includes(`${N.units} }`) || src.includes(`units: ${N.units}`)) return src;
    const out = src.replace(new RegExp(`(import \\{[^}]*?\\b${esc(S.units)})\\b`), `$1, ${N.units}`);
    return out === src ? null : out;
  }, "units import");
  edit(f, cloneLine(`key: '${S.slug}', label:`, swapAll, `key: '${N.slug}', label:`), "subject entry");
}
edit("public/shared/dashboard-app.js", src => {
  if (src.includes(`'${N.slug}': '${N.cat}'`)) return src;
  // two parallel maps follow the sibling: first its category (ap/math/...), second its group (science/humanities/...)
  let n = 0;
  const out = src.replace(new RegExp(`('${esc(S.slug)}': '[a-z]+',)`, "g"), (m, g) => { n++; if (n === 1) return `${g} '${N.slug}': '${N.cat}',`; if (n === 2) return `${g} '${N.slug}': '${N.group}',`; return m; });
  return n < 2 ? null : out;
}, "category maps");

edit("public/shared/dashboard-app.js", src => {
  if (new RegExp(`'${esc(N.slug)}': '#[0-9a-fA-F]{6}'`).test(src)) return src;
  const out = src.replace(new RegExp(`('${esc(S.slug)}': '#[0-9a-fA-F]{6}',)`), `$1 '${N.slug}': '${N.color}',`);
  return out === src ? null : out;
}, "dashboard subject colour");

// ---- picker lists on other pages ----
edit("public/syllabus/index.html", src => {
  if (src.includes(`{key:'${N.slug}'`)) return src;
  let out = src.replace(new RegExp(`(\\{key:'${esc(S.slug)}',label:'${esc(S.label)}'\\},)`), `$1{key:'${N.slug}',label:'${N.label}'},`);
  out = out.replace(new RegExp(`('${esc(S.slug)}':'${esc(S.units)}',)`), `$1'${N.slug}':'${N.units}',`);
  return out === src ? null : out;
}, "syllabus picker + units map");
edit("public/compete/index.html", after(new RegExp(`\\{key:'${esc(S.slug)}',label:'${esc(S.label)}'\\},`), `{key:'${N.slug}',label:'${N.label}'},`, `{key:'${N.slug}'`), "compete picker");
edit("public/educators/index.html", after(new RegExp(`\\{h:"/${esc(S.slug)}",n:"${esc(S.label)}"\\},`), `{h:"/${N.slug}",n:"${N.label}"},`, `{h:"/${N.slug}"`), "educators list");
edit("public/shared/command-palette.js", after(new RegExp(`\\{ l: '${esc(S.label)}', h: '/${esc(S.slug)}' \\},`), ` { l: '${N.label}', h: '/${N.slug}' },`, `h: '/${N.slug}'`), "command palette");
edit("public/share/index.html", after(new RegExp(`"${esc(S.slug)}":"${esc(S.label)}",`), `"${N.slug}":"${N.label}",`, `"${N.slug}":"`), "share labels");
edit("public/onboarding/index.html", cloneLine(`{ key: '${S.slug}', cat:`, () => `  { key: '${N.slug}', cat: '${N.cat}', label: '${N.label}' },`, `{ key: '${N.slug}', cat:`), "onboarding class");
edit("public/shared/settings-app.js", cloneLine(`{ key: '${S.slug}', cat:`, l => swapAll(l).replace(/cat: '[a-z]+'/, `cat: '${N.cat}'`).replace(/color: '#[0-9a-fA-F]{3,8}'/, `color: '${N.color}'`), `{ key: '${N.slug}', cat:`), "settings class + icon");
edit("public/shared/subject-icons.js", cloneLine(`'${S.slug}': { color:`, l => swapAll(l).replace(/color: '#[0-9a-fA-F]{3,8}'/, `color: '${N.color}'`), `'${N.slug}': { color:`), "subject icon");

// ---- homepage class card + llms.txt ----
edit("public/index.html", src => {
  if (src.includes(`data-subject-key="${N.slug}"`)) return src;
  const re = new RegExp(`<a href="/${esc(S.slug)}/" class="class-card"[\\s\\S]*?</a>\\n`);
  const m = src.match(re); if (!m) return null;
  const names = G.units.map(u => u.name.replace(/&/g, "&amp;")).slice(0, 3).join(" · ");
  const more = G.units.length > 3 ? ` <span class="class-card-more">+${G.units.length - 3} more</span>` : "";
  const card = `<a href="/${N.slug}/" class="class-card" data-subject-key="${N.slug}" data-name="${N.label}">\n        <div class="class-card-icon"></div>\n        <div class="cc-name">${N.label}</div>\n        <div class="cc-meta">${G.units.length} units · ${new Set(G.quiz.map(q => q.q)).size} practice questions</div>\n        <p class="class-card-topics">${names}${more}</p>\n      </a>\n`;
  return src.replace(re, m[0] + card);
}, "homepage class card");
edit("public/llms.txt", cloneLine(`(https://precisstudy.com/${S.slug}/)`, () => `- [${N.label}](https://precisstudy.com/${N.slug}/)`, `(https://precisstudy.com/${N.slug}/)`), "llms.txt");

// ---- server ----
edit("src/chat.ts", cloneLine(`"${S.slug}": "You are a concise`, swapAll, `"${N.slug}": "You are a concise`), "tutor persona");
edit("src/link-previews.ts", cloneLine(`"${S.slug}": "${S.label}",`, swapAll, `"${N.slug}": "${N.label}"`), "link preview label");
edit("src/progress-routes.ts", src => {
  if (new RegExp(`export const SUBJECTS = \\[[^\\]]*"${esc(N.slug)}"`).test(src)) return src;
  const out = src.replace(/(export const SUBJECTS = \[[^\]]*)\]/, `$1, "${N.slug}"]`);
  return out === src ? null : out;
}, "progress subjects");
edit("src/worker.ts", src => {
  if (new RegExp(`const SUBJECT_PATHS = new Set\\(\\[[^\\]]*"${esc(N.slug)}"`).test(src)) return src;
  const out = src.replace(/(const SUBJECT_PATHS = new Set\(\[[^\]]*)\]/, `$1, "${N.slug}"]`);
  return out === src ? null : out;
}, "worker subject paths");

// ---- scripts ----
edit("scripts/gen-subject-units.mjs", after(new RegExp(`"${esc(S.slug)}": "${esc(S.units)}",`), ` "${N.slug}": "${N.units}",`, `"${N.slug}": "${N.units}"`), "unit data generator map");
edit("scripts/generate-guide.mjs", src => {
  if (new RegExp(`RELATED_GROUPS = \\[[\\s\\S]*?"${esc(N.slug)}"`).test(src)) return src;
  const out = src.replace(new RegExp(`("${esc(S.slug)}",)(?=[^\\]]*\\],)`), `$1 "${N.slug}",`);
  return out === src ? null : out;
}, "related-guides group");
for (const f of ["scripts/hero-patterns.mjs", "scripts/hero-patterns.cjs"]) {
  edit(f, src => {
    // add the slug to every family list that contains the sibling (a family is a quoted-slug array literal)
    // the negative lookahead keeps this idempotent: skip a family list that already has the new slug right after the sibling
    const out = src.replace(new RegExp(`(\\[(?:'[a-z0-9-]+',)*'${esc(S.slug)}')(?!,'${esc(N.slug)}')(,|\\])`, "g"), (m, a, b) => `${a},'${N.slug}'${b}`);
    return out === src ? (src.includes(`'${N.slug}'`) ? src : null) : out;
  }, "hero pattern family");
}
edit("client/personality.js", src => {
  const chalk = opt("chalk", null);
  if (!chalk) return src;
  if (src.includes(`"${N.slug}": "${chalk}"`)) return src;
  const out = src.replace(new RegExp(`("${esc(S.slug)}": "[a-z]+",)`), `$1 "${N.slug}": "${chalk}",`);
  return out === src ? null : out;
}, "chalk group (optional)");
edit("public/shared/fun-facts.js", src => {
  const facts = opt("facts", null);
  if (!facts) return src;
  if (src.includes(`"${N.slug}": [`)) return src;
  const body = facts.split("|").map(f => `    ${JSON.stringify(f.trim())},`).join("\n");
  const re = new RegExp(`  "${esc(S.slug)}": \\[[\\s\\S]*?\\n  \\],\\n`);
  const m = src.match(re); if (!m) return null;
  return src.replace(re, m[0] + `  "${N.slug}": [\n${body}\n  ],\n`);
}, "fun facts (optional)");

for (const r of results) console.log(`${r.status.padEnd(34)} ${r.file}  (${r.note})`);
const bad = results.filter(r => /^(no match|MISSING|ERROR)/.test(r.status));
console.log(`\n${results.filter(r => r.status === "added").length} edited, ${results.filter(r => r.status === "already registered").length} already registered, ${bad.length} need attention${dry ? " (dry run: nothing written)" : ""}`);
process.exit(bad.length ? 1 : 0);
