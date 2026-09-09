# Legacy Guide Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the 12 hand-authored legacy guide pages under `scripts/generate-guide.mjs` so they are regenerated from `guides/<slug>.json` like every other guide, with **zero loss** of their existing content and features.

**Architecture:** Two phases. Phase 1 extends the shared template (`scripts/guide-template/*`) and the generator so it can render the two features the legacy pages have that generated pages don't: a **Worked Examples** tab and a **Hard Mode** quiz bank. Phase 2 migrates each legacy page: extract every inline data structure from `public/<slug>/index.html` into `guides/<slug>.json`, regenerate, and diff the rendered content against the pre-migration page to prove nothing was dropped.

**Tech Stack:** Node ESM build scripts (no framework), vanilla-JS page runtime, Vitest for the Worker, Wrangler. Pages are static HTML in `public/<slug>/index.html`.

## Global Constraints

- Node scripts are ESM (`.mjs`) using `node:fs`/`node:path`; `.cjs` helpers loaded via `createRequire`. Match existing style — no new dependencies.
- The generator's output for an already-migrated page must be **byte-stable** across repeated runs (`node scripts/generate-guide.mjs <slug>` twice → identical file).
- Every generated page keeps the APG tab pattern already in the template: `role="tablist"` / `role="tab"` / `role="tabpanel"`, roving `tabindex`, `aria-selected`, arrow-key nav on `.tablist`.
- Meta descriptions come from `buildMetaDescription()` (data-derived). Do **not** copy the legacy pages' boilerplate `<meta name="description">` or any "Expanded Edition" string into the JSON or template.
- JSON-LD comes from `buildJsonLd()`. Legacy pages currently ship none; generated output adds it — that is intended.
- Tab order on every page, left to right: **Study Guide, Flashcards, Quiz, Worked Examples, Practice Exam, Quick Reference, Memory Tricks.** "Worked Examples" sits between Quiz and Practice Exam.
- A page with no worked examples in its JSON must **not** render the Worked Examples tab or `#view-examples` at all (no empty tab).
- A page with no hard-mode questions must **not** render the "Hard Mode Only" option.
- `guides/<slug>.json` is pretty-printed with 1-space indent (match `guides/calc-ab.json`).
- Slug ↔ mastery-key mismatch is real and must be preserved: `src/progress-routes.ts` keys some subjects without dashes (`aplang`, `globalhistory`, `apbiology`) while the URL slug has dashes (`ap-lang`, `global-history`, `ap-biology`). The generated page's `window.__ssCreateMastery('<key>', …)` call must use the **existing** key for that page, not the slug. Capture it per page (Appendix A).
- Run `python3 scripts/sync-guides-registry.py` after adding any `guides/*.json` and commit its output.
- The 12 legacy slugs: `algebra1`, `algebra2`, `ap-biology`, `ap-lang`, `apush`, `biology`, `chemistry`, `geometry`, `global-history`, `physics`, `precalc`, `us-history`.

---

## Feature inventory (what each legacy page carries that the generator lacks)

| slug | Worked Examples tab | Hard Mode (`HARD_Q`) | inline merges (`.push.apply`) | mastery key | special |
|---|---|---|---|---|---|
| algebra1 | yes | – | `QUIZ`+=`QUIZ_EXTRA` | `ALG1_MASTERY` | — |
| algebra2 | yes | yes | `QUIZ`,`FLASHCARDS`,`WORKED` (+`EXTRA_*`, `EXTRA_QUIZ2`) | `ALG2_MASTERY` | — |
| ap-biology | – | – | none | `CHEM_MASTERY` | closest to generator already |
| ap-lang | yes | yes | `QUIZ`,`FLASHCARDS`,`WORKED` (+`EXTRA_*`, `EXTRA_QUIZ`) | `APLANG_MASTERY` | DBQ/LEQ prose in units |
| apush | – | yes | `QUIZ`,`FLASHCARDS` (+`EXTRA_QUIZ`,`EXTRA_FC`) | `CHEM_MASTERY` | large deep bank |
| biology | – | – | none | `CHEM_MASTERY` | — |
| chemistry | – | – | none | `CHEM_MASTERY` | largest file (~3200 lines) |
| geometry | yes | yes | many (`EXTRA_QUIZ`,`EXTRA2_QUIZ`,`EXTRA3_QUIZ`,`IMG_QUIZ`,`GEN_BANK`,`BANK_V15`,`REGENTS_UP`,`WORKED`,`EXTRA_WORKED`,`WORKED_SVGS`) | `GEO_MASTERY` | **bespoke fonts (Fraunces/Outfit/JetBrains), custom `switchTab` with localStorage persistence, per-example SVG diagrams** |
| global-history | yes | – | none | `GLOBALHIST_MASTERY` | — |
| physics | – | yes | `QUIZ`,`FLASHCARDS` (+`EXTRA_QUIZ`,`EXTRA_FC`) | `CHEM_MASTERY` | — |
| precalc | – | – | none | `CHEM_MASTERY` | — |
| us-history | – | yes | `QUIZ`,`FLASHCARDS` (+`EXTRA_QUIZ`,`EXTRA_FC`) | `CHEM_MASTERY` | — |

**geometry is out of scope for this plan.** Its bespoke type system, custom tab-persistence `switchTab`, and per-example inline SVGs (`WORKED_SVGS`) are a separate visual design, not a data-shape difference. Migrating it means either (a) teaching the template a per-page font system + example-diagram slot, or (b) accepting a visual regression. Handle it in its own plan after the other 11 land. Tasks below cover **11 pages**.

