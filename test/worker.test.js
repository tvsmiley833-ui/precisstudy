import { SELF } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import { abuseGuard, continueDailyWork } from "../src/worker.ts";
import { allowedBy, withinDailyQuota, declaredTooLarge, bodyLimitFor, utcDay } from "../src/limits.ts";

describe("security headers", () => {
  it("sets baseline security headers on every response, API and asset alike", async () => {
    for (const url of ["https://precisstudy.com/", "https://precisstudy.com/api/chat"]) {
      const res = await SELF.fetch(url);
      expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains; preload");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    }
  });

  it("sets a restrictive Content-Security-Policy and Permissions-Policy on every response", async () => {
    for (const url of ["https://precisstudy.com/", "https://precisstudy.com/api/chat"]) {
      const res = await SELF.fetch(url);
      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(res.headers.get("Permissions-Policy")).toContain("geolocation=()");
    }
  });
});

describe("routing", () => {
  it("returns 405 for GET on /api/chat", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/chat");
    expect(res.status).toBe(405);
  });

  it("returns 204 with CORS headers for OPTIONS on /api/chat", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/chat", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("returns 400 for POST /api/chat with empty history", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: [] })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Empty message");
  });

  it("falls through to ASSETS for the root path", async () => {
    const res = await SELF.fetch("https://precisstudy.com/");
    expect(res.status).toBe(200);
  });
});

describe("per-view subject routing", () => {
  const subjects = ["geometry", "chemistry", "algebra1", "algebra2", "ap-lang", "global-history"];
  const views = ["flashcards", "quiz", "examples", "exam", "reference", "memory"];

  // <title>, meta description, and og:title/og:description are the only
  // parts allowed to differ per view (see rewriteViewMeta in worker.ts) --
  // strip just those before comparing so this still catches any other
  // unintended drift between a view URL and the base page.
  function stripRewrittenMeta(html) {
    return html
      .replace(/<title>[^<]*<\/title>/, "<title></title>")
      .replace(/<meta name="description" content="[^"]*"\s*\/>/, "")
      .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, "")
      .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, "");
  }

  for (const subject of subjects) {
    it(`serves the ${subject} bundle for every real view URL, identical to the base page apart from the rewritten meta tags`, async () => {
      const baseRes = await SELF.fetch(`https://precisstudy.com/${subject}/`);
      expect(baseRes.status).toBe(200);
      const baseBody = stripRewrittenMeta(await baseRes.text());

      for (const view of views) {
        const res = await SELF.fetch(`https://precisstudy.com/${subject}/${view}`);
        expect(res.status).toBe(200);
        const body = stripRewrittenMeta(await res.text());
        expect(body).toBe(baseBody);
      }
    });
  }

  it("does not intercept an unknown subject", async () => {
    const res = await SELF.fetch("https://precisstudy.com/nosuchsubject/quiz");
    expect(res.status).toBe(404); // production serves its 404 page here, never a subject bundle
    const body = await res.text();
    const geoBody = await (await SELF.fetch("https://precisstudy.com/geometry/")).text();
    expect(body).not.toBe(geoBody);
  });

  it("does not intercept an unknown view segment under a real subject (falls back to the SPA shell, not the subject bundle)", async () => {
    const res = await SELF.fetch("https://precisstudy.com/geometry/not-a-real-view");
    expect(res.status).toBe(404);
    const body = await res.text();
    const geoBody = await (await SELF.fetch("https://precisstudy.com/geometry/")).text();
    expect(body).not.toBe(geoBody);
  });
});

describe("homepage", () => {
  it("shows the PrecisStudy brand and the current class roster", async () => {
    const res = await SELF.fetch("https://precisstudy.com/");
    const text = await res.text();
    expect(text).toContain("PrecisStudy");
    expect(text).toContain("Geometry");
    expect(text).toContain("The Original");
    expect(text).toContain("Chemistry");
    expect(text).toContain("Algebra I");
    expect(text).toContain("Algebra II");
    expect(text).toContain("AP English Lang");
    expect(text).toContain("Global History");
  });
});

