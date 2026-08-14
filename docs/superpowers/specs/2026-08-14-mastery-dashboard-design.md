# Mastery Dashboard System — Design Spec

**Date:** 2026-08-14
**Status:** Approved, ready for implementation

## Problem

All three independent AI reviews of StudyStacks converged on the same core critique:
progress tracking measures *completion* ("you answered 280 questions") rather than
*mastery* ("you know Circle Geometry but not Similarity"). The site has strong content
but no system that tells a student what to study next.

Investigation found that Geometry already has a working per-unit mastery calculation
(`GEO_STORE.mastery[unitId] = {correct, total}`, color-coded red/amber/green), but it's
localStorage-only (doesn't follow a logged-in student across devices), lives only inside
the Geometry page (no cross-subject view), and Chemistry has no equivalent at all — its
quiz only keeps an in-memory score that resets on reload.

## Goals

- Progress follows the student's account across devices (server-side sync via KV).
- A dedicated `/dashboard` page shows exam readiness and weak spots across both subjects.
- A concrete "study this next" recommendation, not just a data dump.
- Chemistry gets real per-unit mastery tracking for the first time.
- Both subjects share one mastery-tracking module instead of two copies (Chemistry was
  going to need this logic built from scratch anyway; future subjects inherit it free).

## Non-goals (explicitly out of scope for this pass)

- Adaptive question difficulty, spaced repetition, or ML-based weakness prediction.
- Teacher accounts/dashboards.
- Any change to how quiz *questions* are authored or stored — only how *answers* are tracked.

## Data model

New KV namespace `PROGRESS`, key `progress:<email>` (email is the stable identity across
Google/GitHub — same student regardless of which provider they used to sign in).

```json
{
  "geometry": {
    "mastery": { "1": {"correct": 3, "total": 4}, "2": {"correct": 1, "total": 2} },
    "examples": { "1": true, "5": true },
    "cardsKnown": ["card-id-1", "card-id-7"]
  },
  "chemistry": { "mastery": {}, "examples": {}, "cardsKnown": [] },
  "updatedAt": "2026-08-14T00:00:00.000Z"
}
```

This is the same shape Geometry's `GEO_STORE` already uses per subject, just wrapped by
subject name and moved server-side. No new format to design from scratch.

## Backend routes (`src/progress-routes.js`)

- `GET /api/progress` — requires session (reuse existing `getSession()` from `auth.js`).
  Returns the caller's blob, or an empty default shape if they have none yet.
- `POST /api/progress` — requires session. Body: `{subject, mastery, examples, cardsKnown}`
  for **one subject at a time**. Read-modify-write: fetch existing blob, replace that
  subject's section, bump `updatedAt`, save. Whole-subject upsert, not per-field deltas —
  matches the debounced "push current state" sync strategy below and keeps the route simple.

## Client-side: shared sync module

New shared file, `public/shared/mastery.js`, loaded by both Geometry and Chemistry pages
(Geometry migrates its existing `GEO_STORE` logic into this shared module instead of
keeping its own copy; Chemistry adopts it for the first time).

Responsibilities:
- Track correct/total per unit, examples done, and known flashcards — same logic Geometry
  already has, now shared.
- Keep writing to `localStorage` instantly on every action (zero latency, works offline,
  unchanged behavior from today).
- On page load, if logged in, fetch `GET /api/progress` and merge the server copy in, so a
  student switching devices sees real progress immediately.
- In the background, push the current subject's state to `POST /api/progress` on a short
  debounce (roughly every 10s of activity) *and* on `visibilitychange`/`beforeunload`, so
  closing the tab doesn't lose the last few answers.

**Why debounced push instead of sync-per-answer:** Cloudflare KV has a soft rate limit
around 1 write/sec per key and each write has propagation latency — syncing on every
single quiz answer risks hitting that limit during normal quiz pace and burns Worker
invocations on a free-tier project for no real benefit. A full manual-only "Sync now"
button was considered and rejected because it defeats the actual goal (progress silently
not following the student unless they remember to click something).

## Unit-filtered practice

Quiz questions already carry a unit id internally (used by the existing mastery
calculation). Add a practice mode that filters the question pool to one unit, triggered by
a URL param like `/geometry?practice=3`. This is what "study this next" links into from
the dashboard — recommending a weak unit is only useful if it goes straight to targeted
questions instead of the general pool.

## Exam readiness score & recommendation logic

**Per-unit "assessed" threshold:** a unit only counts toward the score once it has at
least 2 answered questions (matches the diagnostic's existing "2 questions per unit"
default, so taking the diagnostic alone is enough to seed every unit). Below that
threshold, the unit shows as "not yet assessed" (gray) rather than a misleading 0% or a
lucky-guess 100%.

**Subject readiness score:** average mastery % across *assessed* units only (equal weight
per unit, not per question), with an explicit caveat shown alongside it, e.g. "3 of 11
units not yet assessed" — the score should never silently imply full coverage it doesn't
have.

**"Study this next" — three-tier rule:**
1. Nothing assessed yet (diagnostic never taken) → recommend taking the diagnostic.
2. Otherwise → recommend the single weakest assessed unit ("Practice Circle Geometry —
   you're weakest here"), linking to unit-filtered practice for that unit.
3. All assessed units scoring ≥80% → nothing weak left to target; recommend flashcard
   review or the practice exam instead.

## Dashboard page (`/dashboard`)

New page, gated behind login using the same pattern as the existing Quiz-tab gate
(sign-in prompt if not logged in, real content if logged in). Shows both subjects: exam
readiness score, color-coded unit list (green ≥80% / amber ≥50% / red below / gray not
yet assessed), and the "study this next" recommendation card at the top.

## Error handling

- Not logged in → sign-in prompt (matches existing Quiz-tab gate UX).
- Logged in, zero progress yet → empty state pointing at the diagnostic.
- `GET /api/progress` fails → fall back to showing local (localStorage) progress with a
  small "couldn't sync — showing your last saved progress" note. Never block the page.
- Background `POST /api/progress` fails → retry quietly on the next debounce cycle; never
  interrupt studying with a visible error.
- Missing/corrupted KV blob on the server → treated as an empty default, not a crash.

## Testing

- Unit tests for `/api/progress` routes: auth required, valid/invalid body shapes, merge
  behavior (existing subject data preserved when posting a different subject).
- Unit tests for the readiness-score and recommendation logic as a pure function (given a
  mastery object, assert the expected score and recommended unit/action).
- Live browser verification for the dashboard UI and the unit-filtered quiz launch, plus a
  cross-device sync check (progress written in one session is visible via `GET
  /api/progress` independent of that browser's localStorage).
