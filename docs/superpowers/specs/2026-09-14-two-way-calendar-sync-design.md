# Two-way calendar sync

## Purpose

Google integration today is read-only: PrecisStudy pulls Classroom
assignments and calendar due-dates *in* (`syncGoogleAssignments`). This adds
the other direction: pushing a student's PrecisStudy study schedule *out* as
recurring events on their Google Calendar, so the schedule shows up
alongside the rest of their life instead of living only inside the app.

## Scope decisions (made directly, per this session's "don't stop to ask" instruction)

- **"Two-way" = pull (existing) + push (new), not live bidirectional
  editing.** True realtime sync (a student edits/deletes an event directly
  in Google Calendar and PrecisStudy notices) needs Calendar push
  notification channels -- a watch-channel subscription, a webhook
  receiver, and a renewal cron, since channels expire. That's a real
  sub-project of its own with no clear requirement driving it yet (nothing
  in this session's request asked for live external-edit detection).
  Push-only two-way (schedule changes in PrecisStudy -> reflected on
  Calendar) delivers the actual value -- "see my study blocks on my
  calendar" -- without that infrastructure. Documented as a non-goal below.
- **Opt-in, off by default.** Writing events onto someone's personal
  calendar is more invasive than reading it. New `pushScheduleToCalendar`
  toggle in the existing Google settings UI, default `false`.
- **New OAuth scope required:** `calendar.events` (create/update/delete
  events the app created; not full calendar read/write). Added to
  `CONNECT_SCOPES` in `google-connect.ts`. Consequence: a student connected
  *before* this ships doesn't have this scope on their stored token and
  must reconnect (Settings' existing "Connect Google" flow) before the
  toggle does anything -- `pushScheduleToGoogleCalendar` fails closed (logs
  nothing, just doesn't create events) rather than erroring the schedule
  save when the API 403s for missing scope.
- **One recurring event per schedule block**, not one event per occurrence.
  A block ("Tue 16:00-17:00 Geometry") becomes one weekly-recurring Calendar
  event with an `RRULE`, matching how the student already thinks about
  their schedule (a recurring commitment, not N one-off events piling up
  over a semester).
- **Event id mapping is duplicated storage, not shared with the schedule
  refactor.** The OAuth-refresh exchange (`google-sync.ts`'s inline
  fetch-token-from-refresh-token block) is copied into the new module
  rather than extracted into a shared helper. `google-sync.ts` is
  already-tested working code; a refactor purely for DRY here isn't worth
  the risk this session, given calendar sync is already the third large
  feature built today with multi-LMS support still to come. Flagged here
  rather than silently duplicated without acknowledgment.

## Data model

`GoogleSettings` (`google-sync.ts`) gains:

```ts
pushScheduleToCalendar: boolean; // default false
```

`ScheduleData` (`progress-routes.ts`) gains:

```ts
googleEventIds?: Record<string, string>; // key: `${day}|${start}|${subjectKey}` -> Calendar event id
```

The key is derived from the block itself (not a random id) so a block that's
edited (time changed) is recognized as "this block, updated" rather than
"old block deleted + new block created" only when day/start/subject are all
unchanged -- changing any of those is treated as delete-old + create-new,
which is the simpler, correct-enough behavior (a renamed/rescheduled block
doesn't need to preserve the same Calendar event's history/attendees, since
there are none).

## Backend

New module `src/google-calendar-push.ts`:

```ts
export async function pushScheduleToGoogleCalendar(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  email: string,
  blocks: { day: string; start: string; end: string; subjectKey: string; subjectLabel: string }[],
  timezone: string,
  previousEventIds: Record<string, string>,
  calendarId: string // settings.calendarIds[0] -- pushes to the first configured calendar
): Promise<Record<string, string>>
```

- Refreshes an access token the same way `syncGoogleAssignments` does
  (duplicated per the scope decision above).
- If no token, refresh fails, or any Calendar API call 403s (missing
  scope), returns `previousEventIds` unchanged -- best-effort, never throws,
  never blocks the schedule save on a Google hiccup.
- Diffs `previousEventIds`' keys against the new blocks' keys: creates
  events for new keys, `DELETE`s events for keys no longer present, leaves
  unchanged keys alone (no-op -- a block that didn't change doesn't need a
  Calendar round-trip).
- A created event: `summary` = subjectLabel + " (PrecisStudy)"`, start/end
  computed for the next occurrence of that weekday at that time in the
  given timezone, `recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=" + twoLetterDay]`,
  `reminders: { useDefault: true }`.
- Returns the updated key -> event id map.

**Wiring:** `handlePostSchedule` (`progress-routes.ts`), after computing
`blocks` and before the `PROGRESS.put`: if `env.GOOGLE_CLIENT_ID` is set,
load the student's `GoogleSettings` (new export `loadGoogleSettings` from
`google-routes.ts`, replacing its current unexported `loadSettings` so both
modules share the one KV-backed reader), and if
`settings.pushScheduleToCalendar` is true, call
`pushScheduleToGoogleCalendar` and store the result as
`blob.schedule.googleEventIds` before saving. If the setting is off, or
`GOOGLE_CLIENT_ID` isn't configured (self-hosted dev without Google
credentials), skip entirely -- `blob.schedule.googleEventIds` stays
whatever it was (or absent).

**`handleGoogleSettingsPost`**: accepts an optional `pushScheduleToCalendar`
boolean in the body (defaults `false` when omitted, so existing callers
that don't send it keep working), validated as a boolean when present,
stored alongside the existing fields.

## Frontend

Settings' existing "Connected accounts" card gets one more checkbox next to
"Only show schoolwork on my list":

```html
<label>
  <input type="checkbox" id="google-push-schedule">
  Add my study schedule to this calendar
</label>
```

Wired the same way the existing `schoolworkOnly` checkbox already is (read
on load, included in the `POST /api/google/settings` body on save) --
mechanical addition to code that already exists, not a new pattern.

## Testing

- `google-calendar-push.test.js` (new): no token -> returns previousEventIds
  unchanged, no fetch calls. Refresh failure -> same. New block -> creates
  an event, returns its id under the block's key. Removed block -> deletes
  the old event, drops its key. Unchanged block -> no Calendar API call for
  that key. A 403 from the events API (simulating a missing scope on an
  old token) -> that block's create/update is skipped, others still
  process, no throw.
- `progress-routes.test.js`: `handlePostSchedule` with
  `pushScheduleToCalendar` on (mock the push module's result) persists
  `googleEventIds`; with it off (default), schedule saves exactly as before
  with no Calendar calls attempted -- regression coverage for "opt-in
  doesn't change existing behavior for everyone who hasn't turned it on".
- `google-routes.test.js`: existing `handleGoogleSettingsPost` /
  `handleGoogleSettingsGet` exact-shape assertions updated to include
  `pushScheduleToCalendar: false` in the default case, and a new case
  setting it `true`.

## Non-goals

- No detection of edits/deletes made directly in Google Calendar (see
  Scope decisions -- would need push notification channels).
- No UI showing which Calendar events map to which blocks, or a "sync now"
  button -- push happens automatically whenever the schedule is saved.
- No support for pushing to more than one calendar even if multiple
  `calendarIds` are configured for reading -- writes go to the first
  configured calendar only, since "which of several calendars should my
  study blocks appear on" has an obvious single answer (primary) absent a
  stated reason to choose otherwise.
