import { describe, it, expect } from "vitest";
import { handleDevLogin, devLoginAllowed } from "../src/dev-login.js";

const kv = () => { const m = new Map(); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; };
const env = (flag) => ({ SESSION_SECRET: "s", PROGRESS: kv(), DEV_LOGIN: flag });
const call = (u, e) => handleDevLogin(new Request(u), e, new URL(u));

describe("dev login", () => {
  it("is refused on the real site even if the flag were set", async () => {
    expect((await call("https://precisstudy.com/auth/dev-login", env("1"))).status).toBe(404);
    expect(devLoginAllowed({ DEV_LOGIN: "1" }, new URL("https://localhost.evil.example/"))).toBe(false);
  });
  it("is refused on localhost without the flag", async () => {
    expect((await call("http://localhost:8787/auth/dev-login", env(undefined))).status).toBe(404);
  });
  it("signs in on localhost with the flag and only redirects to same-site paths", async () => {
    const r = await call("http://localhost:8787/auth/dev-login?next=//evil.example", env("1"));
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("/dashboard/");
    expect(r.headers.get("Set-Cookie")).toContain("HttpOnly");
  });
});
