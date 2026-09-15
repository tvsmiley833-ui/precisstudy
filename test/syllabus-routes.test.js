import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleSyllabusParse } from "../src/syllabus-routes.js";

const SECRET = "test-session-secret";

function fakeAI(response, toMarkdownResult) {
  return {
    async run(model, opts) {
      if (typeof response === "function") return response(model, opts);
      return response;
    },
    async toMarkdown(file) {
      if (typeof toMarkdownResult === "function") return toMarkdownResult(file);
      return toMarkdownResult;
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

describe("handleSyllabusParse", () => {
  it("401s with no session", async () => {
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", null, "POST", { text: "syllabus" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: "{}" }) });
    expect(res.status).toBe(401);
  });

  it("rejects empty pasted text", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "   " }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: "{}" }) });
    expect(res.status).toBe(400);
  });

  it("500s when the AI binding is missing", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "syllabus text" }), { SESSION_SECRET: SECRET });
    expect(res.status).toBe(500);
  });

  it("parses a clean JSON object response into meetings and key dates", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const modelOutput = JSON.stringify({
      meetings: [{ day: "mon", start: "09:00", end: "09:50" }, { day: "wed", start: "09:00", end: "09:50" }],
      keyDates: [{ date: "2026-10-15", title: "Midterm exam" }]
    });
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "Class meets Mon/Wed 9-9:50am. Midterm Oct 15, 2026." }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meetings).toEqual([{ day: "mon", start: "09:00", end: "09:50" }, { day: "wed", start: "09:00", end: "09:50" }]);
    expect(data.keyDates).toEqual([{ date: "2026-10-15", title: "Midterm exam" }]);
  });

  it("extracts a JSON object even when the model wraps it in prose or a code fence", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const modelOutput = "Here's what I found:\n```json\n{\"meetings\":[{\"day\":\"fri\",\"start\":\"14:00\",\"end\":\"15:00\"}],\"keyDates\":[]}\n```\nLet me know if you need more.";
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meetings).toEqual([{ day: "fri", start: "14:00", end: "15:00" }]);
  });

  it("drops malformed meetings (bad day, bad time) and malformed key dates", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const modelOutput = JSON.stringify({
      meetings: [
        { day: "mon", start: "09:00", end: "09:50" },
        { day: "someday", start: "09:00", end: "09:50" },
        { day: "tue", start: "9am", end: "09:50" }
      ],
      keyDates: [{ date: "2026-10-15", title: "Valid" }, { date: "", title: "Missing date" }, { title: "no date field" }]
    });
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meetings).toEqual([{ day: "mon", start: "09:00", end: "09:50" }]);
    expect(data.keyDates).toEqual([{ date: "2026-10-15", title: "Valid" }]);
  });

  it("502s when nothing usable comes back", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const modelOutput = JSON.stringify({ meetings: [], keyDates: [] });
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "not a syllabus" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(502);
  });

  it("502s on unparsable AI output", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: fakeAI({ response: "not json at all" }) });
    expect(res.status).toBe(502);
  });

  it("502s when the AI call throws", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const throwingAI = { run: async () => { throw new Error("boom"); }, toMarkdown: async () => ({ format: "markdown", data: "" }) };
    const res = await handleSyllabusParse(req("https://example.com/api/syllabus/parse", cookie, "POST", { text: "notes" }), { SESSION_SECRET: SECRET, AI: throwingAI });
    expect(res.status).toBe(502);
  });

  function fakeFile(name, type, bytes) {
    return new File([bytes], name, { type });
  }

  it("accepts a text/plain file upload directly, no AI toMarkdown call needed", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const form = new FormData();
    form.append("file", fakeFile("syllabus.txt", "text/plain", new TextEncoder().encode("Class meets Tue/Thu 10-11am.")));
    const modelOutput = JSON.stringify({ meetings: [{ day: "tue", start: "10:00", end: "11:00" }], keyDates: [] });
    const request = new Request("https://example.com/api/syllabus/parse", { method: "POST", body: form, headers: { Cookie: cookie } });
    const res = await handleSyllabusParse(request, { SESSION_SECRET: SECRET, AI: fakeAI({ response: modelOutput }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meetings).toEqual([{ day: "tue", start: "10:00", end: "11:00" }]);
  });

  it("rejects an unsupported file type", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const form = new FormData();
    form.append("file", fakeFile("virus.exe", "application/x-msdownload", new Uint8Array(10)));
    const request = new Request("https://example.com/api/syllabus/parse", { method: "POST", body: form, headers: { Cookie: cookie } });
    const res = await handleSyllabusParse(request, { SESSION_SECRET: SECRET, AI: fakeAI({ response: "{}" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/unsupported file type/i);
  });

  it("routes a PDF through env.AI.toMarkdown()", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const pdfSignature = new TextEncoder().encode("%PDF-1.4 fake pdf bytes");
    const form = new FormData();
    form.append("file", fakeFile("syllabus.pdf", "application/pdf", pdfSignature));
    const modelOutput = JSON.stringify({ meetings: [], keyDates: [{ date: "2026-12-01", title: "Final" }] });
    const request = new Request("https://example.com/api/syllabus/parse", { method: "POST", body: form, headers: { Cookie: cookie } });
    const res = await handleSyllabusParse(request, {
      SESSION_SECRET: SECRET,
      AI: fakeAI({ response: modelOutput }, { format: "markdown", data: "Final exam Dec 1, 2026." })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.keyDates).toEqual([{ date: "2026-12-01", title: "Final" }]);
  });
});
