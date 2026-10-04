# SEC-15: rotate the leaked service-account key

A service-account key printed in an old transcript (see `docs/HANDOFF-2026-10-01.md`, Open #3) was never rotated. Anyone who saw that transcript could still use it.

## Steps (Google Cloud console)
1. https://console.cloud.google.com → pick the project → IAM & Admin → Service Accounts.
2. Open the service account, go to **Keys**. **Delete** the old key (the one created at the time of the leak).
3. If the site still needs a service-account key (check where it is used: `grep -rn "service" src`), create a new key and store it only as a Worker secret: `npx wrangler secret put <NAME>`. Never paste it into chat or commit it.
4. Check nothing broke: `npm run smoke`, and send a test push from Settings if push uses it.

## Check every secret is set
`GET https://precisstudy.com/api/health` shows `missingSecrets`. If it is not 0, run `npx wrangler secret list` and compare with `src/ops.ts` (`REQUIRED_SECRETS`). The daily cron also logs the missing names as `missing-secrets`.

## While you're there
Rotate `SESSION_SECRET` only if you suspect it leaked: changing it signs every student out.
