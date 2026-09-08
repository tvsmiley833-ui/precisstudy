import { describe, it, expect } from "vitest";
import { sanitizeMessages, subjectFromReferer, DEFAULT_SUBJECT } from "../src/chat.js";

describe("sanitizeMessages", () => {
  it("returns empty array for empty input", () => {
    expect(sanitizeMessages([])).toEqual([]);
  });

  it("returns empty array for non-array input", () => {
    expect(sanitizeMessages(undefined)).toEqual([]);
    expect(sanitizeMessages(null)).toEqual([]);
  });

  it("drops a leading assistant/bot message so the array starts with user", () => {
    const result = sanitizeMessages([
      { role: "bot", content: "Hi! Ask me anything." },
      { role: "user", content: "what is a rhombus" }
    ]);
    expect(result).toEqual([{ role: "user", content: "what is a rhombus" }]);
  });

  it("merges consecutive same-role messages instead of leaving them back-to-back", () => {
    const result = sanitizeMessages([
      { role: "user", content: "q1" },
      { role: "user", content: "q1 dup" }
    ]);
    expect(result).toEqual([{ role: "user", content: "q1\n\nq1 dup" }]);
  });

  it("drops a trailing assistant message so the array ends with user", () => {
    const result = sanitizeMessages([
      { role: "user", content: "q1" },
      { role: "bot", content: "a1" }
    ]);
    expect(result).toEqual([{ role: "user", content: "q1" }]);
  });

  it("preserves a normal alternating multi-turn conversation", () => {
    const result = sanitizeMessages([
      { role: "bot", content: "Hi!" },
      { role: "user", content: "q1" },
      { role: "bot", content: "a1" },
      { role: "user", content: "q2" }
    ]);
    expect(result).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" }
    ]);
  });

  it("truncates content longer than 2000 characters", () => {
    const long = "x".repeat(2500);
    const result = sanitizeMessages([{ role: "user", content: long }]);
    expect(result[0].content.length).toBe(2000);
  });

  it("keeps only the last 9 messages before processing", () => {
    const history = [];
    for (let i = 0; i < 12; i++) {
      history.push({ role: i % 2 === 0 ? "user" : "bot", content: "msg" + i });
    }
    const result = sanitizeMessages(history);
    // slice(-9) keeps msg3(bot)..msg11(bot); the leading-trim step then drops
    // msg3 (bot) since it isn't role "user", so msg4 is the true first survivor.
    expect(result[0].content).toBe("msg4");
  });
});

describe("subjectFromReferer", () => {
  it("returns the default subject when no referer is given", () => {
    expect(subjectFromReferer(null)).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer(undefined)).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer("")).toBe(DEFAULT_SUBJECT);
  });

  it("returns the default subject for a malformed URL", () => {
    expect(subjectFromReferer("not a url")).toBe(DEFAULT_SUBJECT);
  });

  it("extracts a known subject from the referer path", () => {
    expect(subjectFromReferer("https://studystacks.example/geometry")).toBe("geometry");
    expect(subjectFromReferer("https://studystacks.example/geometry/")).toBe("geometry");
    expect(subjectFromReferer("https://studystacks.example/chemistry")).toBe("chemistry");
    expect(subjectFromReferer("https://studystacks.example/chemistry/")).toBe("chemistry");
  });

  it("falls back to the default subject for an unregistered path segment", () => {
    expect(subjectFromReferer("https://studystacks.example/algebra-2")).toBe(DEFAULT_SUBJECT);
  });

  it("falls back to the default subject for the homepage referer", () => {
    expect(subjectFromReferer("https://studystacks.example/")).toBe(DEFAULT_SUBJECT);
  });

  it("does not resolve Object.prototype members as a subject", () => {
    expect(subjectFromReferer("https://studystacks.example/constructor")).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer("https://studystacks.example/toString")).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer("https://studystacks.example/hasOwnProperty")).toBe(DEFAULT_SUBJECT);
    expect(subjectFromReferer("https://studystacks.example/__proto__")).toBe(DEFAULT_SUBJECT);
  });
});

import { vi } from "vitest";
import { handleChatPost, handleChatOptions, MODEL } from "../src/chat.js";

describe("handleChatPost", () => {
  it("returns a reply from a mocked AI binding on success", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "42 degrees" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "what is x" }] })
    });
    const res = await handleChatPost(req, fakeEnv);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("42 degrees");
    expect(fakeEnv.AI.run).toHaveBeenCalledWith(MODEL, expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({ role: "user", content: "what is x" })
      ])
    }));
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://example.com/api/chat", { method: "POST", body: "not json" });
    const res = await handleChatPost(req, {});
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty history", async () => {
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [] })
    });
    const res = await handleChatPost(req, {});
    expect(res.status).toBe(400);
  });

  it("returns 500 when the AI binding is missing", async () => {
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    const res = await handleChatPost(req, {});
    expect(res.status).toBe(500);
  });

  it("returns 429 and does not call the model when the rate limiter denies", async () => {
    const fakeEnv = {
      AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) },
      CHAT_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: false }) }
    };
    const req = new Request("https://precisstudy.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    const res = await handleChatPost(req, fakeEnv);
    expect(res.status).toBe(429);
    expect(fakeEnv.AI.run).not.toHaveBeenCalled();
    expect(fakeEnv.CHAT_RATE_LIMIT.limit).toHaveBeenCalledWith({ key: expect.stringMatching(/^chat:/) });
  });

  it("returns 502 when the AI binding throws", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockRejectedValue(new Error("boom")) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    const res = await handleChatPost(req, fakeEnv);
    expect(res.status).toBe(502);
  });

  it("uses the geometry system prompt when Referer points to /geometry", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { Referer: "https://example.com/geometry" },
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    await handleChatPost(req, fakeEnv);
    const callArgs = fakeEnv.AI.run.mock.calls[0][1];
    expect(callArgs.messages[0].content).toContain("study Geometry");
  });

  it("uses the chemistry system prompt when Referer points to /chemistry", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { Referer: "https://example.com/chemistry" },
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    await handleChatPost(req, fakeEnv);
    const callArgs = fakeEnv.AI.run.mock.calls[0][1];
    expect(callArgs.messages[0].content).toContain("study Chemistry");
  });

  it.each([
    ["algebra1", "Algebra I"],
    ["algebra2", "Algebra II"],
    ["ap-lang", "AP English Language and Composition"],
    ["global-history", "Global History"]
  ])("uses the %s system prompt when Referer points to /%s", async (segment, expectedPhrase) => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { Referer: `https://example.com/${segment}` },
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    await handleChatPost(req, fakeEnv);
    const callArgs = fakeEnv.AI.run.mock.calls[0][1];
    expect(callArgs.messages[0].content).toContain(expectedPhrase);
  });

  it("falls back to the geometry prompt when Referer is missing", async () => {
    const fakeEnv = { AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) } };
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({ history: [{ role: "user", content: "hi" }] })
    });
    await handleChatPost(req, fakeEnv);
    const callArgs = fakeEnv.AI.run.mock.calls[0][1];
    expect(callArgs.messages[0].content).toContain("study Geometry");
  });
});

describe("handleChatOptions", () => {
  it("returns 204 and reflects an allowed origin", async () => {
    const res = handleChatOptions(new Request("https://precisstudy.com/api/chat", {
      method: "OPTIONS",
      headers: { Origin: "https://precisstudy.com" }
    }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://precisstudy.com");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("does not send an ACAO header for an unknown origin", async () => {
    const res = handleChatOptions(new Request("https://precisstudy.com/api/chat", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" }
    }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