describe("geometry migration", () => {
  it("serves the migrated Geometry guide at /geometry", async () => {
    const res = await SELF.fetch("https://precisstudy.com/geometry");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Geometry Study Guide");
    expect(text).toContain("HARD_Q");
  });
});

describe("/api/progress routing", () => {
  it("returns 401 for GET with no session, via the real worker", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/progress");
    expect(res.status).toBe(401);
  });

  it("returns 405 for DELETE", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/progress", { method: "DELETE" });
    expect(res.status).toBe(405);
  });
});

describe("canonical host redirect", () => {
  it("301s a non-canonical host to precisstudy.com, preserving path and query", async () => {
    const res = await SELF.fetch("https://studystacks.org/calculus/?tab=quiz", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/calculus/?tab=quiz");
  });

  it("301s the www variant to the apex", async () => {
    const res = await SELF.fetch("https://www.precisstudy.com/ap-world/", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/ap-world/");
  });

  it("serves precisstudy.com directly without redirecting", async () => {
    const res = await SELF.fetch("https://precisstudy.com/geometry/", { redirect: "manual" });
    expect(res.status).toBe(200);
  });

  it("still serves the Google verification file on a non-canonical host", async () => {
    const res = await SELF.fetch("https://studystacks.org/google70342a91216260b3.html", { redirect: "manual" });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("google-site-verification");
  });

  it("does not redirect a non-idempotent method", async () => {
    const res = await SELF.fetch("https://studystacks.org/api/chat", { method: "OPTIONS" });
    expect(res.status).not.toBe(301);
  });

  it("normalises a bare subject path to trailing-slash in one hop", async () => {
    const res = await SELF.fetch("https://studystacks.org/calculus", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/calculus/");
  });
});

describe("/sitemap.xml", () => {
  it("is generated from the live subject routes, not a stale file", async () => {
    const res = await SELF.fetch("https://precisstudy.com/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("xml");
    const body = await res.text();
    expect(body).toContain("<loc>https://precisstudy.com/calculus/</loc>");
    expect(body).toContain("<loc>https://precisstudy.com/us-history/</loc>");
    expect(body).toContain("<loc>https://precisstudy.com/</loc>");
  });

  it("excludes the per-view sub-URLs (flashcards, quiz, etc.) -- they canonicalize back to the subject root, so listing them told Google to crawl duplicate-content pages", async () => {
    const res = await SELF.fetch("https://precisstudy.com/sitemap.xml");
    const body = await res.text();
    expect(body).not.toContain("<loc>https://precisstudy.com/geometry/flashcards</loc>");
    expect(body).not.toContain("<loc>https://precisstudy.com/geometry/quiz</loc>");
    expect(body).not.toContain("<loc>https://precisstudy.com/geometry/exam</loc>");
    // The routes themselves are unaffected -- still live, still real, still shareable.
    const sub = await SELF.fetch("https://precisstudy.com/geometry/flashcards");
    expect(sub.status).toBe(200);
    const canonical = /<link rel="canonical" href="([^"]*)"/.exec(await sub.text())[1];
    expect(canonical).toBe("https://precisstudy.com/geometry/");
  });
});

describe("subject sub-view <title>/description rewriting", () => {
  it("rewrites the flashcards view with a distinct title and description derived from the base page's real counts", async () => {
    const base = await SELF.fetch("https://precisstudy.com/geometry/");
    const baseHtml = await base.text();
    const baseTitle = /<title>([^<]*)<\/title>/.exec(baseHtml)[1];

    const res = await SELF.fetch("https://precisstudy.com/geometry/flashcards");
    expect(res.status).toBe(200);
    const html = await res.text();
    const title = /<title>([^<]*)<\/title>/.exec(html)[1];
    const description = /<meta name="description" content="([^"]*)"/.exec(html)[1];

    expect(title).not.toBe(baseTitle);
    expect(title).toBe("Geometry Flashcards — PrecisStudy");
    expect(description).toMatch(/^Study Geometry with \d+ free flashcards/);
  });

  it("rewrites the quiz view distinctly from the flashcards view for the same subject", async () => {
    const res = await SELF.fetch("https://precisstudy.com/geometry/quiz");
    const html = await res.text();
    const title = /<title>([^<]*)<\/title>/.exec(html)[1];
    expect(title).toBe("Geometry Practice Quiz — PrecisStudy");
  });

  it("leaves the base guide page's own title/description untouched", async () => {
    const res = await SELF.fetch("https://precisstudy.com/geometry/");
    const html = await res.text();
    expect(html).toContain("<title>Geometry Study Guide: Notes, Flashcards &amp; Quizzes | PrecisStudy</title>");
  });
});

