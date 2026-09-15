#!/usr/bin/env node
// One-off mechanical patch: appends the error-monitor.js footer tag right
// after the existing command-palette.js/high-contrast.js footer, across
// every public/ page that already has that footer. Idempotent (skips files
// that already have the marker) and verifies the exact byte-identical
// footer text before touching anything, same discipline as
// scripts/patch-unit-order.mjs.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_DIR = join(process.cwd(), "public");

const FOOTER = '<script src="/shared/command-palette.js" defer></script><script src="/shared/high-contrast.js" defer></script>';
const INSERTION = '<script src="/shared/error-monitor.js" defer></script>';
const MARKER = "/shared/error-monitor.js";

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch (e) { continue; }
    if (st.isDirectory()) {
      out.push(...findHtmlFiles(full));
    } else if (entry === "index.html") {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = findHtmlFiles(PUBLIC_DIR);
  const touched = [];
  const skippedNoFooter = [];
  const skippedAlready = [];
  const anomalies = [];

  for (const file of files) {
    let src;
    try { src = readFileSync(file, "utf8"); } catch (e) { continue; }

    if (!src.includes(FOOTER)) { skippedNoFooter.push(file); continue; }
    if (src.includes(MARKER)) { skippedAlready.push(file); continue; }

    const count = src.split(FOOTER).length - 1;
    if (count !== 1) { anomalies.push(`${file}: footer appears ${count} times, expected exactly 1`); continue; }

    const patched = src.split(FOOTER).join(FOOTER + INSERTION);
    writeFileSync(file, patched, "utf8");
    touched.push(file);
  }

  console.log(`Patched: ${touched.length}`);
  touched.forEach(t => console.log("  + " + t));
  console.log(`Skipped (no matching footer): ${skippedNoFooter.length}`);
  console.log(`Skipped (already patched): ${skippedAlready.length}`);
  if (anomalies.length) {
    console.log(`ANOMALIES (${anomalies.length}) - not patched, needs manual review:`);
    anomalies.forEach(a => console.log("  ! " + a));
  } else {
    console.log("No anomalies.");
  }
}

main();
