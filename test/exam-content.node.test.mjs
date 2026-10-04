import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Biology, AP Biology and PreCalculus once shipped the Chemistry practice exam, copied in from a template.
const SAME_SUBJECT = [["apush", "us-history"]];

test("no two guides share a practice exam unless they are the same subject", () => {
  const seen = new Map();
  for (const f of readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(new URL("../guides/" + f, import.meta.url), "utf8"));
    const key = JSON.stringify((d.examParts?.PART_A || []).map(q => q.q));
    if (key === "[]") continue;
    const other = seen.get(key);
    if (other) assert.ok(SAME_SUBJECT.some(p => p.includes(other) && p.includes(d.slug)), `${d.slug} has the same Part A as ${other}`);
    seen.set(key, d.slug);
  }
});

test("exam questions refer to units the guide actually has", () => {
  for (const f of readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(new URL("../guides/" + f, import.meta.url), "utf8"));
    const ids = new Set(d.units.map(u => u.id));
    for (const part of Object.values(d.examParts || {})) for (const q of part) if (q.u !== undefined) assert.ok(ids.has(q.u), `${d.slug}: exam question for unit ${q.u}`);
  }
});
