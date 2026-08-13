# StudyStacks Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified StudyStacks Cloudflare Worker — homepage, shared subject-aware chatbot endpoint, and the migrated (unmodified) Geometry guide — replacing the standalone `geometry-regents-guide` Worker.

**Architecture:** One Cloudflare Worker (Static Assets + Workers AI) serves everything. `src/worker.js` routes `/api/chat` to a shared handler in `src/chat.js` (subject inferred from the `Referer` header, defaulting to `geometry`) and falls back to `env.ASSETS.fetch(request)` for everything else, which serves `public/index.html` (homepage) and `public/geometry/index.html` (the Geometry guide, copied in unmodified).

**Tech Stack:** Cloudflare Workers, Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8`), Workers Static Assets, Vitest 4 + `@cloudflare/vitest-pool-workers` 0.21 for testing, Wrangler 4.

## Global Constraints

- Geometry's existing `public/index.html` (currently at `/Users/smiley/Claude/Projects/School/geometry-guide-site/public/index.html`) must be copied byte-for-byte, no edits — per spec, its internals are explicitly out of scope for this project.
- Brand: name "StudyStacks", warm/approachable palette — background `#fffaf5`, accent `#c2410c` (text) / `#ff8a4c` (buttons), rounded corners 12–18px, font stack `'Nunito','Segoe UI',system-ui,sans-serif`. Distinct from Geometry's own dark/gold look.
- Chat request/response contract must stay `{history: [...]}` in, `{reply: "..."}` out — Geometry's existing frontend JS calls this shape already and must not need changes.
- Chemistry, Algebra 2, and Global History II are placeholder "Coming Soon" cards only — no functional pages, no chat subject entries, in this plan.
- No content copied from Turbo's "Expert Study Guides" library, ever.
- After deploy, the standalone `geometry-regents-guide` Worker is deleted — but only after the migrated `/geometry` route is verified live.

---

### Task 1: Project scaffolding and test harness

**Files:**
- Create: `/Users/smiley/Claude/Projects/School/studystacks/package.json`
- Create: `/Users/smiley/Claude/Projects/School/studystacks/wrangler.jsonc`
- Create: `/Users/smiley/Claude/Projects/School/studystacks/vitest.config.js`
- Create: `/Users/smiley/Claude/Projects/School/studystacks/src/worker.js`
- Create: `/Users/smiley/Claude/Projects/School/studystacks/public/index.html`
- Test: `/Users/smiley/Claude/Projects/School/studystacks/test/worker.test.js`

