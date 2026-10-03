# PrecisStudy improvement list — 2026-10-02

Produced by an automated audit: 16 dimension auditors found 496 candidate findings, each was re-checked against the code by a skeptical reviewer (6 refuted), a completeness critic added 6 more areas, and the verified findings were merged into the 196 items below.

Effort: S = hours, M = a day or two, L = several days, XL = a project. **Owner** = needs the site owner (accounts, keys, legal or product decisions), not just code.

## Status (updated 2026-10-02)

Done and deployed: SEC-1, SEC-2, SEC-3, PWA-1, GUIDE-1, GUIDE-2, PRIV-1, BE-1, BE-2 (each with tests).
Waiting on the owner: PRIV-2 (age gate, legal decision) and TEST-1 (CI workflow file needs a token with `workflow` scope, or edit `.github/workflows/ci.yml` in the GitHub web UI: change `npx vitest run` to `npm test`).
Still open from the migration fix: any Algebra II / Physics blob that a quest, push or leaderboard write stamped before 2026-10-02 may already hold old unit numbers; that needs a one-time audit of production KV.

## Summary

- **P0 now**: 11 items
- **P1 next**: 64 items
- **P2 soon**: 93 items
- **P3 later**: 28 items

| Area | Items |
|---|---|
| Guide UX | 27 |
| Backend | 26 |
| Accessibility | 26 |
| Performance | 18 |
| Security | 15 |
| Code health | 13 |
| Privacy | 12 |
| Mobile & Offline | 10 |
| Product features | 10 |
| Growth | 9 |
| Content | 9 |
| Testing & CI | 7 |
| SEO | 6 |
| Ops | 4 |
| Site UX | 3 |
| Design | 1 |

## P0 now

### Backend

- **BE-1 — Stop GET /api/quest and other writers from defeating the Algebra II/Physics unit migrations** (critical impact · effort M)
  - Why: Migrations key off updatedAt < cutoff, but quest, leaderboard, push, streak, goal and settings handlers stamp updatedAt without migrating. If one lands first, the student's Algebra II progress is permanently attributed to the wrong units.
  - Fix: Run all migrations inside one shared loadBlob(); replace the updatedAt heuristic with an explicit schemaVersion. Meanwhile call the migrations in every saveBlob path, log which branch ran, audit affected blobs, and add a test that interleaves GET /api/quest and GET /api/progress.
  - Evidence: `src/progress-routes.ts:283-313,440-443; src/quest-routes.ts:13-16,293; client/personality.js:249-255`
- **BE-2 — Merge per-unit progress on the server instead of replacing the subject** (high impact · effort L)
  - Why: POST /api/progress overwrites the whole subject with the client's copy; a stale tab or second device autosyncing erases answers recorded elsewhere.
  - Fix: Merge per unit on the server (or send answer deltas), union examples and cardsKnown, keep SRS newest-wins, return the merged subject. Longer term move per-user state to a Durable Object or D1 with versioning.
  - Evidence: `src/progress-routes.ts:473-485; public/shared/mastery.js:350-390`
### Guide UX

- **GUIDE-1 — Escape non-HTML angle brackets in guide content (AP CSA shows wrong Java)** (high impact · effort S)
  - Why: ArrayList<Integer> is parsed as an unknown tag and disappears, so quiz options become identical and code is wrong.
  - Fix: Add a build-time allowlist check in generate-guide.mjs, escape or wrap code in <code> in the data, and add a node test over all guides.
  - Evidence: `scripts/generate-guide.mjs:69-71; client/guide-app.js:1532-1543; ap-csa has 66 bad tags`
- **GUIDE-2 — Typeset math in content rendered after load (flashcards, exam, steps, answer reveal, print)** (high impact · effort S)
  - Why: Only startup content is typeset, so flashcards, the practice exam, worked steps, 'The answer is…' and print show raw LaTeX.
  - Fix: Call ssTypeset after buildExam, revealStep and ansQ; set flashcard faces safely then typeset; await MathJax before printing.
  - Evidence: `client/guide-app.js:37-65,1040-1041,1180-1190,1640-1659,1078-1126`
### Mobile & Offline

- **PWA-1 — Add push and notificationclick handlers to sw.js** (critical impact · effort S)
  - Why: The server sends reminder payloads but the service worker never calls showNotification, so reminders show a generic message or nothing, and Safari revokes the subscriptions.
  - Fix: Add a 'push' listener that calls registration.showNotification(title,{body,icon,data:{url},tag}) and a 'notificationclick' listener that focuses or opens data.url. Add a test asserting both listeners exist.
  - Evidence: `public/sw.js (only install/activate/fetch); src/push-routes.ts:208-214`
### Privacy

- **PRIV-1 — Make account deletion remove every per-user key and revoke third-party tokens** (critical impact · effort M)
  - Why: Deletion only removes progress:, login: and the Google token, and uses the lowercased email while keys use the raw email. Canvas tokens, gsettings, gcache, syllabus dates, share/cal/invite reverse keys, group memberships, challenge emails and feedback all survive, and the Google/Canvas grants stay valid.
  - Fix: Write one deleteUserData(env,email): try both raw and lowercase keys, read the blob first to find share/cal/invite tokens and groupCode, delete canvastok/gsettings/gcache/syldates/reverse keys/feedback entries, remove the member from lbgroup, anonymize challenges, revoke Google (oauth2 revoke) and Canvas tokens. Add a test that seeds every prefix and asserts nothing remains.
  - Evidence: `src/auth-routes.ts:353-370; src/canvas-token.ts:14; src/google-sync.ts:46; src/syllabus-dates.ts:29; src/progress-routes.ts:521,591,707; src/feedback.ts:52-60; src/leaderboard-routes.ts:81`
- **PRIV-2 — Add an age gate and COPPA parental-consent path for under-13 users** (critical impact · effort M · **Owner**)
  - Why: The site targets students (some guides suit middle schoolers) but never asks age, so under-13s can create accounts and get personalized ads without parental consent.
  - Fix: Add a birth-year screen before sign-in; block or require verifiable parental consent under 13 and force non-personalized ads. State the policy in /privacy. Needs an owner legal decision.
  - Evidence: `public/onboarding/index.html (no age fields); public/privacy/index.html:160-161`
### Security

- **SEC-1 — Fix stored XSS in admin panel (ssEscapeHtml leaves quotes unescaped)** (critical impact · effort S)
  - Why: Anyone can submit a guide request whose class name breaks out of an aria-label attribute and runs script in the admin's session.
  - Fix: Replace every ssEscapeHtml copy with one shared helper that escapes & < > " ', and build admin rows with textContent/setAttribute.
  - Evidence: `public/admin/index.html:164-168, :261; src/guide-requests.ts:21-25`
- **SEC-2 — Block login CSRF on POST /auth/verify** (high impact · effort S)
  - Why: A foreign site can sign a victim into the attacker's account; any Google/Canvas connection the victim then makes is stored under the attacker's account.
  - Fix: Reject the POST unless Origin is https://precisstudy.com or Sec-Fetch-Site is same-origin.
  - Evidence: `src/auth-routes.ts:302-319`
- **SEC-3 — Reject uploads with no Content-Type and force safe download names/types** (high impact · effort S)
  - Why: An empty part type skips both the allowlist and magic-byte checks, so any 6 MB file is stored. Downloads keep the uploader's filename (e.g. notes.pdf.exe) and client-declared type, and non-ASCII names make the download throw.
  - Fix: Reject or sniff empty types; store only allowlisted types. On download, map to a fixed type, force the extension from the validated type, add RFC 6266 filename*, strip control chars, and send CSP sandbox + nosniff + CORP. Check docx is real OOXML, record buf.byteLength.
  - Evidence: `src/guide-requests.ts:41-47,104,108; src/admin-routes.ts:236-245; src/file-validation.ts:17-38`
### Testing & CI

- **TEST-1 — Run the full test suite (281 node tests) in CI** (critical impact · effort S · **Owner**)
  - Why: CI runs only `npx vitest run`, so pages-match-generator, client-build freshness, guide-content and other guardrails never run on push.
  - Fix: Change the ci.yml step to `npm test` (needs a token with workflow scope or the GitHub web UI).
  - Evidence: `.github/workflows/ci.yml:18; package.json test script; commit fdb6583 revert`

## P1 next

### Accessibility

- **A11Y-1 — Stop the quiz shortcut handler hijacking Enter and 1-4** (high impact · effort S)
  - Why: Enter on any focused button or link triggers Next instead of the control, and bare character shortcuts can't be turned off (WCAG 2.1.1, 2.1.4).
  - Fix: Ignore events when focus is on buttons/links/tabs or inside the explanation; add a shortcuts on/off setting or scope keys to #qbox.
  - Evidence: `client/guide-app.js:289-323,1693-1707`
- **A11Y-2 — Make flashcards readable by screen readers and add rating keys** (high impact · effort S)
  - Why: A fixed aria-label hides term and definition; flips and navigation are silent; no keys for prev/next or rating.
  - Fix: Use a native button named by the visible face, aria-hide the hidden face, add a polite live region, add ←/→ and 1/2 keys and list them.
  - Evidence: `scripts/guide-template/page-views.template.html:80-85; client/guide-app.js:1029-1057`
