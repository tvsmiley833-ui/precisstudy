import { describe, it, expect } from "vitest";
import { sharePreview, challengePreview, invitePreview, withLinkPreview } from "../src/link-previews.js";

const EMAIL = "secret.student@example.com";
const OPP = "opponent@example.com";
const TOKEN = "abcDEF1234567890xyz";
const CODE = "ABC234";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    reads: 0,
    async get(key) {
      this.reads++;
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    _store: store
  };
}

const env = kv => ({ PROGRESS: kv });
const blob = extra => JSON.stringify({ email: EMAIL, ...extra });
const mastery = (correct, total) => ({ u1: { correct, total } });

function shareKV(shareToken) {
  return fakeKV({
    ["share:" + TOKEN]: EMAIL,
    ["progress:" + EMAIL]: blob({
      shareToken,
      streak: { current: 5, longest: 9 },
      geometry: { mastery: mastery(9, 10) },
      chemistry: { mastery: mastery(5, 10) }
    })
  });
}

function challengeKV(nickname, creatorResult, extra) {
  return fakeKV({
    ["challenge:" + CODE]: JSON.stringify({
      subjectKey: "algebra1",
      questionNumbers: [1, 2, 3, 4, 5],
      creatorEmail: EMAIL,
      creatorResult,
      opponentEmail: OPP,
      opponentResult: { correct: 1, total: 5, completedAt: "2026-01-01T00:00:00Z" },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      ...extra
    }),
    ["progress:" + EMAIL]: blob({ leaderboard: { optedIn: true, handle: "Swift Otter 42", nickname, groupCode: null } })
  });
}

const PAGE = '<!DOCTYPE html><html><head><title>Old</title><meta name="robots" content="noindex"/></head><body>hi</body></html>';
const htmlRes = html => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

describe("sharePreview", () => {
  it("summarises only streak and readiness for a valid token, with no email", async () => {
    const p = await sharePreview(env(shareKV(TOKEN)), TOKEN);
    expect(p.title).toBe("A student's study progress — PrecisStudy");
    expect(p.description).toContain("5-day study streak");
    expect(p.description).toContain("70% overall readiness");
    expect(p.description).toContain("top subject Geometry at 90%");
    expect(JSON.stringify(p)).not.toContain("example.com");
  });

  it("returns a generic preview for revoked, mismatched, unknown or malformed tokens without echoing them", async () => {
    for (const [kv, token] of [[shareKV(null), TOKEN], [shareKV("otherToken123456"), TOKEN], [fakeKV(), TOKEN], [shareKV(TOKEN), "bad token<"]]) {
      const p = await sharePreview(env(kv), token);
      expect(p.url).toBe("https://precisstudy.com/share/");
      expect(JSON.stringify(p)).not.toContain(token);
      expect(JSON.stringify(p)).not.toContain("-day");
    }
  });
});

describe("challengePreview", () => {
  it("uses the handle, subject label and question count, never scores or email", async () => {
    const p = await challengePreview(env(challengeKV(null, { correct: 4, total: 5, completedAt: "x" })), CODE);
    expect(p.title).toBe("Challenge: Algebra I quiz on PrecisStudy");
    expect(p.description).toBe("5 questions. Can you beat Swift Otter 42's score?");
    expect(p.url).toBe("https://precisstudy.com/challenge?challenge=" + CODE);
    expect(JSON.stringify(p)).not.toContain("example.com");
    expect(p.description).not.toMatch(/4\/5|4 of 5|80%/);
  });

  it("prefers the nickname and does not hint at a score before the creator finishes", async () => {
    const p = await challengePreview(env(challengeKV("Ms Nick", undefined)), CODE);
    expect(p.description).toBe("5 questions. Ms Nick challenged you to a head-to-head quiz.");
  });

  it("does not write to KV (no handle minting on GET)", async () => {
    const kv = fakeKV({
      ["challenge:" + CODE]: JSON.stringify({ subjectKey: "algebra1", questionNumbers: [1], creatorEmail: EMAIL, createdAt: "", expiresAt: new Date(Date.now() + 1e6).toISOString() })
    });
    const before = kv._store.size;
    const p = await challengePreview(env(kv), CODE);
    expect(p.description).toContain("A classmate");
    expect(kv._store.size).toBe(before);
  });

  it("uses one challenge read and one profile read", async () => {
    const kv = challengeKV(null, undefined);
    await challengePreview(env(kv), CODE);
    expect(kv.reads).toBe(2);
  });

  it("is generic for unknown, expired or malformed codes", async () => {
    for (const [kv, code] of [[fakeKV(), CODE], [challengeKV(null, undefined, { expiresAt: "2020-01-01T00:00:00Z" }), CODE], [challengeKV(null, undefined), "no!"]]) {
      const p = await challengePreview(env(kv), code);
      expect(p.title).toBe("Peer Challenge — PrecisStudy");
      expect(p.url).toBe("https://precisstudy.com/challenge");
    }
  });
});

