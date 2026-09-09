import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

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

  for (const subject of subjects) {
    it(`serves the ${subject} bundle for every real view URL, identical to the base page`, async () => {
      const baseRes = await SELF.fetch(`https://precisstudy.com/${subject}/`);
      expect(baseRes.status).toBe(200);
      const baseBody = await baseRes.text();

      for (const view of views) {
        const res = await SELF.fetch(`https://precisstudy.com/${subject}/${view}`);
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toBe(baseBody);
      }
    });
  }

  it("does not intercept an unknown subject", async () => {
    const res = await SELF.fetch("https://precisstudy.com/biology/quiz");
    expect(res.status).toBe(200); // falls through to the SPA index.html, not a subject bundle
    const body = await res.text();
    const geoBody = await (await SELF.fetch("https://precisstudy.com/geometry/")).text();
    expect(body).not.toBe(geoBody);
  });

  it("does not intercept an unknown view segment under a real subject (falls back to the SPA shell, not the subject bundle)", async () => {
    const res = await SELF.fetch("https://precisstudy.com/geometry/not-a-real-view");
    expect(res.status).toBe(200);
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
});
