# Mastery Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every student a server-synced, per-topic mastery view (exam readiness score + "study this next") across both Geometry and Chemistry, replacing localStorage-only completion tracking.

**Architecture:** A new Cloudflare KV namespace (`PROGRESS`) stores one JSON blob per signed-in student (keyed by email). Two new Worker routes (`GET`/`POST /api/progress`) read/write that blob, reusing the existing session-cookie auth (`getSession` from `src/auth.js`). A new shared browser module (`public/shared/mastery.js`) replaces Geometry's existing `GEO_STORE` logic and gives Chemistry the same tracking for the first time — it keeps writing to `localStorage` instantly, and pushes to the server on a debounce plus on tab-close. A new `/dashboard` page reads the merged blob and shows exam readiness + a concrete "study this next" recommendation for each subject.

**Tech Stack:** Cloudflare Workers, Cloudflare KV, Vitest + `@cloudflare/vitest-pool-workers` (existing test setup), plain browser JS (no framework, no build step — matches the rest of the site).

## Global Constraints

- No framework, no build step, no bundler — every browser-facing file must work as a plain `<script>`/`<script type="module">` tag, matching every existing page.
- Session auth reuses `getSession(request, env)` from `src/auth.js` — do not invent a second auth mechanism.
- KV write pattern: whole-subject upsert (read full blob, replace one subject's section, write back) — not per-field deltas. Matches `docs/superpowers/specs/2026-08-14-mastery-dashboard-design.md`.
- A unit counts as "assessed" only once it has `total >= 2` answered questions (matches the diagnostic's existing 2-per-unit default).
- Follow the exact test pattern already established in `test/admin-routes.test.js` (`fakeKV`, `sessionCookieFor`, `req()` helpers) for the new route tests — don't invent a different pattern.
- Visual styling for any new HTML must match the site's existing inline-style convention (see `public/about/index.html` for the shared header/footer/`ss-card` pattern) — no new CSS framework.

---

### Task 1: Create the PROGRESS KV namespace and wire the binding

**Files:**
- Modify: `wrangler.jsonc` (add to `kv_namespaces` array)

**Interfaces:**
- Produces: `env.PROGRESS` (a KV namespace binding), available to every Worker route from this point on.

- [ ] **Step 1: Create the KV namespace via wrangler**

Run:
```bash
cd /Users/smiley/Claude/Projects/School/studystacks/.claude/worktrees/studystacks-hub
npx wrangler kv namespace create PROGRESS
```
Expected output includes a line like:
```
{ binding = "PROGRESS", id = "<a 32-char hex id>" }
```
Copy the `id` value for the next step.

- [ ] **Step 2: Add the binding to `wrangler.jsonc`**

Open `wrangler.jsonc` and find the `kv_namespaces` array:
```jsonc
  "kv_namespaces": [
    { "binding": "MAGIC_LINKS", "id": "743b3e7249f649879ee90558c52bc7f5" },
    { "binding": "GUIDE_REQUESTS", "id": "05ee5b68b6894ab5866ccc2a003ce0de" }
  ],
```
Add the new binding using the real `id` from Step 1:
```jsonc
  "kv_namespaces": [
    { "binding": "MAGIC_LINKS", "id": "743b3e7249f649879ee90558c52bc7f5" },
    { "binding": "GUIDE_REQUESTS", "id": "05ee5b68b6894ab5866ccc2a003ce0de" },
    { "binding": "PROGRESS", "id": "<the id from Step 1>" }
  ],
```

- [ ] **Step 3: Verify the config is valid**

Run:
```bash
npx wrangler deploy --dry-run
```
Expected: no errors, output lists `env.PROGRESS` under bindings.

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc
git commit -m "Add PROGRESS KV namespace for mastery-dashboard sync"
```

---

### Task 2: Backend progress routes (`src/progress-routes.js`)

**Files:**
- Create: `src/progress-routes.js`
- Create: `test/progress-routes.test.js`

**Interfaces:**
- Consumes: `getSession(request, env)` from `../src/auth.js` (returns `{email, name, provider}` or `null`), `env.PROGRESS` (KV binding from Task 1).
- Produces: `handleGetProgress(request, env)`, `handlePostProgress(request, env)` — both exported functions taking `(Request, env)` and returning a `Response`. Later tasks (Task 3) wire these into `src/worker.js` at `GET /api/progress` and `POST /api/progress`.

**Default/empty progress shape** (returned by `GET` when a student has no data yet, and used as the merge base):
```js
{
  geometry: { mastery: {}, examples: {}, cardsKnown: [] },
  chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
  updatedAt: null
}
```

- [ ] **Step 1: Write the failing tests**

Create `test/progress-routes.test.js`:
```js
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGetProgress, handlePostProgress } from "../src/progress-routes.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    _store: store
  };
}