- **A11Y-3 — Fix white text on #4fbf85 in dark mode (2.3:1)** (high impact · effort S)
  - Why: Seven filled controls use white on the dark-mode accent, failing contrast in the default theme.
  - Fix: Add an --on-accent token (#0e231e dark, #fff light) and a token contrast test.
  - Evidence: `public/shared/guide-polish.css:259,532-572; scripts/guide-template/style.css:154,242,442`
- **A11Y-4 — Make guide units, concepts and exam parts real headings** (high impact · effort M)
  - Why: The Study Guide view has zero headings; exam part h3s are inside role=button; screen-reader users can't navigate by heading.
  - Fix: Use h2>button accordion units, h3 concept labels, h3>button exam parts; regenerate.
  - Evidence: `scripts/generate-guide.mjs:69,87-92; client/guide-app.js:125-160,766-793`
- **A11Y-5 — Keep focus and announce questions in the quiz** (high impact · effort M)
  - Why: Answering disables the focused option and the next question replaces the DOM, so focus drops to body; options show correct/wrong by color only; 'Incorrect' omits the answer.
  - Fix: Group options with role=group, focus question text on render, use aria-disabled, focus the explanation after answering, add hidden 'Correct/Your answer' text, announce the correct answer, remove aria-live from the score.
  - Evidence: `client/guide-app.js:1532-1603,1689,1692`
- **A11Y-6 — Give the AI helper, command palette and shortcuts modal proper dialog behavior** (high impact · effort S)
  - Why: The helper has no dialog role, focus handling, Esc or live log; the palette and modal declare aria-modal but don't trap focus or restore it; palette results lack listbox semantics.
  - Fix: Use native <dialog>/showModal where modal; for the helper add role=dialog, focus input, Esc to close, role=log on messages, labelled input and gear; give the palette combobox/listbox roles and restore focus.
  - Evidence: `client/guide-app.js:1959-2040,2443-2465,2598-2647; public/shared/command-palette.js`
- **A11Y-8 — Tag French, Spanish and German text with lang and use matching voices; keep read-aloud on mobile** (high impact · effort M)
  - Why: Screen readers and read-aloud pronounce target-language words in English; read-aloud is hidden on phones.
  - Fix: Add targetLang to guide JSON, put lang on terms, options and inline foreign text, pick a matching voice per segment, add a speaker button on language flashcards, keep the TTS button on mobile with pause/resume.
  - Evidence: `client/guide-app.js:643-747; scripts/guide-template/head.html:2; public/shared/guide-polish.css:188`
- **A11Y-9 — Fix low-contrast schedule colors and the invisible French 2/3 blocks** (high impact · effort S)
  - Why: french-2/french-3 have no color, so blocks are white on white; six subject colors fail 4.5:1 with white text.
  - Fix: Add the colors plus a fallback, darken failing ones, and test every subject color for 4.5:1.
  - Evidence: `public/dashboard/index.html:174-178,691-707,1093,1116`
- **A11Y-10 — Raise contrast on remaining low-contrast tokens site-wide** (high impact · effort S)
  - Why: Guide --ink-dim (3.3:1), homepage status/tier tokens (1.92-3.93:1), diagram labels, Watch-out label, dark wrong-answer red, dashboard accuracy bars and locked badges, share page colors all fail AA; status relies on color alone.
  - Fix: Adopt the listed darker values, use status tokens, add text labels next to colors, show locked-badge hints as text, and add all pairs to a token contrast test.
  - Evidence: `scripts/guide-template/style.css:4,171-176,239,260; public/index.html:84,91-110,573; public/dashboard/index.html:1688-1697,1898; public/share/index.html:70`
- **A11Y-19 — Respect the OS light/dark preference and offer a System option** (high impact · effort S)
  - Why: Every page forces dark unless 'light' was saved; there is no Light/Dark/System setting and no color-scheme meta; theme toggles don't expose state.
  - Fix: Shared inline bootstrap: saved value wins else matchMedia; add a Light/Dark/System control in Settings; add color-scheme meta and aria-pressed on toggles.
  - Evidence: `public/index.html:70-75; scripts/guide-template/head.html:26-27; public/settings/index.html:298-320`
- **A11Y-25 — Make Request-page file attachment keyboard accessible** (high impact · effort S)
  - Why: The file input is display:none behind a label, so keyboard users can't attach files; remove buttons are unnamed per file.
  - Fix: Use the visually-hidden class with a focus ring, label each remove button with the file name.
  - Evidence: `public/request/index.html:124,199-200,257`
### Backend

- **BE-3 — Rework cron fan-out before it hits the 1,000 KV ops per invocation limit** (high impact · effort L)
  - Why: Every cron lists all progress:* keys and does a sequential get per user; the */5 job scans users twice. Around 250-500 users the jobs start throwing and later users never get snapshots, leaderboards or reminders.
  - Fix: Use bulk KV get, keep index keys (remind:<HHMM>, streak buckets) so the 5-minute job reads only due users, split daily jobs into separate crons or Queues, wrap each user in try/catch, and skip leaderboards if snapshots failed.
  - Evidence: `src/worker.ts:290-303; src/push-routes.ts:245-282,336-468; src/progress-routes.ts:395-430; src/leaderboard-routes.ts:299-337`
- **BE-4 — Expire challenges and stop scanning every challenge per request** (high impact · effort S)
  - Why: Challenges have no TTL and expiresAt is never enforced; GET /api/challenges scans all challenge keys, so it will 500 for everyone after ~1,000 challenges. Codes use Math.random.
  - Fix: Write with expirationTtl, treat expired as not found, keep a per-user chal:<email> index, generate codes with crypto.getRandomValues, and treat an unparseable expiresAt as expired.
  - Evidence: `src/challenge-routes.ts:47,62-64,122-129,244-269; src/link-previews.ts:139`
- **BE-5 — Fix lost members when a class joins a study group at once** (high impact · effort M)
  - Why: Join/leave read-modify-write one lbgroup array; concurrent joins overwrite each other and the 1 write/sec/key limit throws, leaving students locked out with 403. Opted-out or deleted users stay as ghost members.
  - Fix: Store membership as one key per member (or a Durable Object per group), keep groupCode in the user blob as truth, rate-limit joins, and remove members on opt-out and deletion.
  - Evidence: `src/leaderboard-routes.ts:137-146,232-256; src/study-group-routes.ts:151-179`
- **BE-6 — Stop the daily snapshot cron rewriting every progress blob** (high impact · effort M)
  - Why: The cron puts the whole blob for every student daily at peak study time, can revert a student's latest answers from a stale read, and keeps 57 KB of history inside the hot blob.
  - Fix: Move history to its own history:<email> key and skip writes when nothing changed.
  - Evidence: `src/progress-routes.ts:378,395-427`
- **BE-7 — Normalize account email case so one person doesn't get two progress blobs** (high impact · effort S)
  - Why: Magic-link and GitHub emails are stored as typed while sv:/login: are lowercased, so 'John@x.com' and 'john@x.com' get separate progress and the student thinks progress is lost.
  - Fix: Lowercase in issueSessionCookie and magic-link creation, and on lookup migrate progress:<raw> to progress:<lower> once.
  - Evidence: `src/auth-routes.ts:196-246; src/auth.ts:52-54,216`
- **BE-8 — Validate and size-cap progress, streak, quest and mastery input** (high impact · effort M)
  - Why: Mastery/examples are stored unvalidated, cardsKnown is uncapped, and localDate is client-chosen, so anyone can inflate XP, streaks and leaderboard rank, re-claim quests, or store huge blobs that slow every cron. String values even break XP math.
  - Fix: Reject bodies over ~64 KB, validate mastery as integer 0<=correct<=total<=10000 with numeric unit keys, cap cardsKnown, cap the serialized blob, clamp localDate to server date ±1 and never backwards, derive quest date from the stored timezone, cap daily XP deltas, and move customDecks to its own key.
  - Evidence: `src/progress-routes.ts:178,348-376,461-482,829-862; src/quest-routes.ts:154-162,275-280`
- **BE-9 — Decay stale streaks on read and add streak freezes** (high impact · effort S)
  - Why: Lapsed students get nightly 'don't lose your 12-day streak' pushes forever, stale streaks show on share pages and add XP; one missed day zeroes a streak with no freeze.
  - Fix: Add effectiveStreak() used everywhere, remind only when lastActiveDate is yesterday, add earned freezes (max 2) consumed on a one-day gap, and fix the 'sleepy streak' dashboard message.
  - Evidence: `src/push-routes.ts:351-367; src/progress-routes.ts:374,553,857; public/shared/sage-dashboard.js:26-41`
- **BE-14 — Make the assignments feed degrade gracefully and report token problems** (high impact · effort M)
  - Why: Stale cache fallback never fires (TTL = freshness window); one 403 course aborts the sync; submissions aren't paginated; revoked Canvas/Google tokens show 'all caught up'; Canvas items lack course and done state.
  - Fix: Keep cache ~24 h with fetchedAt, use Promise.allSettled, follow nextPageToken, return per-source reasons and show 'Reconnect' on dashboard and Settings with last-sync health, fill Canvas courseName and state.
  - Evidence: `src/google-sync.ts:38,70-124,238-277; src/google-routes.ts:17; src/canvas-sync.ts:32-53; public/dashboard/index.html:1368-1410`
- **BE-20 — Fix syllabus saves: class default, overwrites, editing and races** (high impact · effort M)
  - Why: Class select defaults to Geometry; re-saving dates wipes earlier ones; parsed dates and times can't be edited or rejected; schedule and unit-order saves overwrite other tabs; wrong years can't be fixed.
  - Fix: Add a placeholder and preselect the student's classes, merge dates, render editable checked rows for dates and meetings, add server-side append and unit-order endpoints, infer the school year, name the class in confirmations.
  - Evidence: `public/syllabus/index.html:132-133,238,365-416,540-589; src/syllabus-dates.ts:105`
### Code health

- **CODE-1 — Generate one subject registry from guides/*.json** (high impact · effort L)
  - Why: ~26 hand-edited subject lists have drifted: the AI tutor uses the Geometry prompt on 3 calculus guides, French 2/3 show raw keys in groups, unit titles and homepage topics are stale, taxonomies differ between pages, settings icons differ from home.
  - Fix: Add metadata to guide JSON, generate public/shared/subjects.js and src/subjects.gen.ts (slug, key, label, category, color, icon, units, href with slash) plus unit titles, import everywhere, add a staleness/cross-registry test; meanwhile add the 3 calculus chat prompts.
  - Evidence: `src/chat.ts:8-65,139-149; src/study-group-routes.ts:92-108; public/shared/unit-titles.js:40,353; git show --stat 48ba318 (31 files)`
### Content

- **CONT-1 — Remove the 'longest option is correct' cue** (critical impact · effort L)
  - Why: The correct answer is strictly longest in 51% of questions and ~85-89% in several guides, so students can game scores and mastery is unreliable.
  - Fix: Add a lint failing guides above 35%; rewrite distractors in the worst 10 guides; also lint answer-position skew.
  - Evidence: `python over guides/*.json: overall 0.514, creative-writing 0.89`
- **CONT-2 — Add quiz questions to Environmental Science units 3-8** (critical impact · effort L)
  - Why: Six of eight units have no questions while the description claims 320.
  - Fix: Write 30-40 questions per unit, or hide quiz CTAs and fix the description until then.
  - Evidence: `guides/environmental-science.json; handoff item 7`
- **CONT-3 — Generate description counts from real data** (high impact · effort S)
  - Why: Many descriptions advertise 320 questions or wrong unit/flashcard counts (sat-reading 87, economics 152, ap-physics 11/371/110 vs 8/320/80); About says 'hundreds of questions'; Educators says 55 subjects.
  - Fix: Compute counts in the generator and inject build totals into About, Request and Educators; test them.
  - Evidence: `guides/*.json description fields; public/about/index.html:172; public/educators/index.html:136`
- **CONT-4 — Fix broken and duplicate questions and flashcards** (high impact · effort S)
  - Why: Junk Spanish distractors, 48 duplicate stems, templated SAT stems, biology 'Only bb'/'bb only', chemistry '???', 19 quiz/hard duplicates and ~44 repeated flashcard terms.
  - Fix: Fix the items and add lints for duplicate stems, duplicate terms, equivalent options and placeholder text, with ratchet allowlists.
  - Evidence: `guides/spanish-1.json:3057; guides/biology.json:1747; guides/chemistry.json:6225; handoff items 8-9`
### Growth

- **GROW-1 — Preview a shared challenge for signed-out invitees and redirect them server-side** (high impact · effort S)
  - Why: A signed-out friend opening a challenge link sees only sign-in buttons, not who challenged them or the score to beat. The page also does two KV reads then a JS redirect for every human visitor, and the noscript link drops the code.
  - Fix: For signed-out visitors fetch /api/challenge/<code> and show a preview card with 'Sign in to accept' carrying next. In the Worker, 302 non-crawler requests to /compete/?tab=challenge&challenge=CODE and keep rewritten tags for unfurlers; store the creator handle on the challenge.
  - Evidence: `public/compete/index.html:1259-1280; public/challenge/index.html:26-34; src/link-previews.ts:138-143`
- **GROW-2 — Honor the next destination for first-time sign-ins** (high impact · effort S)
  - Why: All callbacks send new users to /onboarding and drop next, so a student signing up from a challenge, guide or invite loses that context; the wizard's final CTA picks Geometry by list order.
  - Fix: Redirect new users to /onboarding?next=<safe>; at the end offer 'Continue to your challenge/guide', otherwise S.enrolled[0].
  - Evidence: `src/auth-routes.ts:140,215,317; public/onboarding/index.html:446-451`
- **GROW-3 — Track funnel events with first-party analytics and UTMs** (high impact · effort M)
  - Why: No product analytics; growth decisions are blind.
  - Fix: /api/event writing a fixed event list to Analytics Engine, UTM convention on all social links, weekly funnel query.
  - Evidence: `rg track/posthog = 0; rg utm_ = 0`
- **GROW-4 — Surface invites and sharing at peak moments with native share** (high impact · effort S)
  - Why: Invite links are hidden in Settings; no share prompts on scores or streak milestones; share page has no CTA.
  - Fix: Invite cards on dashboard and results, navigator.share, share prompts at 90%+ or streak 7/30, 'Start <subject> free' CTA with ?ref on /share.
  - Evidence: `public/settings/index.html:475-481; public/share/index.html`
- **GROW-5 — Add re-engagement: cards-due and exam countdown pushes, opt-in email digest** (high impact · effort M · **Owner**)
  - Why: Push covers only daily/streak/blocks; no email channel for lapsed users.
  - Fix: Add 'due' and exam-countdown push kinds; opt-in weekly digest email (student or parent) with unsubscribe, after resolving minors' consent.
  - Evidence: `src/push-routes.ts:74; no email sender`
- **GROW-6 — Make the educator flow a real funnel** (high impact · effort M)
  - Why: Teachers must opt into the student leaderboard to create a code; no join link or QR; no assignments or completion view.
  - Fix: Create codes without opt-in, /join/CODE links and QR, printable handout, then class assignments with due dates and completion %.
  - Evidence: `public/educators/index.html:142-170`
### Guide UX

- **UX-4 — Stop showing '100% ready' and AP 5 forecasts after two answers** (high impact · effort M)
  - Why: Readiness averages only units with 2+ answers, so 2/2 in one unit of eight shows 100% and an AP 5 to students and parents.
  - Fix: Weight by coverage (unassessed units count 0, or show '1 of 8 units practiced'), hide forecasts until ~60% of units have 5+ answers, and show coverage on the parent share page.
  - Evidence: `public/shared/mastery.js:50-64; public/index.html:1515-1568; public/dashboard/index.html:1764-1796`
- **GUIDE-3 — Hide or fix the difficulty chips that empty the quiz to '0/0 NaN%'** (high impact · effort S)
  - Why: Almost no question has a d field, so any chip produces an empty pool and a NaN results card.
  - Fix: Emit chips only when each level has ≥10 questions, treat HARD_Q as hard, and show 'No questions at this difficulty' for an empty pool.
  - Evidence: `client/guide-app.js:1395,1406,1512-1518`
- **GUIDE-4 — Fix flashcard skipping and dead shuffle in filtered decks; requeue 'Again' cards** (high impact · effort S)
  - Why: Rating removes the card from the filtered deck and then advances, skipping every other card; shuffle has no effect in filtered views; custom decks drop 'Again' cards and swallow failed saves.
  - Fix: Keep a session order array, clamp the index instead of advancing when the rated card leaves the deck, requeue 'again' cards, check res.ok, and add tests.
  - Evidence: `client/guide-app.js:994,1010-1016,1057-1058,1127-1136; public/flashcards/index.html:366-379`
- **GUIDE-5 — Only count genuine answers as mastery (hints, guesses, re-asks)** (high impact · effort S)
  - Why: Correct answers after hint 3 (which contains the answer in 27% of items), 50/50, 'I'm guessing' or a re-queue all count as full mastery, inflating every readiness signal.
  - Fix: Track assisted flags and record them as incorrect or 'assisted'; make tier 1 a concept pointer and tier 3 a cloze.
  - Evidence: `client/guide-app.js:1565-1628`
- **GUIDE-6 — Score the diagnostic from this run and stop seeding fake wrong answers** (high impact · effort S)
  - Why: Weak units come from lifetime mastery, missed items are re-asked, and 'Skip — start Unit 1' records two wrong answers per click.
  - Fix: Keep a per-run diagTally, disable requeue in diag mode, and replace the fake answers with a 'started' flag.
  - Evidence: `client/guide-app.js:381-388,1456-1464,1619-1626`
- **GUIDE-7 — Promote SRS boxes only when a card is due; require a flip before rating** (high impact · effort M)
  - Why: Each 'Know it' moves a card up a box even seconds later, so cramming schedules everything 30 days out; cards can be rated without flipping.
  - Fix: Keep the box when not due, drop to max(1,box-2) on a miss, add a 'Hard' rating or FSRS-lite, and disable rating until flipped.
  - Evidence: `client/guide-app.js:898,919-923,1127-1136`
- **GUIDE-8 — Make the practice exam behave like an exam** (high impact · effort M)
  - Why: Timers start when the tab opens and keep running in the background, answers are revealed instantly, there is no final score, nothing is saved, and the lockdown start row never comes back.
  - Fix: Start timers on Start, pause on hidden, defer feedback until 'Submit part', fill #ex-score-box with per-part/unit scores and AP/SAT band, save answers to sessionStorage, add role=timer announcements, restore the start row for retakes.
  - Evidence: `client/guide-app.js:57,63-64,82-106,164-238`
- **GUIDE-9 — Fix exam lockdown: fullscreen exits, warning timing, cleanup** (high impact · effort S)
  - Why: Leaving fullscreen starts an away clock that never stops; the warning appears while the student is away and hides after 4 s; lockdown listeners stay active after leaving the exam; iframe focus and native dialogs count as leaving; iOS gets no fullscreen and no message; the summary is not announced.
  - Fix: Treat fullscreen exit as a zero-duration event or close it on re-entry/interaction; warn in markBack; exit lockdown on view switch, timer expiry and pagehide; ignore blur when document.hasFocus() or activeElement is an iframe; add webkit fallbacks and an 'unsupported' label; focus the summary; lazy-import the module; use or delete getLockdownSummary.
  - Evidence: `public/shared/exam-lockdown.js:46-142; client/guide-app.js:50,74-106`
- **GUIDE-10 — Add retrieval checks inside the Study Guide and a 'Quiz this unit' step** (high impact · effort M)
  - Why: The Study Guide tab is reading only, and 'Take the quiz' appears only after the last concept of the whole guide.
  - Fix: Add a lazy 3-question 'Check yourself' block per unit and show 'Quiz Unit N' in the sticky bar at unit boundaries.
  - Evidence: `scripts/generate-guide.mjs:66-95; client/guide-app.js:2956-2968`
### Mobile & Offline

- **UX-5 — Shorten the mobile homepage (57 single-column cards push content 16 screens down)** (high impact · effort M)
  - Why: At 375px How It Works starts at 13,500px and the demo at 15,187px, so new visitors never see the value proposition.
  - Fix: At ≤640px show a compact 2-column list without topics, first 4 per group with 'Show all', and move a condensed How It Works and demo above the class list.
  - Evidence: `live measurement docH=17040; public/index.html:245,555`
- **GUIDE-14 — Show the guide tab bar on phones** (high impact · effort S)
  - Why: Only 58px of a 697px tab strip is visible at 375px; the active tab is off-screen and nothing hints more tabs exist.
  - Fix: At ≤640px give the tablist its own full-width row with a fade mask, move toggles/timer elsewhere, and scrollIntoView the active tab.
  - Evidence: `public/shared/guide-polish.css:100-113,411-419`
- **GUIDE-15 — Let flashcards grow to fit their text** (high impact · effort S)
  - Why: The card is fixed at 220px, so 77 of 80 AP World definitions overflow onto the controls at 375px.
  - Fix: Stack faces in one grid cell, use min-height:220px and clamp() the font size.
  - Evidence: `scripts/guide-template/style.css:193-203`
- **MOB-1 — Make the PWA installable with a sensible start page** (high impact · effort S)
  - Why: Manifest has only 128/180 icons (not installable on Android), start_url is /onboarding (outside SW flow), wrong theme colors, no shortcuts.
  - Fix: Add 192/512/maskable icons, start_url '/?source=pwa', id, brand colors, shortcuts and screenshots.
  - Evidence: `public/manifest.json`
### Ops

- **OPS-1 — Back up the PROGRESS KV namespace** (high impact · effort M · **Owner**)
  - Why: All student progress lives in one KV namespace with no export; a bad migration or deploy is unrecoverable.
  - Fix: Daily cron dumping PROGRESS and FEEDBACK to R2 as NDJSON with 30-day retention, plus a tested restore script.
  - Evidence: `docs/HANDOFF-2026-10-01.md Open #12`
- **OPS-2 — Add error alerting, health endpoint and uptime monitoring** (high impact · effort M · **Owner**)
  - Why: Errors only land in logs and outages go unnoticed.
  - Fix: Cloudflare Notifications or a tail worker emailing error-level events (rate-limited), GET /api/health with a KV check, UptimeRobot or CF health checks.
  - Evidence: `src/log.ts; no /api/health`
### Performance

- **PERF-1 — Load MathJax only on guides that contain TeX, and pin/self-host it** (high impact · effort S)
  - Why: 43 of 57 guides have no math but still download 256 KB of MathJax and walk the DOM; the floating tag gets only a 7-day cache and can't be cached offline.
  - Fix: Emit MathJax tags only when the guide JSON has TeX; pin 3.2.2 or self-host under /shared with ?v=; add preconnect.
  - Evidence: `scripts/guide-template/head.html:36-43; live /french-2/ transfer 46% MathJax`
- **PERF-3 — Server-render the mission banner and stop it contradicting sign-in walls** (high impact · effort S)
  - Why: The JS-inserted banner shifts every page (~0.15 CLS) and says 'no sign-up required' above sign-in gates.
  - Fix: Emit banner HTML/CSS from the Worker with a head flag for dismissed state; skip it on account-only pages and for signed-in users or reword it.
  - Evidence: `src/worker.ts:156-168; public/shared/mission-banner.js:33-37`
- **PERF-4 — Inline the decorative chalk SVG at build time (it's the 4-5 s guide LCP)** (high impact · effort S)
  - Why: A JS-injected decorative SVG appears seconds after FCP and becomes the LCP element.
  - Fix: Generate the seeded SVG in generate-guide.mjs, drop the invisible displacement filter, remove chalkStrip from personality.js.
  - Evidence: `client/personality.js:89-117; CDP LCP 3.4-5 s`
- **PERF-5 — Fix the font strategy: preload Fraunces, drop unused fonts, subset** (high impact · effort S)
  - Why: Guides preload unused Permanent Marker while Fraunces (67 KB full variable) loads late and shifts layout; 11 font families ship; geometry.css, Outfit and JetBrains Mono are unreferenced; @font-face is declared in several files.
  - Fix: Preload a static Fraunces 600 instance with a metric-matched fallback, remove the Permanent Marker preload and dead fonts, keep each @font-face in one place, inline the few rules instead of render-blocking fonts.css, and limit immutable caching to hashed woff2.
  - Evidence: `scripts/guide-template/head.html:32-35; public/shared/guide-polish.css:8-14; public/fonts/`
- **PERF-16 — Add trailing slashes to all internal links and make slash redirects permanent** (high impact · effort S)
  - Why: Every class link costs a 307 temporary redirect, hurting speed and SEO consolidation.
  - Fix: Emit '/slug/' from one registry, rewrite static hrefs, return 301/308 for normalization, test for slashless internal hrefs.
  - Evidence: `curl /biology → 307; public/index.html 83 slashless hrefs`
### Privacy

- **PRIV-3 — Rewrite the privacy policy to match what is actually collected** (high impact · effort S · **Owner**)
  - Why: The policy says to email for deletion, calls the account just name and email, omits Google Classroom/Calendar, Canvas, push, leaderboard, groups, client-log and Cloudflare analytics, and says only 'the question you type' goes to the AI.
  - Fix: List every stored category and integration (what, why, how long, how to disconnect), link Settings > Delete account, disclose analytics and logging, chat history and page context, add retention periods and a named contact.
  - Evidence: `public/privacy/index.html:134-161; src/chat.ts:194-207; src/client-log-routes.ts:93-98`
### Product features

- **FEAT-2 — Upgrade the AI tutor for quantitative subjects** (high impact · effort M · **Owner**)
  - Why: An 8B model with 400 tokens gives wrong multi-step math answers.
  - Fix: Route math/science to a larger model with a step-by-step mode, keep 8B for short humanities answers.
  - Evidence: `src/chat.ts:151,207`
- **FEAT-3 — Cross-subject review and adaptive per-question practice** (high impact · effort M)
  - Why: Due cards must be reviewed one guide at a time; quizzes can't target previously missed questions.
  - Fix: Interleaved all-subject due review on /flashcards; store missed question ids and build an adaptive mix.
  - Evidence: `public/dashboard/index.html:1463; src/progress-routes.ts:172`
### SEO

- **SEO-1 — Add internal links between related guides** (high impact · effort M)
  - Why: Guide pages link to no other guide, so they're dead ends for crawlers.
  - Fix: Render a static 'Related guides' block and course-sequence prev/next links.
  - Evidence: `curl /biology/ → 0 guide links`
### Security

- **SEC-4 — Require same-origin and JSON content type on all state-changing API calls** (high impact · effort S)
  - Why: request.json() parses text/plain, so any site can make visitors POST to /auth/email/start, /api/feedback, /api/chat and /api/request-guide, spreading load across IPs to dodge per-IP limits.
  - Fix: Add one middleware in handleFetch that rejects non-GET requests with a foreign Origin and requires application/json except on multipart routes.
  - Evidence: `src/worker.ts router (no Origin check)`
- **SEC-5 — Use native rate limits and add limits/budgets on AI and upload endpoints** (high impact · effort M)
  - Why: Magic-link, feedback and guide-request limiters use eventually consistent KV; AI flashcard and syllabus parse, canvas/connect and assignment refresh have no limit; chat has no daily or global cap, so Workers AI cost is unbounded. Multipart bodies are buffered before the 8 MB check.
  - Fix: Add ratelimit bindings keyed by user and IP (/64 for IPv6) for each route, a per-user daily and global daily chat quota with a billing alert, and reject Content-Length > 8.5 MB before formData().
  - Evidence: `src/auth.ts:145-154; wrangler.jsonc ratelimits; src/chat.ts:178-207; src/flashcards-routes.ts:141-152; src/syllabus-routes.ts:111-122`
- **SEC-15 — Rotate the leaked service-account key and check secrets on deploy** (medium impact · effort S · **Owner**)
  - Why: A key printed in an old transcript is unrotated; missing secrets (e.g. VAPID_PRIVATE_KEY) make features silently no-op.
  - Fix: Rotate the key; add a check comparing `wrangler secret list` to env.d.ts and log when a secret is missing.
  - Evidence: `docs/HANDOFF-2026-10-01.md Open #3; src/push-routes.ts:330`
### Site UX

- **UX-1 — Stop walling off no-account students from Dashboard, Settings, Concepts and leaderboards** (high impact · effort M)
  - Why: The site promises 'no sign-up', but Dashboard, Settings (even local Appearance), Concept map, Compete leaderboards, Syllabus and Flashcards show only a sign-in card to anonymous visitors who already have local progress.
  - Fix: Render the dashboard and concept map from localFallback() with a slim 'Sign in to sync' strip, open Settings > Appearance and read-only leaderboards to everyone, and show 'Sign in' instead of Dashboard/Settings in the nav for anonymous visitors.
  - Evidence: `public/dashboard/index.html:1256-1269,1543-1551; public/settings/index.html:1217-1223; public/concepts/index.html:335-338; public/compete/index.html:872-874`
- **UX-2 — Fix the dashboard 'Set a test date' link that loops back to the dashboard** (high impact · effort S)
  - Why: The link goes to /onboarding, which redirects anyone with ob-done-v2 straight back, which is everyone who sees the link.
  - Fix: Add an inline date input in Today's plan that saves the exam record, or link to /onboarding?tour=1&step=test and honor step.
  - Evidence: `public/dashboard/index.html:1515; public/onboarding/index.html:20-25,385,523`
- **UX-3 — Make homepage class search understand how students type, and link to requests** (high impact · effort S)
  - Why: Plain substring search returns 'No subjects found' for 'algebra 2', 'ap lang', 'ap gov', 'calc ab' and more; the empty state is a dead end; the request form suggests classes that already exist and never points to existing guides.
  - Fix: Add data-aliases per card, normalize roman numerals and '&', match by token prefixes; make the empty state 'Request <query> →' prefilled into /request; fuzzy-match on the request form to show 'We already have X'; hide empty group headings and keep the enrolled filter when clearing search.
  - Evidence: `public/index.html:1191-1245,517; public/request/index.html:184-205`
### Testing & CI

- **TEST-2 — Gate deploys on tests and add a staging/rollout path** (high impact · effort M · **Owner**)
  - Why: Deploys run from a laptop with only build:client; main has no protection; no staging or rollback runbook; content edits need a multi-step manual build.
  - Fix: predeploy = build (registry + regen + client) + typecheck + test; deploy job in CI after verify; branch protection; env.staging and gradual `wrangler versions deploy`; document rollback.
  - Evidence: `package.json predeploy; wrangler.jsonc (no env)`
- **TEST-4 — Stop tests hitting real networks and fix config drift** (high impact · effort S)
  - Why: The OAuth callback test calls Google for real (already flaked CI); the test wrangler config differs from production so a test asserts 200 where prod returns 404; the 'unknown subject' test is vacuous.
  - Fix: Mock fetch and add a setup file that throws on unmocked calls; generate the test config from wrangler.jsonc; expect 404 for unknown subjects and views.
  - Evidence: `test/auth-routes.test.js:232-251; wrangler.test.jsonc:20; test/worker.test.js:88-102`
- **TEST-5 — Add browser E2E, axe and performance budgets** (high impact · effort M)
  - Why: No Playwright; core flows and a11y are checked by hand; a duplicate SVG id already shipped; page weight is unbounded.
  - Fix: Add @playwright/test against wrangler dev with ~6 specs plus axe, a unique-id test with per-figure SVG id prefixes, and gzip/Lighthouse budgets.
  - Evidence: `package.json; public/physics/index.html id=a1 x2`

## P2 soon

### Accessibility

- **A11Y-7 — Fix focus return and semantics of the Tools menu, Quick Reference and calculator** (medium impact · effort S)
  - Why: Closing panels focuses removed FAB ids so focus drops to body; the Tools menu sits before its button in tab order, uses role=menu without arrow keys, and its aria-label doesn't contain 'Tools'.
  - Fix: One open/close helper that restores the opener (fallback #toolkit-fab); make Tools a disclosure inserted after the button, focus the first item, name it 'Tools'.
  - Evidence: `client/guide-app.js:2365-2425,2527-2579`
- **A11Y-11 — Make the homepage search combobox keyboard-usable (or plain)** (medium impact · effort S)
  - Why: ARIA combobox roles without arrow-key handling; no announced result count; inline outline:none removes the focus ring.
  - Fix: Implement the APG pattern with aria-activedescendant, or drop the roles and add a role=status count; remove outline:none.
  - Evidence: `public/index.html:207-215,509-517,1211-1245`
- **A11Y-12 — Fix landmarks, tab semantics and menus on hand-written pages** (medium impact · effort S)
  - Why: role=main wraps only the homepage hero; several pages have no main; Compete tabs lack aria-selected and arrow keys; mobile menus misuse role=menu; Sign In panel has no expanded state or Esc; desktop logo is a button announcing a popup.
  - Fix: Wrap content in <main>, copy Settings' tab implementation to Compete, use <nav> links instead of role=menu, add aria-expanded/Esc to Sign In, make the logo a real link.
  - Evidence: `public/index.html:369,384-407,499-542,1318-1324; public/compete/index.html:203-207`
- **A11Y-13 — Use real headings on homepage and dashboard sections** (medium impact · effort S)
  - Why: Dashboard card titles and several homepage section titles are divs; section h2s render smaller than h3s; emoji in titles are read aloud.
  - Fix: Use h2/h3 with section aria-labelledby, raise h2 size, wrap emoji in aria-hidden spans.
  - Evidence: `public/dashboard/index.html:261,310-346; public/index.html:547,947-1031`
- **A11Y-14 — Announce status messages and link form errors across all pages** (medium impact · effort S)
  - Why: Status/error text on homepage, dashboard, request, flashcards, syllabus, settings and admin is never announced; schedule errors are far from their inputs.
  - Fix: Add role=status/alert to status containers, render field errors next to inputs with aria-invalid/aria-describedby, focus the first invalid field.
  - Evidence: `public/dashboard/index.html:336,397,406,856-860; public/index.html:517,1067; rg aria-live in hub pages = 0`
- **A11Y-15 — Keep focused elements visible under sticky headers and floating bars** (medium impact · effort S)
  - Why: No scroll-padding, so focused items scroll under the 129px sticky header or bottom bars (WCAG 2.4.11).
  - Fix: Set scroll-padding-top/bottom from a measured sticky height on guides and 80px on homepage/dashboard.
  - Evidence: `scripts/guide-template/style.css:101; public/shared/guide-polish.css:566,574`
- **A11Y-16 — Make the schedule grid keyboard-usable** (medium impact · effort M)
  - Why: 119 tab stops with no state; empty cell borders are 1.56:1; re-render drops focus.
  - Fix: Use role=grid with roving tabindex and arrow keys, aria-pressed state, ≥3:1 borders, restore focus after render.
  - Evidence: `public/dashboard/index.html:145-147,727-815,902-907`
- **A11Y-17 — Show and announce the selected dashboard density** (medium impact · effort S)
  - Why: Inline styles beat .active so the selection is invisible and there is no aria-pressed.
  - Fix: Move styles to a class, set aria-pressed, style the pressed state.
  - Evidence: `public/dashboard/index.html:99,297-299,2104`
- **A11Y-18 — Fix small focus/visibility issues on guides (back-to-top, Reveal step, Break this down, reorder handle)** (medium impact · effort S)
  - Why: Invisible back-to-top stays focusable; hiding 'Reveal step' drops focus; 'Break this down' is mouse-only; reorder handles are unnamed and moves are silent.
  - Fix: Add visibility:hidden to back-to-top, move focus to the answer before hiding, insert the explain button after the concept, name handles per unit and announce moves.
  - Evidence: `scripts/guide-template/style.css:488-492; client/guide-app.js:421,537-550,825-862,1180-1195`
- **A11Y-20 — Apply high-contrast and AMOLED before first paint and honor prefers-contrast** (medium impact · effort S)
  - Why: A deferred script applies them late, so users see a flash of the normal theme; OS 'more contrast' is ignored.
  - Fix: Read the flags in the inline head bootstrap, default from prefers-contrast: more, sync via storage events, and replace !important overrides with token layers.
  - Evidence: `public/shared/high-contrast.js:3,45-76`
- **A11Y-22 — Fix tooltip hover (WCAG 1.4.13) and duplicate announcements** (medium impact · effort M)
  - Why: Tooltips close when moving onto them and can get stuck; text is announced twice; validation titles are stripped from inputs.
  - Fix: Allow pointer on the tip, hide when trigger disconnects, skip describedby when equal to the name, skip inputs with pattern.
  - Evidence: `public/shared/tooltips.js:56,100-187`
- **A11Y-23 — Fix feedback dialog focus, labels and errors** (medium impact · effort S)
  - Why: Close drops focus to body; fields are placeholder-only; category toggles lack aria-pressed; non-JSON errors show parser messages; the success timer can close a reopened dialog.
  - Fix: Restore focus, add hidden labels and aria-pressed, use themed danger color, guard res.json, clear the timer on open.
  - Evidence: `public/shared/feedback-widget.js:51,69-135`
- **A11Y-24 — Fix Sage owl icon names and closet keyboard use** (medium impact · effort S)
  - Why: All closet buttons announce 'Sage the owl'; locked items are disabled with title-only hints; picking an item drops focus.
  - Fix: Use label ?? default and aria-hidden for '', use aria-disabled with visible hint text, refocus after render.
  - Evidence: `public/shared/owl.js:119-123; public/shared/sage-dashboard.js:58-83`
### Backend

- **BE-10 — Shift worked-example keys and quest boss ids in unit migrations** (medium impact · effort S)
  - Why: Completed examples in old units show as completed in the wrong renumbered units.
  - Fix: Rewrite example keys >= inserted unit and reset quest.boss; add a follow-up migration.
  - Evidence: `src/progress-routes.ts:293-309; public/shared/mastery.js:250-258`
- **BE-11 — Give units stable ids so new units don't need copy-pasted migrations** (medium impact · effort M)
  - Why: Progress is keyed by position, requiring hand-written diverging migrations on server and client.
  - Fix: Add a stable uid per unit in guide JSON with one final migration, or at least a shared data-driven applyUnitShifts().
  - Evidence: `src/progress-routes.ts:266-313; public/shared/mastery.js:222-257,395`
- **BE-12 — Prevent double quest XP and lost challenge results** (medium impact · effort M)
  - Why: Concurrent claims award XP twice; simultaneous challenge submits overwrite each other.
  - Fix: Store each side's challenge result under its own key, add idempotency for claims, disable claim buttons while pending.
  - Evidence: `src/quest-routes.ts:376-400; src/challenge-routes.ts:146-193`
- **BE-13 — Fix Google Calendar push: stale events and no cleanup** (medium impact · effort M)
  - Why: Events keyed without end/timezone/calendar never update; switching calendars orphans events; disabling or disconnecting leaves recurring events forever.
  - Fix: Store eventId and calendarId per block, patch on changes, delete on disable/disconnect/deletion, run calls with limited parallelism and timeouts.
  - Evidence: `src/google-calendar-push.ts:14-16,115-128; src/progress-routes.ts:792-802`
- **BE-15 — Make push reminders capped, timezone-aware and idempotent** (medium impact · effort M)
  - Why: Unlimited subscriptions per user; daily reminder at fixed 22:00 UTC even after studying; 5-minute windows drop or duplicate reminders; no topic/urgency headers.
  - Fix: Keep the 5 newest subscriptions, send daily at a local hour and skip if studied today, store lastSent markers, add topic/urgency and notification tags.
  - Evidence: `src/push-routes.ts:118-125,187,230-258,362,435-440`
- **BE-16 — Count 'questions today' and flashcard due dates by local day** (medium impact · effort S)
  - Why: UTC dates reset counters mid-evening for US students and make custom cards due the evening before.
  - Fix: Use streak.timezone / local date helpers on server and client.
  - Evidence: `public/dashboard/index.html:1483-1491; src/progress-routes.ts:380-389; public/flashcards/index.html:186-187`
- **BE-17 — Unify the three exam-date systems into one synced record** (medium impact · effort M)
  - Why: Homepage date, homepage slider (hardcoded Geometry) and onboarding buckets never sync, producing wrong countdowns.
  - Fix: One account-synced {date,label,subjectKey} with a local mirror; real date picker in onboarding; prefill official AP exam dates for AP guides.
  - Evidence: `public/index.html:980-1068,1373-1404,1593-1618; public/onboarding/index.html:341-347,509; public/dashboard/index.html:1460-1479`
- **BE-18 — Make onboarding reminders actually subscribe to push** (medium impact · effort S)
  - Why: The step shows reminders on but never asks permission or subscribes, so nothing is ever sent.
  - Fix: Reuse the dashboard subscribe flow on Continue; save prefs off and explain if denied.
  - Evidence: `public/onboarding/index.html:438-443,514-520`
- **BE-19 — Store onboarding completion in the account instead of localStorage** (medium impact · effort S)
  - Why: Every new device force-redirects to onboarding with a visible flash; a stale ob-step-v2 check remains.
  - Fix: Save onboardingCompletedAt in the blob, check it, remove the stale key, prefer a dismissible 'Finish setup' card.
  - Evidence: `public/index.html:1581-1587; public/dashboard/index.html:1299-1305`
- **BE-21 — Improve syllabus parse feedback and matching** (medium impact · effort M)
  - Why: Failures return 502 with no next step; text is silently truncated at 6,000 chars; no progress or cancel; stale results stay after failure; unit matcher is too eager and can't be adjusted.
  - Fix: Return 422 with codes and a truncation notice, add progress/cancel, reset state per parse, require 2+ shared tokens, mark unmatched units and allow reordering.
  - Evidence: `src/syllabus-routes.ts:31,159-187; public/syllabus/index.html:319-351,468-528`
- **BE-22 — Improve Canvas and Google connect error handling** (medium impact · effort S)
  - Why: Pasted URLs are rejected; all Canvas failures share one message; Google errors (cancel, signed out, missing scopes) all say 'try again'; disconnect failures are ignored; norefresh gives a plain-text URL.
  - Fix: Normalize URLs to hostname, map errors to specific messages, check granted scopes, redirect signed-out users through sign-in, check res.ok, link the permissions page, add role=status.
  - Evidence: `src/canvas-routes.ts:17,38-57; src/google-connect.ts:39-111; public/settings/index.html:1309-1448`
- **BE-23 — Fix upload type support and client-side size checks** (medium impact · effort S)
  - Why: Legacy .doc is accepted but toMarkdown can't parse it; iPhone HEIC photos are hidden; flashcard and syllabus uploads aren't size-checked before sending.
  - Fix: Drop .doc with a 'save as .docx' message, use accept='image/*,…' so iOS converts HEIC, share a client size check with the server constant.
  - Evidence: `src/file-validation.ts:2-22; public/flashcards/index.html:118-119,243-264; public/syllabus/index.html:143`
- **BE-24 — Fix admin panel robustness** (medium impact · effort M)
  - Why: Lists do one sequential get per key (subrequest limit at scale); partial upload saves orphan files; status updates race; deletes of missing keys return ok; sign-in drops next; title says 'Dashboard'; feedback 'too long' check is dead.
  - Fix: Store summaries in list metadata with pagination, clean up on failed writes or add TTL, keep status separately, validate keys and 404, add next=/admin/, rename title, validate raw message length.
  - Evidence: `src/admin-routes.ts:37-77,105-233; src/guide-requests.ts:44,115-124; src/feedback.ts:19,42; public/admin/index.html:421-440`
- **BE-26 — Fix link-preview bugs (?ref rewriting, challenge og:url, caching, tags)** (medium impact · effort S)
  - Why: Any ?ref= rewrites the page title for real visitors; challenge og:url points to a 307 URL; personalized previews are marked public; raw subject keys appear in previews; generic previews do redundant rewrites; missing site_name/alt/dimensions.
  - Fix: Only prefix titles for crawlers on guide pages, use /challenge/, mark resolved previews private, sanitize keys, return null for generic cases after aligning static files, add og:site_name/image:alt/dimensions.
  - Evidence: `src/link-previews.ts:86-198`
### Code health

- **CODE-11 — Merge color/token systems into one OKLCH token file and unify the brand palette** (high impact · effort L · **Owner**)
  - Why: Homepage/dashboard are green while guides are navy; 11+ token sets, three shadow and radius schemes; dark diagram bg is the wrong green; hardcoded emoji icons and duplicate card/badge styles.
  - Fix: Create /shared/tokens.css with semantic OKLCH tokens for light/dark/high-contrast/AMOLED plus spacing, radius, type and shadow scales; choose one brand hue (owner decision); shared card/badge components and SVG icons.
  - Evidence: `scripts/guide-template/style.css:1-30; public/index.html:79-124; public/dashboard/index.html:21-57`
- **CODE-2 — Remove raw NUL/control bytes that make git treat files as binary** (medium impact · effort S)
  - Why: Regex and test files contain literal NUL bytes, so diffs show 'Binary files differ' and grep skips them.
  - Fix: Use escaped /[\x00-\x1f\x7f]/g, share one sanitizer, add a test rejecting bytes below 0x09.
  - Evidence: `src/leaderboard-routes.ts:151; src/study-group-routes.ts:15; two test files`
- **CODE-3 — Create one progress-store and http module** (medium impact · effort M)
  - Why: Three loadBlob and two saveBlob variants, 15 json() copies and repeated session/KV guards caused the migration bug and block validation.
  - Fix: src/progress-store.ts (load/update with migrate, validate, size cap) and src/http.ts (json, withSession, methodNotAllowed); split progress-routes.ts by feature.
  - Evidence: `src/progress-routes.ts:34-97,315-325; src/push-routes.ts:54-75; src/flashcards-routes.ts:73-86`
- **CODE-5 — Share site header, footer, theme, auth and escape helpers across hand-written pages** (medium impact · effort M)
  - Why: 8 header variants, 4 footers (10 pages without footer or Privacy/Terms links), duplicated theme/auth/escape code, inconsistent sign-in options and a logo button that can't open in a new tab.
  - Fix: Inject one header/footer partial via HTMLRewriter (or build-time partials) with aria-current, shared theme bootstrap, getMe(), escape and ICS helpers; real <a> logo.
  - Evidence: `public/*/index.html banner/footer variants; public/index.html:369,399-400`
- **CODE-6 — Offer the same sign-in options everywhere, including email** (medium impact · effort M · **Owner**)
  - Why: Settings and Flashcards offer only Google (Settings without next); school Google accounts often block OAuth; email magic link exists but is never offered.
  - Fix: One shared login box with Google, GitHub and 'Email me a link', always passing next, plus a benefit line and Terms/Privacy links; confirm send_email can reach arbitrary addresses.
  - Evidence: `public/settings/index.html:260,1221-1222; public/flashcards/index.html:97-100; src/auth-routes.ts:229-262`
- **CODE-7 — Move large inline page scripts into built modules and share XP logic** (medium impact · effort L)
  - Why: Dashboard, settings and compete are mostly untyped inline JS; XP, level and badge rules are duplicated with the Worker.
  - Fix: client/dashboard.js etc. built by esbuild, isomorphic src/shared/xp.ts, replace inline styles with classes.
  - Evidence: `public/dashboard/index.html:1605-1628; src/progress-routes.ts:348-376`
- **CODE-8 — Delete stale scripts, round-trip tooling and dead code** (medium impact · effort S)
  - Why: One-off patchers, a diverged hero-patterns.mjs, sync-guides-registry.py, apply-guide-json (which skips the archive), sync-guide-json, prerender-practice, unreferenced files, dead homepage/settings code and dead guide markup confuse and can break pages.
  - Fix: Delete them and the dead branches/markup; make sync-home-counts read guides JSON; add scripts/README.md.
  - Evidence: `scripts/ (1,622 lines unreferenced); scripts/apply-guide-json.mjs:40; public/index.html:1115-1207`
- **CODE-9 — Validate guide JSON against a schema at build time** (medium impact · effort M)
  - Why: Quiz/flashcard items aren't validated (34 items break the 4-option assumption), exam items are silently dropped, intro arrays render comma-joined, dead fields linger, template replacements can silently fail.
  - Fix: Add guide.schema.json and validateGuide() that throws, mustReplace() for template substitutions, remove fontUrl/description, use __TITLE__ tokens in hero.html.
  - Evidence: `scripts/generate-guide.mjs:242-249,316-340,364-377; guides/earth-science.json units 6,8`
- **CODE-10 — Add a linter/formatter and tighten TypeScript** (medium impact · effort S)
  - Why: No linter; 4 dead declarations; vitest globals leak into Worker types; 22 `any` on OAuth/API input; client JS never type-checked; tsconfig.shared.json is orphaned.
  - Fix: Add Biome to npm test/CI, enable noUnused*, remove vitest/globals, use `wrangler types`, type guards for external JSON, point tsconfig.shared at client sources.
  - Evidence: `package.json; tsconfig.json:16; src/env.d.ts`
### Content

- **GUIDE-21 — Make Memory Tricks and Quick Reference more than repeats** (medium impact · effort M)
  - Why: For 50 guides Memory Tricks re-shows unit traps and Quick Reference repeats concept intros.
  - Fix: Rename to 'Common Mistakes' or drop duplicate traps, add optional mnemonics, build Quick Reference from keyFacts, formulas and a term table; delete memory-content-apush.txt.
  - Evidence: `scripts/generate-guide.mjs:41-51,76-77,159-166`
- **CONT-5 — Bring thin guides up to ~30 questions per unit and add per-option explanations** (medium impact · effort XL)
  - Why: Many guides have ~10 questions per unit; many explanations are under 40 chars; wrong answers don't explain the chosen distractor.
  - Fix: Prioritize AP/SAT guides, require explanations to state the rule, add optional per-option rationale for most-missed items.
  - Evidence: `per-guide counts; short-e counts`
- **CONT-6 — Add worked examples, hard questions and calculus FRQs where thin** (medium impact · effort M)
  - Why: Only 6 guides have hard questions, 7 have worked examples; Calc AB has 5 FRQs vs 31 in APUSH.
  - Fix: Add multi-part FRQs to calc-ab/bc and examples/hard sets to math and science guides first.
  - Evidence: `grep hardQuiz = 6; calc-ab examParts`
- **CONT-7 — Update the changelog and generate it from commits** (medium impact · effort S)
  - Why: Newest entry is September 14 while 174 commits shipped since.
  - Fix: Add recent entries and generate from conventional commit prefixes at build.
  - Evidence: `public/changelog/index.html:176`
- **CONT-8 — Clean up homepage cards and sections** (medium impact · effort M)
  - Why: Plan calculator hardcoded to Geometry with a wrong count; 'The Original' badge; card '+N more' counts wrong; taxonomy differs from onboarding; dashboard puts class cards last; Settings link opens Account with Delete account instead of class picker.
  - Fix: Generate cards from registry, remove or generalize the calculator, use one taxonomy, reorder the dashboard (plan, resume, classes, collapsed schedule), link /settings#study and move destructive actions to a typed-confirm danger zone.
  - Evidence: `public/index.html:562-573,1033,1150; public/dashboard/index.html:306-411; public/settings/index.html:267-421`
### Growth

- **GROW-7 — Show local progress to anonymous returning visitors and nudge saving** (medium impact · effort S)
  - Why: Class cards show readiness only after sign-in; no event-driven save prompt.
  - Fix: Render readiness from localStorage first; after the first quiz show 'Save progress' and merge on login.
  - Evidence: `public/index.html:1424-1434,1553-1570`
- **GROW-9 — Automate the social pipeline** (medium impact · effort M · **Owner**)
  - Why: Only 2 decks exist; account auth is blocked on the owner; promo media sits in public/.
  - Fix: Generate decks from flashcards with UTM links; move public/social out of the deploy.
  - Evidence: `../precisstudy-social/decks; public/social`
### Guide UX

- **GUIDE-11 — Build Quick 10 after mastery loads and start the session clock at the first question** (medium impact · effort S)
  - Why: Quick 10 is built before mastery loads so it is never weighted; quiz time includes reading time.
  - Fix: Build the pool lazily on first quiz open; set qSessionStart when the first question shows.
  - Evidence: `client/guide-app.js:1214-1223,1397-1405,1515,1708`
- **GUIDE-12 — Make 'Type it' answers accent, punctuation and parenthetical insensitive** (medium impact · effort S)
  - Why: Correct answers like 'esta' vs 'está' or 'bacons rebellion' fail; feedback vanishes after 1.7 s with no override.
  - Fix: Normalize (NFD, strip diacritics and punctuation), accept text without parentheticals and slash alternatives, flag accent-only misses, skip LaTeX cards, wait for Enter after a wrong answer, add 'I was right'.
  - Evidence: `client/guide-app.js:883-892,994`
- **GUIDE-16 — Apply saved syllabus unit order on guide pages** (medium impact · effort S)
  - Why: The inline call runs before the module defines __ssApplyUnitOrder, so saved orders never apply; hydrate keeps DOM order; renumbered titles then disagree with every other label.
  - Fix: Apply order from the module after import, reorder DOM and selects, route labels through one unitLabel() helper, and add a happy-dom test.
  - Evidence: `scripts/generate-guide.mjs:347; scripts/guide-template/module-wiring.html; client/guide-app.js:466-473,794-807`
- **GUIDE-17 — Fix the AI Study Helper greeting and remove the dev OmniRoute path** (medium impact · effort S)
  - Why: Every guide greets with chemistry examples, and a local-dev API-key form ships in production.
  - Fix: Build the greeting from this guide's flashcard terms and delete OmniRoute code and markup.
  - Evidence: `client/guide-app.js:1878-1998,1964,2042-2057,2112,2448-2457`
- **GUIDE-18 — Make anonymous quiz copy match reality and route all quiz entry points one way** (medium impact · effort S)
  - Why: Anonymous users are told it's a 'free diagnostic' and to sign in for the full bank, but everything is open; several entry points skip the gate logic; Print prints the whole bank with answers.
  - Fix: Rewrite the note around syncing, delete #quiz-gate, send every entry through ssQuizTabClick, limit printWorksheet to the selected unit.
  - Evidence: `scripts/guide-template/page-views.template.html:112-121; client/guide-app.js:37,1107-1126,1273,1432,2325-2340,2967`
- **GUIDE-19 — Merge the two resume systems and resume flashcards, quizzes and exams** (medium impact · effort M)
  - Why: The on-page Continue uses a stale DOM index; the dashboard Resume drops the concept anchor; flashcard, quiz and exam state is lost on refresh.
  - Fix: Use ss-last-subject (unit+concept) everywhere via one shared builder, delete LAST_UNIT_KEY, and save deck/quiz/exam state per slug with 'Resume quiz (Q 6/10)'.
  - Evidence: `client/personality.js:192-224; client/guide-app.js:1205-1212,2899-2921; public/dashboard/index.html:1536-1540`
- **GUIDE-20 — Improve guide search: accent folding, full coverage, keyboard and close** (medium impact · effort M)
  - Why: No diacritic folding, raw-HTML matches, 12-result cap, misses memory/qref/worked/hard items, no Esc or arrow keys, filter select goes out of sync.
  - Fix: Build a normalized index once over all content, show grouped counts with 'Show all', add Esc/arrows/outside click, reset the filter on search.
  - Evidence: `client/guide-app.js:253-287,394-401`
- **GUIDE-25 — Fix garbled page titles on deep-linked view URLs** (medium impact · effort S)
  - Why: The client derives the subject from a Worker-rewritten title, producing 'Flashcards — AP World History Flashcards — PrecisStudy Study Guide' and stale titles after switching.
  - Fix: Build titles from SS_GUIDE.title using one map shared with the Worker.
  - Evidence: `client/guide-app.js:2877-2885; src/worker.ts:66-72`
- **GUIDE-29 — Replace alert/prompt/confirm in challenge, report and admin flows** (medium impact · effort S)
  - Why: Challenge links appear in window.prompt (hard to copy on phones), reports use prompt(), admin deletes run with no confirmation and ignore failures, deck delete ignores failures.
  - Fix: Use navigator.share with clipboard fallback, an inline report dialog, inline confirmations with res.ok checks.
  - Evidence: `client/guide-app.js:1676,2743-2823; public/admin/index.html:262,300,337-410; public/flashcards/index.html:224-230`
### Mobile & Offline

- **MOB-2 — Ship real offline flashcards and quizzes** (high impact · effort L)
  - Why: Offline works only for previously visited pages and progress made offline is lost.
  - Fix: 'Save for offline' per guide, queue progress POSTs in IndexedDB, show offline state and disable AI/challenge when offline.
  - Evidence: `public/sw.js; handoff #11`
- **GUIDE-13 — Show the first quiz question above the fold on phones** (medium impact · effort S)
  - Why: Plan card, notes, diagnostic buttons and a 185px toolbar push the first option to y=1214 at 375×812.
  - Fix: Collapse toolbar items into an 'Options' disclosure, show diagnostic CTA only before any answers, move the plan card below the question, shorten the anonymous note.
  - Evidence: `live /biology/quiz measurements; client/guide-app.js:2705-2708`
- **PERF-9 — Fix the service worker: preload, bounded cache, timeout, offline page, update flow, registration everywhere** (medium impact · effort M)
  - Why: No navigation preload; every response is cached forever including view and query variants and old ?v URLs; no network timeout; offline is a plain-text 503; many pages don't register the SW; silent skipWaiting.
  - Fix: Enable navigationPreload, normalize keys, skip ?v assets, cap HTML entries, race fetch with ~3 s timeout, precache /offline.html, register SW and manifest from a shared snippet, show a refresh toast, and test that sw.js stays uncached.
  - Evidence: `public/sw.js:10-47`
- **MOB-3 — Fix safe-area insets and floating layer overlap on phones** (medium impact · effort S)
  - Why: Fixed bars sit under the home indicator; four floating layers cover the bottom third; the chat panel overflows at 375px.
  - Fix: viewport-fit=cover with env() insets, merge back-to-top into Tools, dock the concept bar full-width, make chat a bottom sheet with dvh.
  - Evidence: `public/shared/guide-polish.css:566,574; scripts/guide-template/style.css:404,488-510`
- **MOB-4 — Add enterkeyhint/inputmode and an iOS install prompt** (medium impact · effort S)
  - Why: Mobile keyboards show wrong keys; iOS users can't get push unless installed.
  - Fix: Add enterkeyhint and inputmode; after the 2nd session show an install card with iOS instructions, then request push.
  - Evidence: `rg enterkeyhint = 0; rg beforeinstallprompt = 0`
### Performance

- **PERF-2 — Render math at build time or only for visible content** (high impact · effort L)
  - Why: MathJax typesets the whole body, including hidden views, causing ~1 s long tasks and 1.4-2 s TBT on math guides.
  - Fix: Pre-render TeX with mathjax-full in the generator; otherwise typeset per open unit and ignore hidden views and the archive.
  - Evidence: `CDP /physics/ TBT 1420 ms; /algebra2/ TBT 1953 ms`
- **PERF-6 — Cut guide HTML weight: lazy-load quiz/exam data and stop shipping content twice** (high impact · effort L)
  - Why: Guides inline up to ~1 MB of HTML; quiz, exam and worked data are needed only on their tabs; the qbank archive duplicates every question; exam CSS is a JS string in every page; nothing is cacheable.
  - Fix: Write hashed per-guide data JSON (quiz, hard, exam parts, worked) loaded on first tab open; move the crawlable archive to its own URL or read from one copy; serve exam.css as a cached file; prefetch after load.
  - Evidence: `scripts/generate-guide.mjs:131-157,420; aggregate QUIZ 4.3 MB across pages`
- **PERF-7 — Move the inline guide stylesheet to one cached file and remove dead hero/noise CSS** (medium impact · effort M)
  - Why: 57 KB of identical CSS is inlined in every guide then overridden by guide-polish.css with 142 !important; per-subject hero patterns are hidden; a leftover fixed overlay blend layer costs compositing.
  - Fix: Merge style.css and guide-polish.css into a versioned /shared/guide.css using @layer, keep only per-subject accent vars inline, delete heroPattern output and the noise body::before.
  - Evidence: `scripts/generate-guide.mjs:262-312; public/shared/guide-polish.css:33-34; scripts/guide-template/style.css:466`
- **PERF-8 — Content-hash every shared module from a build manifest** (medium impact · effort M)
  - Why: ES imports and 6 files bypass ?v= versioning, so they revalidate every view and chain into a 4.8 s waterfall; hashes are computed at runtime per isolate; any ?v is served immutable.
  - Fix: Bundle/hash with esbuild, write a manifest at build, have the Worker read it (or inject an importmap), add modulepreload, merge the HTMLRewriter passes, short TTL for mismatched v.
  - Evidence: `src/worker.ts:91-146,720-739`
- **PERF-10 — Ship utility-page header CSS statically** (medium impact · effort S)
  - Why: The header-hiding CSS is injected by a deferred script, so phones flash the open mobile menu (it becomes LCP) and the auth slot shifts layout.
  - Fix: Move the styles into a static stylesheet and reserve width for the auth slot.
  - Evidence: `public/shared/site-header.js:10-24`
- **PERF-11 — Add content-visibility to off-screen guide sections** (medium impact · effort S)
  - Why: Guides have 27-49k elements and every layout covers all of them.
  - Fix: Add content-visibility:auto with contain-intrinsic-size to unit bodies, archive and inactive views.
  - Evidence: `CDP /physics/ layout 655 ms`
- **PERF-12 — Remove the permanent non-passive document touchmove listener** (medium impact · effort S)
  - Why: It blocks touch scrolling on every guide while MathJax keeps the main thread busy.
  - Fix: Use pointer events with capture on the drag handle and transform for movement.
  - Evidence: `client/guide-app.js:2478-2519,2710`
- **PERF-13 — Externalize dashboard and settings inline scripts** (medium impact · effort S)
  - Why: The dashboard ships a 90 KB inline module and Settings a 51 KB inline subject list with duplicate icons, re-downloaded each visit.
  - Fix: Move them into built, versioned modules and import icons from subject-icons.js; delete sync-settings-icons.py.
  - Evidence: `public/dashboard/index.html:507-508; public/settings/index.html SUBJECTS`
- **PERF-15 — Size dashboard skeletons to the student's classes and dedupe progress/auth fetches** (medium impact · effort S)
  - Why: 57 skeletons collapse to a few cards; pages fire /api/progress and /auth/me twice per load.
  - Fix: Cache enrolled count for skeletons, memoize one progress promise and one getMe() shared module.
  - Evidence: `public/dashboard/index.html:1308-1318; public/index.html:1409,1557; client/personality.js:246`
- **PERF-17 — Split guide-app.js into lazy-loaded ES modules** (medium impact · effort XL)
  - Why: 113 KB parser-blocking script, 73% unused at load; 251 globals for inline handlers; blocks CSP tightening and testing.
  - Fix: Split along section markers, bundle with esbuild splitting, lazy-load exam/chat/Desmos, replace inline handlers with delegated data-action listeners.
  - Evidence: `client/guide-app.js (3023 lines); handoff #12`
- **PERF-18 — Make GET /api/quest read-only and cut write amplification** (medium impact · effort S)
  - Why: Every quest GET writes the whole blob; flashcard ratings each do a full read/write; GET /api/progress returns the entire blob twice per session.
  - Fix: Write only when quest state changes, batch flashcard ratings and check res.ok, support ?subject= and a small summary endpoint, skip unchanged puts.
  - Evidence: `src/quest-routes.ts:282-296; src/flashcards-routes.ts:238-302; src/progress-routes.ts:435-444`
### Privacy

- **PRIV-4 — Turn off personalized AdSense for a student audience** (medium impact · effort S · **Owner**)
  - Why: Personalized ads run on pages including guides; with minors and NY Ed Law 2-d this is a compliance risk.
  - Fix: Force requestNonPersonalizedAds / child-directed treatment globally and never show ads on signed-in pages.
  - Evidence: `public/index.html:40; public/privacy/index.html:141,161`
- **PRIV-5 — Add a data export endpoint** (medium impact · effort M)
  - Why: FERPA, 2-d and GDPR give students and parents the right to see their data; no export exists.
  - Fix: Add GET /api/account/export returning every key for the user as JSON and link it from Settings and the Bill of Rights.
  - Evidence: `no export route in src/worker.ts`
- **PRIV-6 — Set retention limits on login records, feedback and request uploads** (medium impact · effort M · **Owner**)
  - Why: login:, feedback and guide-request files are kept forever with no stated retention.
  - Fix: Add expirationTtl (e.g. 90 days for feedback/requests), purge inactive accounts by cron, and publish the retention table.
  - Evidence: `src/auth.ts:214-237; src/feedback.ts:56-63; src/guide-requests.ts:44,117`
- **PRIV-7 — Only attach the account email to feedback when the user opts in** (medium impact · effort S)
  - Why: Feedback silently attaches the signed-in email when the field is blank.
  - Fix: Attach it only when a 'contact me' box is ticked.
  - Evidence: `src/feedback.ts:52-60`
- **PRIV-8 — Add a subprocessor list and contract terms to the Parents' Bill of Rights** (medium impact · effort S · **Owner**)
  - Why: NY Ed Law 2-d needs named third parties, purpose, retention, storage, encryption and a challenge process.
  - Fix: Add a subprocessor table, encryption-at-rest statement, breach notification commitment and a named privacy contact.
  - Evidence: `public/parents-bill-of-rights/index.html`
- **PRIV-11 — Overwrite empty leaderboards so opted-out handles disappear** (medium impact · effort S)
  - Why: Empty subject boards are never written, so last week's rankings and opted-out handles keep showing.
  - Fix: Write every board including empty ones, ideally as one lb:all key per day.
  - Evidence: `src/leaderboard-routes.ts:355-363`
### Product features

- **FEAT-1 — AI-graded AP FRQ practice with rubrics** (high impact · effort L)
  - Why: FRQs are 40-60% of AP scores and get no feedback today.
  - Fix: Add rubric arrays to FR items and a /api/frq/grade route returning per-criterion points.
  - Evidence: `guides/ap-lang.json PART_C; no grading route`
- **FEAT-4 — Use Classroom/Canvas due dates for study recommendations** (medium impact · effort M)
  - Why: Upcoming tests only flag schedule conflicts.
  - Fix: Match test/quiz titles to units and boost them in recommendNext().
  - Evidence: `public/dashboard/index.html:717-719,1036-1046`
- **FEAT-5 — Improve the parent share page** (medium impact · effort M)
  - Why: Parents see percentages without coverage or recency, in failing colors, with no ongoing updates.
  - Fix: Show units practiced and last studied with text labels; optional weekly parent digest.
  - Evidence: `public/share/index.html:70-91`
- **FEAT-6 — Generate quiz questions from uploaded notes and let students edit saved decks** (medium impact · effort M)
  - Why: Uploads produce only flashcards; saved decks can't be edited.
  - Fix: Extend generation to MC questions; add a deck Edit view and flag empty fields; show errors when loading decks fails.
  - Evidence: `src/flashcards-routes.ts; public/flashcards/index.html:202-302`
- **FEAT-7 — Live multiplayer quiz sessions** (medium impact · effort L)
  - Why: Groups and challenges are async only.
  - Fix: Durable Object room per group code running a Kahoot-style quiz.
  - Evidence: `no WebSocket routes`
- **FEAT-8 — Concept map and dashboard guidance fixes** (medium impact · effort S)
  - Why: Every unit shows 'shore up earlier units' for new students; nodes link only to practice without slash; no single Continue CTA; class pickers unsorted.
  - Fix: Flag only units after red/amber, honor unitOrder, add Review notes/Practice links, a single Continue CTA, sort pickers with own classes first.
  - Evidence: `public/concepts/index.html:252-304; public/syllabus/index.html:238`
- **FEAT-9 — Command palette and error monitor robustness** (medium impact · effort S)
  - Why: Palette throws on undefined e.key and steals Ctrl+K while typing; search misses slugs; CLS is summed not windowed; 'Script error.' uses up the error budget.
  - Fix: Guard isComposing/typeof key, match slugs, toggle classes on arrows; use web-vitals session windows and resend on hide; drop opaque script errors.
  - Evidence: `public/shared/command-palette.js:82-120; public/shared/error-monitor.js:18-134`
### SEO

- **SEO-4 — Build per-unit landing pages for long-tail search** (high impact · effort L)
  - Why: Hundreds of units students search for have no page of their own.
  - Fix: Generate /<slug>/<unit>/ pages with notes, sample questions and a CTA; add to sitemap.
  - Evidence: `sitemap 64 URLs`
- **SEO-2 — Add lastmod/dateModified and keep sitemap and llms.txt generated** (medium impact · effort S)
  - Why: No recrawl hints; llms.txt is hand-kept; some pages need an index decision.
  - Fix: Build a slug→git date map, emit lastmod and dateModified/educationalLevel, generate llms.txt from the registry, audit remaining pages for sitemap vs noindex.
  - Evidence: `src/worker.ts:384-400; public/llms.txt`
- **SEO-3 — Per-guide 1200x630 OG images and per-share cards** (medium impact · effort M)
  - Why: Every share shows a small square logo, lowering click-through.
  - Fix: Generate guide OG images at build and render share/challenge cards at the edge; use summary_large_image.
  - Evidence: `src/link-previews.ts:15,191-195`
- **SEO-6 — Finish Search Console setup** (medium impact · effort S · **Owner**)
  - Why: No query data to choose new guides and unit pages.
  - Fix: Enable the API, rotate the key, export top queries monthly.
  - Evidence: `docs/HANDOFF-2026-10-01.md:39`
### Security

- **SEC-6 — Add Turnstile or a honeypot to anonymous upload and feedback forms, and batch admin emails** (medium impact · effort M · **Owner**)
  - Why: Public forms are protected only by an IP counter with a shared 'unknown' bucket; each spam submission emails every admin from the login@ address, risking the domain reputation magic links rely on.
  - Fix: Verify a Turnstile token server-side, add a honeypot and min fill time, require sign-in for attachments, send a batched digest from a notifications@ address, and validate the feedback 'page' field as a same-site path.
  - Evidence: `src/guide-requests.ts:58-60,137-147; src/feedback.ts:30-32,45,75-85; src/auth.ts:164`
- **SEC-7 — Tighten CSP and pin MathJax with SRI** (medium impact · effort M)
  - Why: script-src allows unsafe-inline, unsafe-eval and all of cdn.jsdelivr.net; MathJax loads from the floating mathjax@3 tag with no integrity hash.
  - Fix: Self-host or pin mathjax@3.2.2 with integrity, restrict jsDelivr to that path, use nonce CSP for /admin and /settings, add report-to; drop unsafe-inline once inline handlers are gone.
  - Evidence: `src/worker.ts:207-234; scripts/guide-template/head.html:43`
- **SEC-8 — Harden OAuth: email_verified, PKCE and admin restrictions, with success-path tests** (medium impact · effort M)
  - Why: Google login never checks email_verified, stores no provider sub and uses no PKCE; admin rights come from any provider's email claim including magic links. Successful callbacks are untested.
  - Fix: Require email_verified, add PKCE S256, restrict admin to Google sessions with shorter max-age, and add mocked-fetch callback tests for Google and GitHub success and failure paths.
  - Evidence: `src/auth-routes.ts:89-137,188-205; src/admin-routes.ts:10-20; test/auth-routes.test.js:169-271`
- **SEC-9 — Escape '<' and line separators in all inline JSON data** (medium impact · effort S)
  - Why: Guide data goes into a classic <script> via bare JSON.stringify; a '</script' or '<!--<script' in content would break the page (ap-csa already ships '<!--'). JSON-LD and SS_GUIDE are escaped, others are not.
  - Fix: Define js() to also replace < with < and U+2028/2029, use it everywhere, validate slug/masteryKey as /^[a-z0-9-]+$/, and add a test counting </script tags.
  - Evidence: `scripts/generate-guide.mjs:39,233,259,346-428`
- **SEC-11 — Restrict Canvas domain and add timeouts to every outbound fetch** (medium impact · effort S)
  - Why: The Worker sends the user's Canvas bearer token to any host entered, and no outbound fetch has a timeout, so a slow host stalls requests; Canvas is re-fetched live on every dashboard load.
  - Fix: Allowlist *.instructure.com (or opt-in) with redirect:'manual', add a fetchWithTimeout helper (AbortSignal.timeout(8000)) used everywhere, and cache Canvas results ~15 min.
  - Evidence: `src/canvas-routes.ts:17,49-51; src/canvas-sync.ts:29; src/google-routes.ts:47-54; rg AbortSignal src = 0`
### Testing & CI

- **TEST-3 — Fix CI file hygiene and harden the workflow** (medium impact · effort S · **Owner**)
  - Why: .github/workflows is gitignored; a 1-byte root ci.yml exists; no concurrency/timeout, actions unpinned, no Dependabot/Renovate, 7 known vulns, Node versions differ, compatibility date stale.
  - Fix: Un-ignore workflows, delete root ci.yml, add dependabot, pin action SHAs, concurrency and timeout, npm audit step, .nvmrc and engines, quarterly compatibility_date bumps.
  - Evidence: `.gitignore:8; ci.yml; .github/workflows/ci.yml:11-14`
- **TEST-6 — Fill unit-test gaps (shuffle/grading, auth email, reset, crypto fixture, cron dispatcher, uploads, shared modules)** (medium impact · effort M)
  - Why: Quiz shuffling, which hides heavily skewed answer keys, is untested, as are magic-link success paths, progress reset, token-crypto salt, cron routing, magic bytes, unit-order/error-monitor/sw.js and runtime onclick names.
  - Fix: Add the listed tests, derive subject fixtures from SUBJECTS, freeze clocks, share test helpers, add coverage with a ratchet floor, build client via a shared script used by tests.
  - Evidence: `client/guide-app.js:21,224,1596; src/progress-routes.ts:494-505; src/token-crypto.ts:9-14; test/`
- **TEST-7 — Add concurrency tests and a post-deploy smoke check** (medium impact · effort S)
  - Why: No test interleaves requests where the real bugs are; nothing checks production after deploy.
  - Fix: Promise.all tests against one miniflare KV key; scripts/smoke.mjs as postdeploy and scheduled checking status codes, headers and ?v hashes.
  - Evidence: `test/progress-routes.test.js; package.json (no postdeploy)`

## P3 later

### Accessibility

- **A11Y-21 — Honor reduced motion on the homepage and keep streak feedback** (low impact · effort S)
  - Why: Hero and section reveal animations ignore prefers-reduced-motion; reduced-motion users get no streak message at all.
  - Fix: Disable .ss-hero-anim/.ss-reveal animations under reduce; always show the streak message, skip only confetti.
  - Evidence: `public/index.html:171-172,238-239; public/shared/celebrate.js:82-90`
- **A11Y-26 — Small a11y fixes: heatmap text alternative, category pill links, decorative SVGs, auto-advance, touch targets, syllabus dropzone** (low impact · effort S)
  - Why: Heatmap is color-only; pills fake aria-pressed and don't move focus; decorative SVGs lack aria-hidden; 'Type it' auto-advances; several targets are under 24-44px; the dropzone nests a button in a label.
  - Fix: Add role=img summary and legend labels, make pills anchor links that focus headings, add aria-hidden to SVGs, wait for Enter after wrong answers, enlarge hit areas under pointer:coarse, move Remove out of the label and use aria-pressed toggles.
  - Evidence: `public/dashboard/index.html:1849-1862; public/index.html:518-528,1290-1307; client/guide-app.js:994; scripts/guide-template/style.css:112,151,340-376; public/syllabus/index.html:136-151`
### Backend

- **BE-25 — Make leaderboard handles unique** (low impact · effort S)
  - Why: 36,000 combinations collide around ~224 users.
  - Fix: Reserve handles in KV with retry or add a hash suffix.
  - Evidence: `src/leaderboard-routes.ts:16-24,126`
### Code health

- **CODE-4 — Replace the copy-pasted route blocks with a route table** (low impact · effort S)
  - Why: 53 near-identical if blocks, no Allow header on 405, inconsistent status codes.
  - Fix: One ROUTES table generating 405 with Allow, 401 vs 403 used consistently.
  - Evidence: `src/worker.ts:406-701`
- **CODE-12 — Update stale docs and duplicate agent files** (low impact · effort S)
  - Why: README says no build step and 11 subjects; handoff says 55 guides; AGENTS.md and .agents/skills duplicate CLAUDE files; old studystacks names linger.
  - Fix: Rewrite README, archive old plans, symlink AGENTS.md, remove studystacks CORS origins and UA.
  - Evidence: `README.md; docs/HANDOFF-2026-10-01.md; src/chat.ts:155-160`
- **CODE-13 — Make regen-guides robust and deterministic** (low impact · effort S)
  - Why: Crashes outside repo root, leaves orphaned pages, meta descriptions exceed 160 chars, homepage and guide question counts differ.
  - Fix: Resolve paths from import.meta.url, report orphans, cap descriptions, compute counts once in a shared helper, take any dates from git not new Date().
  - Evidence: `scripts/regen-guides.mjs:18-23; scripts/generate-guide.mjs:196-202; scripts/sync-home-counts.mjs:22`
### Design

- **GUIDE-27 — Define --accent-bright on guide pages** (low impact · effort S)
  - Why: The search-hit ring and drag-drop indicator use an undefined variable outside high-contrast mode, so they never draw.
  - Fix: Define it in guide-polish.css light and dark blocks or use --accent.
  - Evidence: `public/shared/guide-polish.css:481-501`
### Growth

- **GROW-8 — Redirect common URL guesses and suggest matches on 404** (low impact · effort S)
  - Why: /ap-bio, /algebra-2, /spanish etc. 404 with no help.
  - Fix: Alias map with 301s; Levenshtein 'Did you mean' plus search on 404.
  - Evidence: `public/404.html:30-36`
### Guide UX

- **GUIDE-22 — Write free-response answers before revealing the model, then self-score** (low impact · effort M)
  - Why: 364 FR items only show a reveal button, so FRQ practice becomes reading.
  - Fix: Add a saved textarea, enable reveal after 20 chars, and add a 0/1/2 self-score that feeds exam stats.
  - Evidence: `client/guide-app.js:139-145,217-222`
- **GUIDE-23 — Make unit progress reflect recent performance and use one mastery threshold** (low impact · effort M)
  - Why: Lifetime accuracy and 'ever known' cards hide improvement and forgetting; overall bar counts attempts not unique questions; thresholds are 90/80 in different places.
  - Fix: Use recent-window accuracy, count only non-overdue known cards, track unique qIds, one MASTERY_THRESHOLD, and a badge tooltip.
  - Evidence: `client/guide-app.js:1317-1365; client/personality.js:138,235`
- **GUIDE-24 — Keep tabs and the study timer reachable while reading** (low impact · effort M)
  - Why: Tabs and timer scroll away; focus mode hides the timer and concept bar; Pomodoro resets on reload.
  - Fix: Put a compact tab select and timer in the sticky header, mirror the countdown in document.title, persist timer in sessionStorage, keep them in focus mode.
  - Evidence: `client/guide-app.js:2177-2254; scripts/guide-template/style.css:60`
- **GUIDE-26 — Give bookmarks a view and sync bookmarks and the Mistake Log** (low impact · effort S)
  - Why: Bookmarks are never shown anywhere; both lists are browser-only; Mistake Log review shows stale session stats.
  - Fix: Add 'Bookmarked (n)' and 'Mistakes (n)' quiz sets, store both in synced mastery, reset stats in openMistakeLog.
  - Evidence: `client/guide-app.js:1225-1289,1521`
- **GUIDE-28 — Fix worked examples losing revealed steps and make 'Got it' reversible** (low impact · effort S)
  - Why: A late mastery rebuild wipes revealed steps without resetting the counter; 'Got it' works before any step and can't be undone.
  - Fix: Toggle classes instead of re-rendering (or reset ex2shown), make Got it an aria-pressed toggle requiring a revealed step.
  - Evidence: `client/guide-app.js:1153-1195,1220`
- **GUIDE-30 — Base 'Exam Ready' on accuracy and done work, not sliders only** (low impact · effort S)
  - Why: The plan card calls a student 'Exam Ready' from time sliders alone; the .ics plan ignores weak units.
  - Fix: Subtract attempted questions, weight toward weak units, rename tiers to coverage terms, order .ics weakest first.
  - Evidence: `client/guide-app.js:1750-1835`
- **GUIDE-31 — Show the graphing calculator only on math and science guides** (low impact · effort S)
  - Why: Desmos is offered on language and history guides.
  - Fix: Add a guide flag and show it only where relevant.
  - Evidence: `client/guide-app.js:2552-2554`
### Ops

- **OPS-3 — Purge edge cache on deploy and disable workers.dev** (low impact · effort S · **Owner**)
  - Why: Edge HTML may lag deploys; workers.dev exposes production outside zone rules.
  - Fix: Postdeploy purge_cache call; set workers_dev:false.
  - Evidence: `wrangler.jsonc; curl cf-cache-status HIT`
- **OPS-4 — Decide on the Cloudflare Web Analytics beacon** (low impact · effort S · **Owner**)
  - Why: 10 KB per page and undisclosed in the privacy policy.
  - Fix: Turn it off if first-party events cover needs, otherwise disclose it.
  - Evidence: `docs/HANDOFF-2026-10-01.md item 5`
### Performance

- **PERF-14 — Small loading wins: personality.js only on guides, inline fun facts, hidden logo, image srcset, long cache for images** (low impact · effort S)
  - Why: Non-guide pages download personality.js; all subjects' facts load late; a hidden logo image downloads; preview images are 1896px; images and manifest revalidate each view.
  - Fix: Inject personality.js only for subject paths, embed this guide's facts, remove kicker-logo img and theme-swapped logo pairs, add srcset/picture, add stale-while-revalidate caching for images and manifest.
  - Evidence: `src/worker.ts:165; client/personality.js:121-135; scripts/guide-template/hero.html:14; public/index.html:1012-1018; public/_headers`
- **PERF-19 — Small render cost cleanups (MutationObserver, owl filters, body transition, mobile overlay)** (low impact · effort S)
  - Why: personality observers re-paint on every #units mutation; 8 turbulence-filtered owls render on the dashboard; body color transition flashes.
  - Fix: Observe only progress labels with rAF, skip filters on small owls, remove the global transition.
  - Evidence: `client/personality.js:164,226-238; public/shared/owl.js:127-130; scripts/guide-template/style.css:30`
### Privacy

- **PRIV-9 — Strip query strings and PII from client-log URLs and messages** (low impact · effort S)
  - Why: Logged URLs and error text can contain tokens or user text.
  - Fix: Log only origin+pathname, redact token-like strings, set Workers Logs retention, and sample vitals (~10%) with head_sampling_rate and a cpu_ms limit.
  - Evidence: `src/client-log-routes.ts:72-98; wrangler.jsonc observability`
- **PRIV-10 — Make cookie consent available site-wide with equal Accept/Decline weight** (low impact · effort S)
  - Why: The 'Cookie preferences' link exists only on the homepage; Accept is a solid button and Decline a ghost button; the banner sits at the end of tab order and covers footer links.
  - Fix: Load banner and preferences link from a shared script on every ad page, style both buttons identically, make it a labelled region near the top of tab order, pad body while shown, and fix the invalid font shorthand.
  - Evidence: `public/index.html:287-293,1087-1093; public/privacy/index.html:141`
- **PRIV-12 — Explain Canvas token scope and recommend an expiry** (low impact · effort S)
  - Why: Students are told to create a full-access non-expiring token without knowing what it grants.
  - Fix: Add a short note on scope, recommend an expiry date, and show connectedAt in the connected state.
  - Evidence: `public/settings/index.html:396`
### Product features

- **FEAT-10 — Small polish: owl theming, unused exports, print colors, branding assets** (low impact · effort S)
  - Why: Owl colors ignore theme; getCombo unused and AudioContext never closed; print turns success/danger black; branding folder has no canonical logo or spec.
  - Fix: Use CSS vars in owl, delete getCombo and suspend audio, keep print-safe semantic colors with icons, add logo.svg and brand.md.
  - Evidence: `public/shared/owl.js:9-25; public/shared/celebrate.js:13-29,99-101; scripts/guide-template/style.css:632-640; branding/`
### SEO

- **SEO-5 — Polish titles, structured data and duplicate view URLs** (low impact · effort S)
  - Why: Generic titles, no Course/Quiz markup, 'Who Are We' About title, /:slug/:view/ duplicates.
  - Fix: Richer titles within 60 chars, Course and Quiz JSON-LD, rename About, 301 trailing-slash view URLs.
  - Evidence: `curl titles; /biology/quiz/ 200`
### Security

- **SEC-10 — Add no-store and isolation headers; clear local data on logout** (low impact · effort S)
  - Why: Authenticated JSON responses have no Cache-Control; COOP/CORP are missing; local progress and SW cache survive logout on shared school devices.
  - Fix: Send Cache-Control: private, no-store on /api and /auth, add Cross-Origin-Opener-Policy: same-origin, and clear ssMastery_* keys and caches on logout.
  - Evidence: `curl /auth/me (no cache-control); public/dashboard/index.html:459-463`
- **SEC-12 — Escape CR and fold lines in ICS output; validate syllabus subjects** (low impact · effort S)
  - Why: icsEscape leaves bare \r and doesn't fold; the syllabus .ics download escapes nothing and uses index-based UIDs; an unchecked syllabus subject can become a protocol-relative link.
  - Fix: Use one shared ICS escape+fold helper for server and client, hash-based UIDs, check subject against SUBJECTS, sort and prune syllabus dates.
  - Evidence: `src/progress-routes.ts:622-624; src/syllabus-dates.ts:42-44,84-105; public/syllabus/index.html:612-615`
- **SEC-13 — Stop returning raw AI provider errors to the client** (low impact · effort S)
  - Why: Chat returns up to 300 chars of the provider error, which can leak prompt or config details.
  - Fix: Log with logError and return a generic message.
  - Evidence: `src/chat.ts:209-211`
- **SEC-14 — Document or close KV consistency gaps in session revoke and magic-link consumption** (low impact · effort M)
  - Why: Sign-out-everywhere can take ~60 s to apply at other PoPs; a magic link can be consumed twice within the propagation window.
  - Fix: Document the window, or move session versions and single-use tokens to a Durable Object or D1.
  - Evidence: `src/auth.ts:56-61,134-137,178-191`