---

## File Structure

**Phase 1 — template + generator (touched once):**

- `scripts/guide-template/hero.html` — add the 7th tab button (`tab-examples`).
- `scripts/guide-template/page-views.template.html` — add `#view-examples` panel + `__EXAMPLES__` static-prerender token.
- `scripts/guide-template/style.css` — add the `.ex2-*` rule block (lifted verbatim from a legacy page).
- `scripts/guide-template/logic.js` — fix `switchTab`'s `idx` map; add `buildExamples()`/`revealStep()`/`revealAll()`/`markExample()` + `examplesBuilt` guard; extend `buildQSel()`/`loadQ()` for `HARD_Q`.
- `scripts/generate-guide.mjs` — accept `config.workedExamples` and `config.hardQuiz`; emit `const WORKED=…` / `const HARD_Q=…`; static-render `__EXAMPLES__`; conditionally strip the examples tab/panel when `workedExamples` is empty; validate schema.

**Phase 2 — per page (×11):**

- `guides/<slug>.json` — **create**. Full config: `slug`, `title`, `accentColor`, `masteryKey` (when ≠ default), `units`, `flashcards`, `quiz`, `hardQuiz`, `workedExamples`, `examParts:{PART_A,PART_B1,PART_B2,PART_C}`, `diagrams`.
- `public/<slug>/index.html` — **overwritten** by the generator. Pre-migration copy saved to `/tmp/precis-migration/<slug>.before.html` for diffing.
- `scripts/sync-guides-registry.py` output — regenerated, committed.

---

## Phase 1: Template & Generator

### Task 1: Worked Examples panel + static prerender token in the views template

**Files:**
- Modify: `scripts/guide-template/page-views.template.html` (add panel after `#view-quiz`, before `#view-exam` at line 79)
- Modify: `scripts/guide-template/style.css` (append `.ex2-*` block)

**Interfaces:**
- Produces: a `<div id="view-examples" class="view" role="tabpanel" aria-labelledby="tab-examples" tabindex="0">__EXAMPLES__</div>` panel. `__EXAMPLES__` is replaced by the generator with static HTML (Task 5) or removed entirely with the panel when there are no worked examples.
- Consumes: nothing.

- [ ] **Step 1: Add the panel to the template**

In `scripts/guide-template/page-views.template.html`, immediately after the `#view-quiz` closing `</div>` (currently line 78) and before `<div id="view-exam" …>` (line 79), insert:

```html
<div id="view-examples" class="view" role="tabpanel" aria-labelledby="tab-examples" tabindex="0">__EXAMPLES__</div>
```

- [ ] **Step 2: Add the `.ex2-*` CSS block**

Append to `scripts/guide-template/style.css` (verbatim from `public/algebra2/index.html:223-242`):

```css
.ex2-intro{font-size:15px;color:var(--ink-muted);background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:20px}
.ex2-unit{margin-bottom:26px}
.ex2-h{font-size:17px;font-weight:700;color:var(--accent);margin-bottom:12px;text-transform:uppercase;letter-spacing:.04em}
.ex2-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;margin-bottom:12px;transition:all .2s ease}
.ex2-card.done{border-color:var(--success-border);box-shadow:0 0 0 1px var(--success-border) inset}
.ex2-title{font-size:17px;font-weight:700;color:var(--ink);margin-bottom:6px;display:flex;align-items:center;gap:8px}
.ex2-card.done .ex2-title::after{content:"✓ mastered";font-size:12px;font-weight:700;color:var(--success);background:var(--success-soft);border:1px solid var(--success-border);padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em}
.ex2-prompt{font-size:15.5px;color:var(--ink-muted);line-height:1.6;margin-bottom:12px}
.ex2-steps{display:flex;flex-direction:column;gap:8px}
.ex2-step{display:flex;gap:11px;align-items:flex-start;font-size:14.5px;color:var(--ink-muted);background:var(--surface-2);border-radius:var(--radius-sm);padding:10px 12px}
.ex2-step span{flex:none;width:20px;height:20px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.ex2-answer{font-size:15px;font-weight:700;color:var(--success);background:var(--success-soft);border:1px solid var(--success-border);border-radius:var(--radius-sm);padding:10px 12px;margin-top:4px}
.ex2-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.ex2-actions .btn{font-size:13.5px;padding:7px 14px}
.ex2-reveal{border-color:var(--accent)!important;color:var(--accent)!important}
.ex2-done{margin-left:auto}
```

- [ ] **Step 3: Verify the template still has matched tags**

Run: `node -e "const s=require('fs').readFileSync('scripts/guide-template/page-views.template.html','utf8');const o=(s.match(/<div/g)||[]).length,c=(s.match(/<\/div>/g)||[]).length;console.log(o,c);process.exit(o===c?0:1)"`
Expected: two equal numbers, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/guide-template/page-views.template.html scripts/guide-template/style.css
git commit -m "guide-template: add Worked Examples panel + ex2 styles"
```

---

### Task 2: Worked Examples tab button + fix the tab index map

**Files:**
- Modify: `scripts/guide-template/hero.html:14` (insert button before `tab-exam`)
- Modify: `scripts/guide-template/logic.js:1` (the `idx` map in `switchTab`)

**Interfaces:**
- Consumes: `switchTab('examples')` (defined in Task 3), `buildExamples()` (Task 3).
- Produces: DOM order of `.tab-btn` buttons is `guide, cards, quiz, examples, exam, qref, memory` (indices 0–6). Any code that maps a tab id to an index must use this order.

- [ ] **Step 1: Insert the tab button**

In `scripts/guide-template/hero.html`, between the `tab-quiz` button (line 13) and the `tab-exam` button (line 14), insert:

```html
      <button class="tab-btn" role="tab" id="tab-examples" aria-controls="view-examples" aria-selected="false" tabindex="-1" onclick="switchTab('examples')">Worked Examples</button>
