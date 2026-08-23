# PrecisStudy

Free, self-contained study guides for high school and AP subjects — notes, flashcards, quizzes, and full practice exams, all running on Cloudflare Workers.

Live at [precisstudy.com](https://precisstudy.com).

## Subjects

Geometry, Chemistry, Algebra I & II, AP English Language & Composition, Global History, AP Biology, Biology, APUSH, Physics, and PreCalculus — each guide includes:

- A full unit-by-unit study guide with worked examples and common traps
- Flashcards and a quiz question bank per unit
- A timed full-length practice exam
- A quick-reference sheet and memory-trick summaries
- Progress tracking and mastery scoring for signed-in users

## Stack

- **Cloudflare Workers** for the backend (`src/`), routing, auth, and progress APIs
- **Cloudflare KV** for sessions, progress, and guide-request storage
- **Static HTML/CSS/JS** guide pages (`public/`) — no build step, no framework
- **Vitest** with `@cloudflare/vitest-pool-workers` for backend tests

## Local development

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

## Deploy

```bash
npm run deploy
```

Requires a configured `wrangler.jsonc` with your own KV namespace IDs and secrets (`wrangler secret put ...`) — none are included in this repo.

## License

MIT — see [LICENSE](LICENSE).
