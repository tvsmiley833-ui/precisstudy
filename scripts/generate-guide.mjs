// Generator for PrecisStudy guides: reads guides/<slug>.json and emits
// public/<slug>/index.html matching the hand-authored subject pages.
//
// The views template (page-views.template.html) carries every static shell the
// page logic expects — study planner, search, quiz scaffolding, flashcard deck,
// exam mount point. Subject-specific content is injected at __TOKENS__.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { heroPattern, bodyPattern } = require("./hero-patterns.cjs");
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
  if (accentColor) {
    // Derive a full themed palette from the single accent color and append AFTER
    // the template :root so these win the cascade over the defaults.
    const hex = accentColor.replace("#","");
    const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
    const mix=(t)=>Math.round(r+(255-r)*t).toString(16).padStart(2,"0")
                 + Math.round(g+(255-g)*t).toString(16).padStart(2,"0")
                 + Math.round(b+(255-b)*t).toString(16).padStart(2,"0");
    const darken=(t)=>{
      const rr=Math.max(0,Math.round(r*(1-t))), gg=Math.max(0,Math.round(g*(1-t))), bb=Math.max(0,Math.round(b*(1-t)));
      return rr.toString(16).padStart(2,"0")+gg.toString(16).padStart(2,"0")+bb.toString(16).padStart(2,"0");
    };
    const soft="#"+mix(0.88);
    const softBorder="#"+mix(0.62);
    const inkDark="#"+darken(0.35);
    const themeBlock = `:root{--accent:#${hex};--accent-ink:${inkDark};--accent-soft:${soft};`+
      `--accent-border:${softBorder};}`;
    // also tint page background & surfaces subtly toward the accent
    const bgTint="#"+mix(0.90);
    const surfTint="#"+mix(0.97);
    // Dark-mode-aware palette: derive darker accent variants for night reading
    const dAcc="#"+mix(0.45), dSoftA=0.16;
    style += `\n<style>\n`+
      `:root:not([data-theme="dark"]){--accent:${accentColor}!important;--accent-ink:${inkDark}!important;--accent-soft:${soft}!important;--accent-border:${softBorder}!important;--bg:${bgTint}!important;}`+
      `[data-theme="dark"]{--accent:${dAcc}!important;--accent-soft:rgba(${r},${g},${b},${dSoftA})!important;--accent-border:rgba(${r},${g},${b},0.4)!important;--bg:#12182b!important;--surface:#1a2138!important;}`+
      `:root:not([data-theme="dark"]) .hero{background:linear-gradient(170deg,${inkDark} 0%,#${hex} 55%,${bgTint} 130%)!important;}`+
      `[data-theme="dark"] .hero{background:linear-gradient(170deg,#0a0e1c 0%,${inkDark} 45%,#${hex} 100%)!important;}`+
      `:root:not([data-theme="dark"]) .tab-btn.active,[data-theme="dark"] .tab-btn.active{background:#${hex};border-color:#${hex};color:#fff!important;}`+
      `.btn{background:#${hex};border-color:#${hex}} .unit.open .chevron{color:#${hex}}`+
      `.chip.on{background:#${hex};border-color:#${hex};color:#fff}`+
      `:root:not([data-theme="dark"]) .spc-card{border-color:${softBorder};background:linear-gradient(135deg,${soft},var(--surface))!important}`+
      `[data-theme="dark"] .spc-card{border-color:rgba(${r},${g},${b},0.4);background:linear-gradient(135deg,rgba(${r},${g},${b},0.16),var(--surface))!important}`;
    // Per-subject unique hero motif (replaces the shared starfield)
    const pat = heroPattern(slug, accentColor);
    if (pat) {
      const svgUri = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${pat.size}' height='${pat.size}'>${encodeURIComponent(pat.svg.replace(/%23/g,'#').replace(/'/g,"\'")).replace(/%27/g,"'")}")`;
      style += `\n.hero::after{background-image:${svgUri}!important;background-size:${pat.size}px ${pat.size}px!important;opacity:.5!important;}`;
    }
    // Page-wide subtle symbol watermark (body layer)
    const bp = bodyPattern(slug, accentColor);
    if (bp) {
      const bsvgUri = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${bp.size}' height='${bp.size}'>${encodeURIComponent(bp.svg.replace(/%23/g,'#').replace(/'/g,"\'")).replace(/%27/g,"'")}")`;
      style += `\n<style>\nhtml::before{content:'';position:fixed;inset:0;z-index:2147483646;pointer-events:none;background-image:${bsvgUri};background-size:${bp.size}px ${bp.size}px;opacity:.05;mix-blend-mode:multiply;}\n[data-theme="dark"] html::before{opacity:.07;mix-blend-mode:screen;}\n[data-theme="dark"] .hero::after{mix-blend-mode:normal}\n</style>`;
    }
    style += `</style>`;
    style = style; // keep base sheet intact below ours so ours wins cascade order
  }
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
