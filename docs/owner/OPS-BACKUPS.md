# OPS-1: nightly backups to R2

All student progress lives in one KV namespace with no export. The code to back it up is deployed and **off** until a bucket is bound.

## What it does
Every night (22:00 UTC cron, continued by the 5-minute cron) it writes `PROGRESS`, `FEEDBACK` and `GUIDE_REQUESTS` to R2 as NDJSON files under `backups/YYYY-MM-DD/`, skips throwaway counters, and deletes days older than 30 days. KV reads are done in small slices so it never hits Cloudflare's per-run limits. Cost: R2 has a free tier (10 GB); this is a few MB per day.

## Your steps
1. Cloudflare dashboard → R2 → **Create bucket** named `precisstudy-backups` (location: automatic).
2. Add this to `wrangler.jsonc` (I can do this for you once the bucket exists; a binding to a bucket that doesn't exist makes deploys fail, so I left it out):
   ```jsonc
   "r2_buckets": [{ "binding": "BACKUPS", "bucket_name": "precisstudy-backups" }]
   ```
3. `npm run deploy`. Next 22:00 UTC the first dump runs. Check R2 → the bucket → `backups/`.

## Restoring (tested by `test/restore-backup.node.test.mjs`)
```bash
# download that day's files
npx wrangler r2 object get precisstudy-backups/backups/2026-10-04/progress-00000.ndjson --file backup/progress-00000.ndjson
# convert (optionally only one student: --only progress:kid@example.com)
node scripts/restore-backup.mjs backup/ out/
# load into the namespace (get the id from wrangler.jsonc)
npx wrangler kv bulk put out/progress-0.json --namespace-id <PROGRESS id>
```
Do a practice restore into a scratch namespace the first week so you know it works before you need it.

## Retention (separate, optional)
Set `RETENTION_DAYS` (e.g. `365`) as a variable and the daily cron deletes guide requests and feedback (and attached files) older than that. Off by default. Match it to what the privacy policy says.
