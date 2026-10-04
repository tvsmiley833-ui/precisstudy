import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleProfile } from "../src/profile-routes.js";

const SECRET = "test-session-secret";
function fakeKV() { const m = new Map(); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); }, _m: m }; }
async function cookie(email) { const now = Math.floor(Date.now() / 1000); return `${SESSION_COOKIE}=${await signSession({ email, name: "Orig", provider: "google", iat: now, exp: now + 3600 }, SECRET)}`; }
const req = (c, method, body) => new Request("https://x.test/api/profile", { method, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: body ? JSON.stringify(body) : undefined });
const env = () => ({ SESSION_SECRET: SECRET, PROGRESS: fakeKV() });

describe("handleProfile", () => {
  it("401s without a session", async () => { expect((await handleProfile(req(null, "GET"), env())).status).toBe(401); });
  it("returns defaults", async () => {
    const r = await handleProfile(req(await cookie("a@b.co"), "GET"), env());
    expect(await r.json()).toMatchObject({ email: "a@b.co", displayName: null, timezone: null });
  });
  it("saves a display name and re-issues the session cookie", async () => {
    const e = env(); const c = await cookie("a@b.co");
    const r = await handleProfile(req(c, "POST", { displayName: "  Sam <b>  " }), e);
    expect(r.status).toBe(200);
    expect((await r.json()).displayName).toBe("Sam b");
    expect(r.headers.get("Set-Cookie")).toContain(SESSION_COOKIE + "=");
    const g = await handleProfile(req(c, "GET"), e);
    expect((await g.json()).displayName).toBe("Sam b");
  });
  it("rejects long names and bad timezones", async () => {
    const c = await cookie("a@b.co");
    expect((await handleProfile(req(c, "POST", { displayName: "x".repeat(41) }), env())).status).toBe(400);
    expect((await handleProfile(req(c, "POST", { timezone: "Mars/Base" }), env())).status).toBe(400);
  });
  it("accepts a valid timezone and clears with an empty string", async () => {
    const e = env(); const c = await cookie("a@b.co");
    expect((await (await handleProfile(req(c, "POST", { timezone: "America/New_York" }), e)).json()).timezone).toBe("America/New_York");
    expect((await (await handleProfile(req(c, "POST", { timezone: "" }), e)).json()).timezone).toBe(null);
  });
});

import { handleSessions, handleAvatar } from "../src/profile-routes.js";
import { issueSessionCookie, getSession, revokeSession, describeDevice } from "../src/auth.js";
import { syncCanvasCached, canvasCacheKey } from "../src/canvas-sync.js";
import { putCanvasToken } from "../src/canvas-token.js";

const ck = c => c.split(";")[0];

describe("device sessions", () => {
  it("records a sid at sign-in, lists it as current, and revokes another device", async () => {
    const e = env();
    const ua = n => new Request("https://x.test/", { headers: { "User-Agent": n } });
    const a = ck(await issueSessionCookie(e, { email: "a@b.co", name: "A", provider: "google" }, ua("Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120 Safari/537")));
    const b = ck(await issueSessionCookie(e, { email: "a@b.co", name: "A", provider: "google" }, ua("Mozilla/5.0 (iPhone) Safari/604")));
    const list = await (await handleSessions(req(a, "GET"), e)).json();
    expect(list.sessions).toHaveLength(2);
    expect(list.sessions.filter(s => s.current)).toHaveLength(1);
    expect(list.sessions.map(s => s.device).sort()).toEqual(["Chrome on Mac", "Safari on iPhone/iPad"]);
    const other = list.sessions.find(s => !s.current);
    expect((await handleSessions(req(a, "POST", { id: other.id }), e)).status).toBe(200);
    expect(await getSession(req(b, "GET"), e)).toBeNull();
    expect(await getSession(req(a, "GET"), e)).not.toBeNull();
  });
  it("refuses to revoke the current session", async () => {
    const e = env();
    const a = ck(await issueSessionCookie(e, { email: "a@b.co", name: "A", provider: "google" }, new Request("https://x.test/")));
    const { sessions } = await (await handleSessions(req(a, "GET"), e)).json();
    expect((await handleSessions(req(a, "POST", { id: sessions[0].id }), e)).status).toBe(400);
  });
  it("describes devices coarsely", () => { expect(describeDevice(null)).toBe("Browser on a device"); });
});

describe("avatar", () => {
  it("stores a JPEG, flags the session, and deletes", async () => {
    const e = env(); const c = await cookie("a@b.co");
    const jpeg = new Uint8Array(500); jpeg.set([0xff, 0xd8, 0xff]);
    const put = await handleAvatar(new Request("https://x.test/api/avatar", { method: "PUT", headers: { Cookie: c }, body: jpeg }), e);
    expect(put.status).toBe(200);
    expect(put.headers.get("Set-Cookie")).toContain(SESSION_COOKIE);
    const got = await handleAvatar(req(c, "GET"), e);
    expect(got.headers.get("Content-Type")).toBe("image/jpeg");
    const del = await handleAvatar(new Request("https://x.test/api/avatar", { method: "DELETE", headers: { Cookie: c } }), e);
    expect((await del.json()).hasAvatar).toBe(false);
    expect((await handleAvatar(req(c, "GET"), e)).status).toBe(404);
  });
  it("rejects non-JPEG and oversized bodies", async () => {
    const e = env(); const c = await cookie("a@b.co");
    const bad = new Uint8Array(500); bad.set([0x89, 0x50]);
    expect((await handleAvatar(new Request("https://x.test/api/avatar", { method: "PUT", headers: { Cookie: c }, body: bad }), e)).status).toBe(400);
    expect((await handleAvatar(new Request("https://x.test/api/avatar", { method: "PUT", headers: { Cookie: c }, body: new Uint8Array(70000) }), e)).status).toBe(400);
  });
});

describe("profile preferences and Canvas frequency", () => {
  it("validates timeFormat, studyMinutes and canvasSync", async () => {
    const e = env(); const c = await cookie("a@b.co");
    expect((await handleProfile(req(c, "POST", { timeFormat: "24h", studyMinutes: 45, canvasSync: "daily" }), e)).status).toBe(200);
    expect((await handleProfile(req(c, "POST", { timeFormat: "25h" }), e)).status).toBe(400);
    expect((await handleProfile(req(c, "POST", { studyMinutes: 5 }), e)).status).toBe(400);
    expect((await handleProfile(req(c, "POST", { canvasSync: "weekly" }), e)).status).toBe(400);
    const g = await (await handleProfile(req(c, "GET"), e)).json();
    expect(g).toMatchObject({ timeFormat: "24h", studyMinutes: 45, canvasSync: "daily" });
  });
  it("manual mode serves the cache and Sync now goes live", async () => {
    const e = env();
    await putCanvasToken(e, "a@b.co", { domain: "school.instructure.com", apiToken: "tok", connectedAt: "x" });
    await e.PROGRESS.put("progress:a@b.co", JSON.stringify({ profile: { canvasSync: "manual" } }));
    await e.PROGRESS.put(canvasCacheKey("a@b.co"), JSON.stringify({ items: [{ id: "canvas-1" }], fetchedAt: "2020-01-01T00:00:00.000Z" }));
    const hit = await syncCanvasCached(e, "a@b.co");
    expect(hit.items).toHaveLength(1);
  });
});
