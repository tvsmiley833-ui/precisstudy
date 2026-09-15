import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleAdminListFeedback, handleAdminDeleteFeedback, handleAdminUpdateFeedbackStatus } from "../src/admin-routes.js";

const ADMIN_SECRET = "test-admin-secret";
const ADMIN_EMAIL = "admin@example.com";

async function adminEnv() {
  return { ...env, SESSION_SECRET: ADMIN_SECRET, ADMIN_EMAILS: ADMIN_EMAIL };
}

async function adminCookieReq(url, method) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email: ADMIN_EMAIL, name: "Admin", provider: "google", iat: now, exp: now + 3600 }, ADMIN_SECRET);
  return new Request(url, { method: method || "GET", headers: { Cookie: `${SESSION_COOKIE}=${token}` } });
}

// Submissions are rate-limited per client IP -- give each test its own IP so
// they don't share a rate-limit bucket with unrelated tests in this file.
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.1.0.${ipCounter}`;
}

describe("/api/feedback", () => {
  it("rejects GET", async () => {
    const res = await SELF.fetch("https://example.com/api/feedback");
    expect(res.status).toBe(405);
  });

  it("rejects a missing message", async () => {
    const res = await SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ message: "" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email when one is provided", async () => {
    const res = await SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ message: "Love the flashcards", email: "not-an-email" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid category", async () => {
    const res = await SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ message: "Hello", category: "nonsense" })
    });
    expect(res.status).toBe(400);
  });

  it("accepts a valid submission with no email", async () => {
    const res = await SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ message: "The quiz timer is great", category: "praise" })
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: "not json"
    });
    expect(res.status).toBe(400);
  });

  it("rate-limits repeated submissions from the same IP", async () => {
    const ip = nextIp();
    const post = () => SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify({ message: "Repeat feedback" })
    });
    for (let i = 0; i < 8; i++) {
      const res = await post();
      expect(res.status).toBe(200);
    }
    const ninth = await post();
    expect(ninth.status).toBe(429);
  });

  it("stores the submission so an admin can list, update its status, and delete it", async () => {
    const submitRes = await SELF.fetch("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ message: "Unique feedback for lifecycle test", category: "bug", page: "/geometry/quiz" })
    });
    expect(submitRes.status).toBe(200);

    const aEnv = await adminEnv();
    const listRes = await handleAdminListFeedback(await adminCookieReq("https://example.com/api/admin/feedback"), aEnv);
    expect(listRes.status).toBe(200);
    const { feedback } = await listRes.json();
    const created = feedback.find(f => f.message === "Unique feedback for lifecycle test");
    expect(created).toBeTruthy();
    expect(created.status).toBe("new");
    expect(created.page).toBe("/geometry/quiz");

    const updateRes = await handleAdminUpdateFeedbackStatus(
      new Request("https://example.com/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: (await adminCookieReq("https://example.com")).headers.get("Cookie") },
        body: JSON.stringify({ key: created.key, status: "resolved" })
      }),
      aEnv
    );
    expect(updateRes.status).toBe(200);

    const delRes = await handleAdminDeleteFeedback(
      await adminCookieReq(`https://example.com/api/admin/feedback?key=${encodeURIComponent(created.key)}`, "DELETE"),
      aEnv
    );
    expect(delRes.status).toBe(200);

    const listAfterDelete = await handleAdminListFeedback(await adminCookieReq("https://example.com/api/admin/feedback"), aEnv);
    const { feedback: afterDelete } = await listAfterDelete.json();
    expect(afterDelete.find(f => f.key === created.key)).toBeFalsy();
  });
});

describe("/api/admin/feedback routing", () => {
  it("401s with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/feedback");
    expect(res.status).toBe(401);
  });

  it("rejects an update with an invalid status", async () => {
    const aEnv = await adminEnv();
    const res = await handleAdminUpdateFeedbackStatus(
      new Request("https://example.com/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: (await adminCookieReq("https://example.com")).headers.get("Cookie") },
        body: JSON.stringify({ key: "fb:1:aaa", status: "archived" })
      }),
      aEnv
    );
    expect(res.status).toBe(400);
  });

  it("returns 405 for unsupported methods, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/feedback", { method: "PUT" });
    expect(res.status).toBe(405);
  });
});
