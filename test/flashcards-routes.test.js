import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleGenerateFlashcards, handleSaveFlashcards, handleDeleteFlashcards } from "../src/flashcards-routes.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    _store: store
  };
}

function fakeAI(response) {
  return {
    async run(model, opts) {
      if (typeof response === "function") return response(model, opts);
      return response;
    }
  };
}

async function sessionCookieFor(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

function req(url, cookie, method, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  return new Request(url, { method: method || "GET", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

describe("handleGenerateFlashcards", () => {
  it("401s with no session", async () => {
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", null, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: "[]" }) });
    expect(res.status).toBe(401);
  });

  it("rejects empty text", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "   " }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: "[]" }) });
    expect(res.status).toBe(400);
  });

  it("500s when the AI binding is missing", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET });
    expect(res.status).toBe(500);
  });

  it("parses a clean JSON array response into cards", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const modelOutput = JSON.stringify([
      { front: "What is a mitochondrion?", back: "The organelle that produces ATP through cellular respiration." },
      { front: "What is a nucleus?", back: "The organelle that houses a cell's DNA." }
    ]);
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "Cell biology notes about organelles." }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cards).toHaveLength(2);
    expect(data.cards[0]).toEqual({ front: "What is a mitochondrion?", back: "The organelle that produces ATP through cellular respiration." });
  });

  it("extracts a JSON array even when the model wraps it in prose or a code fence", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const modelOutput = "Here are your flashcards:\n```json\n[{\"front\":\"Q\",\"back\":\"A\"}]\n```\nHope that helps!";
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cards).toEqual([{ front: "Q", back: "A" }]);
  });

  it("drops malformed entries and caps at 20 cards", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const many = Array.from({ length: 30 }, (_, i) => ({ front: "Q" + i, back: "A" + i }));
    const modelOutput = JSON.stringify([...many, { front: "no back" }, { back: "no front" }, "not an object"]);
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cards).toHaveLength(20);
  });

  it("returns 502 when the model output isn't parseable JSON at all", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: "Sorry, I can't help with that." }) });
    expect(res.status).toBe(502);
  });

  it("returns 502 when the AI call throws", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleGenerateFlashcards(req("https://example.com/api/flashcards/generate", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: { run: async () => { throw new Error("boom"); } } });
    expect(res.status).toBe(502);
  });
});

describe("handleSaveFlashcards", () => {
  it("401s with no session", async () => {
    const res = await handleSaveFlashcards(req("https://example.com/api/flashcards/save", null, "POST", { name: "Deck", cards: [{ front: "Q", back: "A" }] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects a missing name or empty card list", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const noName = await handleSaveFlashcards(req("https://example.com/api/flashcards/save", cookie, "POST", { name: "", cards: [{ front: "Q", back: "A" }] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(noName.status).toBe(400);
    const noCards = await handleSaveFlashcards(req("https://example.com/api/flashcards/save", cookie, "POST", { name: "Deck", cards: [] }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(noCards.status).toBe(400);
  });

  it("saves a deck and appends without clobbering an existing one", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({ customDecks: [{ id: "existing", name: "Old Deck", cards: [{ front: "X", back: "Y" }], createdAt: "2026-01-01T00:00:00.000Z" }] })
    });
    const res = await handleSaveFlashcards(req("https://example.com/api/flashcards/save", cookie, "POST", { name: "New Deck", cards: [{ front: "Q", back: "A" }] }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deck.name).toBe("New Deck");
    expect(typeof data.deck.id).toBe("string");

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.customDecks).toHaveLength(2);
    expect(saved.customDecks[0].id).toBe("existing");
    expect(saved.customDecks[1].name).toBe("New Deck");
  });

  it("evicts the oldest deck once past the 20-deck cap", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = Array.from({ length: 20 }, (_, i) => ({ id: "deck" + i, name: "Deck " + i, cards: [{ front: "Q", back: "A" }], createdAt: "2026-01-01T00:00:00.000Z" }));
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ customDecks: existing }) });
    await handleSaveFlashcards(req("https://example.com/api/flashcards/save", cookie, "POST", { name: "Newest", cards: [{ front: "Q", back: "A" }] }), { SESSION_SECRET: SECRET, PROGRESS: kv });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.customDecks).toHaveLength(20);
    expect(saved.customDecks.find(d => d.id === "deck0")).toBeUndefined(); // oldest evicted
    expect(saved.customDecks[saved.customDecks.length - 1].name).toBe("Newest");
  });
});

describe("handleDeleteFlashcards", () => {
  it("401s with no session", async () => {
    const res = await handleDeleteFlashcards(req("https://example.com/api/flashcards/delete", null, "POST", { id: "x" }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("removes the matching deck", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        customDecks: [
          { id: "keep", name: "Keep", cards: [{ front: "Q", back: "A" }], createdAt: "2026-01-01T00:00:00.000Z" },
          { id: "remove", name: "Remove", cards: [{ front: "Q", back: "A" }], createdAt: "2026-01-01T00:00:00.000Z" }
        ]
      })
    });
    const res = await handleDeleteFlashcards(req("https://example.com/api/flashcards/delete", cookie, "POST", { id: "remove" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.customDecks).toEqual([{ id: "keep", name: "Keep", cards: [{ front: "Q", back: "A" }], createdAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("no-ops (200) on an unknown id, matching the idempotent-delete precedent from share-revoke", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ customDecks: [] }) });
    const res = await handleDeleteFlashcards(req("https://example.com/api/flashcards/delete", cookie, "POST", { id: "doesnotexist" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);
  });
});
