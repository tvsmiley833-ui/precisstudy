# OPS-2: error alerting and uptime

## Already in the code
- NOTE: the first health check showed one required secret missing (`VAPID_SUBJECT`, the contact in push messages). It is now set as a plain variable in `wrangler.jsonc`. Two stray secrets, `GOOGLE_CLIENT` and `GOOGLE_CLIENT_SECRE`, look like typos and can be deleted: `npx wrangler secret delete GOOGLE_CLIENT` and `... GOOGLE_CLIENT_SECRE`.
- `GET /api/health` returns `200 {"ok":true,"kv":true,"missingSecrets":0,...}` and `503` if the progress database doesn't answer. It never names a missing secret (only a count), so it is safe to leave public.
- The daily cron logs `missing-secrets` at error level in Workers Logs when a required secret isn't set (VAPID keys, OAuth, etc.).
- `npm run smoke` and every `npm run deploy` check the key pages after deploying.

## Your steps
1. **Uptime monitor (free):** create an account at UptimeRobot (or Better Stack / Cloudflare Health Checks). Add an HTTPS monitor for `https://precisstudy.com/api/health`, 5-minute interval, alert to your email/phone. Optionally add a keyword monitor on the homepage for the word `PrecisStudy`.
2. **Error alerts:** Cloudflare dashboard → Notifications → Add → choose *Workers* (or "Alerting for Workers: error rate / usage") and send it to your email. Also turn on the "Cloudflare incident" notification for the Workers product.
3. **Look at logs when alerted:** Workers & Pages → studystacks → Logs. Search `missing-secrets`, `cron:` and `client-error`.

A full tail-worker that emails every error is possible but noisier than this; start with 1 and 2 and tell me if you want more.
