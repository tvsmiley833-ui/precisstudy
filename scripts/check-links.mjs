#!/usr/bin/env node
// Internal link checker: every local href/src in public/**/*.html must point at a file that exists (or at a route the
// Worker serves). Fragment-only and external links are skipped, and #anchors on other pages are checked against ids.
//   node scripts/check-links.mjs [--json]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const PUB = resolve("public");
// Routes the Worker answers that are not static files (see src/worker.ts); links to these are fine.
const DYNAMIC = [/^\/api\//, /^\/auth\//, /^\/admin(\/|$)/, /^\/(sitemap\.xml|robots\.txt|manifest\.webmanifest|sw\.js)$/, /^\/[a-z0-9-]+\/(quiz|flashcards|exam|examples|reference|memory)\/?$/, /^\/tips\/[a-z0-9-]+\/?$/];

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p); else if (f.endsWith(".html")) yield p;
  }
}
const idsCache = new Map();
function idsOf(file) {
  if (!idsCache.has(file)) idsCache.set(file, new Set([...readFileSync(file, "utf8").matchAll(/\bid="([^"]+)"/g)].map(m => m[1])));
  return idsCache.get(file);
}
function resolveTarget(pathname) {
  const p = join(PUB, decodeURIComponent(pathname));
  if (existsSync(p) && statSync(p).isFile()) return p;
  const idx = join(p, "index.html");
  if (existsSync(idx)) return idx;
  if (existsSync(p + ".html")) return p + ".html";
  return null;
}

const problems = [];
let checked = 0;
for (const file of walk(PUB)) {
  // Links built by inline scripts (string concatenation, templates) are not static links.
  const html = readFileSync(file, "utf8").replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const here = "/" + relative(PUB, file).replace(/index\.html$/, "").replace(/\\/g, "/");
  for (const m of html.matchAll(/\b(?:href|src)="([^"#][^"]*|#[^"]*)"/g)) {
    let u = m[1].trim();
    if (!u || /^(https?:|mailto:|tel:|data:|javascript:|blob:|\/\/)/i.test(u)) continue;
    if (u.startsWith("#") || /['"+]|\$\{|\s/.test(u)) continue;
    const [path, frag] = u.split("#");
    const clean = path.split("?")[0];
    if (!clean) continue;
    const abs = clean.startsWith("/") ? clean : resolve("/", dirname(here + "x"), clean);
    if (DYNAMIC.some(r => r.test(abs))) continue;
    checked++;
    const target = resolveTarget(abs);
    if (!target) { problems.push({ page: here, link: u, why: "missing file" }); continue; }
    if (frag && target.endsWith(".html") && !idsOf(target).has(decodeURIComponent(frag))) {
      // Anchors injected by scripts are not in the static HTML, so report these as a softer warning only for real pages.
      problems.push({ page: here, link: u, why: "missing #id", soft: true });
    }
  }
}
const hard = problems.filter(p => !p.soft);
if (process.argv.includes("--json")) console.log(JSON.stringify({ checked, hard, soft: problems.filter(p => p.soft) }, null, 1));
else {
  for (const p of hard) console.log(`${p.page}  ->  ${p.link}  (${p.why})`);
  console.log(`${checked} internal links checked, ${hard.length} broken, ${problems.length - hard.length} anchor warnings`);
}
process.exit(hard.length ? 1 : 0);
