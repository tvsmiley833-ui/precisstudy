# Multi-LMS support

## Purpose

The assignment feed only ever pulls from Google (Classroom + Calendar). Many
schools run Canvas instead of (or alongside) Google Classroom. This adds
Canvas as a second, independent LMS source, merged into the same feed the
dashboard already renders -- "multi-LMS" meaning the feed becomes
source-agnostic rather than hard-wired to Google.

## Scope decisions (made directly, per this session's "don't stop to ask" instruction, and the user's explicit "multi-LMS last" ordering)

- **Canvas, via personal API token, not OAuth.** Canvas doesn't have a
  universal OAuth app registration the way Google does -- every school runs
  its own Canvas instance at its own domain, so a "Canvas OAuth app" would
  need per-institution developer key registration, which isn't something
  this app can set up generically. Canvas natively supports personal access
  tokens (a student generates one from their own Canvas Account ->
  Settings -> "+ New Access Token", pastes it in) -- this is Canvas's own
  documented integration path for exactly this situation, and needs no app
  secrets on PrecisStudy's side at all.
- **One more provider, not an N-provider plugin system.** Building a formal
  "LMS provider" interface/registry for a hypothetical third and fourth LMS
  is premature abstraction with a sample size of two. Canvas is added the
  same shape Google already uses (its own sync module, its own token
  storage, merged at the point `handleAssignments` already combines
  sources) -- if a third LMS shows up later, that's when the shared
  interface earns its keep.
- **Read-only, matching Google's Classroom side.** No Canvas write-back
  (Canvas has no calendar-push equivalent need here -- Canvas assignments
  already live in the school's system of record; PrecisStudy pulling them
  in is the whole value).
- **No submission/grade state for Canvas items** (`state` is always
  `"todo"`). Fetching per-assignment submission status would mean an extra
  API call per assignment (Canvas's upcoming-events endpoint doesn't
  include it), multiplying request count for a nice-to-have the Classroom
  side has mainly because Classroom's submissions endpoint happens to be a
  single bulk call per course. Flagged as a non-goal rather than silently
  shipped as "done" when it isn't full parity.
- **Token-encryption helper extracted, not duplicated.** `google-token.ts`'s
  `encryptTokenRecord`/`decryptTokenRecord` already contain no
  Google-specific logic (they just JSON-serialize whatever record they're
  given) -- generalizing them into a shared `token-crypto.ts` used by both
  `google-token.ts` and the new `canvas-token.ts` is a safe, low-risk
  extraction (pure functions, existing Google token tests keep covering the
  shared code), unlike the OAuth-refresh duplication decision made for
  calendar-push (that code has actual per-provider logic and real risk of
  a subtle behavioral change from touching tested code under time
  pressure).

## Data model

New `src/canvas-token.ts`, mirroring `google-token.ts`'s shape:

```ts
export interface CanvasTokenRecord {
  domain: string;      // e.g. "school.instructure.com" -- validated: no protocol, no path
  apiToken: string;     // the student's Canvas personal access token
  connectedAt: string;  // ISO 8601
}
```

Stored encrypted at `canvastok:<email>` the same way Google's refresh token
is stored at `gtok:<email>` -- same AES-GCM-via-HKDF(SESSION_SECRET) scheme,
via the shared `token-crypto.ts` extraction.

`Assignment.source` (`google-sync.ts`) widens from `"classroom" | "calendar"`
to `"classroom" | "calendar" | "canvas"`.

## Backend

**`src/canvas-sync.ts`**:

```ts
export async function syncCanvasAssignments(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string
): Promise<{ connected: boolean; items: Assignment[] }>
```

- Loads the token record; not connected -> `{ connected: false, items: [] }`.
- `GET https://{domain}/api/v1/users/self/upcoming_events` (Canvas's own
  "what's due soon" endpoint -- a single call, no per-course enumeration
  needed, the same shape of convenience Classroom's bulk submissions call
  gives the Google side) with `Authorization: Bearer {apiToken}`.
- A non-2xx (bad token, wrong domain, network error) -> caught, returns
  `{ connected: true, items: [] }` (connected because a token is stored;
  empty because this fetch attempt failed) -- mirrors `staleOrEmpty`'s
  fail-soft shape on the Google side, but without a persistent cache layer
  (Canvas's endpoint is cheap enough -- one call, no fan-out -- that this
  session skips adding a second KV cache; see Non-goals).
