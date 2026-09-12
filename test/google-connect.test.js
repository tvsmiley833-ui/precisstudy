import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGoogleConnectStart, handleGoogleConnectCallback, CONNECT_SCOPES } from "../src/google-connect.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

async function sessionCookie(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

const baseEnv = () => ({
  SESSION_SECRET: SECRET,
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  PROGRESS: fakeKV()
});

describe("handleGoogleConnectStart", () => {
  it("redirects an un-signed-in user to /settings?google=error, sets no state cookie", async () => {
    const res = await handleGoogleConnectStart(new Request("https://precisstudy.com/auth/google/connect/start"), baseEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("503s when GOOGLE_CLIENT_SECRET is unset", async () => {
    const env = baseEnv();
    delete env.GOOGLE_CLIENT_SECRET;
    const req = new Request("https://precisstudy.com/auth/google/connect/start", {
      headers: { Cookie: await sessionCookie("s@e.edu") }
    });
    const res = await handleGoogleConnectStart(req, env);
    expect(res.status).toBe(503);
  });

  it("builds the consent URL with offline access, forced consent, all scopes, and the connect callback", async () => {
    const req = new Request("https://precisstudy.com/auth/google/connect/start?next=%2Fsettings", {
      headers: { Cookie: await sessionCookie("s@e.edu") }
    });
    const res = await handleGoogleConnectStart(req, baseEnv());
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location"));
    expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc.searchParams.get("access_type")).toBe("offline");
    expect(loc.searchParams.get("prompt")).toBe("consent");
    expect(loc.searchParams.get("include_granted_scopes")).toBe("true");
    expect(loc.searchParams.get("response_type")).toBe("code");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://precisstudy.com/auth/google/connect/callback");
    expect(loc.searchParams.get("scope")).toBe(CONNECT_SCOPES.join(" "));
    const state = loc.searchParams.get("state");
    const setCookie = res.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain(`ss_oauth_state=${state}`);
    expect(setCookie).toContain("ss_next=%2Fsettings");
  });
});

describe("handleGoogleConnectCallback", () => {
  it("redirects to /settings?google=error on a bad state", async () => {
    const req = new Request("https://precisstudy.com/auth/google/connect/callback?code=x&state=nope", {
      headers: { Cookie: await sessionCookie("s@e.edu") }
    });
    const res = await handleGoogleConnectCallback(req, baseEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
  });

  it("redirects an un-signed-in user to /settings?google=error", async () => {
    const req = new Request("https://precisstudy.com/auth/google/connect/callback?code=x&state=y");
    const res = await handleGoogleConnectCallback(req, baseEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
  });

  it("stores an encrypted token and redirects ?google=connected when Google returns a refresh_token", async () => {
    const env = baseEnv();
    const email = "s@e.edu";
    const startRes = await handleGoogleConnectStart(
      new Request("https://precisstudy.com/auth/google/connect/start", { headers: { Cookie: await sessionCookie(email) } }),
      env
    );
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "at", refresh_token: "1//rt", scope: "openid email", expires_in: 3599 }), { headers: { "Content-Type": "application/json" } });
      }
      if (u.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
        return new Response(JSON.stringify({ email: "gmail-of@student.edu" }), { headers: { "Content-Type": "application/json" } });
      }
      throw new Error("unexpected fetch " + u);
    };
    try {
      const res = await handleGoogleConnectCallback(
        new Request(`https://precisstudy.com/auth/google/connect/callback?code=abc&state=${encodeURIComponent(state)}`, {
          headers: { Cookie: `${await sessionCookie(email)}; ss_oauth_state=${state}` }
        }),
        env
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=connected");
      expect(env.PROGRESS._store.has("gtok:" + email)).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("redirects ?google=norefresh when Google withholds the refresh_token", async () => {
    const env = baseEnv();
    const email = "s@e.edu";
    const startRes = await handleGoogleConnectStart(
      new Request("https://precisstudy.com/auth/google/connect/start", { headers: { Cookie: await sessionCookie(email) } }),
      env
    );
    const state = new URL(startRes.headers.get("Location")).searchParams.get("state");

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "at", scope: "openid email", expires_in: 3599 }), { headers: { "Content-Type": "application/json" } });
      }
      throw new Error("unexpected fetch " + url);
    };
    try {
      const res = await handleGoogleConnectCallback(
        new Request(`https://precisstudy.com/auth/google/connect/callback?code=abc&state=${encodeURIComponent(state)}`, {
          headers: { Cookie: `${await sessionCookie(email)}; ss_oauth_state=${state}` }
        }),
        env
      );
      expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=norefresh");
      expect(env.PROGRESS._store.has("gtok:" + email)).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
