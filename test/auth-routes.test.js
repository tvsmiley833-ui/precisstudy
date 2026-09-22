import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { handleGoogleStart, handleGoogleCallback, handleGithubStart, handleGithubCallback, handleVerify, handleVerifyConfirm, handleDeleteAccount, handleSignOutEverywhere } from "../src/auth-routes.js";
import { createMagicLinkToken, issueSessionCookie, getSessionVersion } from "../src/auth.js";

describe("/auth/me", () => {
  it("reports guest when there is no session cookie", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ loggedIn: false });
  });

  it("ignores a garbage cookie instead of erroring", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/me", {
      headers: { Cookie: "ss_session=not.a.valid.token" }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loggedIn).toBe(false);
  });
});

describe("/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("rejects GET", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/logout");
    expect(res.status).toBe(405);
  });
});

describe("/auth/delete-account", () => {
  function kvStub() {
    const m = new Map();
    return {
      _m: m,
      get: (k) => Promise.resolve(m.has(k) ? m.get(k) : null),
      put: (k, v) => { m.set(k, v); return Promise.resolve(); },
      delete: (k) => { m.delete(k); return Promise.resolve(); },
      list: () => Promise.resolve({ keys: [], list_complete: true })
    };
  }

  async function signedInEnv(email) {
    const env = { SESSION_SECRET: "s", PROGRESS: kvStub() };
    env.PROGRESS._m.set("progress:" + email, JSON.stringify({ updatedAt: null, streak: { current: 3, longest: 3 } }));
    env.PROGRESS._m.set("login:" + email, JSON.stringify({ provider: "email", firstSeen: "x", lastSeen: "x" }));
    const cookie = await issueSessionCookie(env, { email, name: email, provider: "email" });
    return { env, cookie };
  }

  it("requires a session", async () => {
    const res = await handleDeleteAccount(new Request("https://precisstudy.com/auth/delete-account", { method: "POST" }), { SESSION_SECRET: "s", PROGRESS: kvStub() });
    expect(res.status).toBe(401);
  });

  it("deletes the progress and login KV records, invalidates the session, and clears the cookie", async () => {
    const email = "learner@example.com";
    const { env, cookie } = await signedInEnv(email);
    const res = await handleDeleteAccount(new Request("https://precisstudy.com/auth/delete-account", {
      method: "POST",
      headers: { Cookie: cookie.split(";")[0] }
    }), env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(env.PROGRESS._m.has("progress:" + email)).toBe(false);
    expect(env.PROGRESS._m.has("login:" + email)).toBe(false);
    expect(await getSessionVersion(env.PROGRESS, email)).toBe(1);
  });

  it("a session cookie issued before deletion no longer authenticates afterward", async () => {
    const email = "learner2@example.com";
    const { env, cookie } = await signedInEnv(email);
    await handleDeleteAccount(new Request("https://precisstudy.com/auth/delete-account", {
      method: "POST",
      headers: { Cookie: cookie.split(";")[0] }
    }), env);

    const res = await handleDeleteAccount(new Request("https://precisstudy.com/auth/delete-account", {
      method: "POST",
      headers: { Cookie: cookie.split(";")[0] }
    }), env);
    expect(res.status).toBe(401);
  });
});

describe("/auth/sign-out-everywhere", () => {
  function kvStub() {
    const m = new Map();
    return {
      _m: m,
      get: (k) => Promise.resolve(m.has(k) ? m.get(k) : null),
      put: (k, v) => { m.set(k, v); return Promise.resolve(); },
      delete: (k) => { m.delete(k); return Promise.resolve(); },
      list: () => Promise.resolve({ keys: [], list_complete: true })
    };
  }

  it("requires a session", async () => {
    const res = await handleSignOutEverywhere(new Request("https://precisstudy.com/auth/sign-out-everywhere", { method: "POST" }), { SESSION_SECRET: "s", PROGRESS: kvStub() });
    expect(res.status).toBe(401);
  });

  it("bumps the session version and clears the cookie, invalidating every outstanding token", async () => {
    const email = "learner@example.com";
    const env = { SESSION_SECRET: "s", PROGRESS: kvStub() };
    const cookie = await issueSessionCookie(env, { email, name: email, provider: "email" });

    const res = await handleSignOutEverywhere(new Request("https://precisstudy.com/auth/sign-out-everywhere", {
      method: "POST",
      headers: { Cookie: cookie.split(";")[0] }
    }), env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await getSessionVersion(env.PROGRESS, email)).toBe(1);

    const again = await handleSignOutEverywhere(new Request("https://precisstudy.com/auth/sign-out-everywhere", {
      method: "POST",
      headers: { Cookie: cookie.split(";")[0] }
    }), env);
    expect(again.status).toBe(401); // old cookie no longer authenticates
  });
});

describe("OAuth start routes before credentials are configured", () => {
  it("/auth/google/start responds 503 without GOOGLE_CLIENT_SECRET", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/google/start", { redirect: "manual" });
    expect(res.status).toBe(503);
  });

  it("/auth/github/start responds 503 without GITHUB_CLIENT_SECRET", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/github/start", { redirect: "manual" });
    expect(res.status).toBe(503);
  });

  it("rejects POST on start routes", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/google/start", { method: "POST" });
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
    const res = await SELF.fetch("https://precisstudy.com/auth/verify", { redirect: "manual" });
    expect(res.status).toBe(503);
  });

  it("responds 503, not 500, for an unknown token when sign-in isn't configured", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/verify?token=bogus", { redirect: "manual" });
    expect(res.status).toBe(503);
  });
});

