#!/usr/bin/env node
// Study Tips: one crawlable page per tip (tips/<slug>.json) plus the /tips/ index.
// The same JSON drives the social carousels in precisstudy-social, so a tip is written once.
//   node scripts/generate-tips.mjs            write public/tips/** and src/tips-list.ts
//   node scripts/generate-tips.mjs --check    exit 1 if the committed output is out of date
// Page chrome (CSS variables, header, footer, scripts) is lifted from public/about/index.html so the two never drift.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ORIGIN = "https://precisstudy.com";

const about = readFileSync(join(root, "public/about/index.html"), "utf8");
const between = (s, a, b, from = 0) => { const i = s.indexOf(a, from); if (i < 0) throw new Error("template marker missing: " + a); const j = s.indexOf(b, i + a.length); if (j < 0) throw new Error("template marker missing: " + b); return [i, j]; };
const [cssA, cssB] = between(about, "<style>", "</style>");
const BASE_CSS = about.slice(cssA, cssB + 8);
const [bodyA] = between(about, "<body", ">");
const bodyOpen = about.slice(bodyA, about.indexOf(">", bodyA) + 1);
const [chromeA] = between(about, '<a href="#main-content" class="ss-skip-link"', ">");
const chromeB = about.indexOf('<div role="main"');
const CHROME = about.slice(chromeA, chromeB).replace(/<a role="menuitem" href="\/about\/"[^>]*aria-current="page"[^>]*>/, m => m.replace(' aria-current="page"', ""));
const [footA] = between(about, '<div role="contentinfo"', ">");
const TAIL = about.slice(footA, about.lastIndexOf("</body>"));

const CSS = `<style>
.tip-wrap{max-width:760px;margin:0 auto;padding:36px 24px 72px}
.tip-crumbs{font-size:13.5px;color:var(--text-muted);margin:0 0 18px}.tip-crumbs a{color:var(--text-muted)}
.tip-chip{display:inline-block;background:var(--chip-bg,#e6efe8);color:var(--accent);font-weight:800;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:999px}
.tip-wrap h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(30px,5vw,44px);line-height:1.12;margin:14px 0 12px;color:var(--text)}
.tip-lede{font-size:18px;line-height:1.55;color:var(--text-body,var(--text));margin:0 0 28px}
.tip-sec{margin:34px 0}.tip-sec h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:26px;line-height:1.2;margin:0 0 14px;color:var(--text)}
.tip-cards{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:10px}
.tip-cards li{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:15px 18px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:600;font-size:16.5px;line-height:1.45;color:var(--text);overflow-wrap:anywhere}
.tip-note,.tip-sec p{font-size:17px;line-height:1.6;color:var(--text-body,var(--text));margin:10px 0}
.tip-rows{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:12px}
.tip-rows li{display:flex;gap:14px;align-items:flex-start}.tip-badge{flex:none;min-width:44px;height:44px;border-radius:12px;background:var(--accent-solid);color:#fff;font-weight:800;display:grid;place-items:center;padding:0 8px}
.tip-q{font-size:19px;font-weight:700;color:var(--text);margin:0 0 10px}
.tip-steps{margin:0 0 12px;padding-left:22px;font-size:17px;line-height:1.55;color:var(--text-body,var(--text))}
.tip-answer{background:var(--accent-solid);color:#fff;border-radius:14px;padding:15px 18px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:700;font-size:17px;overflow-wrap:anywhere}
.tip-warn{border:2px solid #c25454;border-radius:16px;padding:20px 22px;background:color-mix(in srgb,#c25454 7%,var(--bg-card))}
.tip-warn h2{color:var(--text)}.tip-wrong{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:700;text-decoration:line-through;text-decoration-color:#c25454;text-decoration-thickness:2px;color:var(--text);margin:0 0 12px;font-size:17px;overflow-wrap:anywhere}
.tip-cta{margin-top:40px;background:var(--bg-card);border:2px solid var(--border);border-radius:18px;padding:26px;text-align:center}
.tip-cta h2{margin:0 0 8px}.tip-cta p{margin:6px 0}
.tip-btn{display:inline-block;margin-top:12px;background:var(--accent-solid);color:#fff;font-weight:800;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:16px}
.tip-btn:hover{background:var(--accent-solid-hover)}
.tip-more{margin-top:44px}.tip-more h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:22px;margin:0 0 12px}
.tip-more ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.tip-more a{color:var(--accent);font-weight:700;text-decoration:none}.tip-more a:hover{text-decoration:underline}
.tip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin-top:22px}
.tip-card{display:block;text-decoration:none;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:20px;color:var(--text);transition:border-color .15s ease,transform .15s ease}
.tip-card:hover{border-color:var(--accent);transform:translateY(-2px)}.tip-card b{display:block;font-size:17px;line-height:1.3;margin:10px 0 6px}.tip-card span.d{font-size:14px;line-height:1.45;color:var(--text-muted)}
.tip-card[hidden]{display:none}.tip-filter{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.tip-filter button{font:inherit;font-size:13.5px;font-weight:700;padding:7px 14px;border-radius:999px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);cursor:pointer}.tip-filter button[aria-pressed="true"]{background:var(--accent-solid);border-color:var(--accent-solid);color:#fff}.tip-filter button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.tip-card{transition:none}.tip-card:hover{transform:none}}
</style>`;

