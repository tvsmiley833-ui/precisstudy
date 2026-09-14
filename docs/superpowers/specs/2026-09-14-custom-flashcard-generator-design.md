# Custom flashcard generator

## Purpose

Every flashcard set in the app today is hand-authored per guide (the
`FLASHCARDS` array baked into each generated guide page). Students studying
from their own class notes, a handout, or a topic their guide doesn't cover
have no way to get flashcards out of that material. This adds an AI-assisted
generator: paste text in, get a deck of front/back cards out, study it with a
flip-card UI, keep it saved across visits.

## Scope decisions (made directly, per this session's "don't stop to ask" instruction)

- **Standalone feature, not woven into the existing per-guide `FLASHCARDS`
  system.** That system is 400+ lines of shared template logic (`logic.js`)
  built around a compile-time array baked into every guide page at generate
  time. Bolting a user-generated, runtime-variable deck onto it would mean
  either duplicating that rendering logic or entangling static guide content
  with dynamic per-user data. A small standalone page with its own minimal
  flip-card renderer is simpler and keeps the two systems independent
  (YAGNI: no user need was identified for cross-linking a custom deck into a
  specific guide unit).
- **Server-side generation, authenticated.** Reuses the existing Workers AI
  binding (`env.AI`, same one `chat.ts` uses) rather than shipping a second
  API key path. Authenticated (unlike the public chat endpoint) because each
  generation is billed AI usage and decks are saved per-account — no reason
  to allow it signed-out.
- **Decks stored in the existing progress blob**, not a new KV namespace.
  One more array field, consistent with how `history`, `shareToken`, etc.
  already live there; avoids a second storage system for what's a small
  amount of data per student.

## Data model

New field on `ProgressBlob`:

```ts
customDecks?: {
  id: string;           // random token, same randomToken() already used for share links
  name: string;          // from the deck's first generation prompt, truncated
  cards: { front: string; back: string }[];
  createdAt: string;
}[];
```

Capped at 20 decks per student, 40 cards per deck (matches the kind of size a
paste-your-notes session produces; stops one student's decks from growing the
KV blob unboundedly).

## Backend

**`POST /api/flashcards/generate`** — authenticated, body `{ text: string }`.

- `text` capped at 6000 chars (same order of magnitude as the chat rate
  limiter's per-message cap, generous enough for a few pages of notes).
- Prompts the model (same `MODEL` constant from `chat.ts`) with a system
  prompt instructing it to output *only* a JSON array of
  `{ "front": "...", "back": "..." }` objects, 5-20 cards, no prose.
- Parses the model's response as JSON; on parse failure or a non-array
  result, returns `502` ("Couldn't generate flashcards from that text — try
  again or shorten it.") rather than surfacing raw model output.
- Validates each parsed card has non-empty string `front`/`back`, trims to
  300 chars each, drops malformed entries, caps at 20 cards.
- Returns `{ cards: [...] }` — does **not** save automatically. Saving is a
  separate explicit action (below), so a student can preview/regenerate
  before committing a deck.

**`POST /api/flashcards/save`** — authenticated, body
`{ name: string, cards: { front: string; back: string }[] }`. Validates
shape (same per-card limits as generate), assigns a random id, appends to
`blob.customDecks` (evicting the oldest deck past the 20-deck cap, same
pattern as `recordDailySnapshots`'s history cap), persists.

**`POST /api/flashcards/delete`** — authenticated, body `{ id: string }`.
Removes the matching deck.

**`GET /api/progress`** already returns the full blob, so decks list for
free — no new read endpoint needed.

## Frontend

New page `public/flashcards/index.html`, linked from the dashboard (a new
"My Flashcards" card, styled like existing dashboard cards). Two states:

1. **List view** (default): every saved deck as a row (name, card count,
   "Study" / "Delete"). A "Generate new deck" button reveals the textarea.
2. **Generate view**: textarea for pasted notes, "Generate" button (disabled
   while in flight, same disable-during-fetch pattern used throughout
   Settings), then a preview of the returned cards with per-card edit
   (plain text, no rich editor — YAGNI) and delete, a name field
   (pre-filled, editable), and "Save deck" / "Discard".
3. **Study view**: same flip-card interaction already familiar from guide
   pages (click/tap to flip, next/prev), reimplemented minimally for this
   page rather than importing `logic.js` (that file assumes the guide
   page's full DOM/state, e.g. `CHEM_MASTERY`, `UNITS` — not a fit for a
   standalone page). No mastery tracking for custom decks (out of scope --
   `cardsKnown` mastery is guide-content-specific groundwork, not present
   in this design).

## Testing

- `flashcards-routes.test.js` (new): generate — 401 no session, empty text
  rejected, malformed/non-JSON model output returns 502, valid model output
  parsed and capped/trimmed correctly (mock `env.AI.run`). save — 401 no
  session, validates card shape, appends without clobbering existing decks,
  evicts oldest past the 20-deck cap. delete — 401 no session, removes the
  matching deck, no-ops on an unknown id (200, not 404 -- idempotent delete
  matches the existing share-revoke precedent, which also 200s revoking an
  already-revoked link).

## Non-goals

- No editing an existing saved deck's cards after save (delete and
  regenerate instead) — keeps save/delete surface small.
- No mastery/spaced-repetition tracking for custom decks.
- No sharing a custom deck (the "Share your progress" link is unrelated —
  that shares mastery stats, not flashcard content).
