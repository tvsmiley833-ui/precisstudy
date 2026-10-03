# Improvements status — 2026-10-03

Source list: `docs/IMPROVEMENTS-2026-10-02.md` (200 items). This file records what has shipped and what is still open.
Latest deploy when last updated: version 363d65c0 (guide search folding). Test state: 368 node + 644 vitest passing.

## Shipped (deployed to production)

### Backend / security / data (earlier batches)
- Daily snapshots write a separate `history:<email>` key; resumable batched daily pass; push/leaderboard index keys.
- Study-group membership as one key per member; challenge index and TTLs; email lowercased at sign-in.
- Streak/quest dates clamped to server date ±1 day.
- Native rate limits plus daily KV quotas (AI, uploads, chat); 413 before buffering oversized bodies.
- sw.js push URL check hardened (`//evil.example` blocked).

### Guide UX
- **GUIDE-15** Flashcards grow to fit long text (faces share one grid cell).
- **GUIDE-14** Tab bar on phones is its own scrollable full-width row; active tab scrolls into view.
- **GUIDE-7** SRS: only due cards earn a box; a miss drops two boxes; rating requires flipping first.
- **GUIDE-9** Exam lockdown: fullscreen exit adds no phantom time, iframe/dialog blur ignored, warning on return, ends on tab switch/pagehide, webkit fallback + unsupported note, retake restores start row, summary focused.
- **GUIDE-8 (partial)** Exam timers pause while tab hidden; 5 min / 1 min / time-up announcements; running multiple-choice total.
- **GUIDE-10 (partial)** "Check yourself" — 3 recall questions at the end of each unit.
- **GUIDE-12 (partial)** Type-it answers ignore case, accents, punctuation, parentheticals, slash alternatives; accent-only answers flagged; wrong answer waits with "Next card" / "I was right".

### Accessibility
- **A11Y-1/2/3/5** Quiz focus and announcements, scoped shortcuts, flashcard screen-reader faces and live region, arrow/1/2 keys.
- **A11Y-4** Units are h2, concepts h3, exam parts h3>button.
- **A11Y-6** Command palette combobox/listbox with focus trap and restore; study helper dialog role, Esc, focus, log, labels; shortcuts modal keeps focus.
- **A11Y-8 (partial)** `targetLang` on 7 language guides, `lang` on flashcard terms, "Hear it" pronunciation button.
- **A11Y-9** Six failing subject colours darkened; French 2/3 dashboard colours + fallback; contrast test.
- **A11Y-10 (partial)** Guide `--ink-dim` and homepage status/tier text raised to AA; token contrast tests.
- **A11Y-19** Follows the device light/dark setting; Theme control (device / light / dark) in Settings; `color-scheme` on guide pages.
- **A11Y-23** Feedback dialog: labels, aria-pressed, focus restore, safe error parsing, timer guard.
- **A11Y-25** Request-page file attach works by keyboard; remove buttons name their file.
- Accent-solid fills for white-on-accent text in dark mode.

### Site UX
- **UX-2** Dashboard "Set a test date" is an inline picker that saves a goal (20 min/day default).
- **UX-3 (partial)** Homepage search understands shorthand (algebra 2, ap lang, calc ab, ap gov, apush); empty state links to `/request?class=…`; request form prefills the class.
- **UX-4** Readiness shown as "early read" until ~60% of units assessed; score forecasts hidden until then.
- **UX-5 (partial)** Phones: two-column compact class list, four per group with "Show all".

### Mobile / PWA
- **MOB-1** Installable manifest (192/512/maskable icons, `/?source=pwa`, shortcuts, brand colours).
- **MOB-3 (partial)** `viewport-fit=cover` and safe-area insets on guide pages.
- **MOB-4 (partial)** `enterkeyhint` on search, answer, and helper inputs.

## Shipped after the first version of this file (2026-10-03, later batches)
- **GUIDE-11** quiz clock starts at the first question; Quick 10 rebuilt after mastery loads.
- **A11Y-20 (partial)** high contrast follows `prefers-contrast` and syncs across tabs (still applied by the deferred script, not the inline head).
- **A11Y-21** homepage reduced motion; streak message kept without confetti. **A11Y-24** owl names, closet keyboard use.
- **A11Y-22** tooltips hoverable, close with trigger, no double announcements, validation titles kept.
- **A11Y-26 (partial)** dashboard heatmap text summary.
- **GUIDE-17** helper examples from the guide's flashcards; OmniRoute dev form removed. **GUIDE-18** honest anonymous quiz note, `#quiz-gate` removed, worksheet prints only the chosen unit.
- **GUIDE-20 (partial)** search folds accents, ignores markup, "Show all", Esc clears.
- **GUIDE-25** titles built from `SS_GUIDE.title`. **GUIDE-27** `--accent-bright` defined. **GUIDE-29** in-page dialogs/share sheet, two-step deletes that check responses. **GUIDE-31** calculator only on math/science guides.
- **UX-1 (partial)** signed-out students with local progress see their dashboard with a sync strip; Settings > Appearance opens without an account.
- **PERF-1** MathJax pinned to 3.2.2 and sent only to guides with `$...$`. **PERF-5 (partial)** Permanent Marker preload and three dead font files removed. **PERF-9 (partial)** service worker: offline page, navigation preload, 4 s network timeout, bounded cache, one copy of `?v=` assets. **PERF-12** pointer-capture dragging. **PERF-16** trailing slashes on section links. **PERF-18 (partial)** GET /api/quest writes only on change.