- Filters response items to ones that have `due_at` set (calendar-only
  entries with no assignment are dropped -- this feed is about
  assignments, matching what Classroom already provides), maps to
  `Assignment`: `id` = `"canvas-" + item.id`, `source: "canvas"`,
  `title: item.title`, `courseName: null` (see scope decision above --
  no extra call to resolve `context_name`), `dueAt: item.due_at`,
  `allDay: false`, `link: item.html_url || null`, `state: "todo"`.

**`src/canvas-routes.ts`**, mirroring `google-connect.ts` + the settings
half of `google-routes.ts`:

- `POST /api/canvas/connect` — authenticated, body `{ domain, apiToken }`.
  Validates `domain` (hostname-shaped, no `http(s)://` prefix, no path,
  reasonable length) and `apiToken` (non-empty, capped length). Does one
  live call (`GET /api/v1/users/self`) to confirm the token actually works
  against that domain before saving -- storing an unverified token that
  silently fails every sync afterward would be a worse experience than one
  extra round-trip at connect time. `401`/`403`/network failure from that
  probe -> `400 { error: "Couldn't verify that Canvas domain and token — check both and try again." }`.
- `POST /api/canvas/disconnect` — authenticated, deletes the stored token.
- `GET /api/canvas/status` — authenticated, `{ connected: boolean, domain: string | null }` (never returns the token itself).

**`handleAssignments`** (`google-routes.ts`): after computing the existing
Google-sourced `feed`, also calls `syncCanvasAssignments` and concatenates
its `items` into the response before the existing `sortItems`-equivalent
ordering (dedup isn't needed -- Google and Canvas assignment ids are
namespaced differently and nothing currently tries to correlate the same
real-world assignment across two systems). `connected` in the top-level
response reflects Google's connection state as it already does (unchanged)
-- Canvas's own connected state is exposed separately via
`GET /api/canvas/status` for Settings to show, not folded into the same
boolean two unrelated systems would otherwise have to share.

## Frontend

Settings gets a new "Canvas" card, next to "Connected accounts" (Google),
same visual language:

```html
<div class="ss-card" id="canvas-card">
  <div>Canvas</div>
  <p>Connect Canvas to pull your assignments into the same list.</p>
  <div id="canvas-disconnected">
    <input id="canvas-domain" placeholder="yourschool.instructure.com"/>
    <input id="canvas-token" type="password" placeholder="Canvas access token"/>
    <button id="canvas-connect-btn">Connect</button>
    <p>Generate a token from Canvas: Account → Settings → "+ New Access Token".</p>
  </div>
  <div id="canvas-connected" style="display:none;">
    Connected to <b id="canvas-domain-label"></b>
    <button id="canvas-disconnect-btn">Disconnect</button>
  </div>
</div>
```

Wired the same connect/disconnect/status-check pattern already established
by the Google card, adapted for a form submit instead of an OAuth redirect.

## Testing

- `canvas-token.test.js` (new, small): round-trips a record through
  encrypt/decrypt via the shared `token-crypto.ts`; wrong `SESSION_SECRET`
  fails to decrypt (same invariant `google-token.test.js` already checks
  for Google's tokens, now backed by shared code).
- `canvas-sync.test.js` (new): not connected -> `{connected:false,items:[]}`,
  no fetch. Connected + good response -> items mapped correctly, entries
  without `due_at` dropped. Connected + API failure -> `{connected:true,
  items:[]}`, doesn't throw.
- `canvas-routes.test.js` (new): connect -- 401 no session, rejects a
  malformed domain (has `https://`, has a path, empty), rejects an empty
  token, the verification probe failing returns 400 without storing
  anything, success stores the token and a re-fetch of status reflects it.
  disconnect -- 401 no session, removes the token, idempotent on
  not-connected. status -- 401 no session, correct shape connected/not.
- `google-routes.test.js`: `handleAssignments` gets one new case --
  Canvas connected with an assignment due -> the returned `items` includes
  both the Google-sourced entries (existing test fixtures) and the
  Canvas-sourced one, `source: "canvas"`.

## Non-goals

- No Canvas submission/grade state (see Scope decisions).
- No Canvas calendar push-back (schedule -> Canvas) -- Canvas is a read
  source only in this design.
- No caching layer for Canvas the way Google's `googleCacheKey` KV cache
  exists -- Canvas's one-call upcoming-events fetch is cheap enough that
  this session doesn't add a second cache subsystem; if Canvas API rate
  limits become a real problem later, that's the trigger to add one, not
  a guess now.
- No generic multi-provider plugin interface (see Scope decisions).
