// Generator for PrecisStudy guides: reads guides/<slug>.json and emits
// public/<slug>/index.html matching the hand-authored subject pages.
//
// The views template (page-views.template.html) carries every static shell the
// page logic expects — study planner, search, quiz scaffolding, flashcard deck,
// exam mount point. Subject-specific content is injected at __TOKENS__.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = (name) => readFileSync(join(ROOT, "scripts/guide-template", name), "utf8");
const templateHead = T("head.html");
const templateStyle = T("style.css");
const templateWiring = T("module-wiring.html");
const templateHero = T("hero.html");
const templateViews = T("page-views.template.html");
const templateLogic = T("logic.js");

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

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
    const cards = (u.traps || u.mistakes || []).map(m =>
      `<div class="mem-card"><div class="mem-t">Watch out</div><div class="mem-d">${esc(m)}</div></div>`
    ).join("\n    ");
    if (!cards) return "";
    return `<div class="qr-section"><h2 class="qr-h">Unit ${u.id}: ${esc(u.name)}</h2><div class="mem-grid">\n    ${cards}\n  </div></div>`;
  }).filter(Boolean).join("\n  ");
}

function buildFcArchive(units, flashcards) {
  // Static browse-all list grouped by unit, mirroring the hand-authored pages.
  const sections = units.map(u => {
    const cards = flashcards.filter(f => f.u === u.id);
    if (!cards.length) return "";
    const items = cards.map(c =>
      `<dt>${esc(c.t)}</dt><dd>${esc(c.d)}</dd>`
    ).join("");
    return `<h4>Unit ${u.id}: ${esc(u.name)}</h4><dl class="fc-archive-list">${items}</dl>`;
  }).filter(Boolean).join("");
  if (!sections) return "";
  return `<details class="practice-archive"><summary>Browse all ${flashcards.length} flashcards as a list</summary><div class="fc-archive-body">${sections}</div></details>`;
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

  html += templateViews
    .replace("__SPC_INTRO__", `${quiz.length} practice questions across ${units.length} units. Slide to match your situation.`)
    .replace("__FILTER_CHIPS__",
      `<button class="chip on">All Units</button>${units.map(u => `<button class="chip">Unit ${u.id}</button>`).join("")}`)
    .replace("__FC_ARCHIVE__", buildFcArchive(units, flashcards))
    .replace("__QREF__", buildQref(units))
    .replace("__MEMORY__", buildMemory(units));

  // Data + logic. Exam parts required by schema but may be empty arrays.
  html += `\n<script>\n`;
  html += `const UNITS=${js(units)};\n`;
  // buildGuide() references this for optional per-unit SVG diagrams; guides
  // without diagrams get the empty object the hand-authored pages use.
  html += `const DIAGRAMS=${js(config.diagrams || {})};\n`;
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
  const configPath = join(ROOT, "guides", `${slug}.json`);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const outDir = join(ROOT, "public", slug);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  writeFileSync(outPath, generateGuide(config));
  console.log(`Generated ${outPath}`);
}
