// Content ratchet: duplicated question stems, duplicated flashcard terms and placeholder text may be fixed (counts go down,
// update the baseline) but never grow. New guides start at zero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const baseline = JSON.parse(readFileSync(new URL("./content-lint-baseline.json", import.meta.url), "utf8"));
const guides = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json"));

function measure(d) {
  const count = (items) => { const m = new Map(); for (const k of items) m.set(k, (m.get(k) || 0) + 1); return [...m.values()].reduce((a, c) => a + (c > 1 ? c - 1 : 0), 0); };
  const qs = [...(d.quiz || []), ...(d.hardQuiz || [])];
  return {
    dupStems: count(qs.map(q => q.u + "|" + String(q.q).trim().toLowerCase())),
    dupTerms: count((d.flashcards || []).map(c => String(c.t).trim().toLowerCase())),
    placeholders: (JSON.stringify(d).match(/\bTODO\b|lorem ipsum|\bPLACEHOLDER\b/g) || []).length,
  };
}

for (const f of guides) {
  test(`${f}: no new duplicate stems, duplicate terms or placeholder text`, () => {
    const d = JSON.parse(readFileSync(new URL(`../guides/${f}`, import.meta.url), "utf8"));
    const got = measure(d), allowed = baseline[d.slug] || {};
    for (const k of ["dupStems", "dupTerms", "placeholders"]) assert.ok(got[k] <= (allowed[k] || 0), `${d.slug} ${k}: ${got[k]} (allowed ${allowed[k] || 0})`);
  });
}