**Interfaces:**
- Produces: a working `npx vitest run` pipeline dispatching through the real configured Worker via `SELF.fetch` (from `cloudflare:test`), and a minimal `export default { async fetch(request) {...} }` in `src/worker.js` that later tasks will replace.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "studystacks",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "vitest": "^4.1.10",
    "@cloudflare/vitest-pool-workers": "^0.21.2",
    "wrangler": "^4.122.0"
  }
}
```

- [ ] **Step 2: Write a placeholder public/index.html (Task 5 replaces this with the real homepage)**

```html
<!DOCTYPE html>
<html>
<head><title>StudyStacks</title></head>
<body>placeholder</body>
</html>
```

- [ ] **Step 3: Write wrangler.jsonc**

```jsonc
{
  "name": "studystacks",
  "main": "src/worker.js",
  "compatibility_date": "2026-08-01",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "ai": {
    "binding": "AI"
  }
}
```

- [ ] **Step 4: Write vitest.config.js**

```js
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" }
      }
    }
  }
});
```

- [ ] **Step 5: Write the minimal worker stub**

```js
export default {
  async fetch(request) {
    return new Response("ok");
  }
};
```

- [ ] **Step 6: Write the bootstrap test**

```js
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker bootstrap", () => {
  it("responds to any request", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
```

- [ ] **Step 7: Install dependencies**

Run: `cd /Users/smiley/Claude/Projects/School/studystacks && npm install`
Expected: installs without error, creates `node_modules/` and `package-lock.json`

- [ ] **Step 8: Run the test to verify the harness works**

Run: `npx vitest run`
Expected: PASS — `worker bootstrap > responds to any request`

- [ ] **Step 9: Commit**

```bash
cd /Users/smiley/Claude/Projects/School/studystacks
git add package.json package-lock.json wrangler.jsonc vitest.config.js src/worker.js public/index.html test/worker.test.js
git commit -m "Scaffold StudyStacks project with working test harness"
```

---

### Task 2: Pure message-handling functions (sanitizeMessages, subjectFromReferer)

**Files:**
- Create: `/Users/smiley/Claude/Projects/School/studystacks/src/chat.js`
- Test: `/Users/smiley/Claude/Projects/School/studystacks/test/chat.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `SUBJECTS: Record<string,string>` (subject key → system prompt, currently just `geometry`), `DEFAULT_SUBJECT: "geometry"`, `sanitizeMessages(historyRaw: unknown) => {role:"user"|"assistant", content:string}[]`, `subjectFromReferer(refererHeader: string|null) => string`. Task 3 imports all four from this file.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from "vitest";
import { sanitizeMessages, subjectFromReferer, DEFAULT_SUBJECT } from "../src/chat.js";

describe("sanitizeMessages", () => {
  it("returns empty array for empty input", () => {
    expect(sanitizeMessages([])).toEqual([]);
  });

  it("returns empty array for non-array input", () => {
    expect(sanitizeMessages(undefined)).toEqual([]);
    expect(sanitizeMessages(null)).toEqual([]);
  });

  it("drops a leading assistant/bot message so the array starts with user", () => {
    const result = sanitizeMessages([
      { role: "bot", content: "Hi! Ask me anything." },
      { role: "user", content: "what is a rhombus" }
    ]);
    expect(result).toEqual([{ role: "user", content: "what is a rhombus" }]);
  });

  it("merges consecutive same-role messages instead of leaving them back-to-back", () => {
    const result = sanitizeMessages([
      { role: "user", content: "q1" },
      { role: "user", content: "q1 dup" }
    ]);
    expect(result).toEqual([{ role: "user", content: "q1\n\nq1 dup" }]);
  });

  it("drops a trailing assistant message so the array ends with user", () => {
    const result = sanitizeMessages([
      { role: "user", content: "q1" },
      { role: "bot", content: "a1" }
    ]);
    expect(result).toEqual([{ role: "user", content: "q1" }]);
  });

  it("preserves a normal alternating multi-turn conversation", () => {
    const result = sanitizeMessages([
      { role: "bot", content: "Hi!" },
      { role: "user", content: "q1" },
      { role: "bot", content: "a1" },
      { role: "user", content: "q2" }
    ]);
    expect(result).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" }
    ]);
  });

  it("truncates content longer than 2000 characters", () => {
    const long = "x".repeat(2500);
    const result = sanitizeMessages([{ role: "user", content: long }]);
    expect(result[0].content.length).toBe(2000);
  });

  it("keeps only the last 9 messages before processing", () => {
    const history = [];
    for (let i = 0; i < 12; i++) {
      history.push({ role: i % 2 === 0 ? "user" : "bot", content: "msg" + i });
    }
    const result = sanitizeMessages(history);
    expect(result[0].content).toBe("msg3");
  });
});