```

- [ ] **Step 2: Fix `switchTab`'s index map**

In `scripts/guide-template/logic.js` line 1, change:

```js
const idx={guide:0,cards:1,quiz:2,exam:3,qref:4,memory:5}[id];
```

to:

```js
const idx={guide:0,cards:1,quiz:2,examples:3,exam:4,qref:5,memory:6}[id];
```

- [ ] **Step 3: Build examples lazily on first switch**

Still in `switchTab` (line 1), the tail reads `if(id==='exam'&&!examBuilt)buildExam();`. Add the examples equivalent immediately before it:

```js
if(id==='examples'&&!examplesBuilt)buildExamples();
```

(`examplesBuilt` / `buildExamples` come from Task 3 — commit Task 3 before this one if executing strictly sequentially; otherwise stage all of Tasks 2–4 together.)

- [ ] **Step 4: Confirm the deep-link wrapper already knows `examples`**

Read `scripts/guide-template/logic.js:819-821`. Confirm `TAB_TO_SEG`, `SEG_TO_TAB`, `TAB_TITLES` already contain `examples` / `'Worked Examples'`. They do — no change needed. Note this in the commit message.

- [ ] **Step 5: Commit (after Task 3 if sequential)**

```bash
git add scripts/guide-template/hero.html scripts/guide-template/logic.js
git commit -m "guide-template: add Worked Examples tab, fix tab index map for 7 tabs"
```

---

### Task 3: Worked Examples runtime (`buildExamples` + reveal/mark) in template logic

**Files:**
- Modify: `scripts/guide-template/logic.js` — add functions near the flashcard/quiz builders (after `buildFCSel`, before the mastery block ~line 280); declare state vars next to the existing `examBuilt` declaration.

**Interfaces:**
- Consumes: `UNITS` (`{id,name,…}[]`), `WORKED` (`{u:Number,title:String,prompt:String,steps:String[],answer:String}[]` — emitted by the generator, Task 5), `CHEM_MASTERY` (the mastery instance; the generator renames this token per page but the template source uses `CHEM_MASTERY`), `switchTab`.
- Produces: `buildExamples()`, `revealStep(id)`, `revealAll(id)`, `markExample(id)`, module vars `examplesBuilt`, `ex2map`, `ex2shown`.

- [ ] **Step 1: Add state vars**

In `scripts/guide-template/logic.js`, next to the existing `let examBuilt` declaration (search `examBuilt`), add:

```js
var examplesBuilt=false, ex2map={}, ex2shown={};
```

- [ ] **Step 2: Add the builder + helpers** (adapted from `public/algebra2/index.html:1405-1445`; `ALG2_MASTERY` → `CHEM_MASTERY` because the generator rewrites that token per page)

```js
function buildExamples(){
  examplesBuilt=true;
  const v=document.getElementById('view-examples');
  if(!v||typeof WORKED==='undefined'||!WORKED.length)return;
  let h='<div class="ex2-intro">Try each problem on your own first — then reveal the solution one step at a time. Mark “Got it” to track your progress.</div>';
  const doneMap=(CHEM_MASTERY&&CHEM_MASTERY.getSnapshot().examples)||{};
  UNITS.forEach(u=>{
    const list=WORKED.filter(w=>w.u===u.id);if(!list.length)return;
    h+=`<div class="ex2-unit"><h3 class="ex2-h">Unit ${u.id}: ${u.name}</h3>`;
    list.forEach((w,wi)=>{
      const id=u.id+'-'+wi;ex2map[id]=w;
      const done=doneMap[id]?' done':'';
      h+=`<div class="ex2-card${done}" data-id="${id}">
        <div class="ex2-title">${w.title}</div>
        <div class="ex2-prompt">${w.prompt}</div>
        <div class="ex2-steps" id="ex2s-${id}"></div>
        <div class="ex2-actions">
          <button class="btn ex2-reveal" onclick="revealStep('${id}')">Reveal step ▾</button>
          <button class="btn" onclick="revealAll('${id}')">Show all</button>
          <button class="btn ex2-done" onclick="markExample('${id}')">✓ Got it</button>
        </div></div>`;
    });
    h+='</div>';
  });
  v.innerHTML=h;
}
function revealStep(id){
  const w=ex2map[id];const c=document.getElementById('ex2s-'+id);let n=ex2shown[id]||0;
  if(n<w.steps.length){
    const d=document.createElement('div');d.className='ex2-step';d.innerHTML='<span>'+(n+1)+'</span><div>'+w.steps[n]+'</div>';c.appendChild(d);
    n++;ex2shown[id]=n;
    if(n===w.steps.length){
      const a=document.createElement('div');a.className='ex2-answer';a.innerHTML='✓ '+w.answer;c.appendChild(a);
      const btn=document.querySelector('.ex2-card[data-id="'+id+'"] .ex2-reveal');if(btn)btn.style.display='none';
    }
  }
}
function revealAll(id){const w=ex2map[id];while((ex2shown[id]||0)<w.steps.length)revealStep(id);}
function markExample(id){
  if(CHEM_MASTERY)CHEM_MASTERY.markExampleDone(id);
  const card=document.querySelector('.ex2-card[data-id="'+id+'"]');if(card)card.classList.add('done');
}
```

- [ ] **Step 3: Re-render examples after mastery hydrates**

Find the mastery `init().then(...)` callback (search `CHEM_MASTERY.init().then`). Inside it, alongside the existing `try{ showFC(); }catch(e){}`, add:

```js
try{ if(examplesBuilt) buildExamples(); }catch(e){}
```

- [ ] **Step 4: Smoke-test the file still parses**

Run: `node --check scripts/guide-template/logic.js`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/guide-template/logic.js
git commit -m "guide-template: worked-examples runtime (buildExamples, reveal, mark-done)"
```

