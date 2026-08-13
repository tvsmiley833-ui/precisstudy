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
  });

  it("falls back to the default subject for an unregistered path segment", () => {
    expect(subjectFromReferer("https://studystacks.example/chemistry")).toBe(DEFAULT_SUBJECT);
  });

  it("falls back to the default subject for the homepage referer", () => {
    expect(subjectFromReferer("https://studystacks.example/")).toBe(DEFAULT_SUBJECT);
  });
});
