// Guards against the generator template and the committed guide pages drifting apart.
// One-off patch scripts used to edit pages without updating the template, so regenerating
// would silently undo (or skip) fixes. If a test here fails: change the template or the
// guide JSON, run `npm run guides:regen`, and commit the regenerated pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { generateGuide } from "../scripts/generate-guide.mjs";

const slugs = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort();
const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const count = (html, needle) => html.split(needle).length - 1;

test("there is a guide JSON for every guide page and the reverse", () => {
  assert.ok(slugs.length >= 50);
  for (const slug of slugs) assert.doesNotThrow(() => read(`../public/${slug}/index.html`), `missing page for ${slug}`);
});

for (const slug of slugs) {
  test(`${slug}: the committed page is exactly what the generator produces`, () => {
    const html = generateGuide(JSON.parse(read(`../guides/${slug}.json`)));
    const page = read(`../public/${slug}/index.html`);
    if (html !== page) {
      // Find the first difference so the failure points at something actionable.
      let i = 0;
      while (i < html.length && html[i] === page[i]) i++;
      assert.fail(`public/${slug}/index.html differs from the generator at char ${i}.\n  generator: ${JSON.stringify(html.slice(Math.max(0, i - 40), i + 80))}\n  page:      ${JSON.stringify(page.slice(Math.max(0, i - 40), i + 80))}\nRun: npm run guides:regen`);
    }
  });

  test(`${slug}: the page has one of each panel and no leftover template placeholders`, () => {
    const page = read(`../public/${slug}/index.html`);
    for (const id of ["main-content", "view-guide", "view-cards", "view-quiz", "view-exam", "view-qref", "view-memory"]) {
      assert.equal(count(page, `id="${id}"`), 1, `${slug}: expected exactly one id="${id}"`);
    }
    assert.ok(!/__[A-Z][A-Z_]{3,}__/.test(page), `${slug}: unreplaced placeholder ${page.match(/__[A-Z][A-Z_]{3,}__/)?.[0]}`);
  });
}

test('guide text containing "$\'", "$&" or "$`" is inserted literally (String.replace patterns once duplicated whole page sections)', () => {
  const evil = "cost is $' then $& and $` end";
  const html = generateGuide({
    slug: "demo",
    title: "Demo",
    accentColor: "#4338ca",
    qbankArchive: true,
    units: [{ id: 1, name: `One ${evil}`, concepts: [{ l: "C", intro: evil, b: [evil] }], traps: [evil], fms: [evil] }],
    quiz: [{ u: 1, q: evil, o: [evil, "b", "c", "d"], a: 0, e: evil }],
    hardQuiz: [{ u: 1, q: evil, o: ["a", evil, "c", "d"], a: 1, e: evil }],
    flashcards: [{ u: 1, t: evil, d: evil }],
    workedExamples: [{ u: 1, title: evil, prompt: evil, steps: [evil], answer: evil }],
    qrefHtml: `<div>${evil}</div>`,
    memoryHtml: `<div>${evil}</div>`,
    examParts: { PART_A: [], PART_B1: [], PART_B2: [], PART_C: [] },
  });
  assert.equal(count(html, 'id="view-cards"'), 1);
  assert.equal(count(html, 'id="main-content"'), 1);
  assert.equal(count(html, "</html>"), 1);
  assert.ok(!/__[A-Z][A-Z_]{3,}__/.test(html), "no unreplaced placeholders");
  assert.ok(html.includes(evil), "the text appears literally");
});