describe("Google connect + assignments routing", () => {
  it("/api/assignments requires a session (401, not the SPA fallback)", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/assignments");
    expect(res.status).toBe(401);
  });

  it("/api/google/settings GET requires a session", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/google/settings");
    expect(res.status).toBe(401);
  });

  it("/api/google/disconnect rejects GET with 405", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/google/disconnect");
    expect(res.status).toBe(405);
  });

  it("/api/google/settings rejects DELETE with 405", async () => {
    const res = await SELF.fetch("https://precisstudy.com/api/google/settings", { method: "DELETE" });
    expect(res.status).toBe(405);
  });

  it("/auth/google/connect/start redirects to /settings?google=error with no session", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/google/connect/start", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://precisstudy.com/settings?google=error");
  });

  it("/auth/google/connect/start rejects POST with 405", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/google/connect/start", { method: "POST" });
    expect(res.status).toBe(405);
  });
});

describe("site-wide tooltips + optimistic UI injection", () => {
  it("injects a versioned tooltips.js module script tag on an ordinary page", async () => {
    const res = await SELF.fetch("https://precisstudy.com/dashboard");
    const html = await res.text();
    expect(html).toMatch(/<script src="\/shared\/tooltips\.js\?v=[0-9a-f]{10}" type="module">/);
  });

  it("injects a versioned optimistic.js module script tag on an ordinary page", async () => {
    const res = await SELF.fetch("https://precisstudy.com/dashboard");
    const html = await res.text();
    expect(html).toMatch(/<script src="\/shared\/optimistic\.js\?v=[0-9a-f]{10}" type="module">/);
  });

  it("does not inject tooltips.js/optimistic.js on /admin pages", async () => {
    const res = await SELF.fetch("https://precisstudy.com/admin");
    const html = await res.text();
    expect(html).not.toContain("/shared/tooltips.js");
    expect(html).not.toContain("/shared/optimistic.js");
  });
});

