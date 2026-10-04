# Owner checklist

Everything here needs your accounts or a decision. The code for each is already written and deployed **switched off**; nothing changes for students until you do your step. Tick them off in this order (fastest, highest value first).

| # | Item | Your step | Time | Doc |
|---|------|-----------|------|-----|
| 1 | **TEST-1** CI runs the full tests | Edit one line in the GitHub web editor | 2 min | below |
| 2 | **OPS-2** Know when the site is down | Add a free uptime monitor pointed at `/api/health` | 10 min | `OPS-ALERTS.md` |
| 3 | **SEC-15** Rotate the leaked key | Revoke it in Google Cloud, set secrets | 15 min | `SEC-15-ROTATE-KEY.md` |
| 4 | **OPS-1** Backups | Create an R2 bucket, add one binding, deploy | 15 min | `OPS-BACKUPS.md` |
| 5 | **Turnstile** spam check | Create a Turnstile widget, set 2 values | 10 min | `TURNSTILE.md` |
| 6 | **PRIV-3** Privacy policy | Review the draft, fill the 4 decisions, publish | 30 min | `PRIVACY-POLICY-DRAFT.md` |
| 7 | **PRIV-2** Age gate | **Done: 13+ gate is live.** Nothing to do except put the age wording in the policy you publish (already in the draft) | - | `AGE-AND-ADS.md` |
| 8 | **PRIV-4** Non-personalized ads | Decide, then flip one snippet | 5 min | `AGE-AND-ADS.md` |

## 1. TEST-1: make CI run every test

The workflow currently runs `npx vitest run`, which skips the Node tests (page generation, client build freshness, content checks, manifest, contrast…).

1. Open https://github.com/ (your repo) → `.github/workflows/ci.yml` → pencil icon.
2. Change the last line `- run: npx vitest run` to `- run: npm test`.
3. Commit directly to `main`.

The exact diff is in `ci.yml.diff` (a full copy of the new file is `ci.yml.proposed`). I can't push it myself because my GitHub token can't edit workflow files.

Local deploys already run `npm test` (typecheck, tests, then a smoke check) before and after every `npm run deploy`, so this only closes the gap for pushes made some other way.
