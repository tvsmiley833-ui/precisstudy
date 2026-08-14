#!/usr/bin/env node
// Build-time static pre-render: injects real semantic HTML for the unit
// filter chips + unit/concept content into the study guide's static file,
// replacing the empty #filter-row / #units divs that buildGuide() would
// otherwise construct client-side. Reproduces buildGuide()'s exact DOM
// structure (classes, data-id, aria attributes) so hydrateGuide() can
// attach behavior to it without rebuilding anything.
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/prerender-guide.mjs <path-to-guide-index.html>");
  process.exit(1);
}

const html = readFileSync(target, "utf8");

function extractData(source) {
  const unitsStart = source.indexOf("const UNITS=[");
  if (unitsStart === -1) throw new Error("const UNITS=[ not found");
  const diagramsStart = source.indexOf("const DIAGRAMS={", unitsStart);
  if (diagramsStart === -1) throw new Error("const DIAGRAMS={ not found");
  const afterDiagrams = source.indexOf("\nfunction switchTab", diagramsStart);
  if (afterDiagrams === -1) throw new Error("end of DIAGRAMS block not found");
  const dataCode = source.slice(unitsStart, afterDiagrams);
  const fn = new Function(dataCode + "\nreturn {UNITS, DIAGRAMS};");
  return fn();
}

function esc(s) {
  return String(s == null ? "" : s);
}

function renderFilterRow(UNITS) {
  let out = '<button class="chip on">All Units</button>';
  for (const u of UNITS) {
    out += `<button class="chip">Unit ${esc(u.id)}</button>`;
  }
  return out;
}

function renderConcept(c) {
  let h = `<div class="c-label">${esc(c.l)}</div>`;
  if (c.intro) h += `<div class="c-text">${esc(c.intro)}</div>`;
  if (c.b && c.b.length) {
    h += '<ul class="c-list">';
    for (const item of c.b) h += `<li>${esc(item)}</li>`;
    h += '</ul>';
  }
  return `<div class="concept">${h}</div>`;
}

function renderUnit(u, DIAGRAMS) {
  let body = "";
  for (const c of u.concepts) body += renderConcept(c);
  if (u.traps && u.traps.length) {
    for (const t of u.traps) body += `<div class="trap">${esc(t)}</div>`;
  }
  if (u.fms && u.fms.length) {
    body += `<div class="formula">${u.fms.join("<br>")}</div>`;
  }
  if (DIAGRAMS && DIAGRAMS[u.id]) {
    const d = DIAGRAMS[u.id];
    body += `<div class="diagram"><div class="dlabel">Diagram</div>${d.svg}<p class="dcap">${esc(d.cap)}</p></div>`;
  }
  const hd = `<div class="unit-hd" tabindex="0" role="button" aria-expanded="false"><span class="unit-title">Unit ${esc(u.id)}: ${esc(u.name)}<span class="unit-meta">${u.concepts.length} concepts</span></span><span class="chevron">▾</span></div>`;
  return `<div class="unit" data-id="${esc(u.id)}">${hd}<div class="unit-body">${body}</div></div>`;
}

function renderUnits(UNITS, DIAGRAMS) {
  return UNITS.map(u => renderUnit(u, DIAGRAMS)).join("");
}

const { UNITS, DIAGRAMS } = extractData(html);

const EMPTY_FILTER_ROW = '<div class="filter-row" id="filter-row"></div>';
const EMPTY_UNITS = '<div id="units"></div>';

if (!html.includes(EMPTY_FILTER_ROW)) {
  throw new Error('Empty <div class="filter-row" id="filter-row"></div> not found — already pre-rendered, or markup changed. Aborting rather than guessing.');
}
if (!html.includes(EMPTY_UNITS)) {
  throw new Error('Empty <div id="units"></div> not found — already pre-rendered, or markup changed. Aborting rather than guessing.');
}

let out = html;
out = out.replace(EMPTY_FILTER_ROW, `<div class="filter-row" id="filter-row">${renderFilterRow(UNITS)}</div>`);
out = out.replace(EMPTY_UNITS, `<div id="units">${renderUnits(UNITS, DIAGRAMS)}</div>`);

writeFileSync(target, out);
console.log(`Pre-rendered ${UNITS.length} units into ${target}`);
