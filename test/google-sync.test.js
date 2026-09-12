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
