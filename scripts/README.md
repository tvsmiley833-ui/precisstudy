# scripts/

- `generate-guide.mjs` + `guide-template/` — builds a guide page from `guides/<slug>.json` (validates the JSON first). Never hand-edit generated pages.
- `regen-guides.mjs` (`npm run guides:regen`) — rebuilds every guide page; reports "match the generator" when nothing changed.
- `smoke.mjs` (`npm run smoke`) — post-deploy check of key pages and headers; runs automatically after `npm run deploy`.
- `add-guide.mjs` — registers a NEW guide everywhere courses are listed (about 26 places) by cloning a sibling's entries; idempotent; `--dry` previews. Follow with `node scripts/gen-subject-units.mjs && npm run guides:regen && node scripts/sync-home-counts.mjs && npm test`.
- `check-links.mjs`, `check-a11y.mjs`, `check-seo.mjs` — static lints over the built pages, each wrapped by a `test/*.node.test.mjs`.
- `sync-guides-registry.py` (guarded: not safe to re-run; use `add-guide.mjs`), `sync-settings-icons.py`, `sync-home-counts.mjs`, `sync-guide-json.mjs`, `apply-guide-json.mjs`, `extract-legacy-guide.mjs`, `gen-subject-units.mjs` — registry and migration helpers used when adding or importing a guide.
- `patch-error-monitor.mjs`, `patch-unit-order.mjs`, `prerender-practice.mjs`, `hero-patterns.*` — page patchers and pattern libraries still used by the generator.
- `lib/` — shared helpers for the scripts above.

One-off patchers that had no references were deleted (see git history if you need one back).
