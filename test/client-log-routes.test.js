import { describe, it, expect, vi } from "vitest";
import { handleClientLogPost } from "../src/client-log-routes.js";

function req(body, headers) {
  return new Request("https://example.com/api/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

describe("handleClientLogPost", () => {
  it("accepts a valid error payload", async () => {
    const res = await handleClientLogPost(req({ kind: "error", message: "boom", url: "https://example.com/x" }), {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("accepts a valid vitals payload", async () => {
    const res = await handleClientLogPost(req({
      kind: "vitals",
      url: "https://example.com/x",
      metrics: [{ name: "LCP", value: 1200 }, { name: "CLS", value: 0.02 }]
    }), {});
    expect(res.status).toBe(200);
  });

  it("rejects a missing message on an error payload", async () => {
    const res = await handleClientLogPost(req({ kind: "error", url: "https://example.com/x" }), {});
    expect(res.status).toBe(400);
  });

  it("rejects vitals with no valid metrics", async () => {
    const res = await handleClientLogPost(req({ kind: "vitals", url: "https://example.com/x", metrics: [{ name: "BOGUS", value: 1 }] }), {});
    expect(res.status).toBe(400);
  });

  it("rejects a malformed kind", async () => {
    const res = await handleClientLogPost(req({ kind: "nonsense", message: "hi" }), {});
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const res = await handleClientLogPost(req("not json"), {});
    expect(res.status).toBe(400);
  });

  it("rejects a body declared too large via Content-Length", async () => {
    const res = await handleClientLogPost(req({ kind: "error", message: "hi" }, { "Content-Length": "999999" }), {});
    expect(res.status).toBe(413);
  });

  it("rejects an actually-oversized body", async () => {
    const res = await handleClientLogPost(req({ kind: "error", message: "x".repeat(10000) }), {});
    expect(res.status).toBe(413);
  });

  it("caps the vitals array length instead of erroring", async () => {
    const metrics = Array.from({ length: 20 }, () => ({ name: "LCP", value: 100 }));
    const res = await handleClientLogPost(req({ kind: "vitals", url: "https://example.com/x", metrics }), {});
    expect(res.status).toBe(200);
  });

  it("truncates over-long string fields instead of erroring", async () => {
    const res = await handleClientLogPost(req({ kind: "error", message: "m".repeat(3000), url: "https://example.com/x" }), {});
    expect(res.status).toBe(200);
  });

  it("rate-limits using the CLIENT_LOG_RATE_LIMIT binding when present", async () => {
    const fakeEnv = { CLIENT_LOG_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: false }) } };
    const res = await handleClientLogPost(req({ kind: "error", message: "hi" }, { "CF-Connecting-IP": "10.5.5.5" }), fakeEnv);
    expect(res.status).toBe(429);
    expect(fakeEnv.CLIENT_LOG_RATE_LIMIT.limit).toHaveBeenCalledWith({ key: expect.stringMatching(/^client-log:/) });
  });

  it("allows the request through when the rate limit succeeds", async () => {
    const fakeEnv = { CLIENT_LOG_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) } };
    const res = await handleClientLogPost(req({ kind: "error", message: "hi" }), fakeEnv);
    expect(res.status).toBe(200);
  });
});