describe("shared JS cache-busting", () => {
  it("rewrites every /shared/*.js script tag on a page to include a content hash", async () => {
    const res = await SELF.fetch("https://precisstudy.com/dashboard");
    const html = await res.text();
    const srcs = [...html.matchAll(/<script src="(\/shared\/[^"]+)"/g)].map(m => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) expect(src).toMatch(/^\/shared\/[a-z-]+\.js\?v=[0-9a-f]{10}$/);
  });

  it("a /shared/*.js request carrying the injected ?v= hash gets a year-long, immutable Cache-Control", async () => {
    const page = await SELF.fetch("https://precisstudy.com/dashboard");
    const html = await page.text();
    const versionedSrc = /<script src="(\/shared\/command-palette\.js\?v=[0-9a-f]{10})"/.exec(html)[1];

    const res = await SELF.fetch("https://precisstudy.com" + versionedSrc);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("a bare /shared/*.js request with no ?v= keeps the platform default, not the long-lived cache", async () => {
    const res = await SELF.fetch("https://precisstudy.com/shared/mastery.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).not.toBe("public, max-age=31536000, immutable");
  });

  it("the hash tracks real file content -- two different shared files get different hashes", async () => {
    const page = await SELF.fetch("https://precisstudy.com/dashboard");
    const html = await page.text();
    const hashes = new Set([...html.matchAll(/\/shared\/[a-z-]+\.js\?v=([0-9a-f]{10})/g)].map(m => m[1]));
    const fileCount = new Set([...html.matchAll(/\/shared\/([a-z-]+\.js)\?v=/g)].map(m => m[1])).size;
    expect(hashes.size).toBe(fileCount);
  });
});

describe("cross-site write guard", () => {
  const post = (extra) => SELF.fetch("https://precisstudy.com/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "text/plain", ...extra },
    body: JSON.stringify({ message: "hello" }),
  });

  it("refuses a state-changing API request from another origin", async () => {
    const res = await post({ Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/cross-site/i);
  });

  it("refuses a request the browser marks Sec-Fetch-Site: cross-site, even without an Origin", async () => {
    expect((await post({ "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
  });

  it("refuses cross-origin writes to /auth routes too", async () => {
    const res = await SELF.fetch("https://precisstudy.com/auth/email/start", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "text/plain" }, body: "{}" });
    expect(res.status).toBe(403);
  });

  it("lets same-origin and header-less (non-browser) requests through to the handler", async () => {
    for (const extra of [{ Origin: "https://precisstudy.com", "Sec-Fetch-Site": "same-origin" }, {}]) {
      const res = await post(extra);
      expect(res.status).not.toBe(403);
    }
  });

  it("never blocks reads or CORS preflights", async () => {
    expect((await SELF.fetch("https://precisstudy.com/auth/me", { headers: { Origin: "https://evil.example" } })).status).toBe(200);
    expect((await SELF.fetch("https://precisstudy.com/api/chat", { method: "OPTIONS", headers: { Origin: "https://evil.example" } })).status).not.toBe(403);
  });
});


describe("abuse limits", () => {
  const kv = () => { const m = new Map(); return { _m: m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); } }; };
  const lim = (success) => ({ limit: vi.fn().mockResolvedValue({ success }) });
  const post = (path, headers = {}) => new Request("https://precisstudy.com" + path, { method: "POST", headers: { "CF-Connecting-IP": "9.9.9.9", ...headers }, body: "{}" });

  describe("limits helpers", () => {
    it("allowedBy lets everything through without a binding, honours the answer, and fails open if the limiter throws", async () => {
      expect(await allowedBy(undefined, "k")).toBe(true);
      expect(await allowedBy(lim(true), "k")).toBe(true);
      expect(await allowedBy(lim(false), "k")).toBe(false);
      expect(await allowedBy({ limit: async () => { throw new Error("down"); } }, "k")).toBe(true);
    });

    it("withinDailyQuota allows up to the cap per key per day, then refuses; other keys are unaffected", async () => {
      const store = kv();
      expect([await withinDailyQuota(store, "a", 2), await withinDailyQuota(store, "a", 2), await withinDailyQuota(store, "a", 2)]).toEqual([true, true, false]);
      expect(await withinDailyQuota(store, "b", 2)).toBe(true);
      expect([...store._m.keys()]).toContain("a:" + utcDay());
      expect(await withinDailyQuota(undefined, "a", 1)).toBe(true);
    });

    it("declaredTooLarge only looks at a numeric Content-Length", () => {
      const r = (len) => new Request("https://x.test/", { method: "POST", headers: len === null ? {} : { "Content-Length": String(len) }, body: "x" });
      expect(declaredTooLarge(r(11), 10)).toBe(true);
      expect(declaredTooLarge(r(10), 10)).toBe(false);
      expect(declaredTooLarge(new Request("https://x.test/"), 10)).toBe(false);
    });

    it("body limits are generous only where files are expected", () => {
      expect(bodyLimitFor("/api/request-guide")).toBeGreaterThan(15 * 1024 * 1024);
      expect(bodyLimitFor("/api/flashcards/generate")).toBeGreaterThan(8 * 1024 * 1024);
      expect(bodyLimitFor("/api/feedback")).toBe(256 * 1024);
      expect(bodyLimitFor("/api/progress")).toBe(1024 * 1024);
    });
  });

  describe("abuseGuard", () => {
    it("rejects a declared body over the route's limit with 413 before any handler runs", async () => {
      const res = await abuseGuard(post("/api/feedback", { "Content-Length": String(300 * 1024) }), new URL("https://precisstudy.com/api/feedback"), {});
      expect(res.status).toBe(413);
      expect(await abuseGuard(post("/api/request-guide", { "Content-Length": String(10 * 1024 * 1024) }), new URL("https://precisstudy.com/api/request-guide"), {})).toBeNull();
    });

    it("applies the per-IP heavy limit to AI and school-connection routes only", async () => {
      const env = { HEAVY_RATE_LIMIT: lim(false), FORM_RATE_LIMIT: lim(true) };
      for (const path of ["/api/flashcards/generate", "/api/syllabus/parse", "/api/canvas/connect", "/api/assignments"]) {
        expect((await abuseGuard(post(path), new URL("https://precisstudy.com" + path), env)).status).toBe(429);
      }
      expect(env.HEAVY_RATE_LIMIT.limit).toHaveBeenCalledWith({ key: "heavy:9.9.9.9" });
      expect(await abuseGuard(post("/api/quest/swap"), new URL("https://precisstudy.com/api/quest/swap"), env)).toBeNull();
    });

    it("applies the form limit to the public forms and the sign-in email", async () => {
      const env = { FORM_RATE_LIMIT: lim(false) };
      for (const path of ["/api/feedback", "/api/request-guide", "/auth/email/start"]) {
        expect((await abuseGuard(post(path), new URL("https://precisstudy.com" + path), env)).status).toBe(429);
      }
    });

    it("never touches reads, preflights, or pages", async () => {
      const env = { HEAVY_RATE_LIMIT: lim(false), FORM_RATE_LIMIT: lim(false) };
      expect(await abuseGuard(new Request("https://precisstudy.com/api/assignments"), new URL("https://precisstudy.com/api/assignments"), env)).toBeNull();
      expect(await abuseGuard(new Request("https://precisstudy.com/api/chat", { method: "OPTIONS" }), new URL("https://precisstudy.com/api/chat"), env)).toBeNull();
      expect(await abuseGuard(post("/spanish-1/"), new URL("https://precisstudy.com/spanish-1/"), env)).toBeNull();
    });
  });
});


describe("continueDailyWork (the daily snapshot pass and the leaderboards that follow it)", () => {
  const today = new Date().toISOString().slice(0, 10);
  function pagedKV(initial) {
    const m = new Map(Object.entries(initial || {}));
    return {
      _m: m,
      get: async (k) => (m.has(k) ? m.get(k) : null),
      put: async (k, v) => { m.set(k, v); },
      delete: async (k) => { m.delete(k); },
      list: async ({ prefix, cursor, limit } = {}) => {
        const all = [...m.keys()].filter(k => !prefix || k.startsWith(prefix)).sort();
        const start = cursor ? Number(cursor) : 0;
        const end = limit ? start + limit : all.length;
        return { keys: all.slice(start, end).map(name => ({ name })), list_complete: end >= all.length, cursor: String(end) };
      },
    };
  }
  const student = JSON.stringify({
    geometry: { mastery: { "1": { correct: 2, total: 2 } }, examples: {}, cardsKnown: [] },
    leaderboard: { optedIn: true, handle: "Fox", nickname: null, groupCode: null },
  });

  it("the frequent trigger does nothing until the daily trigger has started today's pass", async () => {
    const kv = pagedKV({ "progress:a@example.com": student });
    expect(await continueDailyWork({ PROGRESS: kv }, { start: false })).toEqual({ step: "idle" });
    expect(kv._m.has("history:a@example.com")).toBe(false);
  });

  it("the daily trigger snapshots everyone and then computes the leaderboards once, exactly once", async () => {
    const kv = pagedKV({ "progress:a@example.com": student, "progress:b@example.com": student });
    const first = await continueDailyWork({ PROGRESS: kv }, { start: true });
    expect(first.step).toBe("leaderboards");
    expect(kv._m.has("history:a@example.com") && kv._m.has("history:b@example.com")).toBe(true);
    expect(kv._m.has("lb:global:questions")).toBe(true);
    expect(JSON.parse(kv._m.get("cron:snap"))).toMatchObject({ date: today, done: true, lbDone: true });
    // later triggers the same day find nothing left to do
    kv._m.delete("lb:global:questions");
    expect(await continueDailyWork({ PROGRESS: kv }, { start: false })).toEqual({ step: "idle" });
    expect(await continueDailyWork({ PROGRESS: kv }, { start: true })).toEqual({ step: "idle" });
    expect(kv._m.has("lb:global:questions")).toBe(false);
  });

  it("with more students than one batch, the frequent trigger finishes the job across runs and the boards wait for the last batch", async () => {
    const many = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`progress:s${String(i).padStart(3, "0")}@example.com`, student]));
    const kv = pagedKV(many);
    expect((await continueDailyWork({ PROGRESS: kv }, { start: true })).step).toBe("snapshots-batch");
    expect(kv._m.has("lb:global:questions")).toBe(false);
    expect((await continueDailyWork({ PROGRESS: kv }, { start: false })).step).toBe("leaderboards");
    expect([...kv._m.keys()].filter(k => k.startsWith("history:")).length).toBe(150);
    expect(kv._m.has("lb:global:questions")).toBe(true);
  });
});