describe("subjectFromReferer", () => {
  it("returns the default subject when no referer is given", () => {
    expect(subjectFromReferer(null)).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer(undefined)).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer("")).toBe(DEFAULT_SUBJECT);
  });

  it("returns the default subject for a malformed URL", () => {
    expect(subjectFromReferer("not a url")).toBe(DEFAULT_SUBJECT);
  });

  it("extracts a known subject from the referer path", () => {
    expect(subjectFromReferer("https://studystacks.example/geometry")).toBe("geometry");
    expect(subjectFromReferer("https://studystacks.example/geometry/")).toBe("geometry");
  });

  it("falls back to the default subject for an unregistered path segment", () => {
    expect(subjectFromReferer("https://studystacks.example/chemistry")).toBe(DEFAULT_SUBJECT);
  });

  it("falls back to the default subject for the homepage referer", () => {
    expect(subjectFromReferer("https://studystacks.example/")).toBe(DEFAULT_SUBJECT);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/chat.test.js`
Expected: FAIL — `Cannot find module '../src/chat.js'` (file doesn't exist yet)

- [ ] **Step 3: Write src/chat.js**

```js
export const SUBJECTS = {
  geometry: "You are a concise, friendly tutor helping a student study for the NYS Geometry Regents exam. Keep answers short (2-5 sentences), accurate, and focused on the question asked."
};

export const DEFAULT_SUBJECT = "geometry";

const MAX_INPUT_CHARS = 2000;
const MAX_HISTORY = 9;

export function sanitizeMessages(historyRaw) {
  const raw = Array.isArray(historyRaw) ? historyRaw.slice(-MAX_HISTORY) : [];
  const mapped = raw
    .filter(m => m && m.content)
    .map(m => ({
      role: (m.role === "assistant" || m.role === "bot") ? "assistant" : "user",
      content: String(m.content).slice(0, MAX_INPUT_CHARS)
    }));

  const merged = [];
  for (const m of mapped) {
    if (merged.length && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += "\n\n" + m.content;
    } else {
      merged.push(m);
    }
  }

  while (merged.length && merged[0].role !== "user") merged.shift();
  while (merged.length && merged[merged.length - 1].role !== "user") merged.pop();

  return merged;
}

export function subjectFromReferer(refererHeader) {
  if (!refererHeader) return DEFAULT_SUBJECT;
  let path;
  try {
    path = new URL(refererHeader).pathname;
  } catch (e) {
    return DEFAULT_SUBJECT;
  }
  const segment = path.split("/").filter(Boolean)[0];
  return (segment && SUBJECTS[segment]) ? segment : DEFAULT_SUBJECT;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/chat.test.js`
Expected: PASS — all 12 tests in `sanitizeMessages` and `subjectFromReferer`

- [ ] **Step 5: Commit**

```bash
cd /Users/smiley/Claude/Projects/School/studystacks
git add src/chat.js test/chat.test.js
git commit -m "Add sanitizeMessages and subjectFromReferer with tests"
```

---

### Task 3: Chat request handler (Workers AI integration)

**Files:**
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/src/chat.js`
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/test/chat.test.js`

**Interfaces:**
- Consumes: `SUBJECTS`, `DEFAULT_SUBJECT`, `sanitizeMessages`, `subjectFromReferer` from this same file (Task 2).
- Produces: `handleChatPost(request: Request, env: {AI?: {run: Function}}) => Promise<Response>`, `handleChatOptions() => Response`, `MODEL: string`. Task 4 imports `handleChatPost` and `handleChatOptions`.

- [ ] **Step 1: Add the failing tests to test/chat.test.js**

Append to the existing file (keep all Task 2 content above this):

```js
import { vi } from "vitest";
import { handleChatPost, handleChatOptions, MODEL } from "../src/chat.js";

describe("handleChatPost", () => {
  it("returns a reply from a mocked AI binding on success", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "42 degrees" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "what is x" }] })
    });
    const res = await handleChatPost(req, fakeEnv);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("42 degrees");
    expect(fakeEnv.AI.run).toHaveBeenCalledWith(MODEL, expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({ role: "user", content: "what is x" })
      ])
    }));
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://example.com/api/chat", { method: "POST", body: "not json" });
    const res = await handleChatPost(req, {});
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty history", async () => {
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [] })
    });
    const res = await handleChatPost(req, {});
    expect(res.status).toBe(400);
  });

  it("returns 500 when the AI binding is missing", async () => {
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    const res = await handleChatPost(req, {});
    expect(res.status).toBe(500);
  });

  it("returns 502 when the AI binding throws", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockRejectedValue(new Error("boom")) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    const res = await handleChatPost(req, fakeEnv);
    expect(res.status).toBe(502);
  });

  it("uses the geometry system prompt when Referer points to /geometry", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { Referer: "https://example.com/geometry" },
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    await handleChatPost(req, fakeEnv);
    const callArgs = fakeEnv.AI.run.mock.calls[0][1];
    expect(callArgs.messages[0].content).toContain("Geometry Regents");
  });

  it("falls back to the geometry prompt when Referer is missing", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    await handleChatPost(req, fakeEnv);
    const callArgs = fakeEnv.AI.run.mock.calls[0][1];
    expect(callArgs.messages[0].content).toContain("Geometry Regents");
  });
});

