import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("/auth/me", () => {
  it("reports guest when there is no session cookie", async () => {
    const res = await SELF.fetch("https://example.com/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ loggedIn: false });
  });

  it("ignores a garbage cookie instead of erroring", async () => {
    const res = await SELF.fetch("https://example.com/auth/me", {
      headers: { Cookie: "ss_session=not.a.valid.token" }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loggedIn).toBe(false);
  });
});

describe("/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await SELF.fetch("https://example.com/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("rejects GET", async () => {
    const res = await SELF.fetch("https://example.com/auth/logout");
    expect(res.status).toBe(405);
  });
});

describe("OAuth start routes before credentials are configured", () => {
  it("/auth/google/start responds 503 without GOOGLE_CLIENT_SECRET", async () => {
    const res = await SELF.fetch("https://example.com/auth/google/start", { redirect: "manual" });
    expect(res.status).toBe(503);
  });

  it("/auth/github/start responds 503 without GITHUB_CLIENT_SECRET", async () => {
    const res = await SELF.fetch("https://example.com/auth/github/start", { redirect: "manual" });
    expect(res.status).toBe(503);
  });

  it("rejects POST on start routes", async () => {
    const res = await SELF.fetch("https://example.com/auth/google/start", { method: "POST" });
    expect(res.status).toBe(405);
  });
});

describe("/auth/verify", () => {
  // SESSION_SECRET isn't set in this test environment (matches real
  // pre-setup state), so every call here should fail gracefully with 503
  // rather than a 500 -- this is a direct regression test for a real bug
  // caught during manual testing: issueSessionCookie/signSession threw an
  // uncaught DataError when SESSION_SECRET was undefined, producing a 500
  // instead of the "not configured" response the OAuth routes already gave.
  it("responds 503, not 500, when the token is missing and sign-in isn't configured", async () => {
    const res = await SELF.fetch("https://example.com/auth/verify", { redirect: "manual" });
    expect(res.status).toBe(503);
  });

  it("responds 503, not 500, for an unknown token when sign-in isn't configured", async () => {
    const res = await SELF.fetch("https://example.com/auth/verify?token=bogus", { redirect: "manual" });
    expect(res.status).toBe(503);
  });
});

describe("/auth/email/start", () => {
  it("rejects an invalid email before attempting to send anything", async () => {
    const res = await SELF.fetch("https://example.com/auth/email/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects a missing body gracefully", async () => {
    const res = await SELF.fetch("https://example.com/auth/email/start", { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("rejects GET", async () => {
    const res = await SELF.fetch("https://example.com/auth/email/start");
    expect(res.status).toBe(405);
  });
});
