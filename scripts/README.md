# scripts/

- `generate-guide.mjs` + `guide-template/` — builds a guide page from `guides/<slug>.json` (validates the JSON first). Never hand-edit generated pages.
- `regen-guides.mjs` (`npm run guides:regen`) — rebuilds every guide page; reports "match the generator" when nothing changed.
- `smoke.mjs` (`npm run smoke`) — post-deploy check of key pages and headers; runs automatically after `npm run deploy`.
- `sync-guides-registry.py`, `sync-settings-icons.py`, `sync-home-counts.mjs`, `sync-guide-json.mjs`, `apply-guide-json.mjs`, `extract-legacy-guide.mjs`, `gen-subject-units.mjs` — registry and migration helpers used when adding or importing a guide.
- `patch-error-monitor.mjs`, `patch-unit-order.mjs`, `prerender-practice.mjs`, `hero-patterns.*` — page patchers and pattern libraries still used by the generator.
- `lib/` — shared helpers for the scripts above.

One-off patchers that had no references were deleted (see git history if you need one back).
