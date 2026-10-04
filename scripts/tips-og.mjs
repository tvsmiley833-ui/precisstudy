#!/usr/bin/env node
// Renders a 1200x630 link-preview card for each study tip into public/tips/<slug>/og.jpg (needs Google Chrome and ffmpeg locally).
// Run after adding a tip, then `node scripts/generate-tips.mjs` so the page points at it. The JPEGs are committed.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const font = f => pathToFileURL(join(root, "public/fonts", f)).href;
const work = mkdtempSync(join(tmpdir(), "tips-og-"));

const card = t => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Fraunces';font-weight:100 900;src:url('${font("fraunces-latin.woff2")}') format('woff2')}
@font-face{font-family:'Nunito';font-weight:200 1000;src:url('${font("nunito-latin.woff2")}') format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:1200px;height:630px;overflow:hidden}
body{background:radial-gradient(120% 140% at 15% 0%,#1f5a45 0%,#14302a 62%);color:#f2f6ef;font-family:'Nunito',sans-serif;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.chip{align-self:flex-start;background:#4fbf85;color:#0c231d;font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:26px;padding:10px 22px;border-radius:999px}
h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:${t.pageTitle.length > 52 ? 66 : 76}px;line-height:1.08;max-width:1000px}
.foot{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:30px}
.foot span:last-child{color:#4fbf85}
</style></head><body><div class="chip">${esc(t.guideLabel)}</div><h1>${esc(t.pageTitle)}</h1>
<div class="foot"><span>PrecisStudy</span><span>Free study tips · precisstudy.com</span></div></body></html>`;

for (const f of readdirSync(join(root, "tips")).filter(f => f.endsWith(".json"))) {
  const t = JSON.parse(readFileSync(join(root, "tips", f), "utf8"));
  const html = join(work, t.slug + ".html"), png = join(work, t.slug + ".png");
  writeFileSync(html, card(t));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--virtual-time-budget=3000", "--window-size=1200,630", `--screenshot=${png}`, pathToFileURL(html).href], { stdio: "ignore" });
  const out = join(root, "public/tips", t.slug, "og.jpg");
  mkdirSync(dirname(out), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-q:v", "3", "-pix_fmt", "yuvj420p", out]);
  console.log("og:", t.slug);
}
rmSync(work, { recursive: true, force: true });
