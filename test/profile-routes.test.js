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
