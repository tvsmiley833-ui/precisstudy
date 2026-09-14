import { describe, it, expect, vi, afterEach } from "vitest";
import { pushScheduleToGoogleCalendar } from "../src/google-calendar-push.js";
import { putGoogleToken } from "../src/google-token.js";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

function env() {
  return { PROGRESS: fakeKV(), SESSION_SECRET: "s", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret" };
}

async function connected(e, email) {
  await putGoogleToken(e, email, { refreshToken: "1//rt", googleEmail: email, scopes: [], connectedAt: "x" });
}

function mockTokenRefresh(ok) {
  return async (url, opts) => {
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return ok
        ? new Response(JSON.stringify({ access_token: "at-123" }), { status: 200 })
        : new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    }
    throw new Error("unexpected fetch: " + url);
  };
}

const BLOCK = { day: "tue", start: "16:00", end: "17:00", subjectKey: "geometry", subjectLabel: "Geometry" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pushScheduleToGoogleCalendar", () => {
  it("returns previousEventIds unchanged, with no fetch calls at all, when there is no connected token", async () => {
    const e = env();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await pushScheduleToGoogleCalendar(e, "student@example.com", [BLOCK], "America/New_York", { old: "evt-1" }, "primary");
    expect(result).toEqual({ old: "evt-1" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns previousEventIds unchanged when the token refresh fails", async () => {
    const e = env();
    await connected(e, "student@example.com");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockTokenRefresh(false));
    const result = await pushScheduleToGoogleCalendar(e, "student@example.com", [BLOCK], "America/New_York", { old: "evt-1" }, "primary");
    expect(result).toEqual({ old: "evt-1" });
  });

  it("creates an event for a new block and returns its id under the block's key", async () => {
    const e = env();
    await connected(e, "student@example.com");
    let createBody = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return mockTokenRefresh(true)(url, opts);
      if (String(url).includes("/events") && opts?.method === "POST") {
        createBody = JSON.parse(opts.body);
        return new Response(JSON.stringify({ id: "new-evt-id" }), { status: 200 });
      }
      throw new Error("unexpected fetch: " + url);
    });

    const result = await pushScheduleToGoogleCalendar(e, "student@example.com", [BLOCK], "America/New_York", {}, "primary");

    expect(result).toEqual({ "tue|16:00|geometry": "new-evt-id" });
    expect(createBody.summary).toBe("Geometry (PrecisStudy)");
    expect(createBody.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=TU"]);
    expect(createBody.start.timeZone).toBe("America/New_York");
    expect(createBody.start.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T16:00:00$/);
  });

  it("deletes the event for a removed block and drops its key", async () => {
    const e = env();
    await connected(e, "student@example.com");
    const deletedUrls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return mockTokenRefresh(true)(url, opts);
      if (opts?.method === "DELETE") {
        deletedUrls.push(String(url));
        return new Response(null, { status: 204 });
      }
      throw new Error("unexpected fetch: " + url);
    });

    const result = await pushScheduleToGoogleCalendar(e, "student@example.com", [], "America/New_York", { "tue|16:00|geometry": "evt-to-delete" }, "primary");

    expect(result).toEqual({});
    expect(deletedUrls).toHaveLength(1);
    expect(deletedUrls[0]).toContain("evt-to-delete");
  });

  it("makes no create/delete call for a block that is unchanged", async () => {
    const e = env();
    await connected(e, "student@example.com");
    const calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return mockTokenRefresh(true)(url, opts);
      calls.push({ url: String(url), method: opts?.method });
      return new Response(JSON.stringify({ id: "should-not-happen" }), { status: 200 });
    });

    const result = await pushScheduleToGoogleCalendar(e, "student@example.com", [BLOCK], "America/New_York", { "tue|16:00|geometry": "existing-evt" }, "primary");

    expect(result).toEqual({ "tue|16:00|geometry": "existing-evt" });
    expect(calls).toHaveLength(0); // only the token refresh call happened
  });

  it("skips a block whose create call 403s (missing scope), without throwing, and still processes the rest", async () => {
    const e = env();
    await connected(e, "student@example.com");
    const blockTwo = { day: "wed", start: "10:00", end: "11:00", subjectKey: "chemistry", subjectLabel: "Chemistry" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return mockTokenRefresh(true)(url, opts);
      if (opts?.method === "POST") {
        const body = JSON.parse(opts.body);
        if (body.summary.startsWith("Geometry")) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
        return new Response(JSON.stringify({ id: "chem-evt" }), { status: 200 });
      }
      throw new Error("unexpected fetch: " + url);
    });

    const result = await pushScheduleToGoogleCalendar(e, "student@example.com", [BLOCK, blockTwo], "America/New_York", {}, "primary");

    expect(result).toEqual({ "wed|10:00|chemistry": "chem-evt" });
  });
});
