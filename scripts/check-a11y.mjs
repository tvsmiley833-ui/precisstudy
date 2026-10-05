#!/usr/bin/env node
// Static accessibility lint over public/**/index.html (no browser needed). It cannot replace a real audit, but it
// catches the mistakes that are cheap to make and cheap to prevent: missing lang/title/h1/main, images without alt,
// controls without a name, form fields without a label, and duplicate ids.
//   node scripts/check-a11y.mjs [--json]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PUB = resolve("public");
// Pages whose structure is intentional: /age/ shows one of two screens (one h1 visible at a time); share, challenge and admin are
// rendered by script or internal. Honeypot fields are hidden from users on purpose.
const SKIP = { "/age/": ["h1"], "/share/": ["h1", "main"], "/challenge/": ["h1", "main"], "/admin/": ["main"] };
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p); else if (f === "index.html" || f === "404.html") yield p;
  }
}
const text = h => h.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
const strip = h => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const attr = (tag, n) => { const m = tag.match(new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")); return m ? (m[2] ?? m[3]) : null; };

const issues = [];
for (const file of walk(PUB)) {
  const page = "/" + relative(PUB, file).replace(/index\.html$/, "");
  const html = text(readFileSync(file, "utf8"));
  const add = (rule, detail) => { if ((SKIP[page] || []).includes(rule)) return; if (rule === "field-label" && /tabindex="-1"/.test(detail)) return; /* honeypot */ issues.push({ page, rule, detail }); };
  if (!/<html[^>]*\blang=/i.test(html)) add("html-lang", "missing lang on <html>");
  if (!/<title>[^<]+<\/title>/i.test(html)) add("title", "missing or empty <title>");
  const h1 = (html.match(/<h1\b/gi) || []).length;
  if (h1 !== 1 && !/404/.test(page)) add("h1", `${h1} <h1> elements (want 1)`);
  if (!/<main\b|role="main"/i.test(html)) add("main", "no <main> landmark");
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (attr(m[0], "alt") === null) add("img-alt", m[0].slice(0, 80));
  // Buttons and links need an accessible name: text, aria-label/labelledby, title, or an inner img with alt.
  for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const [, tag, a, inner] = m;
    if (tag === "a" && !/\bhref=/i.test(a)) continue;
    if (/\bhidden\b|aria-hidden="true"/i.test(a) && !/aria-label/i.test(a)) continue;
    const named = strip(inner).length || /aria-label(ledby)?\s*=\s*"[^"]+"/i.test(a) || /\btitle\s*=\s*"[^"]+"/i.test(a) || /<img\b[^>]*\balt="[^"]+"/i.test(inner) || /<svg\b[^>]*aria-label="[^"]+"/i.test(inner);
    if (!named) add("control-name", `<${tag}${a.slice(0, 70)}>`);
  }
  for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const t = m[0];
    const type = (attr(t, "type") || "text").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    const id = attr(t, "id");
    const labelled = /aria-label(ledby)?\s*=\s*"[^"]+"/i.test(t) || (id && new RegExp(`<label\\b[^>]*\\bfor="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i").test(html)) || /\btitle\s*=\s*"[^"]+"/i.test(t);
    // An input nested inside a <label> is also labelled; approximate by checking the preceding 300 chars for an open <label.
    const idx = html.indexOf(t); const before = html.slice(Math.max(0, idx - 300), idx);
    if (!labelled && !/<label\b(?![\s\S]*<\/label>)/i.test(before)) add("field-label", t.slice(0, 90));
  }
  const ids = new Map();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.set(m[1], (ids.get(m[1]) || 0) + 1);
  for (const [id, n] of ids) if (n > 1) add("duplicate-id", `${id} x${n}`);
}
const byRule = {};
for (const i of issues) (byRule[i.rule] = byRule[i.rule] || []).push(i);
if (process.argv.includes("--json")) console.log(JSON.stringify(issues, null, 1));
else {
  for (const [rule, list] of Object.entries(byRule)) {
    console.log(`\n${rule}: ${list.length}`);
    for (const i of list.slice(0, 6)) console.log(`  ${i.page}  ${i.detail}`);
  }
  console.log(`\n${issues.length} issue(s) across ${new Set(issues.map(i => i.page)).size} page(s)`);
}
process.exit(issues.length ? 1 : 0);
