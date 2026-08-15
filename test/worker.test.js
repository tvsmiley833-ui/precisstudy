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
    expect(text).toContain("The Original");
    expect(text).toContain("Chemistry");
    expect(text).toContain("Algebra I");
    expect(text).toContain("Algebra II");
    expect(text).toContain("AP English Lang");
    expect(text).toContain("Global History");
  });
});

describe("geometry migration", () => {
  it("serves the migrated Geometry guide at /geometry", async () => {
    const res = await SELF.fetch("https://example.com/geometry");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Geometry Study Guide");
    expect(text).toContain("HARD_Q");
  });
});

describe("/api/progress routing", () => {
  it("returns 401 for GET with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/progress");
    expect(res.status).toBe(401);
  });

  it("returns 405 for DELETE", async () => {
    const res = await SELF.fetch("https://example.com/api/progress", { method: "DELETE" });
    expect(res.status).toBe(405);
  });
});
