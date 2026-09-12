import { describe, it, expect } from "vitest";
import {
  SITE_ORIGIN, makeState, checkState, stateCookie,
  safeNext, nextCookie, consumeNext
} from "../src/auth-state.js";

const env = { SESSION_SECRET: "test-secret" };

describe("auth-state: OAuth state", () => {
  it("makeState + matching cookie passes checkState", async () => {
    const state = await makeState(env);
    const req = new Request("https://precisstudy.com/x", {
      headers: { Cookie: `ss_oauth_state=${state}` }
    });
    expect(await checkState(env, req, state)).toBe(true);
  });

  it("checkState fails when the cookie is absent", async () => {
    const state = await makeState(env);
    const req = new Request("https://precisstudy.com/x");
    expect(await checkState(env, req, state)).toBe(false);
  });

  it("checkState fails when the cookie does not match the param", async () => {
    const state = await makeState(env);
    const req = new Request("https://precisstudy.com/x", {
      headers: { Cookie: "ss_oauth_state=other" }
    });
    expect(await checkState(env, req, state)).toBe(false);
  });

  it("stateCookie is HttpOnly + Secure + SameSite=Lax", () => {
    const c = stateCookie("abc");
    expect(c).toContain("ss_oauth_state=abc");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
  });
});

describe("auth-state: next path", () => {
  it("safeNext accepts a same-origin absolute path", () => {
    expect(safeNext("/settings")).toBe("/settings");
  });

  it("safeNext rejects open-redirect shapes", () => {
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "notapath", null]) {
      expect(safeNext(bad)).toBeNull();
    }
  });

  it("consumeNext round-trips through nextCookie's encoding", () => {
    const c = nextCookie("/calculus/");
    const value = c.split(";")[0].split("=")[1];
    const req = new Request("https://precisstudy.com/x", {
      headers: { Cookie: `ss_next=${value}` }
    });
    expect(consumeNext(req)).toBe("/calculus/");
  });

  it("SITE_ORIGIN is the canonical host", () => {
    expect(SITE_ORIGIN).toBe("https://precisstudy.com");
  });
});
