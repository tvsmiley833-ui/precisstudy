# Google Classroom + Calendar — Connect & Read Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in precisstudy student connect their Google account for read-only offline access to Google Classroom + Calendar, and serve their coursework and relevant calendar events as one normalized, cached JSON feed from an authenticated endpoint, plus the Settings UI to connect/disconnect and pick calendars.

**Architecture:** Five new `src/` modules behind six new routes on the existing Cloudflare Worker. A small refactor extracts the OAuth `state`/`next` cookie helpers from `src/auth-routes.ts` into `src/auth-state.ts` so the new connect flow reuses them. The Google refresh token is stored AES-GCM-encrypted in the existing `PROGRESS` KV namespace (key derived from `SESSION_SECRET` via HKDF); access tokens are never persisted. Sync is on-demand only with a 15-minute KV cache. The Settings page gains a vanilla-JS "Connected accounts" card.

**Tech Stack:** TypeScript Cloudflare Worker (`src/worker.ts`), Workers KV, WebCrypto (`crypto.subtle`), `fetch`. Tests: Vitest under `@cloudflare/vitest-pool-workers` (`test/*.test.js`). Vanilla JS + `fetch` for the page. Wrangler for dev/deploy.

## Global Constraints

- The canonical origin constant is `SITE_ORIGIN = "https://precisstudy.com"`. All OAuth `redirect_uri` values and post-flow redirects use it verbatim.
- New connect callback `redirect_uri`: `https://precisstudy.com/auth/google/connect/callback` — distinct from the sign-in callback `/auth/google/callback`.
- Google consent request MUST include `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, `response_type=code`.
- Exactly these scopes, in this order: `openid`, `email`, `https://www.googleapis.com/auth/classroom.courses.readonly`, `https://www.googleapis.com/auth/classroom.coursework.me.readonly`, `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly`, `https://www.googleapis.com/auth/calendar.readonly`.
- No new Worker bindings. Reuse `PROGRESS` KV and the existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET`. `src/env.d.ts` does not change.
- KV keys, all in `env.PROGRESS`: `gtok:<session.email>`, `gcache:<session.email>`, `gsettings:<session.email>`. `<session.email>` is used exactly as `session.email` (no lower-casing) to match `progress:<email>` in `src/progress-routes.ts`.
- Access tokens are **never** written to KV — held in a local variable for the duration of one sync only.
- `gcache:<email>` is written with `{ expirationTtl: 900 }` (15 min).
- Default settings: `{ calendarIds: ["primary"], schoolworkOnly: true }`.
- Handlers must never throw out to the router: every Google API failure path returns a well-formed `Feed` or JSON error.
- Session check on every `/api/*` route via `getSession(request, env)` from `src/auth.js`; missing session → HTTP 401. Missing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`SESSION_SECRET` on a connect route → HTTP 503.
- Match existing code style: 2-space indent, `.js` import specifiers for local TS modules, `export async function handleX(request: Request, env: Env): Promise<Response>` handler shape, a local `json()` helper per route module (see `src/progress-routes.ts`).
- New tests run in the Vitest Workers pool as `test/*.test.js` (ESM, `import { describe, it, expect } from "vitest"`). Do **not** add a `*.node.test.mjs` file — `node --test` cannot import the TypeScript source modules; the Workers pool provides the same `crypto.subtle`. (Intentional deviation from the design doc's "Testing" section, which named a node test for the crypto module.)
- Run `npm test` (runs `test:scripts` then `vitest run`) and `npm run typecheck` green before every commit.
- Commit after each task with a `feat:` / `refactor:` message.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/auth-state.ts` | `SITE_ORIGIN`, OAuth `state` sign/verify + cookie, `next` cookie + `safeNext`, extracted from `auth-routes.ts` | 1 |
| `src/auth-routes.ts` | modified: import the above instead of defining them | 1 |
| `src/google-token.ts` | encrypt / decrypt (HKDF→AES-GCM) + put / get / delete the refresh-token record in KV | 2 |
| `src/google-connect.ts` | `handleGoogleConnectStart`, `handleGoogleConnectCallback` | 3 |
| `src/google-sync.ts` | refresh access token, fetch + normalize Classroom + Calendar, schoolwork filter, sort, cache | 4 |
| `src/google-routes.ts` | `/api/assignments`, `/api/google/calendars`, `/api/google/disconnect`, `/api/google/settings` | 5 |
| `src/worker.ts` | modified: +2 entries in `AUTH_ROUTES`, +4 `/api/*` route blocks | 6 |
| `public/settings/index.html` | modified: "Connected accounts" card + its JS | 7 |
| `docs/google-connect-setup.md` | deploy prerequisites (Google Cloud console steps), not code | 8 |
| `test/auth-state.test.js` | state/next helper unit tests | 1 |
| `test/google-token.test.js` | crypto round-trip, wrong-secret failure, ciphertext ≠ plaintext | 2 |
| `test/google-connect.test.js` | consent-URL shape, no-session redirect, callback state/`refresh_token` handling | 3 |
| `test/google-sync.test.js` | refresh, `invalid_grant`, normalize, filter, sort, cache, stale-cache-on-5xx | 4 |
| `test/google-routes.test.js` | 401s, cache hit vs miss, `?refresh=1`, disconnect deletes keys, settings validation | 5 |

---

## Task 1: Extract shared OAuth state/next helpers into `src/auth-state.ts`

**Files:**
- Create: `src/auth-state.ts`
- Modify: `src/auth-routes.ts` — remove the local `SITE_ORIGIN` / `STATE_TTL` / `STATE_COOKIE` / `NEXT_COOKIE` constants and the local `stateCookie` / `clearStateCookie` / `safeNext` / `nextCookie` / `clearNextCookie` / `consumeNext` / `makeState` / `checkState` definitions; import them instead
- Create: `test/auth-state.test.js`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, `getCookie` from `src/auth.js`.
- Produces:
  - `export const SITE_ORIGIN = "https://precisstudy.com"`
  - `export const STATE_TTL: number` (`60 * 10`)
  - `export function stateCookie(state: string): string`
  - `export function clearStateCookie(): string`
  - `export function makeState(env: { SESSION_SECRET: string }): Promise<string>`
  - `export function checkState(env: { SESSION_SECRET: string }, request: Request, state: string): Promise<boolean>`
  - `export function safeNext(raw: string | null): string | null`
  - `export function nextCookie(path: string): string`
  - `export function clearNextCookie(): string`
  - `export function consumeNext(request: Request): string | null`

- [ ] **Step 1: Write the failing test**

Create `test/auth-state.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  SITE_ORIGIN, makeState, checkState, stateCookie,
  safeNext, nextCookie, consumeNext
} from "../src/auth-state.js";

const env = { SESSION_SECRET: "test-secret" };

describe("auth-state: OAuth state", () => {
  it("makeState + matching cookie passes checkState", async () => {
    const state = await makeState(env);
    const req = new Request("https://precisstudy.com/x", {
      headers: { Cookie: `ss_oauth_state=${state}` }
    });
    expect(await checkState(env, req, state)).toBe(true);
  });

  it("checkState fails when the cookie is absent", async () => {
    const state = await makeState(env);
    const req = new Request("https://precisstudy.com/x");
    expect(await checkState(env, req, state)).toBe(false);
  });

  it("checkState fails when the cookie does not match the param", async () => {
    const state = await makeState(env);
    const req = new Request("https://precisstudy.com/x", {
      headers: { Cookie: "ss_oauth_state=other" }
    });
    expect(await checkState(env, req, state)).toBe(false);
  });

  it("stateCookie is HttpOnly + Secure + SameSite=Lax", () => {
    const c = stateCookie("abc");
    expect(c).toContain("ss_oauth_state=abc");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
  });
});

describe("auth-state: next path", () => {
  it("safeNext accepts a same-origin absolute path", () => {
    expect(safeNext("/settings")).toBe("/settings");
  });

  it("safeNext rejects open-redirect shapes", () => {
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "notapath", null]) {
      expect(safeNext(bad)).toBeNull();
    }
  });

  it("consumeNext round-trips through nextCookie's encoding", () => {
    const c = nextCookie("/calculus/");
    const value = c.split(";")[0].split("=")[1];
    const req = new Request("https://precisstudy.com/x", {
      headers: { Cookie: `ss_next=${value}` }
    });
    expect(consumeNext(req)).toBe("/calculus/");
  });

  it("SITE_ORIGIN is the canonical host", () => {
    expect(SITE_ORIGIN).toBe("https://precisstudy.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth-state.test.js`
Expected: FAIL — `Cannot find module '../src/auth-state.js'`.

- [ ] **Step 3: Create `src/auth-state.ts`**

Move the definitions out of `src/auth-routes.ts` verbatim (behavior identical):

```ts
import { signSession, verifySession, getCookie } from "./auth.js";

export const SITE_ORIGIN = "https://precisstudy.com";
export const STATE_TTL = 60 * 10; // 10 minutes
const STATE_COOKIE = "ss_oauth_state";
const NEXT_COOKIE = "ss_next";

export function stateCookie(state: string): string {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL}`;
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function makeState(env: { SESSION_SECRET: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signSession({ purpose: "oauth_state", exp: now + STATE_TTL }, env.SESSION_SECRET);
}

export async function checkState(
  env: { SESSION_SECRET: string },
  request: Request,
  state: string
): Promise<boolean> {
  if (!state) return false;
  const cookieState = getCookie(request, STATE_COOKIE);
  if (!cookieState || cookieState !== state) return false;
  const payload = await verifySession(state, env.SESSION_SECRET);
  return !!(payload && payload.purpose === "oauth_state");
}

// A post-flow destination is only accepted if it is a same-origin absolute
// path (no scheme, no protocol-relative "//host", no "\" tricks). Anything
// else falls back to the caller's default, so this can't become an open
// redirect.
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return null;
  if (raw.includes("://") || raw.includes("\n") || raw.includes("\r")) return null;
  return raw.length <= 512 ? raw : null;
}

export function nextCookie(path: string): string {
  return `${NEXT_COOKIE}=${encodeURIComponent(path)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL}`;
}

export function clearNextCookie(): string {
  return `${NEXT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function consumeNext(request: Request): string | null {
  const raw = getCookie(request, NEXT_COOKIE);
  return raw ? safeNext(decodeURIComponent(raw)) : null;
}
```

- [ ] **Step 4: Rewire `src/auth-routes.ts` to import from the new module**

1. Delete the local `const SITE_ORIGIN = ...`, `const STATE_TTL = ...`, `const STATE_COOKIE = ...`, `const NEXT_COOKIE = ...` lines and the local function bodies for `stateCookie`, `clearStateCookie`, `safeNext`, `nextCookie`, `clearNextCookie`, `consumeNext`, `makeState`, `checkState`.
2. Add to the top import block:

```ts
import {
  SITE_ORIGIN, STATE_TTL, stateCookie, clearStateCookie,
  makeState, checkState, safeNext, nextCookie, clearNextCookie, consumeNext
} from "./auth-state.js";
```

Everything else in `auth-routes.ts` stays (`json`, `redirect`, `authErrorRedirect`, `canonicalizeOrigin`, `notConfigured`, `sessionSecretMissing`, all handlers).

- [ ] **Step 5: Run the auth suites + typecheck**

Run: `npx vitest run test/auth-state.test.js test/auth-routes.test.js && npm run typecheck`
Expected: PASS — every `test/auth-routes.test.js` case still green (state/CSRF/next behavior unchanged), `test/auth-state.test.js` green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/auth-state.ts src/auth-routes.ts test/auth-state.test.js
git commit -m "refactor: extract OAuth state/next helpers into auth-state.ts"
```

---

## Task 2: `src/google-token.ts` — encrypted refresh-token storage

**Files:**
- Create: `src/google-token.ts`
- Create: `test/google-token.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (WebCrypto globals only).
- Produces:
  - `export interface GoogleTokenRecord { refreshToken: string; googleEmail: string; scopes: string[]; connectedAt: string }`
  - `export function encryptTokenRecord(secret: string, record: GoogleTokenRecord): Promise<string>`
  - `export function decryptTokenRecord(secret: string, packedB64: string): Promise<GoogleTokenRecord>`
  - `export function googleTokenKey(email: string): string` → `"gtok:" + email`
  - `export function putGoogleToken(env: { PROGRESS: KVNamespace; SESSION_SECRET: string }, email: string, record: GoogleTokenRecord): Promise<void>`
  - `export function getGoogleToken(env: { PROGRESS: KVNamespace; SESSION_SECRET: string }, email: string): Promise<GoogleTokenRecord | null>`
  - `export function deleteGoogleToken(env: { PROGRESS: KVNamespace }, email: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `test/google-token.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  encryptTokenRecord, decryptTokenRecord,
  putGoogleToken, getGoogleToken, deleteGoogleToken, googleTokenKey
} from "../src/google-token.js";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

const record = {
  refreshToken: "1//refresh-abc",
  googleEmail: "student@school.edu",
  scopes: ["openid", "email"],
  connectedAt: "2026-09-10T00:00:00.000Z"
};

describe("google-token crypto", () => {
  it("encrypt -> decrypt round-trips a record", async () => {
    const packed = await encryptTokenRecord("secret-A", record);
    expect(await decryptTokenRecord("secret-A", packed)).toEqual(record);
  });

  it("a record encrypted under a different secret fails to decrypt (throws)", async () => {
    const packed = await encryptTokenRecord("secret-A", record);
    await expect(decryptTokenRecord("secret-B", packed)).rejects.toThrow();
  });

  it("ciphertext does not contain the plaintext refresh token", async () => {
    const packed = await encryptTokenRecord("secret-A", record);
    expect(packed).not.toContain("1//refresh-abc");
  });

  it("two encryptions of the same record differ (random IV)", async () => {
    const a = await encryptTokenRecord("secret-A", record);
    const b = await encryptTokenRecord("secret-A", record);
    expect(a).not.toBe(b);
  });
});

describe("google-token KV helpers", () => {
  const env = () => ({ PROGRESS: fakeKV(), SESSION_SECRET: "secret-A" });

  it("put then get returns the same record", async () => {
    const e = env();
    await putGoogleToken(e, "student@school.edu", record);
    expect(e.PROGRESS._store.has(googleTokenKey("student@school.edu"))).toBe(true);
    expect(await getGoogleToken(e, "student@school.edu")).toEqual(record);
  });

  it("get returns null when nothing is stored", async () => {
    expect(await getGoogleToken(env(), "nobody@school.edu")).toBeNull();
  });

  it("get returns null (not throw) when the stored blob is corrupt", async () => {
    const e = env();
    e.PROGRESS._store.set(googleTokenKey("x@y.z"), "not-base64-$$$");
    expect(await getGoogleToken(e, "x@y.z")).toBeNull();
  });

  it("delete removes the record", async () => {
    const e = env();
    await putGoogleToken(e, "student@school.edu", record);
    await deleteGoogleToken(e, "student@school.edu");
    expect(await getGoogleToken(e, "student@school.edu")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/google-token.test.js`
Expected: FAIL — `Cannot find module '../src/google-token.js'`.

- [ ] **Step 3: Create `src/google-token.ts`**

```ts
// Refresh-token storage for the Google Classroom/Calendar connection.
// The refresh token is the only long-lived secret we hold for a user, so it is
// AES-GCM encrypted at rest in KV. The key is derived from SESSION_SECRET via
// HKDF-SHA-256 so rotating SESSION_SECRET invalidates every stored token (they
// simply fail to decrypt, and getGoogleToken returns null -> "not connected").
// Access tokens are never stored -- see src/google-sync.ts.

export interface GoogleTokenRecord {
  refreshToken: string;
  googleEmail: string;
  scopes: string[];
  connectedAt: string; // ISO 8601
}

const ENC_SALT = "precisstudy-google-token";
const ENC_INFO = "v1";
const IV_BYTES = 12;

export function googleTokenKey(email: string): string {
  return "gtok:" + email;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(ENC_SALT),
      info: new TextEncoder().encode(ENC_INFO)
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64); // throws on malformed input -> callers treat as "no token"
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptTokenRecord(secret: string, record: GoogleTokenRecord): Promise<string> {
  if (!secret) throw new Error("encryptTokenRecord: missing SESSION_SECRET");
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const pt = new TextEncoder().encode(JSON.stringify(record));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return bytesToBase64(packed);
}

export async function decryptTokenRecord(secret: string, packedB64: string): Promise<GoogleTokenRecord> {
  if (!secret) throw new Error("decryptTokenRecord: missing SESSION_SECRET");
  const packed = base64ToBytes(packedB64);
  if (packed.length <= IV_BYTES) throw new Error("decryptTokenRecord: ciphertext too short");
  const iv = packed.slice(0, IV_BYTES);
  const ct = packed.slice(IV_BYTES);
  const key = await deriveKey(secret);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as GoogleTokenRecord;
}

export async function putGoogleToken(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string,
  record: GoogleTokenRecord
): Promise<void> {
  const packed = await encryptTokenRecord(env.SESSION_SECRET, record);
  await env.PROGRESS.put(googleTokenKey(email), packed);
}

export async function getGoogleToken(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string
): Promise<GoogleTokenRecord | null> {
  const raw = await env.PROGRESS.get(googleTokenKey(email));
  if (!raw) return null;
  try {
    return await decryptTokenRecord(env.SESSION_SECRET, raw);
  } catch (e) {
    // Wrong/rotated secret, or a corrupt blob -> treat as "not connected"
    // rather than 500 the endpoint.
    return null;
  }
}

export async function deleteGoogleToken(env: { PROGRESS: KVNamespace }, email: string): Promise<void> {
  await env.PROGRESS.delete(googleTokenKey(email));
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run test/google-token.test.js && npm run typecheck`
Expected: PASS — all 9 cases green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/google-token.ts test/google-token.test.js
git commit -m "feat: encrypted Google refresh-token storage (google-token.ts)"
```

---

## Task 3: `src/google-connect.ts` — OAuth connect start + callback

**Files:**
- Create: `src/google-connect.ts`
- Create: `test/google-connect.test.js`

**Interfaces:**
- Consumes: `SITE_ORIGIN`, `makeState`, `checkState`, `stateCookie`, `clearStateCookie`, `safeNext`, `nextCookie`, `clearNextCookie`, `consumeNext` from `src/auth-state.js`; `getSession` from `src/auth.js`; `GoogleTokenRecord`, `putGoogleToken` from `src/google-token.js`.
- Produces:
  - `export const CONNECT_SCOPES: string[]` (the 6 scopes, in order)
  - `export const CONNECT_REDIRECT_URI: string` (`SITE_ORIGIN + "/auth/google/connect/callback"`)
  - `export function handleGoogleConnectStart(request: Request, env: Env): Promise<Response>`
  - `export function handleGoogleConnectCallback(request: Request, env: Env): Promise<Response>`

- [ ] **Step 1: Write the failing test**

Create `test/google-connect.test.js`:

```js
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGoogleConnectStart, handleGoogleConnectCallback, CONNECT_SCOPES } from "../src/google-connect.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

async function sessionCookie(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

const baseEnv = () => ({
  SESSION_SECRET: SECRET,
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  PROGRESS: fakeKV()
});

describe("handleGoogleConnectStart", () => {
  it("redirects an un-signed-in user to /settings?google=error, sets no state cookie", async () => {
    const res = await handleGoogleConnectStart(new Request("https://precisstudy.com/auth/google/connect/start"), baseEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("503s when GOOGLE_CLIENT_SECRET is unset", async () => {
    const env = baseEnv();
    delete env.GOOGLE_CLIENT_SECRET;
    const req = new Request("https://precisstudy.com/auth/google/connect/start", {
      headers: { Cookie: await sessionCookie("s@e.edu") }
    });
    const res = await handleGoogleConnectStart(req, env);
    expect(res.status).toBe(503);
  });

  it("builds the consent URL with offline access, forced consent, all scopes, and the connect callback", async () => {
    const req = new Request("https://precisstudy.com/auth/google/connect/start?next=%2Fsettings", {
      headers: { Cookie: await sessionCookie("s@e.edu") }
    });
    const res = await handleGoogleConnectStart(req, baseEnv());
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location"));
    expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc.searchParams.get("access_type")).toBe("offline");
    expect(loc.searchParams.get("prompt")).toBe("consent");
    expect(loc.searchParams.get("include_granted_scopes")).toBe("true");
    expect(loc.searchParams.get("response_type")).toBe("code");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://precisstudy.com/auth/google/connect/callback");
    expect(loc.searchParams.get("scope")).toBe(CONNECT_SCOPES.join(" "));
    const state = loc.searchParams.get("state");
    const setCookie = res.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain(`ss_oauth_state=${state}`);
    expect(setCookie).toContain("ss_next=%2Fsettings");
  });
});

describe("handleGoogleConnectCallback", () => {
  it("redirects to /settings?google=error on a bad state", async () => {
    const req = new Request("https://precisstudy.com/auth/google/connect/callback?code=x&state=nope", {
      headers: { Cookie: await sessionCookie("s@e.edu") }
    });
    const res = await handleGoogleConnectCallback(req, baseEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
  });

  it("redirects an un-signed-in user to /settings?google=error", async () => {
    const req = new Request("https://precisstudy.com/auth/google/connect/callback?code=x&state=y");
    const res = await handleGoogleConnectCallback(req, baseEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
  });

  it("stores an encrypted token and redirects ?google=connected when Google returns a refresh_token", async () => {
    const env = baseEnv();
    const email = "s@e.edu";
    const startRes = await handleGoogleConnectStart(
      new Request("https://precisstudy.com/auth/google/connect/start", { headers: { Cookie: await sessionCookie(email) } }),
      env
    );
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "at", refresh_token: "1//rt", scope: "openid email", expires_in: 3599 }), { headers: { "Content-Type": "application/json" } });
      }
      if (u.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
        return new Response(JSON.stringify({ email: "gmail-of@student.edu" }), { headers: { "Content-Type": "application/json" } });
      }
      throw new Error("unexpected fetch " + u);
    };
    try {
      const res = await handleGoogleConnectCallback(
        new Request(`https://precisstudy.com/auth/google/connect/callback?code=abc&state=${encodeURIComponent(state)}`, {
          headers: { Cookie: `${await sessionCookie(email)}; ss_oauth_state=${state}` }
        }),
        env
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=connected");
      expect(env.PROGRESS._store.has("gtok:" + email)).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("redirects ?google=norefresh when Google withholds the refresh_token", async () => {
    const env = baseEnv();
    const email = "s@e.edu";
    const startRes = await handleGoogleConnectStart(
      new Request("https://precisstudy.com/auth/google/connect/start", { headers: { Cookie: await sessionCookie(email) } }),
      env
    );
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "at", scope: "openid email", expires_in: 3599 }), { headers: { "Content-Type": "application/json" } });
      }
      throw new Error("unexpected fetch " + url);
    };
    try {
      const res = await handleGoogleConnectCallback(
        new Request(`https://precisstudy.com/auth/google/connect/callback?code=abc&state=${encodeURIComponent(state)}`, {
          headers: { Cookie: `${await sessionCookie(email)}; ss_oauth_state=${state}` }
        }),
        env
      );
      expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=norefresh");
      expect(env.PROGRESS._store.has("gtok:" + email)).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/google-connect.test.js`
Expected: FAIL — `Cannot find module '../src/google-connect.js'`.

- [ ] **Step 3: Create `src/google-connect.ts`**

```ts
import { getSession } from "./auth.js";
import {
  SITE_ORIGIN, makeState, checkState, stateCookie, clearStateCookie,
  safeNext, nextCookie, clearNextCookie, consumeNext
} from "./auth-state.js";
import { putGoogleToken, type GoogleTokenRecord } from "./google-token.js";

export const CONNECT_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  "https://www.googleapis.com/auth/calendar.readonly"
];

export const CONNECT_REDIRECT_URI = SITE_ORIGIN + "/auth/google/connect/callback";

function redirect(location: string, cookies?: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const c of cookies || []) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function settings(flag: "connected" | "error" | "norefresh", cookies?: string[]): Response {
  return redirect(SITE_ORIGIN + "/settings?google=" + flag, cookies);
}

function notConfigured(): Response {
  return new Response(JSON.stringify({ error: "Google connect isn't configured yet" }), {
    status: 503,
    headers: { "Content-Type": "application/json" }
  });
}

export async function handleGoogleConnectStart(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return settings("error");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) return notConfigured();

  const state = await makeState(env);
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: CONNECT_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: CONNECT_SCOPES.join(" "),
    state
  });
  const cookies = next ? [stateCookie(state), nextCookie(next)] : [stateCookie(state)];
  return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(), cookies);
}

export async function handleGoogleConnectCallback(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return settings("error", [clearStateCookie(), clearNextCookie()]);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) return notConfigured();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await checkState(env, request, state))) {
    return settings("error", [clearStateCookie(), clearNextCookie()]);
  }

  let tokenData: any;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: CONNECT_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) return settings("error", [clearStateCookie(), clearNextCookie()]);
    tokenData = await tokenRes.json();
  } catch (e) {
    return settings("error", [clearStateCookie(), clearNextCookie()]);
  }

  if (!tokenData || typeof tokenData.refresh_token !== "string" || !tokenData.refresh_token) {
    // User had already granted consent and Google withheld a new refresh token
    // despite prompt=consent. Tell them how to fix it.
    return settings("norefresh", [clearStateCookie(), clearNextCookie()]);
  }

  let googleEmail = "";
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + String(tokenData.access_token) }
    });
    if (infoRes.ok) {
      const info: any = await infoRes.json();
      if (typeof info?.email === "string") googleEmail = info.email;
    }
  } catch (e) {
    // Informational only -- a missing display email must not fail the connect.
  }

  const record: GoogleTokenRecord = {
    refreshToken: tokenData.refresh_token,
    googleEmail,
    scopes: typeof tokenData.scope === "string" ? tokenData.scope.split(" ").filter(Boolean) : [],
    connectedAt: new Date().toISOString()
  };
  await putGoogleToken(env, session.email, record);

  const dest = consumeNext(request) || "/settings";
  const sep = dest.includes("?") ? "&" : "?";
  return redirect(SITE_ORIGIN + dest + sep + "google=connected", [clearStateCookie(), clearNextCookie()]);
}
```

> Note: for the default `next=/settings` the connected redirect resolves to `https://precisstudy.com/settings?google=connected` (matching the test); when `next` already has a query string it appends `&google=connected`.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run test/google-connect.test.js && npm run typecheck`
Expected: PASS — all 6 cases green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/google-connect.ts test/google-connect.test.js
git commit -m "feat: Google account connect OAuth flow (google-connect.ts)"
```

---

## Task 4: `src/google-sync.ts` — refresh, fetch, normalize, cache

**Files:**
- Create: `src/google-sync.ts`
- Create: `test/google-sync.test.js`

**Interfaces:**
- Consumes: `getGoogleToken`, `deleteGoogleToken` from `src/google-token.js`.
- Produces:
  - `export interface GoogleSettings { calendarIds: string[]; schoolworkOnly: boolean }`
  - `export const DEFAULT_SETTINGS: GoogleSettings` (`{ calendarIds: ["primary"], schoolworkOnly: true }`)
  - `export interface Assignment { id: string; source: "classroom" | "calendar"; title: string; courseName: string | null; dueAt: string | null; allDay: boolean; link: string | null; state: "todo" | "submitted" | "done" | "none" }`
  - `export interface Feed { connected: boolean; items: Assignment[]; fetchedAt: string; reason?: "revoked" | "google_unavailable" }`
  - `export function googleCacheKey(email: string): string` → `"gcache:" + email`
  - `export function syncGoogleAssignments(env: { PROGRESS: KVNamespace; SESSION_SECRET: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string }, email: string, settings: GoogleSettings): Promise<Feed>`

- [ ] **Step 1: Write the failing test**

Create `test/google-sync.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { syncGoogleAssignments, DEFAULT_SETTINGS, googleCacheKey } from "../src/google-sync.js";
import { putGoogleToken, googleTokenKey } from "../src/google-token.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { store.set(k, v); store._lastPutOpts = opts; },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

const env = () => ({
  PROGRESS: fakeKV(),
  SESSION_SECRET: SECRET,
  GOOGLE_CLIENT_ID: "cid",
  GOOGLE_CLIENT_SECRET: "csec"
});

async function connect(e, email) {
  await putGoogleToken(e, email, {
    refreshToken: "1//rt", googleEmail: email, scopes: ["openid"], connectedAt: "2026-09-10T00:00:00.000Z"
  });
}

function routeFetch(routes) {
  return async (url) => {
    const u = String(url);
    for (const [prefix, handler] of Object.entries(routes)) {
      if (u.startsWith(prefix)) return handler(u);
    }
    throw new Error("unrouted fetch: " + u);
  };
}

const jsonRes = (obj) => new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = realFetch; });

describe("syncGoogleAssignments", () => {
  it("returns connected:false when there is no stored token", async () => {
    const feed = await syncGoogleAssignments(env(), "nobody@e.edu", DEFAULT_SETTINGS);
    expect(feed).toMatchObject({ connected: false, items: [] });
    expect(typeof feed.fetchedAt).toBe("string");
  });

  it("on invalid_grant: deletes gtok + gcache and returns reason 'revoked'", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    e.PROGRESS._store.set(googleCacheKey("s@e.edu"), JSON.stringify({ items: [], fetchedAt: "old" }));
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "Content-Type": "application/json" } })
    });
    const feed = await syncGoogleAssignments(e, "s@e.edu", DEFAULT_SETTINGS);
    expect(feed).toMatchObject({ connected: false, reason: "revoked", items: [] });
    expect(e.PROGRESS._store.has(googleTokenKey("s@e.edu"))).toBe(false);
    expect(e.PROGRESS._store.has(googleCacheKey("s@e.edu"))).toBe(false);
  });

  it("normalizes Classroom coursework (dated + undated) and submission state", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () => jsonRes({ access_token: "at", expires_in: 3599 }),
      "https://classroom.googleapis.com/v1/courses?": () => jsonRes({ courses: [{ id: "c1", name: "Bio" }] }),
      "https://classroom.googleapis.com/v1/courses/c1/courseWork?": () => jsonRes({
        courseWork: [
          { id: "w1", title: "Lab 3", alternateLink: "https://classroom.google.com/w1", dueDate: { year: 2026, month: 9, day: 20 }, dueTime: { hours: 15, minutes: 30 } },
          { id: "w2", title: "Reading", alternateLink: "https://classroom.google.com/w2" }
        ]
      }),
      "https://classroom.googleapis.com/v1/courses/c1/courseWork/-/studentSubmissions?": () => jsonRes({
        studentSubmissions: [
          { courseWorkId: "w1", state: "TURNED_IN" },
          { courseWorkId: "w2", state: "CREATED" }
        ]
      }),
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?": () => jsonRes({ items: [] })
    });
    const feed = await syncGoogleAssignments(e, "s@e.edu", { calendarIds: ["primary"], schoolworkOnly: true });
    expect(feed.connected).toBe(true);
    const w1 = feed.items.find(i => i.id === "classroom:c1:w1");
    const w2 = feed.items.find(i => i.id === "classroom:c1:w2");
    expect(w1).toMatchObject({ source: "classroom", title: "Lab 3", courseName: "Bio", dueAt: "2026-09-20T15:30:00.000Z", allDay: false, state: "submitted", link: "https://classroom.google.com/w1" });
    expect(w2).toMatchObject({ dueAt: null, allDay: true, state: "todo" });
  });

  it("normalizes Calendar events (timed + all-day) and applies the schoolwork filter", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () => jsonRes({ access_token: "at", expires_in: 3599 }),
      "https://classroom.googleapis.com/v1/courses?": () => jsonRes({ courses: [] }),
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?": () => jsonRes({
        summary: "My Calendar",
        items: [
          { id: "e1", summary: "Unit 3 Test", start: { dateTime: "2026-09-15T13:00:00Z" }, htmlLink: "https://cal/e1" },
          { id: "e2", summary: "Dentist", start: { date: "2026-09-16" }, htmlLink: "https://cal/e2" }
        ]
      })
    });
    const filtered = await syncGoogleAssignments(e, "s@e.edu", { calendarIds: ["primary"], schoolworkOnly: true });
    expect(filtered.items.map(i => i.title)).toEqual(["Unit 3 Test"]);
    expect(filtered.items[0]).toMatchObject({ id: "calendar:primary:e1", source: "calendar", allDay: false, state: "none", courseName: "My Calendar", link: "https://cal/e1" });

    const all = await syncGoogleAssignments(e, "s@e.edu", { calendarIds: ["primary"], schoolworkOnly: false });
    expect(all.items.map(i => i.title).sort()).toEqual(["Dentist", "Unit 3 Test"]);
    expect(all.items.find(i => i.title === "Dentist")).toMatchObject({ allDay: true, dueAt: "2026-09-16T00:00:00.000Z" });
  });

  it("sorts ascending by dueAt with undated items last, then by title", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () => jsonRes({ access_token: "at", expires_in: 3599 }),
      "https://classroom.googleapis.com/v1/courses?": () => jsonRes({ courses: [{ id: "c1", name: "Hist" }] }),
      "https://classroom.googleapis.com/v1/courses/c1/courseWork?": () => jsonRes({
        courseWork: [
          { id: "late", title: "Zeta", dueDate: { year: 2026, month: 10, day: 1 } },
          { id: "soon", title: "Alpha", dueDate: { year: 2026, month: 9, day: 12 } },
          { id: "none1", title: "Beta" },
          { id: "none2", title: "Aardvark" }
        ]
      }),
      "https://classroom.googleapis.com/v1/courses/c1/courseWork/-/studentSubmissions?": () => jsonRes({ studentSubmissions: [] }),
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?": () => jsonRes({ items: [] })
    });
    const feed = await syncGoogleAssignments(e, "s@e.edu", DEFAULT_SETTINGS);
    expect(feed.items.map(i => i.title)).toEqual(["Alpha", "Zeta", "Aardvark", "Beta"]);
  });

  it("writes gcache with a 900s TTL after a successful sync", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () => jsonRes({ access_token: "at", expires_in: 3599 }),
      "https://classroom.googleapis.com/v1/courses?": () => jsonRes({ courses: [] }),
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?": () => jsonRes({ items: [] })
    });
    await syncGoogleAssignments(e, "s@e.edu", DEFAULT_SETTINGS);
    expect(e.PROGRESS._store.has(googleCacheKey("s@e.edu"))).toBe(true);
    expect(e.PROGRESS._store._lastPutOpts).toMatchObject({ expirationTtl: 900 });
  });

  it("on a Classroom 500 with a warm cache: serves the cache with reason 'google_unavailable'", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    const cached = { items: [{ id: "classroom:c1:w1", source: "classroom", title: "Cached", courseName: "X", dueAt: null, allDay: true, link: null, state: "todo" }], fetchedAt: "2026-09-10T00:00:00.000Z" };
    e.PROGRESS._store.set(googleCacheKey("s@e.edu"), JSON.stringify(cached));
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () => jsonRes({ access_token: "at", expires_in: 3599 }),
      "https://classroom.googleapis.com/v1/courses?": () => new Response("upstream boom", { status: 500 }),
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?": () => new Response("upstream boom", { status: 500 })
    });
    const feed = await syncGoogleAssignments(e, "s@e.edu", DEFAULT_SETTINGS);
    expect(feed).toMatchObject({ connected: true, reason: "google_unavailable" });
    expect(feed.items.map(i => i.title)).toEqual(["Cached"]);
  });

  it("on a Classroom 503 with no cache: returns connected:true, empty items, reason 'google_unavailable'", async () => {
    const e = env();
    await connect(e, "s@e.edu");
    globalThis.fetch = routeFetch({
      "https://oauth2.googleapis.com/token": () => jsonRes({ access_token: "at", expires_in: 3599 }),
      "https://classroom.googleapis.com/v1/courses?": () => new Response("boom", { status: 503 }),
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?": () => new Response("boom", { status: 503 })
    });
    const feed = await syncGoogleAssignments(e, "s@e.edu", DEFAULT_SETTINGS);
    expect(feed).toMatchObject({ connected: true, items: [], reason: "google_unavailable" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/google-sync.test.js`
Expected: FAIL — `Cannot find module '../src/google-sync.js'`.

- [ ] **Step 3: Create `src/google-sync.ts`**

```ts
import { getGoogleToken, deleteGoogleToken } from "./google-token.js";

export interface GoogleSettings {
  calendarIds: string[];
  schoolworkOnly: boolean;
}

export const DEFAULT_SETTINGS: GoogleSettings = { calendarIds: ["primary"], schoolworkOnly: true };

export interface Assignment {
  id: string;
  source: "classroom" | "calendar";
  title: string;
  courseName: string | null;
  dueAt: string | null; // ISO 8601
  allDay: boolean;
  link: string | null;
  state: "todo" | "submitted" | "done" | "none";
}

export interface Feed {
  connected: boolean;
  items: Assignment[];
  fetchedAt: string;
  reason?: "revoked" | "google_unavailable";
}

interface CacheEntry {
  items: Assignment[];
  fetchedAt: string;
}

const CACHE_TTL_SECONDS = 900;
const CALENDAR_WINDOW_DAYS = 35;
const COURSE_CONCURRENCY = 5;

// Keywords that mark a calendar event as schoolwork. Word-boundary, case-insensitive.
const SCHOOLWORK_RE = /\b(test|quiz|exam|midterm|final|essay|project|paper|due|assignment|presentation|lab report|homework|hw)\b/i;

export function googleCacheKey(email: string): string {
  return "gcache:" + email;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const count = Math.min(limit, items.length);
  const workers = Array.from({ length: count > 0 ? count : 0 }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

// Thrown to abort the sync and fall back to cache / empty. Never escapes this module.
class GoogleUnavailable extends Error {}

async function gfetch(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (!res.ok) throw new GoogleUnavailable(url + " -> " + res.status);
  return res.json();
}

function classroomDueAt(cw: any): { dueAt: string | null; allDay: boolean } {
  const d = cw?.dueDate;
  if (!d || typeof d.year !== "number") return { dueAt: null, allDay: true };
  const yyyy = String(d.year).padStart(4, "0");
  const mm = String(d.month || 1).padStart(2, "0");
  const dd = String(d.day || 1).padStart(2, "0");
  const t = cw?.dueTime;
  if (t && (typeof t.hours === "number" || typeof t.minutes === "number")) {
    const hh = String(t.hours || 0).padStart(2, "0");
    const mi = String(t.minutes || 0).padStart(2, "0");
    return { dueAt: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00.000Z`, allDay: false };
  }
  return { dueAt: `${yyyy}-${mm}-${dd}T00:00:00.000Z`, allDay: true };
}

function submissionState(raw: string | undefined): Assignment["state"] {
  if (raw === "TURNED_IN") return "submitted";
  if (raw === "RETURNED") return "done";
  return "todo";
}

async function fetchClassroom(accessToken: string): Promise<Assignment[]> {
  const first = await gfetch(
    "https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=50",
    accessToken
  );
  let courses: any[] = Array.isArray(first?.courses) ? first.courses : [];
  if (first?.nextPageToken && courses.length < 50) {
    const next = await gfetch(
      "https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=50&pageToken=" +
        encodeURIComponent(first.nextPageToken),
      accessToken
    );
    if (Array.isArray(next?.courses)) courses = courses.concat(next.courses);
  }
  courses = courses.slice(0, 50);

  const perCourse = await mapLimit(courses, COURSE_CONCURRENCY, async (course: any) => {
    const cid = String(course.id);
    const [workRes, subRes] = await Promise.all([
      gfetch(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(cid)}/courseWork?pageSize=50&orderBy=${encodeURIComponent("dueDate desc")}`,
        accessToken
      ),
      gfetch(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(cid)}/courseWork/-/studentSubmissions?userId=me&pageSize=100`,
        accessToken
      )
    ]);
    const subByWork = new Map<string, string>();
    for (const s of (Array.isArray(subRes?.studentSubmissions) ? subRes.studentSubmissions : [])) {
      if (s?.courseWorkId) subByWork.set(String(s.courseWorkId), String(s.state));
    }
    const work: any[] = Array.isArray(workRes?.courseWork) ? workRes.courseWork : [];
    return work.map((cw): Assignment => {
      const { dueAt, allDay } = classroomDueAt(cw);
      return {
        id: `classroom:${cid}:${cw.id}`,
        source: "classroom",
        title: typeof cw.title === "string" ? cw.title : "(untitled)",
        courseName: typeof course.name === "string" ? course.name : null,
        dueAt,
        allDay,
        link: typeof cw.alternateLink === "string" ? cw.alternateLink : null,
        state: submissionState(subByWork.get(String(cw.id)))
      };
    });
  });
  return perCourse.flat();
}

interface CalItem extends Assignment {
  _desc?: string;
}

async function fetchCalendars(accessToken: string, settings: GoogleSettings): Promise<CalItem[]> {
  const calIds = settings.calendarIds.length ? settings.calendarIds : ["primary"];
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + CALENDAR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const perCal = await mapLimit(calIds, COURSE_CONCURRENCY, async (calId: string) => {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250"
    });
    const data = await gfetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` + params.toString(),
      accessToken
    );
    const calName = typeof data?.summary === "string" ? data.summary : null;
    const events: any[] = Array.isArray(data?.items) ? data.items : [];
    return events.map((ev): CalItem => {
      const timed = ev?.start?.dateTime;
      const dateOnly = ev?.start?.date;
      const allDay = !timed && !!dateOnly;
      let dueAt: string | null = null;
      if (timed) dueAt = new Date(timed).toISOString();
      else if (dateOnly) dueAt = `${dateOnly}T00:00:00.000Z`;
      return {
        id: `calendar:${calId}:${ev.id}`,
        source: "calendar",
        title: typeof ev.summary === "string" && ev.summary ? ev.summary : "(no title)",
        courseName: calName,
        dueAt,
        allDay,
        link: typeof ev.htmlLink === "string" ? ev.htmlLink : null,
        state: "none",
        _desc: typeof ev.description === "string" ? ev.description : undefined
      };
    });
  });
  return perCal.flat();
}

function applySchoolworkFilter(classroom: Assignment[], calendar: CalItem[], settings: GoogleSettings): Assignment[] {
  const keptCal = settings.schoolworkOnly === false
    ? calendar
    : calendar.filter((it) => SCHOOLWORK_RE.test(it.title + " " + (it._desc || "")));
  const strippedCal: Assignment[] = keptCal.map(({ _desc, ...rest }) => rest);
  return [...classroom, ...strippedCal];
}

function sortItems(items: Assignment[]): Assignment[] {
  return [...items].sort((a, b) => {
    if (a.dueAt && b.dueAt) {
      if (a.dueAt < b.dueAt) return -1;
      if (a.dueAt > b.dueAt) return 1;
      return a.title.localeCompare(b.title);
    }
    if (a.dueAt && !b.dueAt) return -1;
    if (!a.dueAt && b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

export async function syncGoogleAssignments(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  email: string,
  settings: GoogleSettings
): Promise<Feed> {
  const token = await getGoogleToken(env, email);
  if (!token) return { connected: false, items: [], fetchedAt: nowIso() };

  // 1. Refresh -> access token (never stored).
  let accessToken: string;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token"
      })
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || typeof data?.access_token !== "string") {
      if (data?.error === "invalid_grant") {
        await deleteGoogleToken(env, email);
        await env.PROGRESS.delete(googleCacheKey(email));
        return { connected: false, items: [], fetchedAt: nowIso(), reason: "revoked" };
      }
      return staleOrEmpty(env, email);
    }
    accessToken = data.access_token;
  } catch (e) {
    return staleOrEmpty(env, email);
  }

  // 2 + 3. Fetch + normalize. Any non-2xx from Classroom/Calendar -> GoogleUnavailable.
  try {
    const [classroom, calendar] = await Promise.all([
      fetchClassroom(accessToken),
      fetchCalendars(accessToken, settings)
    ]);
    const items = sortItems(applySchoolworkFilter(classroom, calendar, settings));
    const fetchedAt = nowIso();
    const entry: CacheEntry = { items, fetchedAt };
    await env.PROGRESS.put(googleCacheKey(email), JSON.stringify(entry), { expirationTtl: CACHE_TTL_SECONDS });
    return { connected: true, items, fetchedAt };
  } catch (e) {
    return staleOrEmpty(env, email);
  }
}

async function staleOrEmpty(env: { PROGRESS: KVNamespace }, email: string): Promise<Feed> {
  const raw = await env.PROGRESS.get(googleCacheKey(email));
  if (raw) {
    try {
      const entry = JSON.parse(raw) as CacheEntry;
      return { connected: true, items: entry.items || [], fetchedAt: entry.fetchedAt || nowIso(), reason: "google_unavailable" };
    } catch (e) {
      // fall through
    }
  }
  return { connected: true, items: [], fetchedAt: nowIso(), reason: "google_unavailable" };
}
```

> Note on `_desc`: the calendar description is carried transiently on `CalItem` only for the schoolwork filter and is destructured away before an item is returned or cached — no event body is persisted, per the spec's non-goals.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run test/google-sync.test.js && npm run typecheck`
Expected: PASS — all 8 cases green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/google-sync.ts test/google-sync.test.js
git commit -m "feat: Google Classroom + Calendar sync pipeline (google-sync.ts)"
```

---

## Task 5: `src/google-routes.ts` — the four API handlers

**Files:**
- Create: `src/google-routes.ts`
- Create: `test/google-routes.test.js`

**Interfaces:**
- Consumes: `getSession` from `src/auth.js`; `getGoogleToken`, `deleteGoogleToken` from `src/google-token.js`; `syncGoogleAssignments`, `googleCacheKey`, `DEFAULT_SETTINGS`, `type GoogleSettings`, `type Feed` from `src/google-sync.js`.
- Produces:
  - `export function handleAssignments(request: Request, env: Env): Promise<Response>` — GET `/api/assignments`
  - `export function handleGoogleCalendars(request: Request, env: Env): Promise<Response>` — GET `/api/google/calendars`
  - `export function handleGoogleDisconnect(request: Request, env: Env): Promise<Response>` — POST `/api/google/disconnect`
  - `export function handleGoogleSettingsGet(request: Request, env: Env): Promise<Response>` — GET `/api/google/settings`
  - `export function handleGoogleSettingsPost(request: Request, env: Env): Promise<Response>` — POST `/api/google/settings`
  - `export function googleSettingsKey(email: string): string` → `"gsettings:" + email`

- [ ] **Step 1: Write the failing test**

Create `test/google-routes.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import {
  handleAssignments, handleGoogleDisconnect,
  handleGoogleSettingsGet, handleGoogleSettingsPost, googleSettingsKey
} from "../src/google-routes.js";
import { putGoogleToken, googleTokenKey } from "../src/google-token.js";
import { googleCacheKey } from "../src/google-sync.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { store.set(k, v); store._lastPutOpts = opts; },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

async function cookie(email) {
  const now = Math.floor(Date.now() / 1000);
  return `${SESSION_COOKIE}=${await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET)}`;
}

const env = () => ({ PROGRESS: fakeKV(), SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec" });
const get = (url, c) => new Request(url, { headers: c ? { Cookie: c } : {} });
const post = (url, c, body) => new Request(url, { method: "POST", headers: { Cookie: c, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = realFetch; });

describe("/api/assignments", () => {
  it("401s with no session", async () => {
    const res = await handleAssignments(get("https://precisstudy.com/api/assignments"), env());
    expect(res.status).toBe(401);
  });

  it("serves a fresh cache (< 15 min) without calling Google", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    await putGoogleToken(e, "s@e.edu", { refreshToken: "1//rt", googleEmail: "s@e.edu", scopes: [], connectedAt: "x" });
    const entry = { items: [{ id: "classroom:c:w", source: "classroom", title: "Cached", courseName: null, dueAt: null, allDay: true, link: null, state: "todo" }], fetchedAt: new Date().toISOString() };
    e.PROGRESS._store.set(googleCacheKey("s@e.edu"), JSON.stringify(entry));
    globalThis.fetch = async () => { throw new Error("must not fetch on a warm cache"); };
    const res = await handleAssignments(get("https://precisstudy.com/api/assignments", c), e);
    expect(res.status).toBe(200);
    const feed = await res.json();
    expect(feed).toMatchObject({ connected: true });
    expect(feed.items.map(i => i.title)).toEqual(["Cached"]);
  });

  it("?refresh=1 bypasses the cache and re-syncs", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    await putGoogleToken(e, "s@e.edu", { refreshToken: "1//rt", googleEmail: "s@e.edu", scopes: [], connectedAt: "x" });
    e.PROGRESS._store.set(googleCacheKey("s@e.edu"), JSON.stringify({ items: [{ id: "x", source: "classroom", title: "Stale", courseName: null, dueAt: null, allDay: true, link: null, state: "todo" }], fetchedAt: new Date().toISOString() }));
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "at" }), { headers: { "Content-Type": "application/json" } });
      if (u.startsWith("https://classroom.googleapis.com/v1/courses?")) return new Response(JSON.stringify({ courses: [] }), { headers: { "Content-Type": "application/json" } });
      if (u.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events?")) return new Response(JSON.stringify({ items: [] }), { headers: { "Content-Type": "application/json" } });
      throw new Error("unrouted " + u);
    };
    const res = await handleAssignments(get("https://precisstudy.com/api/assignments?refresh=1", c), e);
    const feed = await res.json();
    expect(feed.items).toEqual([]);
  });

  it("returns connected:false when the user has no Google token", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const res = await handleAssignments(get("https://precisstudy.com/api/assignments", c), e);
    expect(await res.json()).toMatchObject({ connected: false, items: [] });
  });
});

describe("/api/google/disconnect", () => {
  it("401s with no session", async () => {
    const res = await handleGoogleDisconnect(post("https://precisstudy.com/api/google/disconnect", ""), env());
    expect(res.status).toBe(401);
  });

  it("deletes gtok, gcache and gsettings, best-effort revokes, returns { ok: true }", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    await putGoogleToken(e, "s@e.edu", { refreshToken: "1//rt", googleEmail: "s@e.edu", scopes: [], connectedAt: "x" });
    e.PROGRESS._store.set(googleCacheKey("s@e.edu"), "{}");
    e.PROGRESS._store.set(googleSettingsKey("s@e.edu"), "{}");
    let revoked = false;
    globalThis.fetch = async (url) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/revoke")) { revoked = true; return new Response("", { status: 200 }); }
      throw new Error("unexpected " + url);
    };
    const res = await handleGoogleDisconnect(post("https://precisstudy.com/api/google/disconnect", c), e);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(e.PROGRESS._store.has(googleTokenKey("s@e.edu"))).toBe(false);
    expect(e.PROGRESS._store.has(googleCacheKey("s@e.edu"))).toBe(false);
    expect(e.PROGRESS._store.has(googleSettingsKey("s@e.edu"))).toBe(false);
    expect(revoked).toBe(true);
  });

  it("still returns { ok: true } when the revoke call throws", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    await putGoogleToken(e, "s@e.edu", { refreshToken: "1//rt", googleEmail: "s@e.edu", scopes: [], connectedAt: "x" });
    globalThis.fetch = async () => { throw new Error("network down"); };
    const res = await handleGoogleDisconnect(post("https://precisstudy.com/api/google/disconnect", c), e);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(e.PROGRESS._store.has(googleTokenKey("s@e.edu"))).toBe(false);
  });
});

describe("/api/google/settings", () => {
  it("GET returns the default when nothing is stored", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const res = await handleGoogleSettingsGet(get("https://precisstudy.com/api/google/settings", c), e);
    expect(await res.json()).toEqual({ calendarIds: ["primary"], schoolworkOnly: true });
  });

  it("POST validates and stores, echoing the stored value", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const res = await handleGoogleSettingsPost(post("https://precisstudy.com/api/google/settings", c, { calendarIds: ["primary", "a@group.calendar.google.com"], schoolworkOnly: false }), e);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ calendarIds: ["primary", "a@group.calendar.google.com"], schoolworkOnly: false });
    expect(JSON.parse(e.PROGRESS._store.get(googleSettingsKey("s@e.edu")))).toEqual({ calendarIds: ["primary", "a@group.calendar.google.com"], schoolworkOnly: false });
  });

  it("POST rejects a non-array calendarIds / oversized list / long id / non-boolean flag with 400", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const bad = [
      { calendarIds: "primary", schoolworkOnly: true },
      { calendarIds: Array.from({ length: 26 }, (_, i) => "c" + i), schoolworkOnly: true },
      { calendarIds: ["x".repeat(513)], schoolworkOnly: true },
      { calendarIds: ["ok"], schoolworkOnly: "yes" }
    ];
    for (const body of bad) {
      const res = await handleGoogleSettingsPost(post("https://precisstudy.com/api/google/settings", c, body), e);
      expect(res.status).toBe(400);
    }
  });

  it("POST 400s on an unreadable body", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const req = new Request("https://precisstudy.com/api/google/settings", { method: "POST", headers: { Cookie: c, "Content-Type": "application/json" }, body: "not json" });
    const res = await handleGoogleSettingsPost(req, e);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/google-routes.test.js`
Expected: FAIL — `Cannot find module '../src/google-routes.js'`.

- [ ] **Step 3: Create `src/google-routes.ts`**

```ts
import { getSession } from "./auth.js";
import { getGoogleToken, deleteGoogleToken } from "./google-token.js";
import {
  syncGoogleAssignments, googleCacheKey, DEFAULT_SETTINGS,
  type GoogleSettings, type Feed
} from "./google-sync.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

const CACHE_FRESH_MS = 15 * 60 * 1000;
const MAX_CALENDAR_IDS = 25;
const MAX_CALENDAR_ID_LEN = 512;

export function googleSettingsKey(email: string): string {
  return "gsettings:" + email;
}

async function loadSettings(env: { PROGRESS: KVNamespace }, email: string): Promise<GoogleSettings> {
  const raw = await env.PROGRESS.get(googleSettingsKey(email));
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    const calendarIds = Array.isArray(parsed?.calendarIds)
      ? parsed.calendarIds.filter((s: unknown): s is string => typeof s === "string")
      : DEFAULT_SETTINGS.calendarIds;
    return {
      calendarIds: calendarIds.length ? calendarIds : [...DEFAULT_SETTINGS.calendarIds],
      schoolworkOnly: parsed?.schoolworkOnly !== false
    };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function handleAssignments(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  const skipCache = new URL(request.url).searchParams.get("refresh") === "1";
  if (!skipCache) {
    const raw = await env.PROGRESS.get(googleCacheKey(session.email));
    if (raw) {
      try {
        const entry = JSON.parse(raw) as { items: unknown[]; fetchedAt: string };
        const age = Date.now() - Date.parse(entry.fetchedAt);
        if (Number.isFinite(age) && age >= 0 && age < CACHE_FRESH_MS) {
          return json({ connected: true, items: entry.items, fetchedAt: entry.fetchedAt } satisfies Feed);
        }
      } catch (e) {
        // fall through to a fresh sync
      }
    }
  }

  const settings = await loadSettings(env, session.email);
  const feed = await syncGoogleAssignments(env, session.email, settings);
  return json(feed);
}

export async function handleGoogleCalendars(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  const token = await getGoogleToken(env, session.email);
  if (!token) return json({ connected: false, calendars: [] });

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token"
      })
    });
    const tokenData: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || typeof tokenData?.access_token !== "string") {
      return json({ connected: false, calendars: [] });
    }
    const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });
    if (!listRes.ok) return json({ connected: true, calendars: [] });
    const list: any = await listRes.json();
    const calendars = (Array.isArray(list?.items) ? list.items : []).map((c: any) => ({
      id: String(c.id),
      summary: typeof c.summary === "string" ? c.summary : String(c.id),
      primary: c.primary === true
    }));
    return json({ connected: true, calendars });
  } catch (e) {
    return json({ connected: true, calendars: [] });
  }
}

export async function handleGoogleDisconnect(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  const token = await getGoogleToken(env, session.email);
  if (token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token.refreshToken), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
    } catch (e) {
      // best-effort; the local deletion below is what matters
    }
  }
  await deleteGoogleToken(env, session.email);
  await env.PROGRESS.delete(googleCacheKey(session.email));
  await env.PROGRESS.delete(googleSettingsKey(session.email));
  return json({ ok: true });
}

export async function handleGoogleSettingsGet(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  return json(await loadSettings(env, session.email));
}

export async function handleGoogleSettingsPost(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const calendarIds = body?.calendarIds;
  if (
    !Array.isArray(calendarIds) ||
    calendarIds.length > MAX_CALENDAR_IDS ||
    !calendarIds.every((s: unknown) => typeof s === "string" && s.length > 0 && s.length <= MAX_CALENDAR_ID_LEN)
  ) {
    return json({ error: "calendarIds must be an array of up to 25 strings, each 512 chars or fewer" }, 400);
  }
  if (typeof body?.schoolworkOnly !== "boolean") {
    return json({ error: "schoolworkOnly must be a boolean" }, 400);
  }

  const value: GoogleSettings = { calendarIds, schoolworkOnly: body.schoolworkOnly };
  await env.PROGRESS.put(googleSettingsKey(session.email), JSON.stringify(value));
  return json(value);
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run test/google-routes.test.js && npm run typecheck`
Expected: PASS — all cases green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/google-routes.ts test/google-routes.test.js
git commit -m "feat: /api/assignments + /api/google/* handlers (google-routes.ts)"
```

---

## Task 6: Wire the six routes into `src/worker.ts`

**Files:**
- Modify: `src/worker.ts` — imports block (after the `push-routes.js` import, ~line 17); `AUTH_ROUTES` object (~lines 23-32); a new group of `/api/*` blocks just after the `/api/streak` block (~line 218)
- Modify: `test/worker.test.js` — append a `describe` block

**Interfaces:**
- Consumes: `handleGoogleConnectStart`, `handleGoogleConnectCallback` from `src/google-connect.js`; `handleAssignments`, `handleGoogleCalendars`, `handleGoogleDisconnect`, `handleGoogleSettingsGet`, `handleGoogleSettingsPost` from `src/google-routes.js`.
- Produces: no new exports (routing only).

- [ ] **Step 1: Write the failing test**

Append to `test/worker.test.js` (keep existing content; the file already imports `SELF` from `cloudflare:test` and `describe/it/expect` from `vitest` — verify and add if missing):

```js
describe("Google connect + assignments routing", () => {
  it("/api/assignments requires a session (401, not the SPA fallback)", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/assignments");
    expect(res.status).toBe(401);
  });

  it("/api/google/settings GET requires a session", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/google/settings");
    expect(res.status).toBe(401);
  });

  it("/api/google/disconnect rejects GET with 405", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/google/disconnect");
    expect(res.status).toBe(405);
  });

  it("/api/google/settings rejects DELETE with 405", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/google/settings", { method: "DELETE" });
    expect(res.status).toBe(405);
  });

  it("/auth/google/connect/start redirects to /settings?google=error with no session", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/google/connect/start", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
  });

  it("/auth/google/connect/start rejects POST with 405", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/google/connect/start", { method: "POST" });
    expect(res.status).toBe(405);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/worker.test.js`
Expected: FAIL — `/api/assignments` currently falls through to `env.ASSETS.fetch` (SPA fallback, 200) and the connect routes are unrouted.

- [ ] **Step 3: Add the imports**

In `src/worker.ts`, after the `push-routes.js` import line:

```ts
import { handleGoogleConnectStart, handleGoogleConnectCallback } from "./google-connect.js";
import {
  handleAssignments, handleGoogleCalendars, handleGoogleDisconnect,
  handleGoogleSettingsGet, handleGoogleSettingsPost
} from "./google-routes.js";
```

- [ ] **Step 4: Add the two connect routes to `AUTH_ROUTES`**

Inside the `AUTH_ROUTES` object literal, add:

```ts
  "/auth/google/connect/start": { GET: handleGoogleConnectStart },
  "/auth/google/connect/callback": { GET: handleGoogleConnectCallback },
```

- [ ] **Step 5: Add the four API route blocks**

In `handleFetch`, immediately after the `if (url.pathname === "/api/streak") { ... }` block, add:

```ts
  if (url.pathname === "/api/assignments") {
    if (request.method === "GET") return handleAssignments(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/google/calendars") {
    if (request.method === "GET") return handleGoogleCalendars(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/google/disconnect") {
    if (request.method === "POST") return handleGoogleDisconnect(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/google/settings") {
    if (request.method === "GET") return handleGoogleSettingsGet(request, env);
    if (request.method === "POST") return handleGoogleSettingsPost(request, env);
    return json({ error: "Method not allowed" }, 405);
  }
```

(`json` is already imported from `./chat.js` at the top of `worker.ts`.)

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — every test file green (new + existing), no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/worker.ts test/worker.test.js
git commit -m "feat: route Google connect + assignments endpoints in worker.ts"
```

---

## Task 7: "Connected accounts" card in `public/settings/index.html`

**Files:**
- Modify: `public/settings/index.html` — add a `.ss-card` inside `#settings-content` after the Notifications card; add a `<script>` block before `</body>`.

**Interfaces:**
- Consumes (HTTP): `GET /api/google/settings`, `GET /api/google/calendars`, `POST /api/google/settings`, `POST /api/google/disconnect`; navigates to `/auth/google/connect/start?next=/settings`.
- Produces: none (page only).

- [ ] **Step 1: Add the card markup**

Immediately after the Notifications `.ss-card` `</div>` closes and before `#settings-content`'s closing `</div>`, insert:

```html
    <div class="ss-card" id="google-card" style="margin-top:20px;">
      <div style="font-weight:800;font-size:17px;color:var(--text);margin-bottom:4px;">Connected accounts</div>
      <p style="font-size:14px;color:var(--text-muted);margin:0 0 16px;">
        Connect Google to pull your Classroom assignments and calendar due-dates into one list.
      </p>
      <div id="google-status" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></div>

      <div id="google-disconnected">
        <a id="google-connect-btn" class="ss-oauth-btn" style="width:auto;display:inline-flex;padding:10px 20px;text-decoration:none;" href="/auth/google/connect/start?next=/settings">Connect Google</a>
      </div>

      <div id="google-connected" style="display:none;">
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">Connected as <b id="google-email"></b></p>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--text);margin-bottom:12px;">
          <input type="checkbox" id="google-schoolwork-only"> Only show schoolwork on my list
        </label>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">Calendars to include:</div>
        <div id="google-calendar-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="google-save-btn" style="width:auto;padding:10px 20px;">Save</button>
          <button id="google-disconnect-btn" class="ss-oauth-btn" style="width:auto;padding:10px 20px;margin-bottom:0;">Disconnect</button>
        </div>
        <div id="google-save-status" style="margin-top:10px;font-size:13px;color:var(--text-muted);"></div>
      </div>
    </div>
```

- [ ] **Step 2: Add the behavior script**

Append this `<script>` just before `</body>`:

```html
<script>
(function(){
  function qs(id){ return document.getElementById(id); }

  function readStatusFlag(){
    var p = new URLSearchParams(location.search).get('google');
    if(!p) return;
    var map = {
      connected: 'Google connected.',
      error: 'Could not connect Google — please try again.',
      norefresh: 'Google did not return offline access. Remove PrecisStudy at myaccount.google.com/permissions, then connect again.'
    };
    var el = qs('google-status');
    if(el && map[p]){ el.textContent = map[p]; }
    history.replaceState(null, '', '/settings');
  }

  async function loadGoogleCard(){
    readStatusFlag();
    var settings;
    try {
      var sres = await fetch('/api/google/settings');
      if(sres.status === 401) return; // not signed in; the gate handles it
      settings = await sres.json();
    } catch(e){ return; }

    var calRes;
    try { calRes = await (await fetch('/api/google/calendars')).json(); }
    catch(e){ calRes = { connected: false, calendars: [] }; }

    var connected = !!calRes.connected;
    qs('google-disconnected').style.display = connected ? 'none' : 'block';
    qs('google-connected').style.display = connected ? 'block' : 'none';
    if(!connected) return;

    qs('google-schoolwork-only').checked = settings.schoolworkOnly !== false;

    var chosen = new Set(settings.calendarIds || ['primary']);
    var list = qs('google-calendar-list');
    list.innerHTML = '';
    var cals = calRes.calendars || [];
    if(!cals.length){
      list.innerHTML = '<span style="font-size:13px;color:var(--text-muted);">No calendars found.</span>';
    }
    cals.forEach(function(c){
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:14px;color:var(--text);';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = c.id;
      cb.checked = chosen.has(c.id);
      row.appendChild(cb);
      row.appendChild(document.createTextNode(c.summary + (c.primary ? ' (primary)' : '')));
      list.appendChild(row);
    });
  }

  document.addEventListener('click', async function(e){
    if(e.target && e.target.id === 'google-save-btn'){
      var ids = Array.prototype.slice.call(document.querySelectorAll('#google-calendar-list input:checked')).map(function(i){ return i.value; });
      if(!ids.length) ids = ['primary'];
      var status = qs('google-save-status');
      status.textContent = 'Saving…';
      try {
        var res = await fetch('/api/google/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarIds: ids, schoolworkOnly: qs('google-schoolwork-only').checked })
        });
        status.textContent = res.ok ? 'Saved.' : 'Could not save.';
      } catch(err){ status.textContent = 'Could not save.'; }
    }
    if(e.target && e.target.id === 'google-disconnect-btn'){
      e.target.disabled = true;
      try { await fetch('/api/google/disconnect', { method: 'POST' }); } catch(err){}
      location.href = '/settings';
    }
  });

  window.addEventListener('load', function(){ setTimeout(loadGoogleCard, 0); });
})();
</script>
```

- [ ] **Step 3: Manual verification (this repo has no page-level test harness)**

Run: `npm run dev`, open `http://localhost:8787/settings`.
Expected signed out: the card is hidden with the rest of `#settings-content` behind the sign-in gate.
Expected signed in (local `GOOGLE_CLIENT_*` unset): the card shows "Connect Google"; clicking it goes to `/auth/google/connect/start?next=/settings`, which redirects back to `/settings?google=error`, and the status line reads "Could not connect Google — please try again."

- [ ] **Step 4: Run the worker suite (guard against markup breaking the route)**

Run: `npm test`
Expected: PASS — unchanged; no new test file, existing ones must stay green.

- [ ] **Step 5: Commit**

```bash
git add public/settings/index.html
git commit -m "feat: Connected accounts (Google) card on the settings page"
```

---

## Task 8: Deploy prerequisites doc

**Files:**
- Create: `docs/google-connect-setup.md`

**Interfaces:** none (documentation only; not imported by code).

- [ ] **Step 1: Write the doc**

Create `docs/google-connect-setup.md`:

```markdown
# Google Classroom + Calendar connect — deploy prerequisites

The `/auth/google/connect/*` flow and `/api/assignments` reuse the existing
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET`. No new Worker
bindings. Before this works in production:

1. **Authorized redirect URI** — in the Google Cloud console for the existing
   OAuth client, add:
   - `https://precisstudy.com/auth/google/connect/callback`
   - the localhost equivalent used in dev (e.g. `http://localhost:8787/auth/google/connect/callback`)
   The sign-in callback `https://precisstudy.com/auth/google/callback` stays as-is.

2. **Enable APIs** on the project: **Google Classroom API** and **Google Calendar API**.

3. **OAuth consent screen** — add these scopes:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
   - `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   Until the app is verified by Google, only accounts added as **test users**
   can complete the connect flow. Call this out in the PR.

4. **No `wrangler.jsonc` change** — `PROGRESS` KV and the three secrets already exist.

## Data stored (KV namespace `PROGRESS`)

| Key | Contents | Lifetime |
|---|---|---|
| `gtok:<email>` | base64(iv ++ AES-GCM(`{refreshToken, googleEmail, scopes, connectedAt}`)); key = HKDF-SHA-256(`SESSION_SECRET`) | until disconnect / revoke |
| `gcache:<email>` | `{items: Assignment[], fetchedAt}` normalized feed | 900s TTL |
| `gsettings:<email>` | `{calendarIds: string[], schoolworkOnly: boolean}` | until disconnect |

Access tokens are never persisted. Rotating `SESSION_SECRET` invalidates every
`gtok:` (it fails to decrypt and the user simply appears disconnected).
```

- [ ] **Step 2: Commit**

```bash
git add docs/google-connect-setup.md
git commit -m "docs: Google connect deploy prerequisites"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| Connect flow — `handleGoogleConnectStart` (session gate, config gate, consent URL params, scopes, state cookie, `next`) | 3 |
| Connect flow — `handleGoogleConnectCallback` (session, state, token exchange, `refresh_token` → `norefresh`, userinfo, store, redirect, cookie clear) | 3 |
| Token storage & crypto — `gtok:`, AES-GCM, HKDF-SHA-256 from `SESSION_SECRET`, `put/get/delete`, access tokens never persisted | 2 |
| Sync — no token → `connected:false`; refresh; `invalid_grant` → delete `gtok:`+`gcache:` + `revoked`; Classroom courses/coursework/submissions, concurrency 5, one extra page, 50-course cap; dueAt from dueDate/dueTime; Calendar timed vs all-day, `["primary"]` default, 35-day window; schoolwork filter (classroom always kept); sort asc, undated last, then title; `gcache` 900s; non-2xx → stale cache or empty + `google_unavailable`; never throws | 4 |
| Public API — `/api/assignments` (401, 15-min cache, `?refresh=1`); `/api/google/calendars`; `/api/google/disconnect` (revoke + delete 3 keys); `/api/google/settings` GET/POST with `≤25` / `≤512` / boolean validation | 5 |
| `gsettings:` default `{ ["primary"], true }` | 4 (`DEFAULT_SETTINGS`) + 5 |
| Settings UI — card, connect link `?next=/settings`, connected state, disconnect, calendar multi-select, schoolwork checkbox, `?google=connected|error|norefresh` status | 7 |
| Config / deploy prerequisites (redirect URI, enable APIs, consent scopes, test-users note, no new bindings) | 8 |
| File structure — `auth-state.ts` extraction of `makeState`/`checkState` | 1 |
| `src/worker.ts` +6 routes | 6 |
| `src/env.d.ts` no change | Global Constraints (explicit) |
| Testing — `google-sync` / `google-token` / `google-connect` cases from the doc | 2, 3, 4 (+ routing in 5, 6) |

Deviation logged (Global Constraints + here): the design doc named `test/google-token.node.test.mjs` under `node --test`; this plan puts the crypto tests in the Vitest Workers pool (`test/google-token.test.js`) because `node --test` cannot import the TypeScript source and the pool exposes the same `crypto.subtle`. Every assertion the doc listed is covered.

**2. Placeholder scan** — no "TBD" / "add error handling" / "similar to Task N" / bare "write tests". Every code step carries complete code; every test step carries runnable assertions with explicit expected results.

**3. Type consistency** — `GoogleTokenRecord` (Task 2) used unchanged in Tasks 3–5. `GoogleSettings` / `Feed` / `Assignment` (Task 4) used unchanged in Task 5. Key builders each defined once: `googleTokenKey` (2), `googleCacheKey` (4), `googleSettingsKey` (5); every other module imports them. Handler names — `handleGoogleConnectStart` / `handleGoogleConnectCallback` (3), `handleAssignments` / `handleGoogleCalendars` / `handleGoogleDisconnect` / `handleGoogleSettingsGet` / `handleGoogleSettingsPost` (5) — match the imports and route table in Task 6. `makeState` / `checkState` / `safeNext` / `nextCookie` / `consumeNext` / `stateCookie` / `clearStateCookie` / `clearNextCookie` / `SITE_ORIGIN` / `STATE_TTL` exported from Task 1, consumed by Task 3 and re-imported by `auth-routes.ts`. `env` shape passed to `makeState`/`checkState` is `{ SESSION_SECRET: string }`, satisfied by `Env`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-10-google-classroom-connect-sync.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
