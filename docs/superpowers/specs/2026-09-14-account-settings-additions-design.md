# Account settings additions

## Purpose

Add three settings, each addressing a gap in the existing Settings page: no
per-notification-type control (it's subscribe/unsubscribe or nothing), no way
for a student to get their own data out, and no way to invalidate a stolen or
forgotten-device session short of "Delete account."

## Scope

1. Notification preferences (daily / streak / study-block reminders, independently)
2. Data export (download own progress blob as JSON)
3. Sign out everywhere

Explicitly out of scope: per-device session list/revocation (would need a new
session-registry subsystem — sessions here are a stateless JWT validated
against one account-wide version counter, not individually tracked). If that's
wanted later it's a separate sub-project.

## 1. Notification preferences

**Data model** — new optional field on `ProgressBlob`:

```ts
notificationPrefs?: { daily: boolean; streak: boolean; blocks: boolean };
```

Absent/undefined is treated as all-`true` (matches current behavior for every
existing subscriber, so this ships with no behavior change until a student
opts something out).

**Backend** — each of the three cron senders in `push-routes.ts` gains one
early-continue check per subscriber:

- `sendDailyReminders`: skip if `notificationPrefs.daily === false`
- `sendStreakReminders`: skip if `notificationPrefs.streak === false`
- `sendScheduledBlockReminders`: skip if `notificationPrefs.blocks === false`

New endpoint `POST /api/notification-prefs`, authenticated, body
`{ daily?: boolean; streak?: boolean; blocks?: boolean }`, merges into the
stored blob (partial update, same pattern as `handlePostGoal`).

**Frontend** — three checkboxes in the existing push-notifications card in
Settings, under the subscribe toggle. Disabled/hidden when push isn't
subscribed (a pref is meaningless with no subscription to gate). Saves
immediately on change (no separate save button, matching the share-link
card's pattern), with the same inline status-text pattern used elsewhere on
the page.

## 2. Data export

New endpoint `GET /api/export`, authenticated. Returns the full stored
progress blob verbatim as JSON with
`Content-Disposition: attachment; filename="precisstudy-data.json"`. No
filtering needed — it's the requesting student's own data, and the blob
contains nothing about other users.

**Frontend** — "Download my data" button in Settings (new small card, placed
near "Reset all progress" / "Delete account" since it's data-management
adjacent). Triggers a plain navigation to `/api/export` (browser handles the
download via the Content-Disposition header — no JS blob/anchor dance
needed).

## 3. Sign out everywhere

New endpoint `POST /auth/sign-out-everywhere`, authenticated. Calls the
existing `bumpSessionVersion(env, email)` (same function `handleLogout` and
`handleDeleteAccount` already use) and clears the requesting cookie, exactly
like `handleLogout` — the only difference from logout is intent-signaling
(bump vs. bump-that-happens-to-be-paired-with-a-clear): functionally
`handleLogout` already invalidates every other session too, but doesn't say
so. This endpoint exists so Settings can offer it as an explicit, named
security action with its own confirmation copy, separate from the plain
"Log out" flow elsewhere in the app.

**Frontend** — a "Sign out of all devices" button in Settings (same card
area as delete-account/reset-progress), with a `confirm()` guard (matching
the existing revoke-share-link and delete-account confirmation pattern),
then redirects to `/` on success.

## Testing

- `push-routes.test.js`: each of the three senders gets a case asserting a
  subscriber with the relevant pref set to `false` is skipped, and that
  omitting `notificationPrefs` entirely still sends (default-true).
- New `POST /api/notification-prefs` tests: 401 with no session, partial
  merge behavior, persists across multiple calls.
- New `GET /api/export` tests: 401 with no session, 200 with correct
  Content-Disposition header and body matching the stored blob.
- New `POST /auth/sign-out-everywhere` tests: 401 with no session, 200 bumps
  version (old token not valid after), clears cookie.

## Non-goals

- No UI for "which devices are signed in" (see Scope).
- No throttling/rate-limiting on `/api/export` beyond the existing
  session-auth requirement — it's a single authenticated user fetching their
  own small JSON blob, not a bulk-scrape target.