## Still open (updated)
GUIDE-13, GUIDE-16 (module timing unclear), GUIDE-19, GUIDE-21–24, GUIDE-26, GUIDE-28, GUIDE-30; A11Y-20 inline-head bootstrap; A11Y-26 rest; MOB-2 offline quizzes; PERF-2/3/4/6/7/8/10/11/13/14/15/17/19; PERF-9 update toast and shared registration; UX-1 concepts/compete/syllabus pages; nav 'Sign in' for anonymous visitors.

## Open — as of the first version of this file

### Remaining pieces of partly-done items
- A11Y-8: `lang` on options/inline foreign text; keep read-aloud on phones with pause/resume.
- A11Y-10: dashboard accuracy bars, locked badges, share page colours, diagram labels; text labels beside colour-only status.
- A11Y-19: `aria-pressed` on theme toggles; `color-scheme` on homepage/settings.
- GUIDE-8: timers start on Start; defer feedback until "Submit part"; AP/SAT band; sessionStorage save.
- GUIDE-9: lazy-import lockdown module; remove or use `getLockdownSummary`.
- GUIDE-10: "Quiz Unit N" in the sticky bar.
- GUIDE-12: skip LaTeX cards.
- UX-3: "We already have X" match on the request form; hide empty group headings; keep enrolled filter when clearing search.
- UX-4: show coverage on the parent share page.
- UX-5: move How It Works and demo above the class list on phones.
- MOB-3: merge back-to-top into Tools, full-width concept bar, helper as bottom sheet.
- MOB-4: iOS install prompt after the 2nd session, then request push.
- A11Y-6: native `<dialog>`/`showModal` for modals.

### Not started (UI)
- UX-1 stop walling off signed-out students; UX-6+ in the audit list.
- GUIDE-3 difficulty chips emptying the quiz to "0/0 NaN%"; GUIDE-11 Quick 10 timing; GUIDE-13 first quiz question above the fold on phones; GUIDE-16 saved syllabus order; GUIDE-17 helper greeting / remove dev OmniRoute path; GUIDE-18 anonymous quiz copy; GUIDE-19 merge resume systems.
- A11Y-20 high-contrast/AMOLED before first paint + `prefers-contrast`; A11Y-21 homepage reduced motion; A11Y-22 tooltip hover (WCAG 1.4.13); A11Y-24 Sage owl names and closet keyboard use; A11Y-26 small a11y fixes.
- MOB-2 real offline flashcards and quizzes; PERF-9 service worker (preload, bounded cache, offline page, update flow).

### Performance (not started)
PERF-1 MathJax only where needed; PERF-2 build-time math; PERF-3 mission banner; PERF-4 inline chalk SVG (guide LCP); PERF-5 font strategy; PERF-6 guide HTML weight; PERF-7 external guide stylesheet; PERF-8 content-hashed shared modules; PERF-10–19 (header CSS, content-visibility, touchmove listener, externalize inline scripts, dashboard skeletons/fetch dedupe, guide-app.js split, read-only GET /api/quest, small loading and render wins); PERF-16 trailing slashes + permanent redirects.

### Backend leftovers
- BE-8: daily XP caps, blob size cap, `customDecks` key.
- One-time audit of Algebra II / Physics progress saved before the migration fix.
- Check Workers Logs for `cron:` errors after the 22:00 UTC run.

### Owner-blocked
- PRIV-2 age gate (legal decision).
- TEST-1 change `npx vitest run` to `npm test` in `.github/workflows/ci.yml` (needs the GitHub UI).

## Not verified in a browser
- Phone-width tab bar (GUIDE-14) and compact class list (UX-5): the Chrome tool could not resize below 1900 px.
- Dashboard test-date picker (UX-2): needs a signed-in account with no goal.
- Lockdown behaviour (GUIDE-9) and safe-area insets (MOB-3): covered by unit/static tests only.

## Working notes
- Guide pages are generated: edit `guides/*.json`, `scripts/generate-guide.mjs`, `scripts/guide-template/*`, then `npm run guides:regen`. Never hand-edit generated pages.
- Client code: `client/guide-app.js` → `npm run build:client` → `public/shared/guide-app.js`. `public/shared/guide-polish.css` is shared and needs no regen.
- Deploy chain: `npm test && git push && npm run deploy`. Do not chain with `;` after tests, or a failing test still deploys.
