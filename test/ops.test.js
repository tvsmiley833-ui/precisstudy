import { describe, it, expect, vi, afterEach } from "vitest";
import { handleHealth, handleConfig, missingSecrets, verifyTurnstile, runRetention, runBackup, keyTimestamp } from "../src/ops.js";

afterEach(() => vi.restoreAllMocks());

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async getWithMetadata(k) { return { value: store.has(k) ? new TextEncoder().encode(store.get(k)).buffer : null, metadata: null }; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    async list({ prefix = "", cursor, limit = 1000 } = {}) {
      const all = [...store.keys()].filter(k => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + limit);
      const end = start + limit;
      return { keys: page.map(name => ({ name })), list_complete: end >= all.length, cursor: String(end) };
    },
    _store: store,
  };
}
function fakeR2() {
  const objs = new Map();
  return {
    async put(k, v) { objs.set(k, v); },
    async delete(keys) { for (const k of [].concat(keys)) objs.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...objs.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })), truncated: false }; },
    _objs: objs,
  };
}

describe("health and config", () => {
  it("is healthy when KV answers and counts, but never names, missing secrets", async () => {
    const res = await handleHealth({ PROGRESS: fakeKV(), SESSION_SECRET: "x" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.missingSecrets).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("VAPID");
  });
  it("is 503 when KV throws", async () => {
    const res = await handleHealth({ PROGRESS: { get: async () => { throw new Error("down"); } } });
    expect(res.status).toBe(503);
  });
  it("lists which secrets are missing and serves the public Turnstile key", async () => {
    expect(missingSecrets({ SESSION_SECRET: "x" })).toContain("VAPID_PRIVATE_KEY");
    expect(await handleConfig({ TURNSTILE_SITE_KEY: "0xABC" }).json()).toEqual({ turnstileSiteKey: "0xABC" });
    expect(await handleConfig({}).json()).toEqual({ turnstileSiteKey: null });
  });
});

describe("Turnstile", () => {
  it("is off without a secret, and fails closed with one", async () => {
    expect(await verifyTurnstile({}, undefined, null)).toBe(true);
    expect(await verifyTurnstile({ TURNSTILE_SECRET: "s" }, "", null)).toBe(false);
  });
  it("accepts only what Cloudflare confirms", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile({ TURNSTILE_SECRET: "s" }, "tok", "1.2.3.4")).toBe(true);
    spy.mockResolvedValue(new Response(JSON.stringify({ success: false })));
    expect(await verifyTurnstile({ TURNSTILE_SECRET: "s" }, "tok", null)).toBe(false);
    spy.mockRejectedValue(new Error("network"));
    expect(await verifyTurnstile({ TURNSTILE_SECRET: "s" }, "tok", null)).toBe(false);
  });
});

describe("retention", () => {
  const NOW = Date.UTC(2026, 9, 4);
  const old = NOW - 400 * 86400000, fresh = NOW - 10 * 86400000;
  it("does nothing unless RETENTION_DAYS is set", async () => {
    const FEEDBACK = fakeKV({ [`fb:${old}:a`]: "{}" });
    expect((await runRetention({ FEEDBACK }, NOW)).deleted).toBe(0);
    expect(FEEDBACK._store.size).toBe(1);
  });
  it("deletes old feedback and requests (with their files) and keeps recent ones", async () => {
    const FEEDBACK = fakeKV({ [`fb:${old}:a`]: "{}", [`fb:${fresh}:b`]: "{}" });
    const GUIDE_REQUESTS = fakeKV({ [`req:${old}:x`]: "{}", [`reqfile:${old}:x:0`]: "bin", [`req:${fresh}:y`]: "{}", [`reqfile:${fresh}:y:0`]: "bin" });
    const r = await runRetention({ FEEDBACK, GUIDE_REQUESTS, RETENTION_DAYS: "365" }, NOW);
    expect(r.deleted).toBe(3);
    expect([...FEEDBACK._store.keys()]).toEqual([`fb:${fresh}:b`]);
    expect([...GUIDE_REQUESTS._store.keys()].sort()).toEqual([`req:${fresh}:y`, `reqfile:${fresh}:y:0`].sort());
  });
  it("reads timestamps only from well-formed keys", () => {
    expect(keyTimestamp("fb:1700000000000:abc", "fb:")).toBe(1700000000000);
    expect(keyTimestamp("fb:notanumber:abc", "fb:")).toBeNull();
  });
});

describe("backups", () => {
  it("does nothing without the R2 binding", async () => {
    expect(await runBackup({ PROGRESS: fakeKV() }, { start: true })).toEqual({ written: 0, done: true });
  });
  it("dumps every namespace to NDJSON over several calls, skipping throwaway counters, and prunes old days", async () => {
    const PROGRESS = fakeKV({ "progress:a@x.com": '{"streak":1}', "chatday:1.2.3.4:2026-10-04": "5", "login:a@x.com": "{}" });
    const FEEDBACK = fakeKV({ "fb:1:a": '{"message":"hi"}' });
    const GUIDE_REQUESTS = fakeKV({ "req:1:a": "{}" });
    const BACKUPS = fakeR2();
    await BACKUPS.put("backups/2026-08-01/progress-00000.ndjson", "old");
    const env = { PROGRESS, FEEDBACK, GUIDE_REQUESTS, BACKUPS };
    let done = false, calls = 0;
    while (!done && calls++ < 10) done = (await runBackup(env, { start: calls === 1, today: "2026-10-04", batch: 2 })).done;
    expect(done).toBe(true);
    const keys = [...BACKUPS._objs.keys()];
    expect(keys.some(k => k.startsWith("backups/2026-10-04/progress-"))).toBe(true);
    expect(keys.some(k => k.startsWith("backups/2026-10-04/feedback-"))).toBe(true);
    expect(keys).not.toContain("backups/2026-08-01/progress-00000.ndjson"); // older than 30 days
    const text = keys.filter(k => k.includes("2026-10-04")).map(k => BACKUPS._objs.get(k)).join("");
    expect(text).toContain("progress:a@x.com");
    expect(text).toContain("login:a@x.com");
    expect(text).not.toContain("chatday:");
  });
  it("the frequent run never starts a dump on its own", async () => {
    const BACKUPS = fakeR2();
    expect(await runBackup({ PROGRESS: fakeKV(), BACKUPS }, { start: false, today: "2026-10-04" })).toEqual({ written: 0, done: true });
    expect(BACKUPS._objs.size).toBe(0);
  });
});