describe("OAuth state CSRF protection", () => {
  const env = {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    SESSION_SECRET: "test-session-secret"
  };

  it("/auth/google/start on a non-canonical domain bounces to precisstudy.com before setting any cookie", async () => {
    // The Worker serves studystacks.org, precisstudy.com, and their www variants
    // on the same routes. The state cookie is host-only, so /start must run on
    // the canonical domain before it sets one -- otherwise a user who clicks
    // "Sign In" from studystacks.org would get a cookie the callback (which
    // always redirects to precisstudy.com) can never see, and fail with
    // auth_error=1 every time.
    const res = await handleGoogleStart(new Request("https://studystacks.org/auth/google/start"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/auth/google/start");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("/auth/github/start on a non-canonical domain bounces to precisstudy.com before setting any cookie", async () => {
    const res = await handleGithubStart(new Request("https://studystacks.org/auth/github/start"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/auth/github/start");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("/auth/google/start sets an ss_oauth_state cookie bound to the redirect's state param", async () => {
    const res = await handleGoogleStart(new Request("https://precisstudy.com/auth/google/start"), env);
    expect(res.status).toBe(302);
    const state = new URL(res.headers.get("Location")).searchParams.get("state");
    expect(res.headers.get("Set-Cookie")).toContain(`ss_oauth_state=${state}`);
  });

  it("/auth/google/callback rejects a validly-signed state with no matching cookie", async () => {
    // A validly-signed state alone isn't enough -- /start is public and unauthenticated,
    // so anyone can mint one. Without the cookie binding, an attacker could complete
    // their own OAuth flow and trick a victim into visiting the resulting callback URL,
    // logging the victim's browser into the attacker's account (login CSRF).
    const startRes = await handleGoogleStart(new Request("https://precisstudy.com/auth/google/start"), env);
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const res = await handleGoogleCallback(
      new Request(`https://precisstudy.com/auth/google/callback?code=fake&state=${encodeURIComponent(state)}`),
      env
    );
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("Location")).search).toContain("auth_error");
  });

  it("/auth/google/callback rejects when the state cookie doesn't match the query param", async () => {
    const res = await handleGoogleCallback(
      new Request("https://precisstudy.com/auth/google/callback?code=fake&state=mismatched", {
        headers: { Cookie: "ss_oauth_state=something-else" }
      }),
      env
    );
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("Location")).search).toContain("auth_error");
  });

  it("/auth/google/callback accepts a state that matches its cookie (proceeds past the CSRF check), and clears the state cookie even on a post-CSRF failure", async () => {
    const startRes = await handleGoogleStart(new Request("https://precisstudy.com/auth/google/start"), env);
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const res = await handleGoogleCallback(
      new Request(`https://precisstudy.com/auth/google/callback?code=fake&state=${encodeURIComponent(state)}`, {
        headers: { Cookie: `ss_oauth_state=${state}` }
      }),
      env
    );
    // Passes the CSRF check and proceeds to the (unmocked) token exchange, which fails
    // against a fake code -- confirming it got past state validation, not stuck on it.
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("Location")).search).toContain("auth_error");
    // Every auth_error exit routes through authErrorRedirect(), which always clears
    // ss_oauth_state -- not just the CSRF-check-failure branch. A stale valid state
    // cookie left behind after a token-exchange hiccup could be replayed within its
    // remaining TTL, which is exactly what binding state to a cookie is meant to stop.
    expect(res.headers.get("Set-Cookie")).toContain("ss_oauth_state=;");
  });

  it("/auth/github/start sets an ss_oauth_state cookie bound to the redirect's state param", async () => {
    const res = await handleGithubStart(new Request("https://precisstudy.com/auth/github/start"), env);
    expect(res.status).toBe(302);
    const state = new URL(res.headers.get("Location")).searchParams.get("state");
    expect(res.headers.get("Set-Cookie")).toContain(`ss_oauth_state=${state}`);
  });

  it("/auth/github/callback rejects a validly-signed state with no matching cookie", async () => {
    const startRes = await handleGithubStart(new Request("https://precisstudy.com/auth/github/start"), env);
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const res = await handleGithubCallback(
      new Request(`https://precisstudy.com/auth/github/callback?code=fake&state=${encodeURIComponent(state)}`),
      env
    );
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("Location")).search).toContain("auth_error");
  });
});

