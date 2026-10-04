# Where things stand (2026-10-04) — read this after a compact

## Done and live (all deployed, tests green: ~705 vitest + ~457 node)
- 13+ age gate before sign-in (`/age/`, `src/age-gate.ts`), signed cookie only. Privacy page age paragraph updated.
- Ads: non-personalized, AdSense tag (`ca-pub-9710380778867118`) in homepage `<head>`, account meta tag on every page (Worker), `ads.txt` lists new + old publisher. Europe consent message (3 choices, Optimize OFF) published in AdSense.
- Ops built but OFF until owner enables: `/api/health`, `/api/config`, R2 backups (`BACKUPS` binding), `RETENTION_DAYS`, Turnstile (`TURNSTILE_SECRET` + `TURNSTILE_SITE_KEY`). Restore script `scripts/restore-backup.mjs`. Docs in `docs/owner/`.
- SEO: 301s for slashless addresses, canonical view URLs, richer titles/descriptions, related-guide links, sitemap lastmod, address-guess redirects.
- `VAPID_SUBJECT` was missing in production; now set in `wrangler.jsonc`.

## Waiting on the owner
- AdSense: enter payment/tax details (required), then site approval ("Getting ready"). After approval: turn on Auto ads for the site only, add Brand safety blocks, confirm an ad shows. ads.txt shows "Not found" until Google re-crawls (file is fine).
- Privacy policy rewrite (`docs/owner/PRIVACY-POLICY-DRAFT.md`) needs owner decisions + review.
- TEST-1 CI line (`docs/owner/ci.yml.diff`), SEC-15 key rotation, R2 bucket for backups, uptime monitor, Turnstile keys, delete stray secrets `GOOGLE_CLIENT`, `GOOGLE_CLIENT_SECRE`.
- Search Console: re-check in 2–3 weeks; click "Validate fix" on the redirect report.

## In progress: logo for PrecisStudy
- Skill installed at `~/.claude/skills/logo-design` (reviewed, MIT, no network calls).
- Three greyscale concepts built in `branding/logo-concepts/` (`concepts.png`): A Bookmark P (recommended), B Sage owl, C Page P. Stopped at the checkpoint: waiting for the owner to pick a direction and say yes to the full kit (palette, lockups with outlined wordmark, small-size cut, favicon/app icon/web icons, presentation board, guidelines). Do NOT build the kit before they answer.
- If they pick one, replace `public/logo-icon*.png`, `favicon.png`, `apple-touch-icon.png`, `icon-192/512/maskable-512.png` and regenerate.

## Reminders
- Deploy chain: `npm run deploy` runs typecheck + tests first, smoke check after. Never chain with `;`.
- Edge cache can serve stale 200/404 for a few minutes; test with `?c=$RANDOM`.
- Remaining audit items: `docs/IMPROVEMENTS-STATUS-2026-10-03.md`.
