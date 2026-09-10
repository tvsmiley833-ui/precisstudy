# Google Classroom + Calendar — Connect & Read Sync (sub-project 1)

**Status:** design approved (user: "go with what you recommend")
**Date:** 2026-09-10
**Branch target:** new branch off `main` (independent of `legacy-guide-migration`)

## Context

This is sub-project 1 of 4 in the "aggregate my assignments in one place" feature:

1. **Google connect + read sync** ← this spec
2. Unified assignment view UI (depends on 1)
3. Two-way sync — mark Classroom coursework done, create Calendar study blocks (depends on 1, 2)
4. Assignment-aware study nudges — map assignments → precisstudy guide+unit, recommend what to study (depends on 1; uses OmniRoute for the matching)

precisstudy is a Cloudflare Worker (`src/worker.ts`) serving static guide pages from `public/` plus a small JSON API. Auth is a signed session cookie (`src/auth.ts`), issued by magic-link, GitHub, or Google sign-in (`src/auth-routes.ts`). The only persistent store is Workers KV: `MAGIC_LINKS`, `GUIDE_REQUESTS`, `PROGRESS`. The existing Google sign-in (`handleGoogleStart`/`handleGoogleCallback`) requests only `openid email profile` and stores nothing — it is login-only.

## Goal

Let a signed-in precisstudy student connect their Google account (separately from how they signed in), grant read-only offline access to Google Classroom + Calendar, and expose their coursework and relevant calendar events as one normalized, cached JSON feed from an authenticated endpoint. Plus the Settings UI to connect/disconnect and pick calendars.

## Non-goals

- No background cron. Sync is on-demand only.
- No storage of assignment content beyond a short (~15 min) cache.
- No multi-account (one Google connection per precisstudy user).
- No teacher features (student scopes only).
- No write scopes, no AI, no recommendation logic (sub-projects 3 and 4).

## Architecture

### 1. Connect flow (new, separate from sign-in)

New routes in `src/worker.ts` route map:

| Route | Method | Handler |
|---|---|---|
| `/auth/google/connect/start` | GET | `handleGoogleConnectStart` |
| `/auth/google/connect/callback` | GET | `handleGoogleConnectCallback` |

Both live in a new file `src/google-connect.ts` (keeps `auth-routes.ts` focused on identity).

`handleGoogleConnectStart`:
- Require an existing precisstudy session (`getSession`); no session → redirect to `/settings` with an error flag.
- Require `env.GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET`; missing → 503 `notConfigured`.
- Build the Google consent URL with:
  - `redirect_uri = SITE_ORIGIN + "/auth/google/connect/callback"` (distinct from the sign-in callback — must be registered in the Google Cloud console; see Deploy prerequisites)
  - `response_type=code`
  - `access_type=offline`, `prompt=consent` (force a refresh token every time), `include_granted_scopes=true`
  - `scope`:
    - `openid`
    - `email`
    - `https://www.googleapis.com/auth/classroom.courses.readonly`
    - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
    - `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly`
    - `https://www.googleapis.com/auth/calendar.readonly`
  - `state`: reuse `makeState(env)` / `checkState` from `auth-routes.ts` (extracted to a shared module — see File structure).
- Set the state cookie, redirect to Google.

`handleGoogleConnectCallback`:
- Require session; validate `state` (`checkState`); on failure redirect `/settings?google=error`.
- Exchange `code` → tokens at `https://oauth2.googleapis.com/token` (`grant_type=authorization_code`).
- Verify the response contains `refresh_token`. If not (user previously consented and Google withheld it despite `prompt=consent`) → redirect `/settings?google=norefresh` with guidance to remove prior access and retry.
- Fetch `https://www.googleapis.com/oauth2/v3/userinfo` for the connected Google `email` (informational display only; the precisstudy identity remains `session.email`).
- Store the encrypted token record (below).
- Redirect `/settings?google=connected`.

### 2. Token storage & crypto

New file `src/google-token.ts`.

- KV: `env.PROGRESS`, key `gtok:<session.email>`.
- Value: `base64(iv[12] ++ AES-GCM ciphertext)` of `JSON.stringify({ refreshToken, googleEmail, scopes: string[], connectedAt: <ISO> })`.
- Key derivation: `HKDF-SHA-256(ikm = utf8(SESSION_SECRET), salt = utf8("precisstudy-google-token"), info = utf8("v1"), length = 32)` → `crypto.subtle.importKey` as AES-GCM. Implemented with WebCrypto (`crypto.subtle`), available in the Workers runtime.
- Helpers: `putGoogleToken(env, email, record)`, `getGoogleToken(env, email): record | null`, `deleteGoogleToken(env, email)`.
- Access tokens are **never** persisted — obtained fresh per sync, held in a local variable.