---

### Task 4: Hard Mode (`HARD_Q`) support in the quiz selector

**Files:**
- Modify: `scripts/guide-template/logic.js` — `buildQSel()` and `loadQ()` (search `buildQSel`), plus wherever the "All Units" count is computed.

**Interfaces:**
- Consumes: `QUIZ` (`{u,q,o,a,e}[]`), `HARD_Q` (same shape — emitted by generator, Task 5; **always defined**, defaults to `[]`), `UNITS`.
- Produces: `#q-sel` gains a `Hard Mode Only (N Qs)` option **only when `HARD_Q.length`**; unit option counts include hard questions; selecting `hard` loads only `HARD_Q`.

- [ ] **Step 1: Inspect the current `buildQSel`/`loadQ`**

Read `scripts/guide-template/logic.js` around `function buildQSel(`. The template version only knows `QUIZ`. Legacy reference (`public/algebra2/index.html:1448-1454`):

```js
function buildQSel(){
  const sel=document.getElementById('q-sel');
  const total=QUIZ.length+HARD_Q.length;
  sel.innerHTML='<option value="0">All Units ('+total+' questions)</option>';
  UNITS.forEach(u=>{const n=QUIZ.filter(q=>q.u===u.id).length+HARD_Q.filter(q=>q.u===u.id).length;if(n)sel.innerHTML+=`<option value="${u.id}">Unit ${u.id}: ${u.name} (${n} Qs)</option>`;});
  sel.innerHTML+='<option value="hard">Hard Mode Only ('+HARD_Q.length+' Qs)</option>';
  loadQ();
}
```

- [ ] **Step 2: Port it, guarding the Hard Mode option**

Rewrite the template's `buildQSel` body so it:
- opens with `const HQ=(typeof HARD_Q!=='undefined'&&Array.isArray(HARD_Q))?HARD_Q:[];`
- uses `QUIZ.length+HQ.length` for the "All Units" count
- adds `+HQ.filter(q=>q.u===u.id).length` to each unit count
- appends the hard option only if non-empty: `if(HQ.length)sel.innerHTML+='<option value="hard">Hard Mode Only ('+HQ.length+' Qs)</option>';`

- [ ] **Step 3: Handle `hard` in `loadQ`'s pool selection**

Find where `loadQ()` reads `#q-sel`'s value and builds the working list (variable is likely `pool`/`qs`/`cur` — **match the existing name**). Replace the branch that filters by unit with:

```js
const HQ=(typeof HARD_Q!=='undefined'&&Array.isArray(HARD_Q))?HARD_Q:[];
if(val==='hard'){ pool=HQ.slice(); }
else if(val!=='0'){ pool=QUIZ.concat(HQ).filter(q=>String(q.u)===String(val)); }
else { pool=QUIZ.concat(HQ); }
```

Leave diagnostic mode (`diagMode`) untouched — it samples `QUIZ` only, as today.

- [ ] **Step 4: `node --check`**

Run: `node --check scripts/guide-template/logic.js`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/guide-template/logic.js
git commit -m "guide-template: Hard Mode quiz bank (HARD_Q) in question selector"
```

---

### Task 5: Generator support for `workedExamples` and `hardQuiz`

**Files:**
- Modify: `scripts/generate-guide.mjs`
- Test: `test/generate-guide.test.js` (**create** — no existing generator test)

**Interfaces:**
- Consumes: `config.workedExamples` (`{u,title,prompt,steps:[],answer}[]`, optional, default `[]`), `config.hardQuiz` (`{u,q,o,a,e}[]`, optional, default `[]`), `config.masteryKey` (optional string; when absent, keep today's behavior — the mastery token follows `'apush'` → `slug` rewriting).
- Produces: `public/<slug>/index.html` that (a) emits `const WORKED=<json>;` and `const HARD_Q=<json>;`, (b) statically renders the examples accordion into `__EXAMPLES__`, (c) omits `tab-examples` + `#view-examples` when `workedExamples` is empty, (d) uses `config.masteryKey` in `window.__ssCreateMastery('<key>', …)` when provided.

- [ ] **Step 1: Write the failing test** — create `test/generate-guide.test.js`:

