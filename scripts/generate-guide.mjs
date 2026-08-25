// Generator for PrecisStudy guides: reads guides/<slug>.json and emits
// public/<slug>/index.html matching the hand-authored subject pages.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = (name) => readFileSync(join(ROOT, "scripts/guide-template", name), "utf8");
const templateHead = T("head.html");
const templateStyle = T("style.css");
const templateWiring = T("module-wiring.html");
const templateHero = T("hero.html");
const templateLogic = T("logic.js");

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

// JS object literal (not JSON) so strings can contain apostrophes safely —
// JSON.stringify output is a valid JS literal, and template logic expects
// plain identifiers UNITS / QUIZ / FLASHCARDS / PART_A etc.
const js = (v) => JSON.stringify(v);

function buildQref(units) {
  return units.map(u => {
    const cards = u.concepts.map(c =>
      `<div class="qr-card"><div class="qr-k">${esc(c.l)}</div><div class="qr-v">${esc(c.intro || "")}</div></div>`
    ).join("\n    ");
    const facts = (u.keyFacts || []).map(f =>
      `<div class="qr-card"><div class="qr-k">Key fact</div><div class="qr-v">${esc(f)}</div></div>`
    ).join("\n    ");
    return `<div class="qr-section"><h2 class="qr-h">Unit ${u.id}: ${esc(u.name)}</h2><div class="qr-grid">\n    ${cards}\n${facts}\n  </div></div>`;
  }).join("\n  ");
}

function buildMemory(units) {
  return units.map(u => {
    const cards = (u.mistakes || []).map(m =>
      `<div class="mem-card"><div class="mem-t">Watch out</div><div class="mem-d">${esc(m)}</div></div>`
    ).join("\n    ");
    if (!cards) return "";
    return `<div class="qr-section"><h2 class="qr-h">Unit ${u.id}: ${esc(u.name)}</h2><div class="mem-grid">\n    ${cards}\n  </div></div>`;
  }).filter(Boolean).join("\n  ");
}

export function generateGuide(config) {
  const { slug, title, description, fontUrl, accentColor, units, quiz, flashcards,
          examParts } = config;

  let html = templateHead
    .replace(/__TITLE__/g, esc(title))
    .replace(/__PAGE_TITLE__/g, esc(`${title} Study Guide — PrecisStudy`))
    .replace(/__DESCRIPTION__/g, esc(description))
    .replace(/__SLUG__/g, slug)
    .replace(/__FONT_URL__/g, fontUrl);

  let style = templateStyle;
  if (accentColor) style = style.replace(":root{", `:root{ --accent:${accentColor}; --accent-ink:${accentColor};`);
  html += `<style>\n${style}\n</style>\n`;

  html += templateWiring;

  const hero = templateHero
    .replaceAll("APUSH", esc(title))
    .replace(`9 Units · 137 Quiz Questions · 72 Flashcards · Diagnostic · Full Reference Tables · Diagrams · Saved Progress`,
      `${units.length} Units · ${quiz.length} Quiz Questions · ${flashcards.length} Flashcards · Diagnostic · Quick Reference · Memory Tricks · Saved Progress`);
  html += hero;
  html += `<div class="page">\n`;
  // spc-card lives at top of page in the original; it's part of hero chunk end.
  html += `<div id="view-guide" class="view active">\n`;
  // Guide view is rendered by JS from UNITS at runtime? No — original renders
  // static unit accordions. We generate them server-side here:
  html += `<div class="filter-row" id="filter-row"><button class="chip on">All Units</button>${units.map(u=>`<button class="chip">Unit ${u.id}</button>`).join("")}</div>
<div id="units"></div>
</div>
`;
  // Cards/quiz/exam/qref/memory shells mirror original markup
  html += `<div id="view-cards" class="view">
<div class="filter-row"><select id="fc-unit" onchange="fcFilterUnit(this.value)" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--ink);font-size:15px"></select></div>
<div id="fc-deck"></div>
</div>
`;
  html += `<div id="view-quiz" class="view"></div>
<div id="view-exam" class="view"></div>
`;
  html += `<div id="view-qref" class="view">\n  ${buildQref(units)}\n</div>\n`;
  html += `<div id="view-memory" class="view">
  <div class="mem-intro">Common mistakes for each unit — read the mistake, then make sure you know why it's wrong.</div>
  ${buildMemory(units)}
</div>
`;
  html += `</div>`; // /.page

  // Data + logic. Exam parts optional: guide works without an exam tab payload
  // only if logic tolerates missing parts — original always defines them, so
  // require them in schema but allow empty arrays.
  html += `\n<script>\n`;
  html += `const UNITS=${js(units)};\n`;
  html += `const FLASHCARDS=${js(flashcards)};\n`;
  html += `const QUIZ=${js(quiz)};\n`;
  for (const part of ["PART_A", "PART_B1", "PART_B2", "PART_C"]) {
    html += `const ${part}=${js(examParts?.[part] || [])};\n`;
  }
  html += templateLogic
    .replaceAll("APUSH", esc(title))
    .replaceAll("'apush'", `'${slug}'`)
    .replaceAll("CHEM_MASTERY", "SS_MASTERY")
    .replaceAll("CHEM_TOTAL_Q", "SS_TOTAL_Q")
    .replaceAll("CHEM_UNITS", "SS_UNIT_COUNT")
    .replaceAll("/apush", `/${slug}`);
  html += `\n</script></body></html>`;

  return html;
}

// CLI entry: node scripts/generate-guide.mjs <slug>
if (process.argv[1] && process.argv[1].endsWith("generate-guide.mjs") && process.argv[2]) {
  const slug = process.argv[2];
  const configPath = join("guides", `${slug}.json`);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const outDir = join("public", slug);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  writeFileSync(outPath, generateGuide(config));
  console.log(`Generated ${outPath}`);
}
