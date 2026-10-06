#!/usr/bin/env node
// Tag quiz/hardQuiz questions with c = index of the unit concept they best match, so the Quiz tab can filter by concept.
//   node scripts/tag-concepts.mjs [slug ...] [--dry]
// Scoring: rare words shared between a question (stem, options, explanation) and a concept (title weighted x3, intro, bullets).
// A question is tagged only when its best concept clearly beats the runner-up; existing tags are never changed.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), show = args.includes("--show"), dry = args.includes("--dry") || show;
const wanted = args.filter(a => !a.startsWith("--"));
const STOP = new Set("the a an and or of to in is are was were be for on with as by that this it its at from which what when how why not no than then into their they them his her he she you your can will would should could has have had do does did if but all any each both more most only also such about over under between after before during one two".split(" "));
const toks = s => (String(s).toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []).map(w => w.replace(/s$/, "")).filter(w => !STOP.has(w));
const MARGIN = 2, MIN = 4;
let total = 0;
for (const f of readdirSync(join(ROOT, "guides")).filter(f => f.endsWith(".json"))) {
  const slug = f.slice(0, -5);
  if (wanted.length && !wanted.includes(slug)) continue;
  const p = join(ROOT, "guides", f), g = JSON.parse(readFileSync(p, "utf8"));
  let tagged = 0, seen = 0;
  for (const u of g.units) {
    const cs = u.concepts || [];
    if (cs.length < 2) continue;
    const qs = [...(g.quiz || []), ...(g.hardQuiz || [])].filter(q => q.u === u.id);
    if (!qs.length) continue;
    const docs = cs.map(c => { const m = new Map(); const add = (s, w) => toks(s).forEach(t => m.set(t, (m.get(t) || 0) + w)); add(c.l, 3); add(c.intro, 1); (c.b || []).forEach(b => add(typeof b === "string" ? b : JSON.stringify(b), 1)); return m; });
    const df = new Map(); docs.forEach(m => m.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
    for (const q of qs) {
      if (q.c !== undefined) continue;
      seen++;
      const qt = new Set([...toks(q.q), ...toks(q.q), ...toks(q.o[q.a]), ...toks(q.e)]);
      const sc = docs.map(m => { let s = 0; qt.forEach(t => { if (m.has(t)) s += Math.min(m.get(t), 3) / df.get(t); }); return s; });
      const order = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
      if (order[0][0] >= MIN * 0.25 && order[0][0] >= order[1][0] * MARGIN && order[0][0] > 0.8) { q.c = order[0][1]; tagged++; if (show && Math.random() < 0.03) console.log(`  ${q.q.slice(0, 85)}  =>  ${cs[q.c].l}`); }
    }
  }
  total += tagged;
  if (tagged) { console.log(`${slug}: tagged ${tagged}/${seen}`); if (!dry) { writeFileSync(p, JSON.stringify(g, null, 1) + "\n"); } }
}
console.log(`${total} question(s) tagged${dry ? " (dry run)" : ""}`);