```js
import { describe, it, expect } from "vitest";
import { generateGuide } from "../scripts/generate-guide.mjs";

const base = {
  slug: "demo", title: "Demo", accentColor: "#4338ca",
  units: [{ id: 1, name: "One", concepts: [{ l: "C", intro: "i", b: [] }] }],
  quiz: [{ u: 1, q: "q", o: ["a", "b", "c", "d"], a: 0, e: "e" }],
  flashcards: [{ u: 1, t: "t", d: "d" }],
  examParts: { PART_A: [], PART_B1: [], PART_B2: [], PART_C: [] },
};

describe("generateGuide worked examples + hard mode", () => {
  it("omits the examples tab when workedExamples is empty", () => {
    const html = generateGuide({ ...base });
    expect(html).not.toContain('id="tab-examples"');
    expect(html).not.toContain('id="view-examples"');
    expect(html).toContain("const WORKED=[];");
    expect(html).toContain("const HARD_Q=[];");
  });

  it("renders the examples tab + static cards when workedExamples is present", () => {
    const html = generateGuide({
      ...base,
      workedExamples: [{ u: 1, title: "WT", prompt: "WP", steps: ["s1", "s2"], answer: "WA" }],
    });
    expect(html).toContain('id="tab-examples"');
    expect(html).toContain('id="view-examples"');
    expect(html).toContain("WT");
    expect(html).toContain("const WORKED=[{");
    expect(html).toContain('class="ex2-card"');
  });

  it("emits hard-mode questions and keeps the 7-tab index map", () => {
    const html = generateGuide({
      ...base,
      hardQuiz: [{ u: 1, q: "hard?", o: ["a", "b", "c", "d"], a: 1, e: "he" }],
    });
    expect(html).toContain('"hard?"');
    expect(html).toContain("examples:3,exam:4,qref:5,memory:6");
  });

  it("uses masteryKey when provided", () => {
    const html = generateGuide({ ...base, masteryKey: "aplang" });
    expect(html).toContain("__ssCreateMastery('aplang'");
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run test/generate-guide.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement in `scripts/generate-guide.mjs`**

3a. Destructure (line 146): add `workedExamples = [], hardQuiz = [], masteryKey`. Normalize: `const worked = Array.isArray(workedExamples) ? workedExamples : []; const hardQ = Array.isArray(hardQuiz) ? hardQuiz : [];`

3b. Schema guards near the top of `generateGuide`:

```js
for (const w of worked) {
  if (typeof w.u !== "number" || !w.title || !w.prompt || !Array.isArray(w.steps) || !w.answer)
    throw new Error(`workedExamples entry malformed: ${JSON.stringify(w).slice(0, 120)}`);
}
for (const q of hardQ) {
  if (typeof q.u !== "number" || !q.q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a))
    throw new Error(`hardQuiz entry malformed: ${JSON.stringify(q).slice(0, 120)}`);
}
```

3c. Static renderer next to `buildMemory` (server-side mirror of Task 3's `buildExamples`; `data-id` scheme `<unitId>-<index>` must match exactly):

```js
function buildExamplesStatic(units, worked) {
  if (!worked.length) return "";
  let h = `<div class="ex2-intro">Try each problem on your own first — then reveal the solution one step at a time. Mark “Got it” to track your progress.</div>`;
  for (const u of units) {
    const list = worked.filter(w => w.u === u.id);
    if (!list.length) continue;
    h += `<div class="ex2-unit"><h3 class="ex2-h">Unit ${u.id}: ${esc(u.name)}</h3>`;
    list.forEach((w, wi) => {
      const id = `${u.id}-${wi}`;
      h += `<div class="ex2-card" data-id="${id}">` +
        `<div class="ex2-title">${esc(w.title)}</div>` +
        `<div class="ex2-prompt">${esc(w.prompt)}</div>` +
        `<div class="ex2-steps" id="ex2s-${id}"></div>` +
        `<div class="ex2-actions">` +
        `<button class="btn ex2-reveal" onclick="revealStep('${id}')">Reveal step ▾</button>` +
        `<button class="btn" onclick="revealAll('${id}')">Show all</button>` +
        `<button class="btn ex2-done" onclick="markExample('${id}')">✓ Got it</button>` +
        `</div></div>`;
    });
    h += `</div>`;
  }
  return h;
}
```

3d. Hero subtitle (lines 213-216): append `· Worked Examples` to the feature list string only when `worked.length`.

3e. Strip the tab button when no examples. After `const hero = templateHero…` (line 212):

```js
let heroOut = hero;
if (!worked.length)
  heroOut = heroOut.replace(/\s*<button class="tab-btn" role="tab" id="tab-examples"[^>]*>Worked Examples<\/button>/, "");
html += heroOut;
```

(replace the existing `html += hero;` at line 216.)

3f. Views chain (lines 218-225): add `.replace("__EXAMPLES__", buildExamplesStatic(units, worked))`, then strip the panel when empty:

```js
let viewsOut = templateViews
  .replace("__EXAMPLES__", buildExamplesStatic(units, worked))
  /* …existing .replace(...) calls unchanged… */;
if (!worked.length)
  viewsOut = viewsOut
    .replace(/<div id="view-examples"[^>]*>__EXAMPLES__<\/div>\n?/, "")
    .replace(/<div id="view-examples"[^>]*><\/div>\n?/, "");