describe("invitePreview", () => {
  it("frames a valid ref as an invite without naming the inviter, and strips the ref from the url", async () => {
    const kv = fakeKV({ ["invite:" + TOKEN]: EMAIL });
    const p = await invitePreview(env(kv), TOKEN, "/geometry/");
    expect(p.description).toBe("A classmate invited you to PrecisStudy — free study guides, quizzes and flashcards, no sign-up.");
    expect(p.url).toBe("https://precisstudy.com/geometry/");
    expect(kv.reads).toBe(1);
    expect(JSON.stringify(p)).not.toContain("example.com");
    expect(JSON.stringify(p)).not.toContain(TOKEN);
  });

  it("returns null for unknown or malformed refs", async () => {
    expect(await invitePreview(env(fakeKV()), TOKEN, "/")).toBeNull();
    expect(await invitePreview(env(fakeKV({ ["invite:x"]: EMAIL })), "x", "/")).toBeNull();
  });
});

describe("withLinkPreview (rewritten HTML)", () => {
  it("inserts missing tags and rewrites the title on a share page, keeping noindex", async () => {
    const req = new Request(`https://precisstudy.com/share/?t=${TOKEN}`);
    const html = await (await withLinkPreview(htmlRes(PAGE), req, env(shareKV(TOKEN)))).text();
    expect(html).toContain("<title>A student's study progress — PrecisStudy</title>");
    expect(html).toContain('<meta property="og:title" content="A student&#39;s study progress — PrecisStudy"/>');
    expect(html).toContain('<meta property="og:image" content="https://precisstudy.com/logo-full.png"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary"/>');
    expect(html).toContain('<meta property="og:url" content="https://precisstudy.com/share/?t=' + TOKEN + '"/>');
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(html).not.toContain("example.com");
  });

  it("updates existing tags in place instead of duplicating them", async () => {
    const page = PAGE.replace("</head>", '<meta name="description" content="old"/><meta property="og:title" content="old"/></head>');
    const req = new Request(`https://precisstudy.com/challenge?challenge=${CODE}`);
    const html = await (await withLinkPreview(htmlRes(page), req, env(challengeKV(null, undefined)))).text();
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).not.toContain('content="old"');
    expect(html).toContain("Challenge: Algebra I quiz on PrecisStudy");
  });

  it("HTML-escapes a hostile nickname in both new and existing tags", async () => {
    const hostile = '"><script>alert(1)</script>';
    const kv = challengeKV(hostile, undefined);
    const req = new Request(`https://precisstudy.com/challenge?challenge=${CODE}`);
    const fresh = await (await withLinkPreview(htmlRes(PAGE), req, env(kv))).text();
    const existing = await (await withLinkPreview(htmlRes(PAGE.replace("</head>", '<meta property="og:description" content="x"/></head>')), req, env(kv))).text();
    for (const html of [fresh, existing]) {
      expect(html).not.toContain("<script");
      expect(html).toContain("script");
      expect(html).toContain("&quot;");
    }
  });

  it("rewrites any page carrying a valid ?ref and leaves an invalid one untouched", async () => {
    const kv = fakeKV({ ["invite:" + TOKEN]: EMAIL });
    const ok = await (await withLinkPreview(htmlRes(PAGE), new Request(`https://precisstudy.com/geometry/?ref=${TOKEN}`), env(kv))).text();
    expect(ok).toContain('property="og:title" content="A classmate invited you to PrecisStudy"');
    expect(ok).toContain('content="https://precisstudy.com/geometry/"');
    expect(ok).not.toContain(TOKEN);
    const bad = await (await withLinkPreview(htmlRes(PAGE), new Request("https://precisstudy.com/geometry/?ref=zzzzzzzzzzzz"), env(kv))).text();
    expect(bad).toBe(PAGE);
  });

  it("only touches GET/HEAD HTML", async () => {
    const kv = fakeKV({ ["invite:" + TOKEN]: EMAIL });
    const post = await withLinkPreview(htmlRes(PAGE), new Request(`https://precisstudy.com/?ref=${TOKEN}`, { method: "POST" }), env(kv));
    expect(await post.text()).toBe(PAGE);
    const png = new Response("x", { headers: { "Content-Type": "image/png" } });
    expect(await withLinkPreview(png, new Request(`https://precisstudy.com/?ref=${TOKEN}`), env(kv))).toBe(png);
  });
});
