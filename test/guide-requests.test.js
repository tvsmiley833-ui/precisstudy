import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("/api/request-guide", () => {
  it("rejects GET", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide");
    expect(res.status).toBe(405);
  });

  it("rejects a missing class name", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className: "" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email when one is provided", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className: "AP Biology", email: "not-an-email" })
    });
    expect(res.status).toBe(400);
  });

  it("accepts a valid request with no email", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className: "AP Biology", notes: "Regents-style please" })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("accepts a valid request with an email", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className: "AP Biology", email: "student@example.com" })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json"
    });
    expect(res.status).toBe(400);
  });
});
