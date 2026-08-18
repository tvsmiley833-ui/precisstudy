import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleAdminListGuideRequests, handleAdminGetGuideRequestFile, handleAdminDeleteGuideRequest } from "../src/admin-routes.js";

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
  return `10.0.0.${ipCounter}`;
}

describe("/api/request-guide", () => {
  it("rejects GET", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide");
    expect(res.status).toBe(405);
  });

  it("rejects a missing class name", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ className: "" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email when one is provided", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ className: "AP Biology", email: "not-an-email" })
    });
    expect(res.status).toBe(400);
  });

  it("accepts a valid request with no email", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ className: "AP Biology", notes: "Regents-style please" })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("accepts a valid request with an email", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ className: "AP Biology", email: "student@example.com" })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: "not json"
    });
    expect(res.status).toBe(400);
  });

  it("rate-limits repeated submissions from the same IP", async () => {
    const ip = nextIp();
    const post = () => SELF.fetch("https://example.com/api/request-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify({ className: "AP Biology" })
    });
    for (let i = 0; i < 5; i++) {
      const res = await post();
      expect(res.status).toBe(200);
    }
    const sixth = await post();
    expect(sixth.status).toBe(429);
  });
});

function fakeFile(name, type, bytes) {
  return new File([bytes], name, { type });
}

describe("/api/request-guide with file attachments", () => {
  it("accepts a request with no files via multipart form", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    form.append("notes", "");
    form.append("email", "");
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects a missing class name via multipart form", async () => {
    const form = new FormData();
    form.append("className", "");
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(400);
  });

  it("accepts a request with one small attached file", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    form.append("files", fakeFile("notes.txt", "text/plain", new Uint8Array(100)));
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects more than 3 files", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    for (let i = 0; i < 4; i++) {
      form.append("files", fakeFile(`f${i}.txt`, "text/plain", new Uint8Array(10)));
    }
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at most 3 files/);
  });

  it("rejects a file over the per-file size limit", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    form.append("files", fakeFile("huge.txt", "text/plain", new Uint8Array(7 * 1024 * 1024)));
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/too large/);
  });

  it("rejects an unsupported file type", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    form.append("files", fakeFile("virus.exe", "application/x-msdownload", new Uint8Array(10)));
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/unsupported file type/);
  });

  it("rejects a file whose content doesn't match its declared type", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    // claims image/png but the bytes aren't a PNG signature
    form.append("files", fakeFile("fake.png", "image/png", new TextEncoder().encode("<script>alert(1)</script>")));
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/doesn't match its declared type/);
  });

  it("accepts a file whose content matches its declared type", async () => {
    const form = new FormData();
    form.append("className", "AP Biology");
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
    form.append("files", fakeFile("real.png", "image/png", pngSignature));
    const res = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("stores the file so an admin can list and download it, and deleting the request removes it", async () => {
    const form = new FormData();
    form.append("className", "AP Biology Attachment Test");
    form.append("files", fakeFile("syllabus.txt", "text/plain", new TextEncoder().encode("hello world")));
    const submitRes = await SELF.fetch("https://example.com/api/request-guide", { method: "POST", body: form, headers: { "CF-Connecting-IP": nextIp() } });
    expect(submitRes.status).toBe(200);

    const aEnv = await adminEnv();
    const listRes = await handleAdminListGuideRequests(await adminCookieReq("https://example.com/api/admin/guide-requests"), aEnv);
    expect(listRes.status).toBe(200);
    const { requests } = await listRes.json();
    const created = requests.find(r => r.className === "AP Biology Attachment Test" && r.files && r.files.length);
    expect(created).toBeTruthy();
    expect(created.files[0].name).toBe("syllabus.txt");

    const fileRes = await handleAdminGetGuideRequestFile(
      await adminCookieReq(`https://example.com/api/admin/guide-request-file?key=${encodeURIComponent(created.files[0].key)}`),
      aEnv
    );
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe("hello world");
    expect(fileRes.headers.get("Content-Disposition")).toContain("syllabus.txt");

    const delRes = await handleAdminDeleteGuideRequest(
      await adminCookieReq(`https://example.com/api/admin/guide-requests?key=${encodeURIComponent(created.key)}`, "DELETE"),
      aEnv
    );
    expect(delRes.status).toBe(200);

    const fileResAfterDelete = await handleAdminGetGuideRequestFile(
      await adminCookieReq(`https://example.com/api/admin/guide-request-file?key=${encodeURIComponent(created.files[0].key)}`),
      aEnv
    );
    expect(fileResAfterDelete.status).toBe(404);
  });
});

describe("/api/admin/guide-request-file routing", () => {
  it("401s with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/guide-request-file?key=reqfile:1:0");
    expect(res.status).toBe(401);
  });

  it("rejects a key that doesn't look like a file key", async () => {
    const aEnv = await adminEnv();
    const res = await handleAdminGetGuideRequestFile(
      await adminCookieReq("https://example.com/api/admin/guide-request-file?key=req:1:aaa"),
      aEnv
    );
    expect(res.status).toBe(400);
  });

  it("returns 405 for POST, via the real worker", async () => {
    const res = await SELF.fetch("https://example.com/api/admin/guide-request-file", { method: "POST" });
    expect(res.status).toBe(405);
  });
});