html += viewsOut;
```

(replace the existing `html += templateViews…` assignment.)

3g. Data script (after the `QUIZ` line, ~234):

```js
html += `const WORKED=${js(worked)};\n`;
html += `const HARD_Q=${js(hardQ)};\n`;
```

3h. Mastery key. First `grep -n "__ssCreateMastery" scripts/guide-template/logic.js` to get the exact call text (it is `window.__ssCreateMastery('apush', …)` at ~line 283). In the `templateLogic.replaceAll(...)` chain (lines 251-257) insert a **more-specific** replace *before* the generic `'apush'` one:

```js
const mKey = masteryKey || slug;
html += templateLogic
  .replaceAll("APUSH", esc(title))
  .replaceAll("__ssCreateMastery('apush'", `__ssCreateMastery('${mKey}'`)
  .replaceAll("'apush'", `'${slug}'`)
  .replaceAll("CHEM_MASTERY", "SS_MASTERY")
  .replaceAll("CHEM_TOTAL_Q", "SS_TOTAL_Q")
  .replaceAll("CHEM_UNITS", "SS_UNIT_COUNT")
  .replaceAll("/apush", `/${slug}`);
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npx vitest run test/generate-guide.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Regression — an already-generated guide is byte-stable**

```bash
node scripts/generate-guide.mjs calc-ab && git diff --stat public/calc-ab/index.html
```
Expected: **no diff**. If any diff appears, the new tokens are not collapsing cleanly for a no-feature guide — fix until calc-ab regenerates identically.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-guide.mjs test/generate-guide.test.js
git commit -m "generate-guide: workedExamples + hardQuiz config support"
```

---

### Task 6: Extraction helper — dump a legacy page's inline data to JSON

**Files:**
- Create: `scripts/extract-legacy-guide.mjs`
- Modify: `scripts/prerender-practice.mjs` — add `export { extractArrayLiteral, extractMergedArray };` (they are file-local today).

**Interfaces:**
- Consumes: `public/<slug>/index.html`.
- Produces: `guides/<slug>.draft.json` with `slug`, `title`, `accentColor`, `units`, `flashcards` (merged `FLASHCARDS`), `quiz` (merged `QUIZ`), `hardQuiz` (`HARD_Q` or `[]`), `workedExamples` (merged `WORKED` or `[]`), `examParts` (`PART_A`/`PART_B1`/`PART_B2`/`PART_C`), `diagrams` (`DIAGRAMS` or `{}`). Prints the length of every captured array and an `UNCAPTURED const NAME=` warning for any `const` it saw that is neither captured nor in the skip-list.

- [ ] **Step 1: Export the two parsers from `prerender-practice.mjs`**

Append `export { extractArrayLiteral, extractMergedArray };`. Confirm the CLI block at the bottom still runs (`node scripts/prerender-practice.mjs` with no args prints usage and exits 1).

- [ ] **Step 2: Write `scripts/extract-legacy-guide.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { extractArrayLiteral, extractMergedArray } from "./prerender-practice.mjs";

const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/extract-legacy-guide.mjs <slug>"); process.exit(1); }
const src = readFileSync(`public/${slug}/index.html`, "utf8");

const evalArr = (name, { merged = true } = {}) => {
  const lit = merged ? extractMergedArray(src, name) : extractArrayLiteral(src, name);
  if (!lit) return [];
  const body = lit.replace(new RegExp(`^const ${name}=`), "");
  // eslint-disable-next-line no-eval
  const val = (0, eval)("(" + body.replace(/;\s*$/, "") + ")");
  console.log(`  ${name}: ${Array.isArray(val) ? val.length : typeof val}`);
  return val;
};

const SKIP = new Set(["EXAM_CSS", "REQUEUE_DELAY", "SEARCH_BADGE", "R",
  "CBOT_KEY", "CBOT_OMNIROUTE_MODEL", "CBOT_OMNIROUTE_URL", "CBOT_PUBLISHED", "CBOT_STOPWORDS",
  "GEO_KEY", "WORKED_SVGS", "BANK_V15", "GEN_BANK"]);
const CAPTURED = new Set(["UNITS", "FLASHCARDS", "QUIZ", "HARD_Q", "WORKED", "DIAGRAMS",
  "PART_A", "PART_B1", "PART_B2", "PART_C",
  "EXTRA_FC", "EXTRA_QUIZ", "EXTRA_QUIZ2", "EXTRA2_QUIZ", "EXTRA3_QUIZ", "QUIZ_EXTRA",
  "EXTRA_WORKED", "IMG_QUIZ", "REGENTS_UP"]);
for (const m of src.matchAll(/const ([A-Z_0-9]+)=/g)) {
  const n = m[1];
  if (!SKIP.has(n) && !CAPTURED.has(n)) console.warn(`  UNCAPTURED const ${n}= — inspect ${slug} by hand`);
}

