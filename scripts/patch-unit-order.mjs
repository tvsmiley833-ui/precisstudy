#!/usr/bin/env node
// One-off mechanical patch: adds unit-order wiring to every generated
// public/<subject>/index.html. Idempotent (skips files that already have
// the marker) and prints a summary rather than silently continuing on
// anything unexpected.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_DIR = join(process.cwd(), "public");

const OLD_MODULE_BLOCK = `<script type="module">
  import { createMastery } from '/shared/mastery.js';
  import { celebrateCorrect, resetCombo } from '/shared/celebrate.js';
  import '/shared/chalk-cursor.js';
  window.__ssCreateMastery = createMastery;
  window.__ssCelebrateCorrect = celebrateCorrect;
  window.__ssResetCombo = resetCombo;
  window.dispatchEvent(new Event('ss-mastery-ready'));
</script>`;

const NEW_MODULE_BLOCK = `<script type="module">
  import { createMastery } from '/shared/mastery.js';
  import { celebrateCorrect, resetCombo } from '/shared/celebrate.js';
  import { applyStoredUnitOrder, refreshUnitOrder } from '/shared/unit-order.js';
  import '/shared/chalk-cursor.js';
  window.__ssCreateMastery = createMastery;
  window.__ssCelebrateCorrect = celebrateCorrect;
  window.__ssResetCombo = resetCombo;
  window.__ssApplyUnitOrder = applyStoredUnitOrder;
  window.__ssRefreshUnitOrder = refreshUnitOrder;
  window.dispatchEvent(new Event('ss-mastery-ready'));
</script>`;

const MARKER = "__ssApplyUnitOrder";

/**
 * Bracket-depth scanner: finds the index right after the `;` that
 * terminates the array literal assigned to `const UNITS=`, respecting JS
 * string literals and escape sequences (the literal is one giant
 * single-line JSON-like blob, so a naive "first ];" regex is not safe).
 * @param {string} src
 * @param {number} startIdx index of the `[` that opens the UNITS array
 * @returns {number} index right after the terminating `;`, or -1
 */
function findArrayLiteralEnd(src, startIdx) {
  let depth = 0;
  let i = startIdx;
  let inString = false;
  let quoteChar = "";
  for (; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === "\\") { i++; continue; } // skip escaped char
      if (c === quoteChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inString = true;
      quoteChar = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        // Expect a `;` right after (possibly nothing between).
        let j = i + 1;
        if (src[j] === ";") return j + 1;
        return -1; // unexpected structure
      }
    }
  }
  return -1;
}

function main() {
  const entries = readdirSync(PUBLIC_DIR);
  const touched = [];
  const skippedNoUnits = [];
  const skippedAlready = [];
  const anomalies = [];

  for (const entry of entries) {
    const dir = join(PUBLIC_DIR, entry);
    let st;
    try { st = statSync(dir); } catch (e) { continue; }
    if (!st.isDirectory()) continue;
    const file = join(dir, "index.html");
    let src;
    try { src = readFileSync(file, "utf8"); } catch (e) { continue; }

    if (!src.includes("const UNITS=")) { skippedNoUnits.push(entry); continue; }

    if (src.includes(MARKER)) { skippedAlready.push(entry); continue; }

    // Discover the subject key via window.__ssCreateMastery('<key>' — stable
    // across all pages, unlike guessing from the folder name.
    const keyMatch = src.match(/window\.__ssCreateMastery\('([^']+)'/);
    if (!keyMatch) { anomalies.push(`${entry}: no window.__ssCreateMastery('<key>' found`); continue; }
    const subjectKey = keyMatch[1];

    if (!src.includes(OLD_MODULE_BLOCK)) { anomalies.push(`${entry}: module-wiring block doesn't match expected byte-identical template`); continue; }

    const unitsStart = src.indexOf("const UNITS=");
    const arrayStart = src.indexOf("[", unitsStart);
    if (arrayStart === -1) { anomalies.push(`${entry}: could not find opening [ after const UNITS=`); continue; }
    const insertAt = findArrayLiteralEnd(src, arrayStart);
    if (insertAt === -1) { anomalies.push(`${entry}: bracket-depth scan couldn't find terminating ]; for UNITS array`); continue; }

    const insertion = `window.__ssApplyUnitOrder&&window.__ssApplyUnitOrder('${subjectKey}',UNITS);window.__ssRefreshUnitOrder&&window.__ssRefreshUnitOrder('${subjectKey}');`;

    let patched = src.slice(0, insertAt) + insertion + src.slice(insertAt);
    patched = patched.split(OLD_MODULE_BLOCK).join(NEW_MODULE_BLOCK);

    writeFileSync(file, patched, "utf8");
    touched.push(`${entry} (key: ${subjectKey})`);
  }

  console.log(`Patched: ${touched.length}`);
  touched.forEach(t => console.log("  + " + t));
  console.log(`Skipped (no const UNITS= - not a subject guide page): ${skippedNoUnits.length}`);
  skippedNoUnits.forEach(s => console.log("  - " + s));
  console.log(`Skipped (already patched): ${skippedAlready.length}`);
  skippedAlready.forEach(s => console.log("  - " + s));
  if (anomalies.length) {
    console.log(`ANOMALIES (${anomalies.length}) - not patched, needs manual review:`);
    anomalies.forEach(a => console.log("  ! " + a));
  } else {
    console.log("No anomalies.");
  }
}

main();
