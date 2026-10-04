import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);

test("generated tip pages are up to date with tips/*.json", () => {
  execFileSync("node", ["scripts/generate-tips.mjs", "--check"], { cwd: root.pathname, stdio: "pipe" });
});

test("every tip has a unique slug, a real guide, and a worked example", () => {
  const files = readdirSync(new URL("tips/", root)).filter(f => f.endsWith(".json"));
  const slugs = new Set();
  for (const f of files) {
    const t = JSON.parse(readFileSync(new URL("tips/" + f, root), "utf8"));
    assert.equal(t.slug + ".json", f);
    assert.ok(!slugs.has(t.slug)); slugs.add(t.slug);
    assert.ok(t.description.length >= 60 && t.description.length <= 170, `${t.slug}: description length ${t.description.length}`);
    assert.ok(t.pageTitle.length <= 80, `${t.slug}: title too long`);
    assert.ok(t.slides.some(s => s.type === "example"), `${t.slug}: needs an example`);
    assert.ok(t.slides.at(-1).type === "cta");
  }
});

test("each tip page has one h1, a canonical URL, structured data and a link to its guide", () => {
  for (const f of readdirSync(new URL("tips/", root)).filter(f => f.endsWith(".json"))) {
    const t = JSON.parse(readFileSync(new URL("tips/" + f, root), "utf8"));
    const h = readFileSync(new URL(`public/tips/${t.slug}/index.html`, root), "utf8");
    assert.equal((h.match(/<h1/g) || []).length, 1);
    assert.ok(h.includes(`<link rel="canonical" href="https://precisstudy.com/tips/${t.slug}/"/>`));
    assert.ok(h.includes('"@type":"Article"') && h.includes('"@type":"BreadcrumbList"'));
    assert.ok(h.includes(`href="/${t.guide}/"`));
    assert.ok(h.includes("</head>"));
  }
});
