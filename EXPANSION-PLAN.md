# PrecisStudy Expansion — Master Plan (overnight autonomous run)

## Benchmark (geometry): 11 units · ~440 practice questions (~40/unit) · flashcards · diagnostic exam · quick reference · memory tricks · saved progress · diagrams

## Schema per guide (guides/<slug>.json)
- slug, title, description, fontUrl, accentColor (per-guide theme!), units, quiz, flashcards, examParts
- unit: {id, name, concepts:[{l,intro,b[4-5]}] x5-6, keyFacts[3-4], traps[3-4]}
- quiz: ~40/unit → 8 units = 320+ questions minimum
- flashcards: ~10/unit → 80+
- examParts: PART_A 30 / B1 20 / B2 10 / C 2
- accentColor: unique theme per subject

## Phase A — Upgrade existing 6 to geometry depth
Targets: spanish-1, spanish-2, earth-science, economics, english-9, english-10
Each needs: units 8 (keep), concepts 5-6/unit, quiz 55→320+, cards 56→80+, themes.

Theme palette per subject:
- spanish-1: #c2410c (warm terracotta)
- spanish-2: #9a3412 (deep sienna)
- earth-science: #0e7490 (ocean teal)
- economics: #7c3aed (violet market)
- english-9: #be185d (magenta lit)
- english-10: #b45309 (amber classics)

Method: author additional quiz questions in chunks (40/unit via python builders),
extend flashcards, add diagrams dict where valuable, set accentColor, regenerate.

## Phase B — Top 50 high-school classes
Existing 13: geometry, chemistry, algebra1, algebra2, precalc, biology, ap-biology,
physics, apush, ap-lang, global-history, us-government, +13 new = 19 total after upgrade.
Need ~31 more. Priority list (standard US curriculum, highest enrollment):
1. algebra-1-honors? No — keep distinct: use these:
   - world-history, geography, health, psychology, sociology,
   - statistics, computer-science, art-history, music-theory,
   - spanish-3, french-1, french-2, german-1,
   - environmental-science, anatomy, astronomy, marine-bio,
   - creative-writing, journalism, speech-debate,
   - ap-chemistry, ap-physics, ap-stats, ap-csa, ap-psych,
   - ap-world, ap-euro, ap-usgov, ap-macro, ap-micro,
   - sat-math, sat-reading, act-prep, study-skills
Pick exactly enough to reach 50 total.

## Execution loop per guide (autonomous):
1. Author JSON in chunks via write_file (units pairs → quiz chunks → cards → exam)
2. Assemble with python, validate counts
3. node scripts/generate-guide.mjs <slug>
4. Add to worker SUBJECT_PATHS + homepage card w/ themed section

## Deployment
Single deploy at the very end of all batches + verify every slug returns 200.
