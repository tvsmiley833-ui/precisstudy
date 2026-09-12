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
  it("GET returns the default when nothing is stored and not connected", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const res = await handleGoogleSettingsGet(get("https://precisstudy.com/api/google/settings", c), e);
    expect(await res.json()).toEqual({ calendarIds: ["primary"], schoolworkOnly: true, googleEmail: null, connected: false });
  });

  it("GET returns the actual connected Google account email and connected:true, not the sign-in email", async () => {
    const e = env();
    const c = await cookie("someone@school.edu");
    await putGoogleToken(e, "someone@school.edu", { refreshToken: "1//rt", googleEmail: "someone.else@gmail.com", scopes: [], connectedAt: "x" });
    const res = await handleGoogleSettingsGet(get("https://precisstudy.com/api/google/settings", c), e);
    const body = await res.json();
    expect(body.googleEmail).toBe("someone.else@gmail.com");
    expect(body.connected).toBe(true);
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

  it("POST invalidates the assignments cache so the next sync picks up the new settings", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    e.PROGRESS._store.set(googleCacheKey("s@e.edu"), JSON.stringify({ items: [], fetchedAt: new Date().toISOString() }));
    const res = await handleGoogleSettingsPost(post("https://precisstudy.com/api/google/settings", c, { calendarIds: ["primary"], schoolworkOnly: false }), e);
    expect(res.status).toBe(200);
    expect(e.PROGRESS._store.has(googleCacheKey("s@e.edu"))).toBe(false);
  });

  it("POST 400s on an unreadable body", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const req = new Request("https://precisstudy.com/api/google/settings", { method: "POST", headers: { Cookie: c, "Content-Type": "application/json" }, body: "not json" });
    const res = await handleGoogleSettingsPost(req, e);
    expect(res.status).toBe(400);
  });
});