### 3. Sync pipeline

New file `src/google-sync.ts`. `syncGoogleAssignments(env, email, settings): Promise<Feed>`.

`Feed = { connected: boolean, items: Assignment[], fetchedAt: string, reason?: "revoked" | "google_unavailable" }`

`Assignment = {`
`  id: string,                 // stable: "classroom:<courseId>:<courseWorkId>" or "calendar:<calId>:<eventId>"`
`  source: "classroom" | "calendar",`
`  title: string,`
`  courseName: string | null,  // Classroom course name, or the calendar's summary`
`  dueAt: string | null,       // ISO 8601; null when undated`
`  allDay: boolean,`
`  link: string | null,        // alternateLink / htmlLink back to Google`
`  state: "todo" | "submitted" | "done" | "none",`
`}`

Steps:
1. `getGoogleToken(env, email)`. Null → `{ connected: false, items: [], fetchedAt: now }`.
2. Refresh: POST `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`. On `error === "invalid_grant"` → `deleteGoogleToken`, also delete `gcache:<email>`, return `{ connected: false, items: [], fetchedAt: now, reason: "revoked" }`.
3. Classroom:
   - `GET https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=50` (follow one page of `nextPageToken`, cap 50 courses).
   - Per course, with a concurrency cap of 5:
     - `GET /v1/courses/{id}/courseWork?pageSize=50&orderBy=dueDate desc`
     - `GET /v1/courses/{id}/courseWork/-/studentSubmissions?userId=me&pageSize=100` → map `courseWorkId → submissionState` (`TURNED_IN` → `submitted`, `RETURNED` → `done`, else `todo`).
   - Build `dueAt` from `courseWork.dueDate` (`{year,month,day}`) + `dueTime` (`{hours,minutes}`); no `dueTime` → `allDay: true`, `dueAt` set to that date at `T00:00:00Z`.
   - `link = courseWork.alternateLink`.
4. Calendar (only `settings.calendarIds`, default `["primary"]`):
   - Per calendar: `GET https://www.googleapis.com/calendar/v3/calendars/{encodeURIComponent(id)}/events?timeMin={now}&timeMax={now+35d}&singleEvents=true&orderBy=startTime&maxResults=250`.
   - `title = event.summary || "(no title)"`, `dueAt` from `event.start.dateTime` or `event.start.date` (`allDay` when `.date`), `link = event.htmlLink`, `state = "none"`, `courseName = calendar summary` (from the calendar list, cached).
5. Schoolwork filter (calendar items only) when `settings.schoolworkOnly !== false` (default true): keep an event only if `\b(test|quiz|exam|midterm|final|essay|project|paper|due|assignment|presentation|lab report|homework|hw)\b` matches `summary + " " + (description || "")`, case-insensitive. Classroom items are always kept.
6. Sort ascending by `dueAt`; `null` dueAt sorts last, then by `title`.
7. Write `gcache:<email>` = `{ items, fetchedAt: now }` to `env.PROGRESS` with `{ expirationTtl: 900 }`.
8. Return `{ connected: true, items, fetchedAt: now }`.

Any non-2xx from Classroom/Calendar (429, 5xx): if a `gcache:<email>` value exists, return it with `reason: "google_unavailable"`; otherwise return `{ connected: true, items: [], fetchedAt: now, reason: "google_unavailable" }`. Never throw out of the handler.

### 4. Public API

New routes in `src/worker.ts` → handlers in `src/google-routes.ts`:

| Route | Method | Behavior |
|---|---|---|
| `/api/assignments` | GET | Session required (401 else). Read `gcache:<email>`; if present and `< 15 min` old return it (`{ ...cache, connected: true }`). Else call `syncGoogleAssignments`. `?refresh=1` skips the cache. Body: `Feed`. |
| `/api/google/calendars` | GET | Session required. Refresh token → `GET /calendar/v3/users/me/calendarList` → `[{ id, summary, primary }]`. Not connected → `{ connected: false, calendars: [] }`. |
| `/api/google/disconnect` | POST | Session required. Best-effort `POST https://oauth2.googleapis.com/revoke?token=<refresh>`. `deleteGoogleToken`, delete `gcache:` and `gsettings:`. Return `{ ok: true }`. |
| `/api/google/settings` | GET, POST | Session required. GET returns `gsettings:<email>` or the default. POST validates `{ calendarIds: string[] (≤25, each ≤512 chars), schoolworkOnly: boolean }`, stores it, returns the stored value. |

