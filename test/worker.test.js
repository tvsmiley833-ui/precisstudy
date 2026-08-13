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