describe("handleChatOptions", () => {
  it("returns 204 with CORS headers", async () => {
    const res = handleChatOptions();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/chat.test.js`
Expected: FAIL — `handleChatPost is not a function` (not exported yet)

- [ ] **Step 3: Append handleChatPost, handleChatOptions, MODEL, and the json helper to src/chat.js**

Add to the bottom of the existing `src/chat.js` (everything from Task 2 stays unchanged above this):

```js
export const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export async function handleChatPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messages = sanitizeMessages(body && body.history);
  if (!messages.length) return json({ error: "Empty message" }, 400);

  if (!env.AI) return json({ error: "Server not configured — Workers AI binding is missing" }, 500);

  const subject = subjectFromReferer(request.headers.get("Referer"));
  const systemPrompt = SUBJECTS[subject];

  let result;
  try {
    result = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: systemPrompt }].concat(messages),
      max_tokens: 400
    });
  } catch (e) {
    return json({ error: "Could not reach AI provider", detail: String(e && e.message || e).slice(0, 300) }, 502);
  }

  const reply = (result && (result.response || result.result)) || "";
  return json({ reply: reply });
}

export function handleChatOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/chat.test.js`
Expected: PASS — all tests, including the 7 new `handleChatPost`/`handleChatOptions` tests (19 total in the file)

- [ ] **Step 5: Commit**

```bash
cd /Users/smiley/Claude/Projects/School/studystacks
git add src/chat.js test/chat.test.js
git commit -m "Add handleChatPost and handleChatOptions with Workers AI integration"
```

---

### Task 4: Worker routing

**Files:**
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/src/worker.js`
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/test/worker.test.js`

**Interfaces:**
- Consumes: `handleChatPost`, `handleChatOptions` from `src/chat.js` (Task 3).
- Produces: the Worker's `fetch(request, env)` entrypoint — `POST/OPTIONS /api/chat` routes to the chat handlers, any other method on `/api/chat` returns 405, everything else falls through to `env.ASSETS.fetch(request)`. Task 5 and Task 6 rely on this fallback to serve `public/index.html` and `public/geometry/index.html`.

- [ ] **Step 1: Replace test/worker.test.js entirely with the real routing tests**

```js
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("routing", () => {
  it("returns 405 for GET on /api/chat", async () => {
    const res = await SELF.fetch("https://example.com/api/chat");
    expect(res.status).toBe(405);
  });

  it("returns 204 with CORS headers for OPTIONS on /api/chat", async () => {
    const res = await SELF.fetch("https://example.com/api/chat", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("returns 400 for POST /api/chat with empty history", async () => {
    const res = await SELF.fetch("https://example.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: [] })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Empty message");
  });

  it("falls through to ASSETS for the root path", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/worker.test.js`
Expected: FAIL — GET/OPTIONS/POST on `/api/chat` all return `"ok"` with status 200 (the Task 1 stub responds to everything the same way), so the 405/204/400 assertions fail

- [ ] **Step 3: Replace src/worker.js entirely with real routing**

```js
import { handleChatPost, handleChatOptions } from "./chat.js";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method === "POST") return handleChatPost(request, env);
      if (request.method === "OPTIONS") return handleChatOptions();
      return json({ error: "Method not allowed" }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/worker.test.js`
Expected: PASS — all 4 tests

- [ ] **Step 5: Run the full suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: PASS — all tests across `chat.test.js` and `worker.test.js`

- [ ] **Step 6: Commit**

```bash
cd /Users/smiley/Claude/Projects/School/studystacks
git add src/worker.js test/worker.test.js
git commit -m "Wire up real request routing: /api/chat to chat handlers, else ASSETS"
```

---

### Task 5: Homepage

**Files:**
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/public/index.html`
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/test/worker.test.js`

**Interfaces:**
- Consumes: nothing (static content only).
- Produces: the real StudyStacks homepage, served at `/` via the ASSETS fallback wired in Task 4.

- [ ] **Step 1: Add the failing test to test/worker.test.js**

Add this `describe` block to the existing file, alongside the `routing` block from Task 4:

```js
describe("homepage", () => {
  it("shows the StudyStacks brand and the current class roster", async () => {
    const res = await SELF.fetch("https://example.com/");
    const text = await res.text();
    expect(text).toContain("StudyStacks");
    expect(text).toContain("Geometry");
    expect(text).toContain("Flagship guide");
    expect(text).toContain("Coming Soon");
    expect(text).toContain("Chemistry");
    expect(text).toContain("Algebra 2");
    expect(text).toContain("Global History II");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/worker.test.js`
Expected: FAIL — placeholder page only contains the word "placeholder", none of the expected strings are present

- [ ] **Step 3: Replace public/index.html with the real homepage**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>StudyStacks — Study guides that actually get you ready</title>
</head>
<body style="margin:0;font-family:'Nunito','Segoe UI',system-ui,sans-serif;background:#fffaf5;">

<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 32px;background:#ffffff;border-bottom:1px solid #ffe4cc;">
  <div style="font-weight:800;font-size:22px;color:#c2410c;display:flex;align-items:center;gap:8px;">
    📚 StudyStacks
  </div>
  <div style="display:flex;gap:24px;font-weight:600;font-size:15px;color:#7c4a2d;align-items:center;">
    <span>Browse Subjects</span>
    <span>How It Works</span>
    <a href="/geometry" style="background:#ff8a4c;color:#fff;padding:8px 18px;border-radius:999px;text-decoration:none;">Start Studying →</a>
  </div>
</div>

<div style="text-align:center;padding:64px 32px 48px;">
  <div style="display:inline-block;background:#ffe4cc;color:#c2410c;font-weight:700;font-size:13px;padding:6px 14px;border-radius:999px;margin-bottom:18px;">
    🎉 Free forever · Built for real classes
  </div>
  <h1 style="font-size:44px;font-weight:800;color:#3d2a1e;margin:0 0 14px;letter-spacing:-0.02em;">
    Study guides that actually<br/>get you ready.
  </h1>
  <p style="font-size:18px;color:#8a6650;max-width:560px;margin:0 auto 28px;line-height:1.5;">
    Interactive quizzes, flashcards, and practice exams for real classes —
    not generic summaries. Pick a class and start.
  </p>
  <div style="max-width:480px;margin:0 auto;display:flex;gap:8px;">
    <div style="flex:1;background:#fff;border:2px solid #ffe4cc;border-radius:14px;padding:14px 18px;color:#c9a688;text-align:left;">
      🔍 Search for your class...
    </div>
  </div>
</div>

<div style="padding:8px 32px 24px;">
  <div style="font-weight:700;font-size:14px;color:#c2410c;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;">
    Classes
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:680px;">
    <a href="/geometry" style="text-decoration:none;background:#fff;border:2px solid #ffe4cc;border-radius:18px;padding:22px;display:block;">
      <div style="font-size:28px;margin-bottom:8px;">📐</div>
      <div style="font-weight:800;font-size:17px;color:#3d2a1e;margin-bottom:4px;">Geometry</div>
      <div style="font-size:13px;color:#a8826a;margin-bottom:12px;">11 units · 440 practice questions · interactive exam</div>
      <div style="font-size:12px;font-weight:700;color:#22a06b;">⭐ Flagship guide</div>
    </a>
  </div>
</div>

<div style="padding:8px 32px 56px;">
  <div style="font-weight:700;font-size:14px;color:#b5862a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;">
    Coming Soon
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:1040px;">
    <div style="background:#fff;border:2px dashed #ffe4cc;border-radius:18px;padding:22px;opacity:0.6;">
      <div style="font-size:28px;margin-bottom:8px;">🧪</div>
      <div style="font-weight:800;font-size:17px;color:#3d2a1e;margin-bottom:4px;">Chemistry</div>
      <div style="font-size:13px;color:#a8826a;">16 units · in progress</div>
    </div>
    <div style="background:#fff;border:2px dashed #ffe4cc;border-radius:18px;padding:22px;opacity:0.6;">
      <div style="font-size:28px;margin-bottom:8px;">🔢</div>
      <div style="font-weight:800;font-size:17px;color:#3d2a1e;margin-bottom:4px;">Algebra 2</div>
      <div style="font-size:13px;color:#a8826a;">In progress</div>
    </div>
    <div style="background:#fff;border:2px dashed #ffe4cc;border-radius:18px;padding:22px;opacity:0.6;">
      <div style="font-size:28px;margin-bottom:8px;">🌍</div>
      <div style="font-weight:800;font-size:17px;color:#3d2a1e;margin-bottom:4px;">Global History II</div>
      <div style="font-size:13px;color:#a8826a;">In progress</div>
    </div>
  </div>
</div>

</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/worker.test.js`
Expected: PASS — `homepage > shows the StudyStacks brand and the current class roster`

- [ ] **Step 5: Commit**

```bash
cd /Users/smiley/Claude/Projects/School/studystacks
git add public/index.html test/worker.test.js
git commit -m "Build the real StudyStacks homepage"
```

---

### Task 6: Migrate the Geometry guide

**Files:**
- Create: `/Users/smiley/Claude/Projects/School/studystacks/public/geometry/index.html` (exact copy, see Step 3)
- Modify: `/Users/smiley/Claude/Projects/School/studystacks/test/worker.test.js`

**Interfaces:**
- Consumes: the existing file at `/Users/smiley/Claude/Projects/School/geometry-guide-site/public/index.html` — copied verbatim, zero edits, per the Global Constraints.
- Produces: `/geometry` serving the full working Geometry guide, including its own `/api/chat` calls now flowing through this project's shared `handleChatPost`.

- [ ] **Step 1: Add the failing test to test/worker.test.js**

Add this `describe` block to the existing file:

```js
describe("geometry migration", () => {
  it("serves the migrated Geometry guide at /geometry", async () => {
    const res = await SELF.fetch("https://example.com/geometry");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Geometry Regents Study Guide");
    expect(text).toContain("HARD_Q");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/worker.test.js`
Expected: FAIL — `/geometry` doesn't exist yet, `not_found_handling: single-page-application` means it falls back to serving the homepage instead (200 status, but wrong content — `text` won't contain "Geometry Regents Study Guide")

- [ ] **Step 3: Copy the Geometry guide unmodified**

Run:
```bash
mkdir -p /Users/smiley/Claude/Projects/School/studystacks/public/geometry
cp /Users/smiley/Claude/Projects/School/geometry-guide-site/public/index.html /Users/smiley/Claude/Projects/School/studystacks/public/geometry/index.html
```

Expected: no output, exit code 0

- [ ] **Step 4: Verify the copy is byte-identical to the source**

Run: `diff /Users/smiley/Claude/Projects/School/geometry-guide-site/public/index.html /Users/smiley/Claude/Projects/School/studystacks/public/geometry/index.html`
Expected: no output (files are identical)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/worker.test.js`
Expected: PASS — `geometry migration > serves the migrated Geometry guide at /geometry`

- [ ] **Step 6: Run the full suite one more time**

Run: `npx vitest run`
Expected: PASS — every test across `chat.test.js` and `worker.test.js`

- [ ] **Step 7: Commit**

```bash
cd /Users/smiley/Claude/Projects/School/studystacks
git add public/geometry/index.html test/worker.test.js
git commit -m "Migrate the Geometry guide to /geometry, unmodified"
```

---

### Task 7: Deploy and retire the old Geometry Worker

**Files:**
- None (deployment + verification only)

**Interfaces:**
- Consumes: the fully working project from Tasks 1–6.
- Produces: the live StudyStacks Worker; the old standalone `geometry-regents-guide` Worker deleted.

- [ ] **Step 1: Deploy**

Run: `cd /Users/smiley/Claude/Projects/School/studystacks && npx wrangler deploy`
Expected: output ending with a line like `Deployed studystacks triggers` and a URL of the form `https://studystacks.<account-subdomain>.workers.dev`

- [ ] **Step 2: Verify the homepage is live**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://studystacks.<account-subdomain>.workers.dev/`
Expected: `200` (substitute the real subdomain printed in Step 1's output)

- [ ] **Step 3: Verify /geometry is live**

Run: `curl -s https://studystacks.<account-subdomain>.workers.dev/geometry | grep -o "<title>[^<]*</title>"`
Expected: `<title>Geometry Regents Study Guide — EXPANDED</title>`

- [ ] **Step 4: Verify /api/chat still works for Geometry**

Run:
```bash
curl -s -X POST https://studystacks.<account-subdomain>.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -H "Referer: https://studystacks.<account-subdomain>.workers.dev/geometry" \
  -d '{"history":[{"role":"user","content":"In one sentence, what is the Pythagorean theorem?"}]}' \
  -w "\nSTATUS:%{http_code}\n"
```
Expected: `STATUS:200` and a `{"reply": "..."}` body describing the Pythagorean theorem

- [ ] **Step 5: Only after Steps 2–4 all pass, delete the old standalone Worker**

Run: `npx wrangler delete geometry-regents-guide <<< "y"`
Expected: `Successfully deleted geometry-regents-guide` (do not run this until the live checks above have actually passed — this permanently deletes the old deployment)

- [ ] **Step 6: Verify the old URL is gone and the new one is unaffected**

Run:
```bash
curl -s -o /dev/null -w "old: %{http_code}\n" https://geometry-regents-guide.tvsmiley833.workers.dev/
curl -s -o /dev/null -w "new: %{http_code}\n" https://studystacks.<account-subdomain>.workers.dev/
```
Expected: `old: 000` (no longer resolves), `new: 200`
