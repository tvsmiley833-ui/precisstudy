// Content-quality checks over every guides/*.json. These catch the defects that have crept in
// before (padded duplicate questions, repeated flashcards that share one "known"/review state
// because progress is keyed by card term, malformed answers) before they reach students.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const files = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json")).sort();
const guides = files.map(f => [f.slice(0, -5), JSON.parse(readFileSync(new URL(`../guides/${f}`, import.meta.url), "utf8"))]);
const norm = s => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const problems = (list, limit = 8) => list.slice(0, limit).join("\n  ") + (list.length > limit ? `\n  ...and ${list.length - limit} more` : "");

test("every guide has units, each with at least one concept", () => {
  const bad = [];
  for (const [slug, g] of guides) {
    if (!g.units?.length) bad.push(`${slug}: no units`);
    for (const u of g.units || []) if (!u.concepts?.length) bad.push(`${slug}: unit ${u.id} has no concepts`);
  }
  assert.equal(bad.length, 0, "\n  " + problems(bad));
});

test("every question points at a real unit and has a valid, unambiguous answer", () => {
  const bad = [];
  for (const [slug, g] of guides) {
    const unitIds = new Set((g.units || []).map(u => u.id));
    for (const [name, list] of [["quiz", g.quiz || []], ["hardQuiz", g.hardQuiz || []]]) {
      list.forEach((q, i) => {
        const w = `${slug} ${name}[${i}]`;
        if (!unitIds.has(q.u)) bad.push(`${w}: unit ${q.u} does not exist`);
        if (!String(q.q ?? "").trim()) bad.push(`${w}: empty question`);
        if (!Array.isArray(q.o) || q.o.length < 2) { bad.push(`${w}: needs at least 2 options`); return; }
        if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) bad.push(`${w}: answer index ${q.a} is out of range`);
        if (q.o.some(o => !String(o ?? "").trim())) bad.push(`${w}: has an empty option`);
        const opts = q.o.map(o => String(o).trim());
        if (new Set(opts).size !== opts.length) bad.push(`${w}: has duplicate options`);
        if (!String(q.e ?? "").trim()) bad.push(`${w}: missing explanation`);
      });
    }
  }
  assert.equal(bad.length, 0, "\n  " + problems(bad));
});

test("no question appears twice with identical options, within or between the quiz and hard quiz", () => {
  const bad = [];
  for (const [slug, g] of guides) {
    const seen = new Map();
    for (const [name, list] of [["quiz", g.quiz || []], ["hardQuiz", g.hardQuiz || []]]) {
      list.forEach((q, i) => {
        // Exact text (not the symbol-stripping norm): "7 - 3x = 8" and "7 - 3x = -8" are different questions.
        const key = String(q.q).trim().toLowerCase().replace(/\s+/g, " ") + "|" + JSON.stringify(q.o);
        if (seen.has(key)) bad.push(`${slug}: ${name}[${i}] repeats ${seen.get(key)}: ${String(q.q).slice(0, 60)}`);
        else seen.set(key, `${name}[${i}]`);
      });
    }
  }
  assert.equal(bad.length, 0, "\n  " + problems(bad));
});

test("flashcards point at real units and are never empty", () => {
  const bad = [];
  for (const [slug, g] of guides) {
    const unitIds = new Set((g.units || []).map(u => u.id));
    (g.flashcards || []).forEach((c, i) => {
      if (!unitIds.has(c.u)) bad.push(`${slug} flashcards[${i}]: unit ${c.u} does not exist`);
      if (!norm(c.t) || !norm(c.d)) bad.push(`${slug} flashcards[${i}]: empty term or definition`);
    });
  }
  assert.equal(bad.length, 0, "\n  " + problems(bad));
});

test("a unit never repeats a flashcard term (progress and review schedule are keyed by the term, so twins would share one state)", () => {
  const bad = [];
  for (const [slug, g] of guides) {
    const seen = new Map();
    (g.flashcards || []).forEach((c, i) => {
      if (/[<>]/.test(c.t)) return; // code generics like ArrayList<Integer> are deliberate variants
      // The exact term (only case and spacing ignored) is what progress is keyed by: "a = 1" and "a ≠ 1" are different cards.
      const key = `${c.u}|${String(c.t).trim().toLowerCase().replace(/\s+/g, " ")}`;
      if (seen.has(key)) bad.push(`${slug}: "${c.t}" in unit ${c.u} appears at flashcards[${seen.get(key)}] and [${i}]`);
      else seen.set(key, i);
    });
  }
  assert.equal(bad.length, 0, "\n  " + problems(bad));
});

test("no concept text contains template leftovers", () => {
  const bad = [];
  for (const [slug, g] of guides) {
    for (const u of g.units || []) for (const [ci, c] of (u.concepts || []).entries()) {
      for (const part of [c.l, c.intro, ...(c.b || [])]) {
        if (/\b(TODO|FIXME|lorem ipsum|\[object Object\]|NaN)\b|__[A-Z]{4,}__/.test(String(part ?? ""))) bad.push(`${slug} unit ${u.id} concept ${ci}: ${String(part).slice(0, 60)}`);
      }
      if (!String(c.l ?? "").trim()) bad.push(`${slug} unit ${u.id} concept ${ci}: no title`);
    }
  }
  assert.equal(bad.length, 0, "\n  " + problems(bad));
});