function sentence(t) {
  if (/=/.test(t) || t !== t.toUpperCase() || !/\s/.test(t.trim())) return t; // mnemonics (FANBOYS, SOH-CAH-TOA) stay as written
  const s = t.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function section(s) {
  switch (s.type) {
    case "hook": return "";
    case "formula":
      return `<section class="tip-sec"><h2>${esc(sentence(s.title))}</h2><ul class="tip-cards">${s.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>${s.note ? `<p class="tip-note">${esc(s.note)}</p>` : ""}</section>`;
    case "soap":
      return `<section class="tip-sec"><h2>${esc(sentence(s.title))}</h2><ul class="tip-cards"><li>${esc(s.demo)}</li></ul><ul class="tip-rows">${s.rows.map(r => `<li><span class="tip-badge">${esc(r[0])}</span><div><b>${esc(r[1])}</b>: ${esc(r[2])}</div></li>`).join("")}</ul></section>`;
    case "example":
      return `<section class="tip-sec"><h2>${esc(sentence(s.title))}</h2><p class="tip-q">${esc(s.problem)}</p><ol class="tip-steps">${s.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol><div class="tip-answer">${esc(s.answer)}</div></section>`;
    case "warn":
      return `<section class="tip-sec tip-warn"><h2>Common mistake</h2><p class="tip-wrong">${esc(s.wrong)}</p>${s.points.map(t => `<p>${esc(t)}</p>`).join("")}</section>`;
    default: return "";
  }
}

const tips = readdirSync(join(root, "tips")).filter(f => f.endsWith(".json")).sort()
  .map(f => JSON.parse(readFileSync(join(root, "tips", f), "utf8")));
for (const t of tips) for (const k of ["slug", "pageTitle", "guide", "guideLabel", "description", "published", "subject", "slides"]) if (!t[k]) throw new Error(`tips/${t.slug || "?"}: missing ${k}`);
if (!tips.every(t => existsSync(join(root, "public", t.guide, "index.html")))) throw new Error("a tip points at a guide that does not exist");

function head(title, desc, path, extra, image) {
  const img = image ? `${ORIGIN}${image}` : `${ORIGIN}/logo-full.png`;
  const dims = image ? `\n<meta property="og:image:width" content="1200"/>\n<meta property="og:image:height" content="630"/>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="PrecisStudy"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${ORIGIN}${path}"/>
<link rel="canonical" href="${ORIGIN}${path}"/>
<meta property="og:image" content="${img}"/>${dims}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${img}"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="preload" href="/fonts/nunito-latin.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="stylesheet" href="/fonts/nunito.css"/>
<script>
(function(){
  try {
    var saved = localStorage.getItem('ss-theme');
    if (saved === 'dark' || (saved !== 'light' && !(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches))) document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
</script>
${BASE_CSS}
<link rel="stylesheet" href="/shared/site-header.css"/>
${CSS}
${extra}</head>
${bodyOpen}
${CHROME}`;
}

function articlePage(t) {
  const path = `/tips/${t.slug}/`;
  const title = `${t.pageTitle} | PrecisStudy`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "Article", headline: t.pageTitle, description: t.description, datePublished: t.published, dateModified: t.published, mainEntityOfPage: ORIGIN + path, image: existsSync(join(root, "public/tips", t.slug, "og.jpg")) ? `${ORIGIN}/tips/${t.slug}/og.jpg` : ORIGIN + "/logo-full.png",
      author: { "@type": "Organization", name: "PrecisStudy", url: ORIGIN + "/" }, publisher: { "@type": "Organization", name: "PrecisStudy", logo: { "@type": "ImageObject", url: ORIGIN + "/logo-full.png" } }, about: t.guideLabel },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
      { "@type": "ListItem", position: 2, name: "Study Tips", item: ORIGIN + "/tips/" },
      { "@type": "ListItem", position: 3, name: t.pageTitle, item: ORIGIN + path } ] } ] };
  const others = tips.filter(o => o.slug !== t.slug && o.guide === t.guide).concat(tips.filter(o => o.slug !== t.slug && o.guide !== t.guide)).slice(0, 4);
  const main = `<div role="main" id="main-content" class="tip-wrap">
<nav class="tip-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/tips/">Study Tips</a> &rsaquo; <span>${esc(t.guideLabel)}</span></nav>
<span class="tip-chip">${esc(t.guideLabel)}</span>
<h1>${esc(t.pageTitle)}</h1>
<p class="tip-lede">${esc(t.description)}</p>
${t.slides.map(section).join("\n")}
<section class="tip-cta"><h2>Want more ${esc(t.guideLabel)} practice?</h2><p>The free ${esc(t.guideLabel)} study guide has quizzes, flashcards and practice exams. 100% free, no sign-up needed.</p><a class="tip-btn" href="/${t.guide}/">Open the ${esc(t.guideLabel)} guide</a></section>
<aside class="tip-more"><h2>More study tips</h2><ul>${others.map(o => `<li><a href="/tips/${o.slug}/">${esc(o.pageTitle)}</a></li>`).join("")}</ul></aside>
</div>
`;
  const og = existsSync(join(root, "public/tips", t.slug, "og.jpg")) ? `/tips/${t.slug}/og.jpg` : null;
  return head(title, t.description, path, `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`, og) + main + TAIL + "</body>\n</html>\n";
}

