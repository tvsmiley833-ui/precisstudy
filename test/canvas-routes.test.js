import { describe, it, expect, vi, afterEach } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleCanvasConnect, handleCanvasDisconnect, handleCanvasStatus } from "../src/canvas-routes.js";
import { canvasTokenKey, putCanvasToken } from "../src/canvas-token.js";

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

function env() {
  return { SESSION_SECRET: SECRET, PROGRESS: fakeKV() };
}

async function cookie(email) {
  const now = Math.floor(Date.now() / 1000);
  return `${SESSION_COOKIE}=${await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET)}`;
}

function req(url, c, method, body) {
  const headers = { "Content-Type": "application/json" };
  if (c) headers.Cookie = c;
  return new Request(url, { method: method || "GET", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleCanvasConnect", () => {
  it("401s with no session", async () => {
    const res = await handleCanvasConnect(req("https://example.com/api/canvas/connect", null, "POST", { domain: "school.instructure.com", apiToken: "t" }), env());
    expect(res.status).toBe(401);
  });

  it("rejects a malformed domain (has protocol, has a path, or empty)", async () => {
    const c = await cookie("s@e.edu");
    for (const domain of ["https://school.instructure.com", "school.instructure.com/", ""]) {
      const res = await handleCanvasConnect(req("https://example.com/api/canvas/connect", c, "POST", { domain, apiToken: "t" }), env());
      expect(res.status).toBe(400);
    }
  });

  it("rejects an empty api token", async () => {
    const c = await cookie("s@e.edu");
    const res = await handleCanvasConnect(req("https://example.com/api/canvas/connect", c, "POST", { domain: "school.instructure.com", apiToken: "  " }), env());
    expect(res.status).toBe(400);
  });

  it("returns 400 and stores nothing when the verification probe fails", async () => {
    const c = await cookie("s@e.edu");
    const e = env();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const res = await handleCanvasConnect(req("https://example.com/api/canvas/connect", c, "POST", { domain: "school.instructure.com", apiToken: "bad" }), e);
    expect(res.status).toBe(400);
    expect(e.PROGRESS._store.has(canvasTokenKey("s@e.edu"))).toBe(false);
  });

  it("verifies then stores the token on success", async () => {
    const c = await cookie("s@e.edu");
    const e = env();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      expect(String(url)).toBe("https://school.instructure.com/api/v1/users/self");
      expect(opts.headers.Authorization).toBe("Bearer good-tok");
      return new Response(JSON.stringify({ id: 1 }), { status: 200 });
    });
    const res = await handleCanvasConnect(req("https://example.com/api/canvas/connect", c, "POST", { domain: "school.instructure.com", apiToken: "good-tok" }), e);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, connected: true, domain: "school.instructure.com" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(e.PROGRESS._store.has(canvasTokenKey("s@e.edu"))).toBe(true);
  });
});

describe("handleCanvasDisconnect", () => {
  it("401s with no session", async () => {
    const res = await handleCanvasDisconnect(req("https://example.com/api/canvas/disconnect", null, "POST"), env());
    expect(res.status).toBe(401);
  });

  it("removes the stored token", async () => {
    const c = await cookie("s@e.edu");
    const e = env();
    await putCanvasToken(e, "s@e.edu", { domain: "school.instructure.com", apiToken: "t", connectedAt: "x" });
    const res = await handleCanvasDisconnect(req("https://example.com/api/canvas/disconnect", c, "POST"), e);
    expect(res.status).toBe(200);
    expect(e.PROGRESS._store.has(canvasTokenKey("s@e.edu"))).toBe(false);
  });

  it("is idempotent when nothing was connected", async () => {
    const c = await cookie("s@e.edu");
    const res = await handleCanvasDisconnect(req("https://example.com/api/canvas/disconnect", c, "POST"), env());
    expect(res.status).toBe(200);
  });
});

describe("handleCanvasStatus", () => {
  it("401s with no session", async () => {
    const res = await handleCanvasStatus(req("https://example.com/api/canvas/status", null), env());
    expect(res.status).toBe(401);
  });

  it("reports not connected when nothing is stored", async () => {
    const c = await cookie("s@e.edu");
    const res = await handleCanvasStatus(req("https://example.com/api/canvas/status", c), env());
    expect(await res.json()).toEqual({ connected: false, domain: null });
  });

  it("reports connected with the domain, never the token", async () => {
    const c = await cookie("s@e.edu");
    const e = env();
    await putCanvasToken(e, "s@e.edu", { domain: "school.instructure.com", apiToken: "secret-tok", connectedAt: "x" });
    const res = await handleCanvasStatus(req("https://example.com/api/canvas/status", c), e);
    const data = await res.json();
    expect(data).toEqual({ connected: true, domain: "school.instructure.com" });
    expect(JSON.stringify(data)).not.toContain("secret-tok");
  });
});