const accent = (src.match(/--accent:\s*(#[0-9a-fA-F]{6})/) || [])[1] || null;
const mkey = (src.match(/__ssCreateMastery\('([^']+)'/) || [])[1] || slug;
console.log(`  accent=${accent}  masteryKey=${mkey}`);

const out = {
  slug,
  title: (src.match(/<title>([^<]+?) Study Guide/) || [])[1] || slug,
  accentColor: accent,
  masteryKey: mkey,
  units: evalArr("UNITS", { merged: false }),
  flashcards: evalArr("FLASHCARDS"),
  quiz: evalArr("QUIZ"),
  hardQuiz: evalArr("HARD_Q", { merged: false }),
  workedExamples: evalArr("WORKED"),
  examParts: {
    PART_A: evalArr("PART_A", { merged: false }),
    PART_B1: evalArr("PART_B1", { merged: false }),
    PART_B2: evalArr("PART_B2", { merged: false }),
    PART_C: evalArr("PART_C", { merged: false }),
  },
  diagrams: (() => { const l = extractArrayLiteral(src, "DIAGRAMS"); if (!l) return {}; return (0, eval)("(" + l.replace(/^const DIAGRAMS=/, "").replace(/;\s*$/, "") + ")"); })(),
};
writeFileSync(`guides/${slug}.draft.json`, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote guides/${slug}.draft.json`);
```

Note on `eval`: this is a **build-time, developer-run, one-shot** extraction over our own source files, not runtime code. Acceptable here; do not import this script from anything.

- [ ] **Step 3: Dry-run on the simplest page**

Run: `node scripts/extract-legacy-guide.mjs ap-biology`
Expected: `wrote guides/ap-biology.draft.json`, printed array lengths, **no** `UNCAPTURED` warnings.

- [ ] **Step 4: Commit the tooling**

```bash
git add scripts/extract-legacy-guide.mjs scripts/prerender-practice.mjs
git commit -m "scripts: legacy-guide inline-data extractor"
```

---

## Phase 2: Per-page migration

Do these **one page at a time, each as its own review gate**, simplest → hardest:
`ap-biology`, `biology`, `chemistry`, `precalc`, `apush`, `physics`, `us-history`, `global-history`, `algebra1`, `ap-lang`, `algebra2`.

Each page is Task 7.x with the same six steps below. Appendix A holds the per-page specifics — **fill in that page's Appendix A row from source before starting its Task 7.**

### Task 7.x: Migrate `<slug>`

**Files:**
- Create: `guides/<slug>.json`
- Overwrite (via generator): `public/<slug>/index.html`
- Modify: registry outputs (Step 5)

- [ ] **Step 1: Snapshot the page and its rendered text**

```bash
mkdir -p /tmp/precis-migration
cp public/<slug>/index.html /tmp/precis-migration/<slug>.before.html
node -e "const s=require('fs').readFileSync('/tmp/precis-migration/<slug>.before.html','utf8');const t=s.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');require('fs').writeFileSync('/tmp/precis-migration/<slug>.before.txt',t)"
```

- [ ] **Step 2: Extract → draft JSON, resolve every warning**

```bash
node scripts/extract-legacy-guide.mjs <slug>
```
For every `UNCAPTURED const` line: open `public/<slug>/index.html`, find that const, and either fold it into the right array in the draft by hand, or confirm it is runtime/dead and record why in the commit message. **No warning left unexplained.** Cross-check the printed array lengths against Appendix A's expected counts.

- [ ] **Step 3: Finalize `guides/<slug>.json`**

- `mv guides/<slug>.draft.json guides/<slug>.json`.
- Keep `masteryKey` only if it differs from `<slug>`; if equal, delete the key (cosmetic).
- If Appendix A says "no worked examples", delete `workedExamples` (or leave `[]`).
- If Appendix A says "no hard mode", delete `hardQuiz` (or leave `[]`).
- Confirm `accentColor` is a 6-hex string; if `null`, read `:root{--accent:…}` in the before-file by hand.
- Re-pretty-print: `node -e "const p='guides/<slug>.json';require('fs').writeFileSync(p,JSON.stringify(JSON.parse(require('fs').readFileSync(p)),null,1)+'\n')"`

- [ ] **Step 4: Generate, prerender, diff**

```bash
node scripts/generate-guide.mjs <slug>
grep -q "<slug>" package.json scripts/*.sh ci.yml 2>/dev/null && echo "check whether <slug> is in a prerender step"
node scripts/prerender-practice.mjs public/<slug>/index.html
node -e "const s=require('fs').readFileSync('public/<slug>/index.html','utf8');const t=s.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');require('fs').writeFileSync('/tmp/precis-migration/<slug>.after.txt',t)"
git --no-pager diff --no-index /tmp/precis-migration/<slug>.before.txt /tmp/precis-migration/<slug>.after.txt || true
```

Read the diff. **Acceptable removals:** boilerplate meta text, "Expanded Edition", nav-chrome wording, whitespace. **Unacceptable:** any concept bullet, flashcard, quiz question, worked-example step, exam question, or reference-table row present before and gone after. Missing content ⇒ a const wasn't captured ⇒ back to Step 2.

Payload count check:

```bash
node -e "const c=require('./guides/<slug>.json');console.log('quiz',c.quiz.length,'fc',c.flashcards.length,'worked',(c.workedExamples||[]).length,'hard',(c.hardQuiz||[]).length,'A',c.examParts.PART_A.length,'B1',c.examParts.PART_B1.length,'B2',c.examParts.PART_B2.length,'C',c.examParts.PART_C.length)"
```
Compare to the extractor's printed lengths and Appendix A.

- [ ] **Step 5: Update the registry**

```bash
python3 scripts/sync-guides-registry.py
grep -n "<slug>" src/worker.ts src/progress-routes.ts
```
All 12 legacy slugs are already in `SUBJECT_PATHS` (`src/worker.ts:19`) and `SUBJECTS` (`src/progress-routes.ts:3`) — confirm, no hand-edit expected. Review anything the sync script rewrites.

- [ ] **Step 6: Browser-verify (both themes), then commit**

Serve (`wrangler dev` / the `run` skill) and open `http://localhost:<port>/<slug>/`. In **light and dark**:
- Correct tab set + order; arrow keys move focus along `.tablist`; `aria-selected` tracks.
- Worked Examples (if present): cards grouped by unit; "Reveal step" adds one step; "Show all" dumps rest + answer; "Got it" marks + persists across reload when signed in.
- Quiz: "Hard Mode Only (N)" appears **iff** the page had `HARD_Q`; it serves only hard Qs; unit counts include hard Qs; diagnostic still works.
- Deep link `/<slug>/examples` opens that tab; browser back/forward works.
- View-source: `application/ld+json` present; static `.ex2-card` (if examples), `.unit`, flashcard-archive, and quiz-bank HTML present.
- No console errors.

```bash
git add guides/<slug>.json public/<slug>/index.html src/ scripts/
git commit -m "guides: migrate <slug> into the generator"
```

---

## Phase 3: Finalize

### Task 8: Full-suite verification

- [ ] **Step 1: Worker test suite** — `npx vitest run`. Expected: all green, incl. `test/worker.test.js` (iterates `["geometry","chemistry","algebra1","algebra2","ap-lang","global-history"]` at line 58) and `test/generate-guide.test.js`.

- [ ] **Step 2: Regenerate every migrated page, assert byte-stable**

```bash
for s in ap-biology biology chemistry precalc apush physics us-history global-history algebra1 ap-lang algebra2; do node scripts/generate-guide.mjs $s; done
git status --porcelain public/    # expect: empty
```

- [ ] **Step 3: Index / sitemap** — confirm `public/index.html` (and any sitemap) still lists all 12 slugs at `/<slug>/`. Spot-check: `grep -c 'href="/algebra2/"' public/index.html`.

- [ ] **Step 4: CI** — push branch, confirm green.

### Task 9: geometry decision (separate plan)

- [ ] Write `docs/superpowers/plans/2026-09-XX-geometry-migration.md` covering: a per-page font system in the generator (`config.fonts` → self-hosted `@font-face`, consistent with commit `6ce649b` "self-host fonts"), the custom `switchTab` localStorage persistence, and a `WORKED_SVGS` per-example diagram slot. Do **not** migrate geometry until that plan is reviewed.

---

## Self-Review

**Spec coverage:**
- "Worked Examples tab + content" → Tasks 1, 2, 3, 5.
- "Hard-mode question bank (`HARD_Q`)" → Tasks 4, 5.
- "DBQ/LEQ essay content" (ap-lang) → carried as `concept.intro` / `concept.b[]` prose in `units`; no schema change. Appendix A flags it for extra content-diff scrutiny.
- "Custom type system" (geometry) → explicitly deferred (Task 9).
- "per-page diffing and verification" → Task 7 Step 4; Task 8 Step 2.
- "Expanded Edition / boilerplate meta / no JSON-LD / pre-APG tab markup" → all fixed by rendering through the template (APG markup + `buildJsonLd` + `buildMetaDescription`); verified Task 7 Step 6.
- Registry (`progress-routes.ts`, `worker.ts`, sync script) → Task 7 Step 5; Task 8 Step 1.

**Placeholder scan:** Phase 2 is a shared 6-step procedure applied 11 times rather than 11 copies — deliberate, and each step is concrete. Soft spot: Task 4 Step 3's `loadQ` edit depends on the template's real variable names, which Step 1 of that task requires the executor to read first. Appendix A rows must be filled from source before each page's Task 7; the extractor's `UNCAPTURED` report (Task 6) is the mechanical backstop.

**Type consistency:** `WORKED` shape `{u,title,prompt,steps[],answer}` and `HARD_Q` shape `{u,q,o,a,e}` used identically in Tasks 3–6 and Appendix A. `data-id` scheme `<unitId>-<index>` matches between `buildExamples` (Task 3) and `buildExamplesStatic` (Task 5). Tab index map `examples:3,exam:4,qref:5,memory:6` consistent across Task 2 and Task 5's test.

**Known gap to close before Phase 2:** Appendix A is a skeleton derived from a grep sweep, not a full read of each page. A pre-flight pass (or the first action of each Task 7) must complete that page's row.

---

## Appendix A: per-page notes (complete each row from source before migrating that page)

Get the mastery key — **always grep, never assume**:
`grep -o "__ssCreateMastery('[^']*'" public/<slug>/index.html`

| slug | masteryKey | accent | worked ex | hard mode | extra consts → target | notes |
|---|---|---|---|---|---|---|
| ap-biology | `apbiology` (verify) | _grep `--accent`_ | no | no | none | do first — cleanest |
| biology | `biology` (verify) | | no | no | none | |
| chemistry | `chemistry` (verify) | | no | no | none | largest file |
| precalc | `precalc` (verify) | | no | no | none | |
| apush | `apush` (verify) | | no | yes | `EXTRA_QUIZ`→quiz, `EXTRA_FC`→flashcards | deep bank — count carefully |
| physics | `physics` (verify) | | no | yes | `EXTRA_QUIZ`→quiz, `EXTRA_FC`→flashcards | |
| us-history | `us-history` (verify) | | no | yes | `EXTRA_QUIZ`→quiz, `EXTRA_FC`→flashcards | |
| global-history | `globalhistory` (verify) | | yes | no | none (`WORKED` defined, no merge) | |
| algebra1 | `algebra1` (verify) | | yes | no | `QUIZ_EXTRA`→quiz | |
| ap-lang | `aplang` (verify) | | yes | yes | `EXTRA_QUIZ`→quiz, `EXTRA_FC`→flashcards, `EXTRA_WORKED`→workedExamples | DBQ/LEQ prose — scrutinize content diff |
| algebra2 | `algebra2` (verify) | | yes | yes | `QUIZ_EXTRA`+`EXTRA_QUIZ2`→quiz, `EXTRA_FC`→flashcards, `EXTRA_WORKED`→workedExamples | extractor reference page |