function indexPage() {
  const path = "/tips/";
  const desc = "Short, free study tips for high school classes: mnemonics, worked examples and the mistakes to avoid, from Algebra to AP Biology.";
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Study Tips", description: desc, url: ORIGIN + path,
    hasPart: tips.map(t => ({ "@type": "Article", headline: t.pageTitle, url: `${ORIGIN}/tips/${t.slug}/` })) };
  const main = `<div role="main" id="main-content" class="tip-wrap" style="max-width:1000px">
<nav class="tip-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Study Tips</span></nav>
<h1>Study tips</h1>
<p class="tip-lede">Quick mnemonics, worked examples and the mistakes to avoid. Each tip links to the full free study guide for the class.</p>
<div class="tip-filter" id="tip-filter" role="group" aria-label="Filter by class" hidden></div>
<div class="tip-grid" id="tip-grid">${[...tips].sort((a, b) => a.guideLabel.localeCompare(b.guideLabel)).map(t => `<a class="tip-card" href="/tips/${t.slug}/"><span class="tip-chip">${esc(t.guideLabel)}</span><b>${esc(t.pageTitle)}</b><span class="d">${esc(t.description)}</span></a>`).join("")}</div>
<script>(function(){var g=document.getElementById("tip-grid"),f=document.getElementById("tip-filter");if(!g||!f)return;var cards=[].slice.call(g.children),labels=[];cards.forEach(function(c){var l=c.querySelector(".tip-chip").textContent;if(labels.indexOf(l)<0)labels.push(l)});function show(l,b){cards.forEach(function(c){c.hidden=!!l&&c.querySelector(".tip-chip").textContent!==l});[].forEach.call(f.children,function(x){x.setAttribute("aria-pressed",x===b?"true":"false")})}["All"].concat(labels).forEach(function(l,i){var b=document.createElement("button");b.type="button";b.textContent=l;b.setAttribute("aria-pressed",i?"false":"true");b.onclick=function(){show(i?l:"",b)};f.appendChild(b)});f.hidden=false})();</script>
</div>
`;
  return head("Study Tips for High School Classes | PrecisStudy", desc, path, `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`).replace('<meta property="og:type" content="article"/>', '<meta property="og:type" content="website"/>') + main + TAIL + "</body>\n</html>\n";
}

const outputs = new Map();
outputs.set("public/tips/index.html", indexPage());
for (const t of tips) outputs.set(`public/tips/${t.slug}/index.html`, articlePage(t));
outputs.set("src/tips-list.ts", `// Generated by scripts/generate-tips.mjs, do not edit.\nexport const TIPS: { slug: string; published: string }[] = ${JSON.stringify(tips.map(t => ({ slug: t.slug, published: t.published })), null, 2)};\n`);

let stale = 0;
for (const [rel, body] of outputs) {
  const f = join(root, rel);
  const same = existsSync(f) && readFileSync(f, "utf8") === body;
  if (same) continue;
  stale++;
  if (!check) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, body); console.log("wrote", rel); }
  else console.log("stale:", rel);
}
if (check && stale) process.exit(1);
console.log(`${tips.length} tip(s), ${stale} file(s) ${check ? "out of date" : "written"}`);