describe("guide address guesses through the real worker", () => {
  it("301s a mistyped guide address and leaves real pages alone", async () => {
    const r = await SELF.fetch("https://precisstudy.com/ap-bio", { redirect: "manual" });
    expect(r.status).toBe(301);
    expect(r.headers.get("Location")).toBe("https://precisstudy.com/ap-biology/");
    expect((await SELF.fetch("https://precisstudy.com/biology/")).status).toBe(200);
  });
});

describe("one address per guide view", () => {
  it("301s a trailing-slash view URL to the canonical form", async () => {
    const r = await SELF.fetch("https://precisstudy.com/biology/quiz/", { redirect: "manual" });
    expect(r.status).toBe(301);
    expect(r.headers.get("Location")).toBe("https://precisstudy.com/biology/quiz");
    expect((await SELF.fetch("https://precisstudy.com/biology/quiz")).status).toBe(200);
  });
});

describe("AdSense account meta tag", () => {
  it("is added to every HTML page", async () => {
    for (const path of ["/", "/biology/", "/about/", "/dashboard/"]) {
      const html = await (await SELF.fetch("https://precisstudy.com" + path)).text();
      expect(html).toContain('<meta name="google-adsense-account" content="ca-pub-9710380778867118">');
    }
  });
});

describe("slashless addresses", () => {
  it("permanently redirect guides and section pages to their slashed address", async () => {
    for (const [from, to] of [["/biology", "/biology/"], ["/about", "/about/"], ["/french-1", "/french-1/"]]) {
      const r = await SELF.fetch("https://precisstudy.com" + from + "?x=1", { redirect: "manual" });
      expect(r.status).toBe(301);
      expect(r.headers.get("Location")).toBe("https://precisstudy.com" + to + "?x=1");
    }
    expect((await SELF.fetch("https://precisstudy.com/biology/")).status).toBe(200);
    expect((await SELF.fetch("https://precisstudy.com/biology/quiz")).status).toBe(200);
  });
});
