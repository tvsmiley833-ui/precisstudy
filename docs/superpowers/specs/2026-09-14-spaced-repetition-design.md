# Spaced repetition (SM-2) for custom flashcards

## Purpose

Custom decks (public/flashcards/index.html) currently cycle front-to-back
with no scheduling — the same 20 cards get equal attention whether a
student aced them last time or missed them. SM-2 fixes that: cards a
student knows well drift to longer review intervals, cards they miss come
back sooner.

## Scope decision

SM-2 lands on **custom decks only**, not the guide-template flashcards
(the `cardsKnown` binary list shared by all 55 generated guide pages, via
`public/shared/mastery.js`). Reasons:

- Custom decks are self-contained (one deck's data model, one page, one
  route file) — this session already owns that surface end-to-end.
- The guide template's `cardsKnown` is a boolean used by several other
  features (readiness %, mastery heatmap, XP/leveling) — replacing or
  extending it with real scheduling data is a bigger, riskier migration
  across 55 pages and multiple dependent systems, better scoped as its own
  follow-up if wanted.

## Algorithm

Standard SM-2 (SuperMemo 2), per-card state:

```ts
{ ease: number; interval: number; reps: number; due: string /* ISO date */ }
```

Defaults for a card with no SRS state yet: `ease: 2.5, interval: 0, reps: 0`
(treated as due immediately).

Rating maps to SM-2 quality on a 4-button scale (simpler than SM-2's
original 0-5, matches Anki's convention students are more likely to
recognize):

- **Again** (quality 0): reps=0, interval=1 day, ease unchanged floor 1.3
- **Hard** (quality 3): interval *= 1.2 (min 1 day), ease -= 0.15 (floor 1.3)
- **Good** (quality 4): reps 0→1 day, 1→6 days, 2+→interval*ease; ease
  unchanged
- **Easy** (quality 5): same interval progression as Good but interval*1.3
  extra, ease += 0.15

`due` = today + interval days.

## Data model

`Flashcard` gains optional SRS fields (absent = never reviewed, due now):

```ts
{ front: string; back: string; ease?: number; interval?: number; reps?: number; due?: string }
```

## Backend

**`POST /api/flashcards/review`** — authenticated, body
`{ deckId: string; cardIndex: number; rating: "again"|"hard"|"good"|"easy" }`.
Loads the deck, applies `sm2(card, rating)` to the card at `cardIndex`,
saves. Returns the updated card's new `due`/`interval` (frontend doesn't
need it, but useful for the response to not be empty).

`sm2()` is a pure function (`{ease,interval,reps}, rating) => {ease,interval,reps,due}`),
unit-tested directly without going through the HTTP layer.

## Frontend

Study view changes from Previous/Next to a due-cards queue:

1. On entering study mode, filter the deck to cards where `!due || due <= today`.
2. If none due, show "All caught up — next card due <date>" instead of the
   flip card.
3. Flip card unchanged (front/back, same keyboard pattern).
4. After flipping, four rating buttons replace Previous/Next: Again / Hard
   / Good / Easy. Clicking one POSTs the review, removes that card from
   the current queue, advances to the next due card (or the "caught up"
   state).

## Testing

- `sm2()` pure-function tests: quality-0 resets reps/interval; the
  0/1/2+ rep progression for Good; ease floor at 1.3; Easy's extra
  interval bump.
- `POST /api/flashcards/review`: 401 no session, 404 unknown deck/card
  index, updates the right card without touching sibling cards, persists.

## Non-goals

- No change to guide-template `cardsKnown` flashcards (see Scope decision).
- No "bury" / "suspend card" / custom interval editing — out of scope for
  a first pass.
