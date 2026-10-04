// Rewrites the footer of the hand-authored pages that use the shared header
// (those loading /shared/site-header.js) to the canonical markup. Idempotent.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { siteFooter } from "./lib/site-footer.mjs";

const PUB = join(import.meta.dirname, "..", "public");
const FOOT = siteFooter({ full: true });
const OLD = /<div role="contentinfo"[\s\S]*?<\/a>\s*<\/div>\s*|<footer class="site-foot">[\s\S]*?<\/footer>\s*/;
let changed = 0;
for (const d of readdirSync(PUB, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const p = join(PUB, d.name, "index.html");
  let html;
  try { html = readFileSync(p, "utf8"); } catch { continue; }
  if (!html.includes("/shared/site-header.js")) continue;
  const next = OLD.test(html) ? html.replace(OLD, FOOT) : html.replace("</body>", FOOT + "</body>");
  if (next !== html) { writeFileSync(p, next); changed++; }
}
console.log(`footer synced on ${changed} page(s)`);