describe("/auth/verify — GET confirms, POST signs in (login-CSRF guard)", () => {
  function kvStub() {
    const m = new Map();
    return {
      _m: m,
      get: (k) => Promise.resolve(m.has(k) ? m.get(k) : null),
      put: (k, v) => { m.set(k, v); return Promise.resolve(); },
      delete: (k) => { m.delete(k); return Promise.resolve(); }
    };
  }
  const baseEnv = () => ({ SESSION_SECRET: "s", MAGIC_LINKS: kvStub() });

  it("GET renders a same-origin confirm form and does NOT create a session or consume the token", async () => {
    const env = baseEnv();
    const token = await createMagicLinkToken(env, "learner@example.com");
    const res = await handleVerify(new Request("https://precisstudy.com/auth/verify?token=" + encodeURIComponent(token)), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain("learner@example.com");
    expect(html).toContain('method=post action="/auth/verify"');
    expect(env.MAGIC_LINKS._m.has(token)).toBe(true); // still valid for the POST
  });

  it("POST consumes the token and issues the session cookie", async () => {
    const env = baseEnv();
    const token = await createMagicLinkToken(env, "learner@example.com");
    const res = await handleVerifyConfirm(new Request("https://precisstudy.com/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token })
    }), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Set-Cookie") || "").toContain("ss_session=");
    expect(env.MAGIC_LINKS._m.has(token)).toBe(false); // consumed
  });

  it("credits the inviting classmate when a new account signs in with an ss_ref cookie set", async () => {
    const progress = kvStub();
    await progress.put("progress:inviter@example.com", JSON.stringify({ inviteToken: "invitetoken1234567890" }));
    await progress.put("invite:invitetoken1234567890", "inviter@example.com");
    const env = { ...baseEnv(), PROGRESS: progress };

    const token = await createMagicLinkToken(env, "newstudent@example.com");
    const res = await handleVerifyConfirm(new Request("https://precisstudy.com/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "ss_ref=invitetoken1234567890" },
      body: new URLSearchParams({ token })
    }), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/onboarding");
    expect(res.headers.get("Set-Cookie") || "").toContain("ss_ref=;");

    const inviter = JSON.parse(await progress.get("progress:inviter@example.com"));
    expect(inviter.invitesAccepted).toBe(1);
  });

  it("does not credit a self-referral", async () => {
    const progress = kvStub();
    await progress.put("progress:newstudent@example.com", JSON.stringify({ inviteToken: "selftoken1234567890a" }));
    await progress.put("invite:selftoken1234567890a", "newstudent@example.com");
    const env = { ...baseEnv(), PROGRESS: progress };

    const token = await createMagicLinkToken(env, "newstudent@example.com");
    await handleVerifyConfirm(new Request("https://precisstudy.com/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "ss_ref=selftoken1234567890a" },
      body: new URLSearchParams({ token })
    }), env);

    const self = JSON.parse(await progress.get("progress:newstudent@example.com"));
    expect(self.invitesAccepted || 0).toBe(0);
  });

  it("bogus token -> auth_error=expired on both GET and POST, no session", async () => {
    const env = baseEnv();
    const g = await handleVerify(new Request("https://precisstudy.com/auth/verify?token=nope"), env);
    expect(g.headers.get("Location")).toBe("https://precisstudy.com/?auth_error=expired");
    const p = await handleVerifyConfirm(new Request("https://precisstudy.com/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: "nope" })
    }), env);
    expect(p.headers.get("Location")).toBe("https://precisstudy.com/?auth_error=expired");
    expect(p.headers.get("Set-Cookie") || "").not.toContain("ss_session=");
  });
});

describe("post-sign-in return path + error categories", () => {
  const env = {
    GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret",
    GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret",
    SESSION_SECRET: "s"
  };

  it("stores a same-origin ?next path in an ss_next cookie on /auth/google/start", async () => {
    const res = await handleGoogleStart(
      new Request("https://precisstudy.com/auth/google/start?next=%2Fcalculus%2F"), env);
    expect(res.headers.get("Set-Cookie") || "").toContain("ss_next=%2Fcalculus%2F");
  });

  it("ignores an off-site ?next (open-redirect guard)", async () => {
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "notapath"]) {
      const res = await handleGoogleStart(
        new Request("https://precisstudy.com/auth/google/start?next=" + encodeURIComponent(bad)), env);
      expect(res.headers.get("Set-Cookie") || "").not.toContain("ss_next=");
    }
  });

  it("emits a specific auth_error category and clears cookies on a bad OAuth state", async () => {
    const res = await handleGoogleCallback(
      new Request("https://precisstudy.com/auth/google/callback?code=x&state=nope"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/?auth_error=state");
    const sc = res.headers.get("Set-Cookie") || "";
    expect(sc).toContain("ss_oauth_state=;");
    expect(sc).toContain("ss_next=;");
  });
});

describe("/auth/email/start", () => {
  it("rejects an invalid email before attempting to send anything", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/email/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects a missing body gracefully", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/email/start", { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("rejects GET", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/email/start");
    expect(res.status).toBe(405);
  });
});