`gsettings:<email>` in `env.PROGRESS` = `{ calendarIds: string[], schoolworkOnly: boolean }`; default `{ calendarIds: ["primary"], schoolworkOnly: true }`.

### 5. Settings UI

`public/settings/index.html` gains a "Connected accounts" card:
- Not connected: text + button linking to `/auth/google/connect/start?next=/settings`.
- Connected: show `googleEmail`, a "Disconnect" button (`POST /api/google/disconnect`), a calendar multi-select populated from `/api/google/calendars`, and an "Only show schoolwork on my list" checkbox. Changes `POST /api/google/settings`.
- Reads `?google=connected|error|norefresh` on load to show a one-line status.
- No framework; match the existing settings page's vanilla JS + fetch style.

### 6. Config / deploy prerequisites (documented, not code)

- In the Google Cloud console for the existing OAuth client: add authorized redirect URI `https://precisstudy.com/auth/google/connect/callback` (and the studystacks.org / localhost equivalents used in dev).
- Enable the **Google Classroom API** and **Google Calendar API** on the project.
- The OAuth consent screen must list the four Classroom/Calendar scopes; until the app is verified, only test users can connect (note in the PR).
- No new Worker bindings — reuses `PROGRESS` KV and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET`.

## Error handling summary

| Condition | Response |
|---|---|
| `GOOGLE_CLIENT_ID` / `SESSION_SECRET` unset | 503 `{ error: "… isn't configured yet" }` |
| No precisstudy session on an `/api/*` route | 401 |
| No `gtok:` for the user | 200 `{ connected: false, items: [] }` |
| Refresh token rejected (`invalid_grant`) | clear `gtok:`/`gcache:`, 200 `{ connected: false, reason: "revoked" }` |
| Google API 429 / 5xx | stale cache if present, else `{ connected: true, items: [], reason: "google_unavailable" }` |
| Callback missing `refresh_token` | redirect `/settings?google=norefresh` |

## Testing

`test/google-sync.test.js` (vitest, Workers pool) — stub `globalThis.fetch` per URL:
- token refresh success → access token used in subsequent calls
- `invalid_grant` → `gtok:`/`gcache:` deleted, `reason: "revoked"`
- Classroom normalize: dated vs undated coursework; submission state → `todo`/`submitted`/`done`
- Calendar normalize: timed vs all-day events
- schoolwork filter keeps "Unit 3 Test", drops "Dentist"; `schoolworkOnly:false` keeps both
- sort order (dued items first, ascending; undated last)
- cache: second call within 15 min does not re-fetch; `?refresh=1` does
- 500 from Classroom with a warm cache → serves cache + `reason`
- `/api/google/disconnect` deletes all three keys, calls revoke

`test/google-token.node.test.mjs` (`node --test`, added to the existing `test:scripts` glob) — pure crypto:
- encrypt→decrypt round-trips a record
- a record encrypted with a different `SESSION_SECRET` fails to decrypt (throws, not silent wrong data)
- ciphertext is not the plaintext refresh token

`test/google-connect.test.js` — `handleGoogleConnectStart` builds a URL with `access_type=offline`, `prompt=consent`, all four scopes, and the connect callback `redirect_uri`; no session → redirect to `/settings`.

## File structure

| File | Responsibility |
|---|---|
| `src/google-connect.ts` | OAuth connect start + callback handlers |
| `src/google-token.ts` | encrypt/put/get/delete the refresh-token record (WebCrypto) |
| `src/google-sync.ts` | refresh access token, fetch + normalize Classroom + Calendar, cache |
| `src/google-routes.ts` | `/api/assignments`, `/api/google/calendars`, `/api/google/disconnect`, `/api/google/settings` |
| `src/auth-state.ts` | `makeState` / `checkState` extracted from `auth-routes.ts` for reuse (small refactor) |
| `src/worker.ts` | +6 routes in the route map |
| `public/settings/index.html` | "Connected accounts" card |
| `src/env.d.ts` | no change (no new bindings) |
