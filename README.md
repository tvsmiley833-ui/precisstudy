# PrecisStudy

Free study guides for high school and AP classes — notes, flashcards, quizzes, worked examples and full practice exams — running on Cloudflare Workers.

Live at [precisstudy.com](https://precisstudy.com).

## What's here

57 guides (math, science, history, English, languages, SAT/ACT prep and electives). Each has a unit-by-unit study guide, flashcards with spaced repetition, a quiz bank, a practice exam, a quick reference and common-mistakes notes. Signed-in students also get progress sync, a dashboard, streaks and quests, study groups and peer challenges, a study schedule, and Google Classroom/Canvas due dates.

## Stack

- **Cloudflare Workers** (`src/`): routing, auth, progress APIs, AI helper, cron jobs.
- **Cloudflare KV**: sessions, progress, push subscriptions, leaderboards.
- **Guide pages are generated**: `guides/<slug>.json` → `scripts/generate-guide.mjs` + `scripts/guide-template/` → `public/<slug>/index.html`. Never hand-edit a generated page; run `npm run guides:regen`.
- **Client code**: `client/guide-app.js` and `client/personality.js` are built by esbuild into `public/shared/` (`npm run build:client`). Other shared scripts in `public/shared/` are plain files; the Worker adds content hashes (`?v=`) and long cache headers to them.
- **Tests**: vitest (Workers pool) for the backend and browser-side modules, plus Node tests (`test/*.node.test.mjs`) for the build scripts and page contents.

## Commands

```bash
npm install
npm run dev          # local Worker
npm test             # node tests + vitest
npm run typecheck
npm run guides:regen # rebuild every guide page from guides/*.json
npm run smoke        # check key pages and headers on production
npm run deploy       # builds, typechecks, runs tests, deploys, then smoke-checks
```

See `scripts/README.md` for the build helpers, `docs/IMPROVEMENTS-STATUS-2026-10-03.md` for what has shipped and what is open, and `CLAUDE.md` for working rules. Older plans are in `docs/archive-*`.
