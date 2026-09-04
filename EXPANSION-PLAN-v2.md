# PrecisStudy — Deep Expansion v2

Goal: bring **algebra2, physics, apush, ap-lang** to ≥ geometry depth, in place, and
add a new non-AP **us-history** guide.

## Benchmark (geometry, public/geometry/index.html, 692KB)
- UNITS: 11 units, ~44 concepts (`{id,name,concepts:[{l,intro,b[4-5]}],traps[],fms[]}`)
- QUIZ 40 + EXTRA_QUIZ 19 (merged into QUIZ pool at load)
- HARD_Q 440 (powers "Hard Mode Only" + per-unit hard filter + focus-weak)
- GEN_BANK 132 + IMG_QUIZ + REGENTS_UP (diagnostic rotation)
- FLASHCARDS 70 + EXTRA_FC 12
- WORKED 31 + EXTRA_WORKED (worked-examples section)
- PART_A 12 MC (`{n,q,o[4],a,e}`) + PART_C 4 short-answer (`{n,q,sa}`)

## Target per guide (≥ geometry)
- UNITS: 11 units, 55 concepts (5/unit), 4-5 bullets each, traps[4] + fms[4] per unit
- Core quiz pool: ~320 (existing QUIZ + EXTRA/QUIZ_EXTRA merge)
- HARD_Q deep bank: ~440  (add bank + minimal Hard Mode wiring where missing)
- FLASHCARDS: ~95 (+ EXTRA_FC where present)
- WORKED: ~28
- PART_A: 30 real MC · PART_C: 20 real short-answer
- Total items/guide: ~900

## Known defects to fix during expansion
- **apush PART_A / PART_C contain CHEMISTRY questions** (gold-foil, valence electrons) — replace entirely.
- physics QUIZ block currently fails clean eval — inspect for the split-char corruption bug.

## Data block shapes (all 4 legacy pages share these)
- MC bank item: `{u:int, q:str, o:[4 str], a:0-3, e:str}`  (QUIZ, EXTRA_QUIZ, QUIZ_EXTRA, HARD_Q, GEN_BANK)
- Flashcard: `{u:int, t:str, d:str}`
- WORKED: `{u:int, title:str, prompt:str, steps:[str], answer:str}`
- PART_A: `{n:int, q:str, o:[4], a:0-3, e:str}`  ·  PART_C: `{n:int, q:str, sa:str}`

## Per-page const inventory (what already exists)
| guide    | core quiz consts        | hard | gen | worked | examA/C | fc consts        |
|----------|-------------------------|------|-----|--------|---------|------------------|
| algebra2 | QUIZ 143 + QUIZ_EXTRA 77 | –    | –   | WORKED 11 | 10 / 4 | FLASHCARDS 47 |
| physics  | QUIZ (corrupt?)          | –    | –   | –      | 30 / 20 | FLASHCARDS 72 |
| apush    | QUIZ 137                 | –    | –   | –      | 30*/20* | FLASHCARDS 72  (*=chem contamination) |
| ap-lang  | QUIZ 200                | –    | –   | WORKED 10 | 10 / 4 | FLASHCARDS 35 |

## Execution
1. **Skeletons (me):** author 11-unit + concept/traps/fms outline per guide → `scratchpad/exp/<slug>/units.json`. Curriculum-accurate.
2. **Banks (OmniRoute, model=auto):** per guide + per unit, generate quiz_core / quiz_hard / flashcards / worked / exam as JSON to `scratchpad/exp/<slug>/`. Batched per unit to keep responses small and checkable.
3. **Assemble (me):** splice banks into each page's data blocks; add Hard Mode `<option>` + filter (copy from geometry, ~15 lines) to pages lacking it; per-slug localStorage keys untouched (already unique).
4. **us-history:** clone repaired apush shell → reskin non-AP survey, own theme `#8a5a2b`, wire into:
   - src/worker.ts SUBJECT_PATHS
   - src/progress-routes.ts SUBJECTS (+ test/progress-routes.test.js fixtures)
   - public/dashboard/index.html: import usHistoryUnits, SUBJECTS_CONFIG, SUBJECT_COLORS
   - public/settings/index.html: icon/color entry
   - public/index.html: class card (History group)
   - public/shared/unit-titles.js: export const usHistoryUnits
   - scripts/hero-patterns.cjs: add 'us-history' to histFam
5. **Validate:** JSON parse; assert counts; assert every MC item o.length===4 && a in 0..3; dedupe by q; browser smoke (console clean, tabs, quiz start, exam render); `npm test` + `npm run typecheck`.
6. **Deploy once** (`npx wrangler deploy`); verify 200 on /<slug>/ , /<slug>/quiz , /<slug>/exam for all 5.

## Status log
- [x] physics — DONE & DEPLOYED (version c7b11be2)
      11 units / 57 concepts; quiz pool 417 (142 core + 132 EXTRA_QUIZ + 143 HARD_Q,
      new "Hard Mode Only" option); 112 flashcards; practice exam rebuilt with 81 real
      physics items (was 100% chemistry). Browser-verified, 208 tests pass.
      Reusable tooling: scripts-equivalent prerender-legacy-guide.mjs + splice-physics-banks.mjs
      in scratchpad/exp/. Note: physics QUIZ was NOT corrupt (false alarm).
      NOT added: worked-examples tab (physics/apush lack the view-examples subsystem;
      deferred as an optional cross-guide follow-up).
- [x] algebra2 — DONE & DEPLOYED (version 633036bd)
      55 concepts (was 44); quiz pool 488 (330 core + 158 HARD_Q, new Hard Mode option);
      106 flashcards; 27 worked examples; exam A30/B1-28/B2-12/C20. Browser-verified, 208 tests pass.
      Was fully real content already (no contamination) — pure depth pass.
      Tooling: scratchpad/exp/algebra2/{deepen-units,splice-banks}.mjs.
- [x] apush — DONE & DEPLOYED (version 75306bc7)
      54 concepts (was 42); quiz pool 366 (250 core + 116 HARD_Q, new Hard Mode option);
      134 flashcards; exam rebuilt with 81 real APUSH items (was 100% chemistry — same bug as physics).
      Kept 9 Period units. Browser-verified, 208 tests pass. Homepage card updated (366).
      Note: ~12 exam MC stems overlap quiz-bank phrasings (acceptable for test prep, separate features).
- [ ] ap-lang banks / assemble  (PART_A already real, expand; add HARD_Q)
- [ ] us-history build + wire  (clone repaired apush shell; 7 registration points)
- [ ] final: re-deploy, verify 200s for all

### Legacy-page gotchas learned on physics (apply to the other 3)
- Pages SSR the unit list into #filter-row + #units; changing const UNITS alone breaks
  hydrateGuide() (chips[i+1] undefined). Must re-run prerender-legacy-guide.mjs.
- Keep existing unit ids/names stable so existing QUIZ/FLASHCARDS/DIAGRAMS u-refs survive;
  only append new units at the end.
- buildQSel/loadQ differ slightly per page — copy the physics Hard Mode patch but re-diff.
- Header stat line + "real question bank — N practice questions" text need count updates.
- Splice helper must be comment/apostrophe-aware (QUIZ blocks contain // comments).
