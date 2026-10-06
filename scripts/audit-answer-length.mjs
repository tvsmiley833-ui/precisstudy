#!/usr/bin/env node
// Counts questions whose correct option is the longest by a wide margin (>=1.35x the average distractor, 35+ characters):
// students learn to pick the longest answer, so these questions test test-taking, not the subject.
//   node scripts/audit-answer-length.mjs            # table, worst first
//   node scripts/audit-answer-length.mjs --write    # refresh test/answer-length-baseline.json (only ever lower it)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export function auditAll() {
  const out = {};
  for (const f of readdirSync(join(ROOT, "guides")).filter(f => f.endsWith(".json"))) {
    const g = JSON.parse(readFileSync(join(ROOT, "guides", f), "utf8"));
    let n = 0, bad = 0;
    for (const q of [...(g.quiz || []), ...(g.hardQuiz || [])]) {
      n++;
      const L = q.o.map(x => String(x).length), a = L[q.a], others = L.filter((_, i) => i !== q.a);
      if (a >= 35 && a === Math.max(...L) && a > 1.35 * (others.reduce((x, y) => x + y, 0) / others.length)) bad++;
    }
    out[f.slice(0, -5)] = { questions: n, giveaway: bad };
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = auditAll();
  const rows = Object.entries(r).sort((a, b) => b[1].giveaway - a[1].giveaway);
  for (const [k, v] of rows) console.log(`${k.padEnd(28)} ${String(v.giveaway).padStart(4)} / ${v.questions}`);
  console.log(`total ${rows.reduce((s, [, v]) => s + v.giveaway, 0)}`);
  if (process.argv.includes("--write")) {
    const p = join(ROOT, "test/answer-length-baseline.json");
    let old = {}; try { old = JSON.parse(readFileSync(p, "utf8")); } catch {}
    const next = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.min(v.giveaway, old[k] ?? Infinity)]));
    writeFileSync(p, JSON.stringify(next, null, 1) + "\n");
  }
}
