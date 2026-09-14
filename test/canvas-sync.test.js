import { describe, it, expect, vi, afterEach } from "vitest";
import { syncCanvasAssignments } from "../src/canvas-sync.js";
import { putCanvasToken } from "../src/canvas-token.js";

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
  return { PROGRESS: fakeKV(), SESSION_SECRET: "secret-A" };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncCanvasAssignments", () => {
  it("returns not-connected with no fetch when no token is stored", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await syncCanvasAssignments(env(), "student@school.edu");
    expect(result).toEqual({ connected: false, items: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps upcoming events with a due_at into Assignments and drops entries without one", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", { domain: "school.instructure.com", apiToken: "tok-1", connectedAt: "x" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      expect(String(url)).toBe("https://school.instructure.com/api/v1/users/self/upcoming_events");
      expect(opts.headers.Authorization).toBe("Bearer tok-1");
      return new Response(JSON.stringify([
        { id: 501, title: "Essay Draft", due_at: "2026-09-20T23:59:00Z", html_url: "https://school.instructure.com/courses/1/assignments/501" },
        { id: 502, title: "Office Hours (no due date)", due_at: null } // calendar-only entry, dropped
      ]), { status: 200 });
    });

    const result = await syncCanvasAssignments(e, "student@school.edu");

    expect(result.connected).toBe(true);
    expect(result.items).toEqual([{
      id: "canvas-501",
      source: "canvas",
      title: "Essay Draft",
      courseName: null,
      dueAt: "2026-09-20T23:59:00Z",
      allDay: false,
      link: "https://school.instructure.com/courses/1/assignments/501",
      state: "todo"
    }]);
  });

  it("returns connected:true with empty items when the API call fails (bad token/domain)", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", { domain: "school.instructure.com", apiToken: "bad-tok", connectedAt: "x" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));

    const result = await syncCanvasAssignments(e, "student@school.edu");
    expect(result).toEqual({ connected: true, items: [] });
  });

  it("returns connected:true with empty items (does not throw) on a network error", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", { domain: "school.instructure.com", apiToken: "tok-1", connectedAt: "x" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await syncCanvasAssignments(e, "student@school.edu");
    expect(result).toEqual({ connected: true, items: [] });
  });
});
