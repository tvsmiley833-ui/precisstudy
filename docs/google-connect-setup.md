# Google Classroom + Calendar connect — deploy prerequisites

The `/auth/google/connect/*` flow and `/api/assignments` reuse the existing
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET`. No new Worker
bindings. Before this works in production:

1. **Authorized redirect URI** — in the Google Cloud console for the existing
   OAuth client, add:
   - `https://precisstudy.com/auth/google/connect/callback`
   - the localhost equivalent used in dev (e.g. `http://localhost:8787/auth/google/connect/callback`)
   The sign-in callback `https://precisstudy.com/auth/google/callback` stays as-is.

2. **Enable APIs** on the project: **Google Classroom API** and **Google Calendar API**.

3. **OAuth consent screen** — add these scopes:
   - `openid`
   - `email`
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
   - `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   Until the app is verified by Google, only accounts added as **test users**
   can complete the connect flow. Call this out in the PR.

4. **No `wrangler.jsonc` change** — `PROGRESS` KV and the three secrets already exist.

## Data stored (KV namespace `PROGRESS`)

| Key | Contents | Lifetime |
|---|---|---|
| `gtok:<email>` | base64(iv ++ AES-GCM(`{refreshToken, googleEmail, scopes, connectedAt}`)); key = HKDF-SHA-256(`SESSION_SECRET`) | until disconnect / revoke |
| `gcache:<email>` | `{items: Assignment[], fetchedAt}` normalized feed | 900s TTL |
| `gsettings:<email>` | `{calendarIds: string[], schoolworkOnly: boolean}` | until disconnect |

Access tokens are never persisted. Rotating `SESSION_SECRET` invalidates every
`gtok:` (it fails to decrypt and the user simply appears disconnected).

## Troubleshooting — connect flow not working in production

If a user can't connect, or `/api/assignments` returns `google_unavailable`,
check the following on the Google Cloud Console side before assuming a code
bug:

- **`redirect_uri_mismatch` error during connect** — the OAuth client is
  missing `https://precisstudy.com/auth/google/connect/callback` under
  Authorized redirect URIs. This is a distinct URI from the existing sign-in
  callback (`/auth/google/callback`); adding one does not add the other.
- **`access_denied` / consent screen blocks the user** — the app has not been
  verified by Google and the account attempting to connect was not added as a
  test user on the OAuth consent screen.
- **Consent screen shows fewer permissions than expected, or Google rejects
  the scope list** — the OAuth consent screen's configured scopes don't match
  the six scopes requested by the connect flow (`openid`, `email`, the three
  `classroom.*.readonly` scopes, and `calendar.readonly`). All six must be
  added under consent screen scopes, not just a subset.
- **Classroom/Calendar API calls fail with `PERMISSION_DENIED` or 403** — the
  Google Classroom API and/or Google Calendar API have not been enabled for
  the Google Cloud project.
- **Everyone shows as disconnected after a deploy** — check whether
  `SESSION_SECRET` was rotated; rotating it invalidates every stored
  `gtok:<email>` record by design (decryption fails, treated as disconnected).
  This is expected, not a bug.
