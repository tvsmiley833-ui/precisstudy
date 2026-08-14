#!/usr/bin/env node
// Build-time static pre-render for flashcards + quiz questions, same
// philosophy as prerender-guide.mjs: replace an empty placeholder div
// with real semantic HTML so this content is crawlable, without
// touching the existing interactive flashcard/quiz JS at all (purely
// additive). The flashcard archive lives inside the ungated #view-cards
// view; the question bank lives inside the ungated #view-guide (after
// #units) rather than inside #view-quiz, because #view-quiz is hidden
// from signed-out visitors (and therefore from crawlers) by the auth
// gate — putting it there would make the "crawlable" content invisible
// in practice.
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/prerender-practice.mjs <path-to-guide-index.html>");
  process.exit(1);
}

const html = readFileSync(target, "utf8");

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Extracts the source text of `const NAME=[ ... ];` by counting bracket
// depth (skipping string contents) rather than assuming a shape, since
// these arrays contain nested objects/arrays and quoted braces/brackets.
function extractArrayLiteral(source, varName) {
  const marker = `const ${varName}=[`;
  const start = source.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length - 1; // at the opening '['
  let depth = 0;
  let inStr = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return source.slice(start, i);
}

// Reproduces the runtime value of a top-level array that may be mutated
// via `NAME.push.apply(NAME, OTHER_ARRAY)` elsewhere in the file (a
// pattern used repeatedly for QUIZ/FLASHCARDS in this codebase). Finds
// every such merge call for NAME, in source order, and replays it.
function extractMergedArray(source, varName) {
  const decl = extractArrayLiteral(source, varName);
  if (!decl) return null;
  let code = decl + ";";
  const mergeRe = new RegExp(`${varName}\\.push\\.apply\\(${varName},([A-Za-z0-9_]+)\\)`, "g");
  let m;
  while ((m = mergeRe.exec(source))) {
    const mergeVar = m[1];
    const mergeDecl = extractArrayLiteral(source, mergeVar);
    if (!mergeDecl) throw new Error(`${varName}.push.apply references ${mergeVar}, but no "const ${mergeVar}=[" declaration was found`);
    code += mergeDecl + `;${varName}.push.apply(${varName},${mergeVar});`;
  }
  const fn = new Function(code + `\nreturn ${varName};`);
  return fn();
}

function extractUnits(source) {
  const decl = extractArrayLiteral(source, "UNITS");
  if (!decl) throw new Error("const UNITS=[ not found");
  const fn = new Function(decl + "\nreturn UNITS;");
  return fn();
}

function unitName(UNITS, id) {
  const u = UNITS.find(x => x.id === id);
  return u ? u.name : `Unit ${id}`;
}

function groupByUnit(items) {
  const byUnit = new Map();
  for (const item of items) {
    if (!byUnit.has(item.u)) byUnit.set(item.u, []);
    byUnit.get(item.u).push(item);
  }
  return [...byUnit.entries()].sort((a, b) => a[0] - b[0]);
}

function renderFlashcardArchive(FLASHCARDS, UNITS) {
  if (!FLASHCARDS || !FLASHCARDS.length) return "";
  let out = `<div id="fc-archive"><details class="practice-archive"><summary>📚 Browse all ${FLASHCARDS.length} flashcards as a list</summary><div class="fc-archive-body">`;
  for (const [unitId, cards] of groupByUnit(FLASHCARDS)) {
    out += `<h4>Unit ${esc(unitId)}: ${esc(unitName(UNITS, unitId))}</h4><dl class="fc-archive-list">`;
    for (const c of cards) {
      out += `<dt>${esc(c.t)}</dt><dd>${esc(c.d)}</dd>`;
    }
    out += "</dl>";
  }
  out += "</div></details></div>";
  return out;
}

function renderQuestionSet(label, items, UNITS) {
  if (!items || !items.length) return "";
  let out = `<details class="practice-archive"><summary>${esc(label)} — ${items.length} questions</summary><div class="qb-archive-body">`;
  for (const [unitId, qs] of groupByUnit(items)) {
    out += `<details class="qb-unit"><summary>Unit ${esc(unitId)}: ${esc(unitName(UNITS, unitId))} (${qs.length})</summary><ol class="qb-list">`;
    for (const q of qs) {
      out += `<li><p class="qb-q">${esc(q.q)}</p><ul class="qb-opts">`;
      q.o.forEach((opt, i) => {
        out += `<li${i === q.a ? ' class="qb-correct"' : ""}>${esc(opt)}</li>`;
      });
      out += `</ul>`;
      if (q.e) out += `<p class="qb-exp">${esc(q.e)}</p>`;
      out += `</li>`;
    }
    out += "</ol></details>";
  }
  out += "</div></details>";
  return out;
}

function renderQuestionBank(QUIZ, HARD_Q, UNITS) {
  let out = '<div id="qbank-archive">';
  out += renderQuestionSet("📝 Practice Question Bank", QUIZ, UNITS);
  out += renderQuestionSet("⭐ Hard Mode Questions", HARD_Q, UNITS);
  out += "</div>";
  return out;
}

const UNITS = extractUnits(html);
const FLASHCARDS = extractMergedArray(html, "FLASHCARDS") || [];
const QUIZ = extractMergedArray(html, "QUIZ") || [];
const HARD_Q = extractMergedArray(html, "HARD_Q") || [];

const FC_ANCHOR = '\n</div>\n<div id="view-quiz"';
const QB_ANCHOR = '\n</div>\n<div id="view-cards"';

if (html.includes('id="fc-archive"') || html.includes('id="qbank-archive"')) {
  throw new Error("Practice archive markers already present — already pre-rendered. Aborting rather than guessing.");
}
if (!html.includes(FC_ANCHOR)) {
  throw new Error(`Anchor not found: ${JSON.stringify(FC_ANCHOR)} — markup changed, aborting.`);
}
if (!html.includes(QB_ANCHOR)) {
  throw new Error(`Anchor not found: ${JSON.stringify(QB_ANCHOR)} — markup changed, aborting.`);
}

let out = html;
out = out.replace(FC_ANCHOR, `\n${renderFlashcardArchive(FLASHCARDS, UNITS)}</div>\n<div id="view-quiz"`);
out = out.replace(QB_ANCHOR, `\n${renderQuestionBank(QUIZ, HARD_Q, UNITS)}</div>\n<div id="view-cards"`);

writeFileSync(target, out);
console.log(`Pre-rendered ${FLASHCARDS.length} flashcards, ${QUIZ.length} quiz questions, ${HARD_Q.length} hard-mode questions into ${target}`);