async function sessionCookieFor(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

function req(url, cookie, method, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  return new Request(url, { method: method || "GET", headers, body: body ? JSON.stringify(body) : undefined });
}

describe("handleGetProgress", () => {
  it("401s with no session", async () => {
    const res = await handleGetProgress(req("https://example.com/api/progress"), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("returns an empty default shape for a student with no saved progress", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleGetProgress(req("https://example.com/api/progress", cookie), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      geometry: { mastery: {}, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      updatedAt: null
    });
  });

  it("returns saved progress for a returning student", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const saved = {
      geometry: { mastery: { "1": { correct: 3, total: 4 } }, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      updatedAt: "2026-08-14T00:00:00.000Z"
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(saved) });
    const res = await handleGetProgress(req("https://example.com/api/progress", cookie), { SESSION_SECRET: SECRET, PROGRESS: kv });
    const data = await res.json();
    expect(data).toEqual(saved);
  });
});

describe("handlePostProgress", () => {
  it("401s with no session", async () => {
    const res = await handlePostProgress(req("https://example.com/api/progress", null, "POST", { subject: "geometry", mastery: {}, examples: {}, cardsKnown: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects a missing or invalid subject", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", { subject: "biology", mastery: {}, examples: {}, cardsKnown: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const badReq = new Request("https://example.com/api/progress", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "not json" });
    const res = await handlePostProgress(badReq, { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("saves progress for a subject and preserves the other subject's existing data", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = {
      geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] },
      chemistry: { mastery: {}, examples: {}, cardsKnown: [] },
      updatedAt: "2026-08-01T00:00:00.000Z"
    };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const body = { subject: "chemistry", mastery: { "3": { correct: 2, total: 2 } }, examples: { "1": true }, cardsKnown: ["c1"] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
    expect(saved.chemistry).toEqual({ mastery: { "3": { correct: 2, total: 2 } }, examples: { "1": true }, cardsKnown: ["c1"] });
    expect(typeof saved.updatedAt).toBe("string");
  });

  it("creates a fresh blob for a student's first-ever save", async () => {
    const cookie = await sessionCookieFor("newstudent@example.com");
    const kv = fakeKV();
    const body = { subject: "geometry", mastery: { "1": { correct: 2, total: 2 } }, examples: {}, cardsKnown: [] };
    const res = await handlePostProgress(req("https://example.com/api/progress", cookie, "POST", body), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const saved = JSON.parse(kv._store.get("progress:newstudent@example.com"));
    expect(saved.geometry.mastery).toEqual({ "1": { correct: 2, total: 2 } });
    expect(saved.chemistry).toEqual({ mastery: {}, examples: {}, cardsKnown: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/progress-routes.test.js`
Expected: FAIL — `Cannot find module '../src/progress-routes.js'`

- [ ] **Step 3: Write the implementation**

Create `src/progress-routes.js`:
```js
import { getSession } from "./auth.js";

const SUBJECTS = ["geometry", "chemistry"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function emptySubject() {
  return { mastery: {}, examples: {}, cardsKnown: [] };
}

function emptyBlob() {
  return { geometry: emptySubject(), chemistry: emptySubject(), updatedAt: null };
}

async function loadBlob(env, email) {
  if (!env.PROGRESS) return null;
  const raw = await env.PROGRESS.get("progress:" + email);
  if (!raw) return emptyBlob();
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(emptyBlob(), parsed);
  } catch (e) {
    return emptyBlob();
  }
}

export async function handleGetProgress(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  return json(blob);
}

export async function handlePostProgress(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const subject = body && body.subject;
  if (!SUBJECTS.includes(subject)) return json({ error: "Unknown subject" }, 400);

  const mastery = (body && typeof body.mastery === "object" && body.mastery) || {};
  const examples = (body && typeof body.examples === "object" && body.examples) || {};
  const cardsKnown = (body && Array.isArray(body.cardsKnown) && body.cardsKnown) || [];

  const blob = await loadBlob(env, session.email);
  blob[subject] = { mastery, examples, cardsKnown };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/progress-routes.test.js`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/progress-routes.js test/progress-routes.test.js
git commit -m "Add GET/POST /api/progress route handlers with tests"
```

---

### Task 3: Wire the routes into the Worker

**Files:**
- Modify: `src/worker.js`
- Modify: `test/worker.test.js` (add routing-level checks, following the existing style already in that file for `/api/admin/*`)

**Interfaces:**
- Consumes: `handleGetProgress`, `handlePostProgress` from `./progress-routes.js` (Task 2).

- [ ] **Step 1: Add the routing block**

In `src/worker.js`, add the import alongside the existing ones:
```js
import { handleGetProgress, handlePostProgress } from "./progress-routes.js";
```
Add a routing block right after the existing `/api/admin/guide-requests` block, before `const authRoute = AUTH_ROUTES[url.pathname];`:
```js
    if (url.pathname === "/api/progress") {
      if (request.method === "GET") return handleGetProgress(request, env);
      if (request.method === "POST") return handlePostProgress(request, env);
      return json({ error: "Method not allowed" }, 405);
    }
```

- [ ] **Step 2: Add routing-level tests**

Open `test/worker.test.js`, find the existing `describe` block(s) testing other `/api/*` routes, and add:
```js
describe("/api/progress routing", () => {
  it("returns 401 for GET with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/progress");
    expect(res.status).toBe(401);
  });

  it("returns 405 for DELETE", async () => {
    const res = await SELF.fetch("https://example.com/api/progress", { method: "DELETE" });
    expect(res.status).toBe(405);
  });
});
```
(If `test/worker.test.js` doesn't already import `SELF`/`describe`/`it`/`expect` at the top, add: `import { SELF } from "cloudflare:test"; import { describe, it, expect } from "vitest";` — check the top of the file first and only add what's missing.)

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, every test file green (including the new routing tests).

- [ ] **Step 4: Commit**

```bash
git add src/worker.js test/worker.test.js
git commit -m "Wire /api/progress routes into the Worker"
```

---

### Task 4: Shared mastery module — pure calculation functions

**Files:**
- Create: `public/shared/mastery.js`
- Create: `test/mastery.test.js`

**Interfaces:**
- Produces: `computeUnitStatus(unit)`, `computeReadiness(mastery, unitIds)`, `recommendNext(mastery, unitIds, unitNames)` — pure functions, no DOM/localStorage/fetch dependency, exported from `public/shared/mastery.js`. Task 5 adds the browser-only storage/sync functions to this same file. Tasks 6/7 import both from the HTML pages.

**Function contracts:**
- `computeUnitStatus({correct, total} | undefined)` → `"not-assessed" | "red" | "amber" | "green"`. Not-assessed when `total < 2` (or the unit has no record at all). `red` when `pct < 50`, `amber` when `50 <= pct < 80`, `green` when `pct >= 80`.
- `computeReadiness(mastery, unitIds)` → `{ pct: number|null, assessedCount: number, totalCount: number }`. `mastery` is `{unitId: {correct, total}}`. `unitIds` is the full list of unit ids for the subject. `pct` is the average mastery % across assessed units only (rounded), or `null` if zero units are assessed yet.
- `recommendNext(mastery, unitIds, unitNames)` → `{ type: "diagnostic" } | { type: "practice", unitId, unitName, pct } | { type: "review" }`. `unitNames` is `{unitId: "display name"}`. Returns `{type:"diagnostic"}` if nothing is assessed yet; the weakest assessed unit as `{type:"practice", ...}` if any assessed unit is below 80%; `{type:"review"}` if every assessed unit is >=80% (nothing weak left to target).

- [ ] **Step 1: Write the failing tests**

Create `test/mastery.test.js`:
```js
import { describe, it, expect } from "vitest";
import { computeUnitStatus, computeReadiness, recommendNext } from "../public/shared/mastery.js";

describe("computeUnitStatus", () => {
  it("is not-assessed with no record", () => {
    expect(computeUnitStatus(undefined)).toBe("not-assessed");
  });

  it("is not-assessed below the 2-question threshold", () => {
    expect(computeUnitStatus({ correct: 1, total: 1 })).toBe("not-assessed");
  });

  it("is red below 50%", () => {
    expect(computeUnitStatus({ correct: 1, total: 3 })).toBe("red");
  });

  it("is amber between 50% and 80%", () => {
    expect(computeUnitStatus({ correct: 3, total: 5 })).toBe("amber");
  });

  it("is green at or above 80%", () => {
    expect(computeUnitStatus({ correct: 4, total: 5 })).toBe("green");
  });
});

describe("computeReadiness", () => {
  it("returns null pct when nothing is assessed", () => {
    const result = computeReadiness({}, [1, 2, 3]);
    expect(result).toEqual({ pct: null, assessedCount: 0, totalCount: 3 });
  });

  it("averages only assessed units", () => {
    const mastery = {
      1: { correct: 4, total: 4 },  // 100%, assessed
      2: { correct: 1, total: 1 },  // not assessed (total < 2)
      3: { correct: 1, total: 4 }   // 25%, assessed
    };
    const result = computeReadiness(mastery, [1, 2, 3]);
    expect(result).toEqual({ pct: 63, assessedCount: 2, totalCount: 3 });
  });
});

describe("recommendNext", () => {
  const unitNames = { 1: "Foundations", 2: "Circle Geometry", 3: "Transformations" };

  it("recommends the diagnostic when nothing is assessed", () => {
    expect(recommendNext({}, [1, 2, 3], unitNames)).toEqual({ type: "diagnostic" });
  });

  it("recommends the single weakest assessed unit", () => {
    const mastery = {
      1: { correct: 4, total: 5 },  // 80%, green
      2: { correct: 1, total: 4 },  // 25%, red - weakest
      3: { correct: 3, total: 5 }   // 60%, amber
    };
    expect(recommendNext(mastery, [1, 2, 3], unitNames)).toEqual({ type: "practice", unitId: 2, unitName: "Circle Geometry", pct: 25 });
  });

  it("recommends review when every assessed unit is >= 80%", () => {
    const mastery = {
      1: { correct: 4, total: 5 },  // 80%
      2: { correct: 5, total: 5 }   // 100%
    };
    expect(recommendNext(mastery, [1, 2], unitNames)).toEqual({ type: "review" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mastery.test.js`
Expected: FAIL — `Cannot find module '../public/shared/mastery.js'`

- [ ] **Step 3: Write the implementation (pure functions only for now)**

Create `public/shared/mastery.js`:
```js
export function computeUnitStatus(record) {
  if (!record || record.total < 2) return "not-assessed";
  const pct = Math.round((record.correct / record.total) * 100);
  if (pct >= 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

export function computeReadiness(mastery, unitIds) {
  const assessed = unitIds
    .map(id => mastery[id])
    .filter(record => record && record.total >= 2);

  if (assessed.length === 0) {
    return { pct: null, assessedCount: 0, totalCount: unitIds.length };
  }

  const sumPct = assessed.reduce((sum, record) => sum + (record.correct / record.total) * 100, 0);
  return {
    pct: Math.round(sumPct / assessed.length),
    assessedCount: assessed.length,
    totalCount: unitIds.length
  };
}

export function recommendNext(mastery, unitIds, unitNames) {
  const assessed = unitIds
    .map(id => ({ id, record: mastery[id] }))
    .filter(u => u.record && u.record.total >= 2)
    .map(u => ({ id: u.id, pct: Math.round((u.record.correct / u.record.total) * 100) }));

  if (assessed.length === 0) return { type: "diagnostic" };

  const weakest = assessed.reduce((min, u) => (u.pct < min.pct ? u : min), assessed[0]);
  if (weakest.pct >= 80) return { type: "review" };

  return { type: "practice", unitId: weakest.id, unitName: unitNames[weakest.id], pct: weakest.pct };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mastery.test.js`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add public/shared/mastery.js test/mastery.test.js
git commit -m "Add pure mastery/readiness calculation functions with tests"
```

---

### Task 5: Shared mastery module — browser storage & server sync

**Files:**
- Modify: `public/shared/mastery.js` (append to the file created in Task 4)

**Interfaces:**
- Consumes: `computeUnitStatus`, `computeReadiness`, `recommendNext` (already in the same file from Task 4); browser globals `localStorage`, `fetch`, `document`, `window` (not available/testable under Vitest — this code is verified live in the browser in Task 6/7, not unit tested, matching the design spec's testing plan).
- Produces: `createMastery(subject, unitIds, unitNames)` — a factory function returning an object with methods `recordAnswer(unitId, correct)`, `markExampleDone(id)`, `markCardKnown(id)`, `getSnapshot()`, `getReadiness()`, `getRecommendation()`, `init()` (call once on page load — loads localStorage, then merges server data if logged in, then starts the debounced background sync). This is what Tasks 6/7 import and call from the Geometry/Chemistry pages.

- [ ] **Step 1: Append the browser-facing code**

Add to the end of `public/shared/mastery.js` (after the Task 4 functions, same file):
```js
const SYNC_DEBOUNCE_MS = 10000;

export function createMastery(subject, unitIds, unitNames) {
  const storageKey = "ssMastery_" + subject;
  let state = { mastery: {}, examples: {}, cardsKnown: [] };
  let syncTimer = null;
  let dirty = false;

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) state = Object.assign(state, JSON.parse(raw));
    } catch (e) { /* localStorage unavailable or corrupt - keep defaults */ }
  }

  function saveLocal() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function scheduleSync() {
    dirty = true;
    if (syncTimer) return;
    syncTimer = setTimeout(pushToServer, SYNC_DEBOUNCE_MS);
  }

  async function pushToServer() {
    syncTimer = null;
    if (!dirty) return;
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject, mastery: state.mastery, examples: state.examples, cardsKnown: state.cardsKnown })
      });
      if (res.ok) {
        dirty = false;
      } else {
        scheduleSync(); // server rejected it (e.g. session expired) - retry on the next cycle
      }
    } catch (e) {
      scheduleSync(); // offline - stay dirty and retry on the next cycle
    }
  }

  function flushSyncNow() {
    if (dirty) pushToServer();
  }

  async function mergeFromServer() {
    try {
      const res = await fetch("/api/progress");
      if (!res.ok) return;
      const blob = await res.json();
      const serverSubject = blob && blob[subject];
      if (serverSubject) {
        state = { mastery: serverSubject.mastery || {}, examples: serverSubject.examples || {}, cardsKnown: serverSubject.cardsKnown || [] };
        saveLocal();
      }
    } catch (e) { /* offline or not logged in - keep local state */ }
  }

  return {
    async init() {
      load();
      await mergeFromServer();
    },
    recordAnswer(unitId, correct) {
      const rec = state.mastery[unitId] || (state.mastery[unitId] = { correct: 0, total: 0 });
      rec.total++;
      if (correct) rec.correct++;
      saveLocal();
      scheduleSync();
    },
    markExampleDone(id) {
      state.examples[id] = true;
      saveLocal();
      scheduleSync();
    },
    markCardKnown(id) {
      if (!state.cardsKnown.includes(id)) state.cardsKnown.push(id);
      saveLocal();
      scheduleSync();
    },
    getSnapshot() {
      return state;
    },
    getReadiness() {
      return computeReadiness(state.mastery, unitIds);
    },
    getRecommendation() {
      return recommendNext(state.mastery, unitIds, unitNames);
    },
    flushSyncNow
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && window.__ssMasteryInstances) {
      window.__ssMasteryInstances.forEach(m => m.flushSyncNow());
    }
  });
  window.addEventListener("beforeunload", () => {
    if (window.__ssMasteryInstances) {
      window.__ssMasteryInstances.forEach(m => m.flushSyncNow());
    }
  });
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS, all tests green (the new browser-facing code has no unit tests — `window`/`document`/`localStorage`/`fetch` aren't testable under this Workers-runtime test pool, and the design spec calls for live browser verification here instead).

- [ ] **Step 3: Commit**

```bash
git add public/shared/mastery.js
git commit -m "Add browser storage + debounced server sync to shared mastery module"
```

---

### Task 6: Migrate Geometry onto the shared module + unit-filtered practice

**Files:**
- Modify: `public/geometry/index.html`

**Interfaces:**
- Consumes: `createMastery` from `/shared/mastery.js` (Tasks 4-5).

This task replaces Geometry's existing inline `GEO_STORE`/`geoSave`/`geoLoad`/`geoOverall` logic with the shared module, and adds unit-filtered practice via a `?practice=<unitId>` URL param.

- [ ] **Step 1: Load the shared module**

In `public/geometry/index.html`, find the `<head>` section and add, right before the closing `</head>`:
```html
<script type="module" src="/shared/mastery.js"></script>
```
Since the rest of the page's scripts are plain (non-module) scripts, also add a small bridge right after that import so non-module code can reach it. Replace the single line above with:
```html
<script type="module">
  import { createMastery } from '/shared/mastery.js';
  window.__ssCreateMastery = createMastery;
</script>
```

- [ ] **Step 2: Replace `GEO_STORE`/`geoSave`/`geoLoad` with the shared instance**

Find the existing lines (from the earlier `grep`):
```js
function geoSave(){try{localStorage.setItem(GEO_KEY,JSON.stringify(GEO_STORE));}catch(e){}}
function geoLoad(){try{const r=localStorage.getItem(GEO_KEY);if(r)GEO_STORE=Object.assign({fc:{},mastery:{},examples:{},lastTab:'guide'},JSON.parse(r));}catch(e){}}
```
Replace the `GEO_STORE` declaration and these two functions with:
```js
let GEO_MASTERY; // set in the init IIFE below, once UNITS is defined
window.__ssMasteryInstances = window.__ssMasteryInstances || [];

async function geoInitMastery() {
  const unitIds = UNITS.map(u => u.id);
  const unitNames = {};
  UNITS.forEach(u => { unitNames[u.id] = u.name; });
  GEO_MASTERY = window.__ssCreateMastery('geometry', unitIds, unitNames);
  await GEO_MASTERY.init();
  window.__ssMasteryInstances.push(GEO_MASTERY);
  renderDashboard();
}
geoInitMastery();
```
(`UNITS` is already defined earlier in the same file per the existing code — this must run after that definition; if `geoInitMastery()`'s call site ends up before `UNITS` is declared, move the call to immediately after the `UNITS` array's closing `];`.)

- [ ] **Step 3: Update the answer-recording call site**

Find the line recording quiz answers (from the earlier `grep`):
```js
if(q){const m=GEO_STORE.mastery[q.u]||(GEO_STORE.mastery[q.u]={correct:0,total:0});m.total++;if(i===q.a)m.correct++;geoSave();renderDashboard();}
```
Replace with:
```js
if(q){GEO_MASTERY.recordAnswer(q.u, i===q.a);renderDashboard();}
```

- [ ] **Step 4: Update `geoOverall()` and the dashboard renderer**

Find:
```js
function geoOverall(){let c=0,tt=0;for(const u in GEO_STORE.mastery){c+=GEO_STORE.mastery[u].correct;tt+=GEO_STORE.mastery[u].total;}return{c:c,t:tt,pct:tt?Math.round(c/tt*100):0};}
```
Replace with:
```js
function geoOverall(){const s=GEO_MASTERY.getSnapshot();let c=0,tt=0;for(const u in s.mastery){c+=s.mastery[u].correct;tt+=s.mastery[u].total;}return{c:c,t:tt,pct:tt?Math.round(c/tt*100):0};}
```
Find the dashboard bar-rendering line (uses `GEO_STORE.mastery[u.id]`) and change `GEO_STORE.mastery[u.id]` to `GEO_MASTERY.getSnapshot().mastery[u.id]` (same expression, just reading through the new accessor — keep the rest of that line's rendering logic unchanged).

- [ ] **Step 5: Add unit-filtered practice mode**

Find the quiz-question-pool setup function (the one that builds the array of questions the Quiz tab draws from — it's the pool used outside of `startDiagnostic`). Near the top of that function, add:
```js
const practiceUnitParam = new URLSearchParams(location.search).get('practice');
if (practiceUnitParam) {
  const practiceUnitId = parseInt(practiceUnitParam, 10);
  qPool = qPool.filter(q => q.u === practiceUnitId);
}
```
(Insert this filter right after `qPool` is populated with the full question set and before it's shuffled/used, so filtering happens once per quiz-start.)

- [ ] **Step 6: Manual verification**

This step has no automated test (DOM/localStorage/fetch behavior, per the design spec's testing plan). Verify live:
1. Run `npx wrangler dev` locally, open the Geometry page, sign in.
2. Answer a few quiz questions — confirm the dashboard bars update as before.
3. Reload the page — confirm progress persists (now via the shared module).
4. Open browser dev tools → Application → Local Storage — confirm a `ssMastery_geometry` key exists with the expected shape.
5. Visit `/geometry?practice=1` and start a quiz — confirm only Unit 1 questions appear.

- [ ] **Step 7: Commit**

```bash
git add public/geometry/index.html
git commit -m "Migrate Geometry onto shared mastery module, add unit-filtered practice"
```

---

### Task 7: Add mastery tracking to Chemistry via the shared module

**Files:**
- Modify: `public/chemistry/index.html`

**Interfaces:**
- Consumes: `createMastery` from `/shared/mastery.js` (Tasks 4-5), same pattern as Task 6.

Chemistry currently has no persistent per-unit tracking at all (only an in-memory `score++` that resets on reload). This task gives it the same tracking Geometry now has.

- [ ] **Step 1: Load the shared module**

Same as Task 6 Step 1, but in `public/chemistry/index.html`:
```html
<script type="module">
  import { createMastery } from '/shared/mastery.js';
  window.__ssCreateMastery = createMastery;
</script>
```

- [ ] **Step 2: Initialize the shared instance**

Find Chemistry's units array (the equivalent of Geometry's `UNITS` — confirm its exact variable name first: `grep -n "^const UNITS\|^const CHEM_UNITS" public/chemistry/index.html`). Using that name (assume `UNITS` if it matches Geometry's convention; substitute the real name if different), add right after that array's closing `];`:
```js
let CHEM_MASTERY;
window.__ssMasteryInstances = window.__ssMasteryInstances || [];

async function chemInitMastery() {
  const unitIds = UNITS.map(u => u.id);
  const unitNames = {};
  UNITS.forEach(u => { unitNames[u.id] = u.name; });
  CHEM_MASTERY = window.__ssCreateMastery('chemistry', unitIds, unitNames);
  await CHEM_MASTERY.init();
  window.__ssMasteryInstances.push(CHEM_MASTERY);
}
chemInitMastery();
```

- [ ] **Step 3: Record answers into the shared instance**

Find the line identified earlier: `if(i===q.a)score++;`. Immediately after that line, add:
```js
CHEM_MASTERY.recordAnswer(q.u, i===q.a);
```
(`q.u` is the unit id on the current question object — confirm the question object uses the same `.u` field Geometry's does by checking a few lines above/below this line; Chemistry's question data should already carry a unit id since the site advertises per-unit content, even though nothing currently reads it for tracking.)

- [ ] **Step 4: Add unit-filtered practice mode**

Same pattern as Task 6 Step 5 — find Chemistry's quiz pool setup function and add the same `practiceUnitParam` filter block right after the pool is populated.

- [ ] **Step 5: Add a minimal dashboard readout (optional but recommended for parity with Geometry)**

If Chemistry has no equivalent of Geometry's `renderDashboard()`/`.dash-bar` UI, skip visual parity for now — the `/dashboard` page (Task 8) is where Chemistry's mastery becomes visible to the student. Do not build a duplicate in-page dashboard here; that would be scope creep beyond what this task needs.

- [ ] **Step 6: Manual verification**

Same as Task 6 Step 6, but on the Chemistry page: answer questions, reload, confirm `ssMastery_chemistry` appears in Local Storage with real data, confirm `/chemistry?practice=<unitId>` filters correctly.

- [ ] **Step 7: Commit**

```bash
git add public/chemistry/index.html
git commit -m "Add mastery tracking to Chemistry via shared module"
```

---

### Task 8: The `/dashboard` page

**Files:**
- Create: `public/dashboard/index.html`
- Modify: `public/index.html`, `public/about/index.html`, `public/request/index.html`, `public/privacy/index.html`, `public/terms/index.html` (add a "Dashboard" nav link, logged-in-only)

**Interfaces:**
- Consumes: `GET /api/progress` (Task 2/3), `computeReadiness`/`recommendNext` from `/shared/mastery.js` (Task 4), `ssCheckSession()`/`SS_SESSION` pattern already used on every other page (see `public/about/index.html` for the exact existing pattern to copy).

- [ ] **Step 1: Create the dashboard page**

Create `public/dashboard/index.html`, starting from the same header/footer/login-panel boilerplate as `public/about/index.html` (copy that file's `<head>` styles and the `ssLoginBoxHtml`/`ssToggleLoginPanel`/`ssLogout`/`ssRenderAccountUI`/`ssCheckSession` script block verbatim — these are the same on every page). Replace the page body and add dashboard-specific logic:

```html
<title>Your Dashboard — StudyStacks</title>
```
(in `<head>`, replacing the `<title>` from the copied template)

Body content (replacing the about-page's hero/card section, same `ss-hero`/`ss-card` classes):
```html
<div class="ss-hero" style="text-align:center;padding:56px 32px 24px;">
  <div class="ss-hero-inner">
    <h1 class="ss-hero-anim" style="animation-delay:0s;font-size:36px;font-weight:800;color:#3d2a1e;margin:0;letter-spacing:-0.02em;">
      Your Dashboard
    </h1>
  </div>
</div>

<div id="dash-gate" style="display:none;padding:0 32px 64px;text-align:center;">
  <div class="ss-card" style="max-width:480px;margin:0 auto;">
    <p style="font-size:16px;color:#3d2a1e;margin:0 0 16px;">Sign in to see your exam readiness and what to study next.</p>
    <div class="ss-login-box"></div>
  </div>
</div>

<div id="dash-content" style="display:none;padding:0 32px 64px;">
  <div style="max-width:840px;margin:0 auto;display:grid;gap:20px;">
    <div id="dash-subject-geometry" class="ss-card"></div>
    <div id="dash-subject-chemistry" class="ss-card"></div>
  </div>
</div>
```

Add module import + dashboard script right before the closing `</body>` (after the copied session-handling script block):
```html
<script type="module">
import { computeReadiness, recommendNext } from '/shared/mastery.js';

const SUBJECTS = [
  { key: 'geometry', label: 'Geometry', href: '/geometry' },
  { key: 'chemistry', label: 'Chemistry', href: '/chemistry' }
];

function statusColor(pct) {
  if (pct === null) return '#c9a688';
  if (pct >= 80) return '#1a7a4f';
  if (pct >= 50) return '#b5862a';
  return '#c2410c';
}

function renderSubject(subjectKey, label, href, subjectData, unitIds, unitNames) {
  const el = document.getElementById('dash-subject-' + subjectKey);
  if (!el) return;

  if (!unitIds.length) {
    el.innerHTML = '<div style="font-weight:800;font-size:18px;color:#3d2a1e;">' + label + '</div>'
      + '<p style="color:#a8826a;font-size:14px;margin:8px 0 0;">Unit data isn\'t available for this subject yet.</p>';
    return;
  }

  const readiness = computeReadiness(subjectData.mastery || {}, unitIds);
  const rec = recommendNext(subjectData.mastery || {}, unitIds, unitNames);

  let recHtml;
  if (rec.type === 'diagnostic') {
    recHtml = '<a href="' + href + '" class="ss-cta-btn" style="display:inline-block;background:#ff8a4c;color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Take the diagnostic →</a>';
  } else if (rec.type === 'practice') {
    recHtml = '<p style="margin:0 0 10px;font-size:14px;color:#5c4433;">You\'re weakest here: <b>' + rec.unitName + '</b> (' + rec.pct + '%)</p>'
      + '<a href="' + href + '?practice=' + rec.unitId + '" class="ss-cta-btn" style="display:inline-block;background:#ff8a4c;color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Practice ' + rec.unitName + ' →</a>';
  } else {
    recHtml = '<p style="margin:0;font-size:14px;color:#5c4433;">Every assessed topic is scoring well — try the practice exam or review flashcards.</p>';
  }

  const scoreText = readiness.pct === null ? '—' : readiness.pct + '%';
  const notAssessedCount = readiness.totalCount - readiness.assessedCount;
  const caveat = notAssessedCount > 0
    ? notAssessedCount + ' of ' + readiness.totalCount + ' units not yet assessed'
    : 'All ' + readiness.totalCount + ' units assessed';

  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">'
    + '<div style="font-weight:800;font-size:18px;color:#3d2a1e;">' + label + '</div>'
    + '<div style="font-weight:800;font-size:28px;color:' + statusColor(readiness.pct) + ';">' + scoreText + '</div>'
    + '</div>'
    + '<p style="margin:0 0 16px;font-size:13px;color:#a8826a;">' + caveat + '</p>'
    + '<div style="border-top:1px solid #ffe4cc;padding-top:14px;">' + recHtml + '</div>';
}

async function loadDashboard() {
  const session = await ssCheckSession();
  const gate = document.getElementById('dash-gate');
  const content = document.getElementById('dash-content');
  if (!session) {
    gate.style.display = 'block';
    gate.querySelector('.ss-login-box').innerHTML = ssLoginBoxHtml();
    return;
  }
  content.style.display = 'block';

  function localFallback() {
    // Same keys/shape the shared module writes on the Geometry/Chemistry pages
    // (same origin, so this page can read them directly) - used only if the
    // server fetch below fails, per the design spec's error-handling section.
    function readLocal(subject) {
      try {
        const raw = localStorage.getItem('ssMastery_' + subject);
        return raw ? JSON.parse(raw) : { mastery: {} };
      } catch (e) { return { mastery: {} }; }
    }
    return { geometry: readLocal('geometry'), chemistry: readLocal('chemistry') };
  }

  let blob;
  let syncFailed = false;
  try {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error('bad response');
    blob = await res.json();
  } catch (e) {
    blob = localFallback();
    syncFailed = true;
  }

  if (syncFailed) {
    const notice = document.createElement('p');
    notice.style.cssText = 'max-width:840px;margin:0 auto 12px;font-size:13px;color:#a8826a;text-align:center;';
    notice.textContent = "Couldn't sync with your account — showing your last saved progress on this device.";
    content.insertBefore(notice, content.firstChild);
  }

  // Unit id/name lists are duplicated here in minimal form because the full
  // UNITS arrays live inside geometry/index.html and chemistry/index.html,
  // which this page does not load. Keep this list in sync if units change.
  const GEOMETRY_UNIT_COUNT = 11;
  const CHEMISTRY_UNIT_COUNT = 16;
  const geoUnitIds = Array.from({ length: GEOMETRY_UNIT_COUNT }, (_, i) => i + 1);
  const chemUnitIds = Array.from({ length: CHEMISTRY_UNIT_COUNT }, (_, i) => i + 1);
  const geoUnitNames = {}; geoUnitIds.forEach(id => { geoUnitNames[id] = 'Unit ' + id; });
  const chemUnitNames = {}; chemUnitIds.forEach(id => { chemUnitNames[id] = 'Unit ' + id; });

  renderSubject('geometry', 'Geometry', '/geometry', blob.geometry || {}, geoUnitIds, geoUnitNames);
  renderSubject('chemistry', 'Chemistry', '/chemistry', blob.chemistry || {}, chemUnitIds, chemUnitNames);
}

loadDashboard();
</script>
```

- [ ] **Step 2: Add a "Dashboard" nav link on every page**

In `public/index.html`, `public/about/index.html`, `public/request/index.html`, `public/privacy/index.html`, `public/terms/index.html`: find the nav-links block (same structure in every file, e.g. from `public/index.html`):
```html
<a href="/request" class="nav-hide-sm" style="color:#7c4a2d;text-decoration:none;">Request a Guide</a>
```
Add right after it:
```html
<a href="/dashboard" class="nav-hide-sm" style="color:#7c4a2d;text-decoration:none;">Dashboard</a>
```

- [ ] **Step 3: Manual verification**

No automated test for this page (same reasoning as Tasks 6/7 — DOM/fetch-dependent). Verify live:
1. Run `npx wrangler dev`, visit `/dashboard` while signed out — confirm the sign-in gate shows.
2. Sign in, answer a few Geometry and Chemistry questions on their respective pages.
3. Revisit `/dashboard` — confirm both subjects show a readiness score (or "—" if nothing assessed), the correct "not yet assessed" caveat count, and a recommendation that matches what was just answered.
4. Click through the "Practice X" link — confirm it lands on the correct page with `?practice=<id>` and only that unit's questions appear.

- [ ] **Step 4: Commit**

```bash
git add public/dashboard/index.html public/index.html public/about/index.html public/request/index.html public/privacy/index.html public/terms/index.html
git commit -m "Add /dashboard page with per-subject readiness score and study-next recommendation"
```

---

### Task 9: Full regression pass and deploy

**Files:** None (verification + deploy only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — every test file green, including all new ones from Tasks 2, 3, 4.

- [ ] **Step 2: Deploy**

```bash
npx wrangler deploy
```

- [ ] **Step 3: Live smoke test**

Repeat the manual verification steps from Tasks 6, 7, and 8 against the real deployed `https://studystacks.org`, using a real Google/GitHub sign-in.

- [ ] **Step 4: Merge the worktree branch into main**

```bash
git -C /Users/smiley/Claude/Projects/School/studystacks merge worktree-studystacks-hub -m "Merge mastery dashboard system"
git -C /Users/smiley/Claude/Projects/School/studystacks rev-parse HEAD^{tree}
git -C /Users/smiley/Claude/Projects/School/studystacks/.claude/worktrees/studystacks-hub rev-parse HEAD^{tree}
```
Expected: both `rev-parse` commands print the same tree hash, confirming the merge captured everything.
