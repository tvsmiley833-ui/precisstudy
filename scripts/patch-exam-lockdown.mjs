#!/usr/bin/env node
// One-off mechanical patch: adds opt-in exam-condition lockdown mode to every
// already-generated subject page's inline exam logic + CSS, mirroring
// scripts/patch-unit-order.mjs / scripts/patch-error-monitor.mjs. Three
// independent, idempotent sub-patches per file:
//   1. module-wiring.html's shared <script type="module"> block: import
//      enterLockdown/exitLockdown/getLockdownSummary and assign window.__ss*.
//   2. logic.js's inlined buildExam(): adds the lockdown bar/warn/summary
//      markup and the ssStartExamLockdown/ssEndExamLockdown functions.
//   3. exam.css's inlined EXAM_CSS JSON string: adds the lockdown bar/warn/
//      summary styles.
// Each sub-patch is verified byte-identical before touching a file, and
// skipped (not failed) if already applied, so re-running is a no-op.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");
const T = (name) => readFileSync(join(ROOT, "scripts/guide-template", name), "utf8");

const MARKER = "ssStartExamLockdown"; // presence => already patched (logic.js part)

// ---- sub-patch 1: module-wiring.html block ----
const OLD_WIRING = `  import { applyStoredUnitOrder, refreshUnitOrder } from '/shared/unit-order.js';
  window.__ssCreateMastery = createMastery;
  window.__ssCelebrateCorrect = celebrateCorrect;
  window.__ssResetCombo = resetCombo;
  window.__ssApplyUnitOrder = applyStoredUnitOrder;
  window.__ssRefreshUnitOrder = refreshUnitOrder;`;
const NEW_WIRING = `  import { applyStoredUnitOrder, refreshUnitOrder } from '/shared/unit-order.js';
  import { enterLockdown, exitLockdown, getLockdownSummary } from '/shared/exam-lockdown.js';
  window.__ssCreateMastery = createMastery;
  window.__ssCelebrateCorrect = celebrateCorrect;
  window.__ssResetCombo = resetCombo;
  window.__ssApplyUnitOrder = applyStoredUnitOrder;
  window.__ssRefreshUnitOrder = refreshUnitOrder;
  window.__ssEnterLockdown = enterLockdown;
  window.__ssExitLockdown = exitLockdown;
  window.__ssGetLockdownSummary = getLockdownSummary;`;

// ---- sub-patch 2: buildExam() inline HTML + new functions ----
const OLD_BUILDEXAM = `v.innerHTML=\`
<div class="ex-header">
  <h2>\${EXAM_META.title}</h2>
  <p>\${EXAM_META.subtitle}</p>
</div>
<div id="ex-score-box" class="ex-score"></div>
\${buildPartMC('A',PART_A)}
\${buildPartMC('B1',PART_B1)}
\${buildPartFR('B2',PART_B2)}
\${buildPartFR('C',PART_C)}
\`;
// open Part A by default
togglePart('A');
}`;
const NEW_BUILDEXAM = T("logic.js").slice(
  T("logic.js").indexOf('v.innerHTML=`'),
  T("logic.js").indexOf("function examPartMeta")
).trimEnd();

// ---- sub-patch 3: EXAM_CSS inline JSON string ----
// Reconstruct the OLD css (pre-lockdown) by stripping the lockdown block back
// out of the current template file, then compute both JSON-encoded forms the
// same way generate-guide.mjs does (JSON.stringify).
const CURRENT_CSS = T("exam.css");
const LOCKDOWN_CSS_BLOCK = CURRENT_CSS.slice(CURRENT_CSS.indexOf(".ex-lockdown-bar"));
const OLD_CSS = CURRENT_CSS.slice(0, CURRENT_CSS.indexOf(".ex-lockdown-bar"));
const OLD_CSS_JSON = JSON.stringify(OLD_CSS);
const NEW_CSS_JSON = JSON.stringify(CURRENT_CSS);
const OLD_EXAM_CSS_DECL = `const EXAM_CSS=${OLD_CSS_JSON};`;
const NEW_EXAM_CSS_DECL = `const EXAM_CSS=${NEW_CSS_JSON};`;

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch (e) { continue; }
    if (st.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry === "index.html") out.push(full);
  }
  return out;
}

function main() {
  const files = findHtmlFiles(PUBLIC_DIR);
  const touched = [];
  const skippedAlready = [];
  const skippedNoMatch = [];
  const anomalies = [];

  for (const file of files) {
    let src;
    try { src = readFileSync(file, "utf8"); } catch (e) { continue; }

    if (src.includes(MARKER)) { skippedAlready.push(file); continue; }
    if (!src.includes("buildExam")) { skippedNoMatch.push(file + " (no exam feature)"); continue; }

    const hasWiring = src.includes(OLD_WIRING);
    const hasBuildExam = src.includes(OLD_BUILDEXAM);
    const hasCss = src.includes(OLD_EXAM_CSS_DECL);

    if (!hasWiring || !hasBuildExam || !hasCss) {
      anomalies.push(
        `${file}: missing expected anchor(s) -- wiring:${hasWiring} buildExam:${hasBuildExam} css:${hasCss}`
      );
      continue;
    }

    const wiringCount = src.split(OLD_WIRING).length - 1;
    const buildExamCount = src.split(OLD_BUILDEXAM).length - 1;
    const cssCount = src.split(OLD_EXAM_CSS_DECL).length - 1;
    if (wiringCount !== 1 || buildExamCount !== 1 || cssCount !== 1) {
      anomalies.push(
        `${file}: unexpected occurrence counts -- wiring:${wiringCount} buildExam:${buildExamCount} css:${cssCount}`
      );
      continue;
    }

    let patched = src
      .split(OLD_WIRING).join(NEW_WIRING)
      .split(OLD_BUILDEXAM).join(NEW_BUILDEXAM)
      .split(OLD_EXAM_CSS_DECL).join(NEW_EXAM_CSS_DECL);
    writeFileSync(file, patched, "utf8");
    touched.push(file);
  }

  console.log(`Patched: ${touched.length}`);
  touched.forEach((t) => console.log("  + " + t));
  console.log(`Skipped (already patched): ${skippedAlready.length}`);
  console.log(`Skipped (no exam feature): ${skippedNoMatch.length}`);
  skippedNoMatch.forEach((t) => console.log("  - " + t));
  if (anomalies.length) {
    console.log(`ANOMALIES (${anomalies.length}) -- not patched, needs manual review:`);
    anomalies.forEach((a) => console.log("  ! " + a));
  } else {
    console.log("No anomalies.");
  }
}

main();
