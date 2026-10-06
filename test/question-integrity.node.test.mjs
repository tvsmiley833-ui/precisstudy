// Every quiz and hard-mode question must be answerable: two to six distinct, non-empty options, an answer index inside them,
// a unit that exists, and an explanation. A broken question is worse than a missing one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const guides = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json"));

for (const f of guides) {
  test(`${f}: every question has distinct options, a valid answer and a real unit`, () => {
    const d = JSON.parse(readFileSync(new URL(`../guides/${f}`, import.meta.url), "utf8"));
    const units = new Set(d.units.map(u => u.id));
    const bad = [];
    for (const [bank, qs] of [["quiz", d.quiz || []], ["hardQuiz", d.hardQuiz || []]]) {
      qs.forEach((q, i) => {
        const where = `${bank}[${i}] "${String(q.q).slice(0, 50)}"`;
        const o = q.o || [];
        if (o.length < 2 || o.length > 6) bad.push(`${where}: ${o.length} options`);
        if (o.some(x => !String(x).trim())) bad.push(`${where}: empty option`);
        if (new Set(o.map(x => String(x).trim())).size !== o.length) bad.push(`${where}: duplicate options`);
        if (!Number.isInteger(q.a) || q.a < 0 || q.a >= o.length) bad.push(`${where}: answer index ${q.a}`);
        if (!units.has(q.u)) bad.push(`${where}: unknown unit ${q.u}`);
        if (!String(q.e || "").trim()) bad.push(`${where}: no explanation`);
      });
    }
    assert.deepEqual(bad.slice(0, 8), [], `${d.slug}: ${bad.length} broken question(s)`);
  });
}

for (const f of guides) {
  test(`${f}: the hard-mode bank covers every unit`, () => {
    const d = JSON.parse(readFileSync(new URL(`../guides/${f}`, import.meta.url), "utf8"));
    const have = new Set((d.hardQuiz || []).map(q => q.u));
    const missing = d.units.filter(u => !have.has(u.id)).map(u => u.id);
    assert.deepEqual(missing, [], `${d.slug}: units with no hard question: ${missing.join(", ")}`);
  });
}

test("no question explanation is generic filler", () => {
  const filler = /core content taught in this unit|this is the correct answer\.?$|^(core [\w\/-]+ concept|[\w-]+ core grammar\/vocab|standard \w+ principle|style\/mechanics principle|demand\/supply determinants|foundational [\w\/ ]+ definitions|dystopia\/allegory concept)\.?$/i;
  const bad = [];
  for (const f of guides) {
    const d = JSON.parse(readFileSync(new URL(`../guides/${f}`, import.meta.url), "utf8"));
    const all = [...(d.quiz || []), ...(d.hardQuiz || []), ...Object.values(d.examParts || {}).flat()];
    all.forEach(q => { if (filler.test(String(q.e || ""))) bad.push(`${d.slug}: ${String(q.q).slice(0, 50)}`); });
  }
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} question(s) with filler explanations`);
});
