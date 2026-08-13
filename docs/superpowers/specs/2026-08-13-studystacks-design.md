# StudyStacks — Design Spec

**Date:** 2026-08-13
**Status:** Approved by user, ready for implementation planning
**Scope:** The hub site and shared engine only. Individual subject-guide content builds (Chemistry, Algebra 2, Global History II) are separate follow-on sub-projects, each with their own spec.

## Purpose

A study guide platform for students — a hub that hosts high-quality, interactive study guides (quizzes, flashcards, practice exams, an AI study helper) across multiple classes, starting from the existing Geometry Regents guide. Long-term goal is to grow into a genuinely popular destination for exam prep; this spec covers the buildable foundation, not the marketing/distribution effort that "popular" actually depends on.

## Name & Brand

- **Name:** StudyStacks
- **Visual direction:** Warm & Approachable — soft cream background (`#fffaf5`), orange/coral accent (`#c2410c` / `#ff8a4c`), rounded corners (12–18px), friendly rounded sans-serif (Nunito or system-ui fallback). Distinct from the Geometry guide's existing dark/gold "Premium & Editorial" look — StudyStacks is its own brand, not a reskin.
- **Tone:** Direct, encouraging, not corporate. Copy like "Study guides that actually get you ready" over generic marketing language.

## Architecture

**One unified Cloudflare Worker, path-based routing** — not separate hosted guides linked from a directory. All content lives under one domain so SEO and brand value accumulate in one place rather than fragmenting across many `*.workers.dev` subdomains.

- Hosting: Cloudflare Workers with Static Assets (same pattern as the existing `geometry-guide-site` project)
- Domain: free `*.workers.dev` subdomain for launch; custom domain is a future decision, not blocking launch
- Routing: `/` → homepage, `/geometry` → the existing Geometry guide (unchanged), `/chemistry`, `/algebra-2`, `/global-history-2` → future guides built on the shared engine (placeholder-only in this phase)

### Geometry: migrate as-is, don't touch its internals

The Geometry guide (currently its own Worker project at `geometry-regents-guide.tvsmiley833.workers.dev`) is tested, working, and has been through significant correctness verification (440-question hard bank, GEN_BANK answer-shuffle fix, chatbot search relevance fix, etc.). Concretely: its `public/index.html` moves unmodified into the StudyStacks project at `public/geometry/index.html`, served at the `/geometry` path — same single-file HTML, same self-contained quiz/flashcard/chatbot engine, zero internal changes. The standalone `geometry-regents-guide` Worker is retired once the migrated copy is verified live at `/geometry` (same pattern as the earlier Pages→Workers migration: confirm the new location works, then delete the old one — not left running in parallel indefinitely). Re-architecting Geometry's internals to fit the shared engine is explicitly out of scope for this spec; it can be considered later as its own separate piece of work if ever worth doing.

### New subjects: shared engine, not copy-paste

Every subject built *after* this spec (Chemistry, Algebra 2, Global History II, and whatever comes next) shares one reusable engine rather than each being its own from-scratch giant file like Geometry is today:

- **Shared engine** (one JS/CSS bundle): tab navigation, quiz runner, flashcard system, practice-exam simulator, progress dashboard, chatbot widget UI
- **Per-subject content**: a data file (units, concepts, quiz questions, worked examples, memory tricks) that the shared engine renders
- Rationale: avoids re-implementing the same app for every subject; bug fixes and UX improvements apply everywhere at once; each new subject is mostly a content-authoring task, not a software-engineering task

This spec does **not** design the shared engine's internals in detail (component structure, data schema) — that's implementation-planning work for the first sub-project that actually builds a new subject (whichever of Chemistry/Algebra 2/Global History II goes first). This spec only commits to the *decision* that a shared engine exists and that Geometry is excluded from it.

### Chatbot: one shared backend

One `/api/chat` endpoint on the unified Worker, parameterized by subject (system prompt / context varies per subject), backed by **Cloudflare Workers AI** (`@cf/meta/llama-3.1-8b-instruct-fp8` or current equivalent at implementation time) — no external API key required, using the existing Cloudflare account. Geometry's current chat handler is already this same shape (Workers AI call + a system prompt, no external key) from earlier work — it becomes the reference implementation for the shared endpoint rather than a separate competing one. Concretely: the single `/api/chat` handler gains a `subject` parameter that selects the right system prompt/context; Geometry's existing prompt becomes the `subject=geometry` case, with the same request/response contract (`{history: [...]}` in, `{reply: "..."}` out) it already uses, so its frontend code doesn't need to change.

## Homepage

- **Nav:** StudyStacks wordmark, "Browse Subjects", "How It Works", a "Start Studying" CTA button
- **Hero:** headline + one-line pitch + a search input (search is not functionally required at launch — can be a visual placeholder until there's enough content to search)
- **Classes section:** live, usable guides — currently just Geometry, shown with real stats (11 units · 440 practice questions · interactive exam) and a "⭐ Flagship guide" badge
- **Coming Soon section:** visually distinct (dashed border, reduced opacity) from live classes — currently Chemistry, Algebra 2, Global History II, each with a one-line status note. No "Add to Dashboard"-style interaction; these are static placeholders until their content sub-projects ship.

## Content Roster

**Launching now:**
- Geometry — live, migrated unchanged

**Coming soon (placeholders only in this spec; each becomes its own future spec):**
- Chemistry — existing 16-unit guide (`~/Claude/Artifacts/chem-regents-study-guide/index.html`) needs a correctness audit (same rigor as Geometry's hard-question bank got) before it can be considered "live," not just migrated to the shared engine as-is
- Algebra 2 — no existing guide; built fresh from the user's Turbo notes ("Honors Alg 2")
- Global History II — existing guide file (`Global_History_II_Regents_Study_Guide.html`) needs the same audit treatment as Chemistry

**Explicitly out of scope for the foreseeable roadmap:**
- PF Debate, Day Trading, NY Permit Test — not academic classes, deliberately excluded from "classes" framing
- Spanish, English, AP European History — real candidates from the user's Turbo notes, deferred past the first wave
- Any content copied from Turbo's own "Expert Study Guides" library — that's Turbo's proprietary product content, not something the user authored; using it in StudyStacks would risk both ToS violation and copyright infringement. Turbo's subject list may inform *what to prioritize building*, never *what to copy*.

## Content Integrity Standard

Any question bank built or audited for this platform (Chemistry, Algebra 2, Global History II, and anything after) must meet the bar established for Geometry's hard-question bank:
- Every answer independently verified against the correct formula/fact, not just internally self-consistent
- No duplicate or near-duplicate answer options within a question
- Balanced correct-answer-index distribution (not skewed toward "always option A" the way an earlier generated bank was found to be)
- No content reproduced from third-party proprietary sources without a clear right to use it

## Explicitly Out of Scope (this spec)

- Custom domain purchase/setup
- Marketing, SEO execution, distribution, or any other driver of actual "popularity" — this spec builds the product; getting it in front of people is separate, ongoing work
- The shared engine's detailed technical design (data schema, component breakdown) — belongs to the first subject-content sub-project
- Auditing or rebuilding Chemistry/Global History II content — separate future sub-projects
- Building Algebra 2 content — separate future sub-project
