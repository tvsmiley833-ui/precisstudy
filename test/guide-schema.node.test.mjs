import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGuideConfig } from "../scripts/generate-guide.mjs";

const ok = () => ({
  slug: "demo-1", title: "Demo",
  units: [{ id: 1, name: "One", concepts: [{ l: "A" }] }],
  quiz: [{ u: 1, q: "Q?", o: ["a", "b"], a: 1 }],
  flashcards: [{ u: 1, t: "term", d: "def" }],
});

test("a well-formed guide passes", () => assert.deepEqual(validateGuideConfig(ok()), []));

test("catches the mistakes that used to ship as broken pages", () => {
  const c = ok();
  c.slug = "Bad Slug"; c.units.push({ id: 1, name: "Dup", concepts: [{ l: "x" }] });
  c.quiz.push({ u: 9, q: "Orphan", o: ["a", "b"], a: 0 }, { u: 1, q: "Bad answer", o: ["a", "b"], a: 5 }, { u: 1, q: "", o: ["a"], a: 0 });
  c.flashcards.push({ u: 1, t: "no def", d: "" });
  const msgs = validateGuideConfig(c).join("\n");
  for (const want of ["slug must match", "duplicated", "unknown unit 9", "answer index 5", "at least two options", "no question text", "needs a term"]) assert.match(msgs, new RegExp(want));
});
