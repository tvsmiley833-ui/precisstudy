import { getSession } from "./auth.js";
import { ALLOWED_UPLOAD_TYPES, matchesDeclaredType } from "./file-validation.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

interface SyllabusMeeting {
  day: string;
  start: string;
  end: string;
}

interface SyllabusKeyDate {
  date: string;
  title: string;
}

const DAY_KEYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_MEETINGS = 10;
const MAX_KEY_DATES = 30;
const MAX_TITLE_CHARS = 120;
const MAX_DATE_CHARS = 40;
const MAX_TOPICS = 40;
const MAX_TOPIC_CHARS = 80;

const MAX_TEXT_CHARS = 6000;
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024; // 8MB, same allowance as the flashcards uploader

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `You read a class syllabus and extract three things: its recurring weekly meeting times, any key one-off dates (exams, project due dates, breaks, unit deadlines), and the ordered list of topics/units the course schedule or outline says it covers.

Respond with ONLY a JSON object, no other text, no markdown code fences, matching this exact shape:
{"meetings":[{"day":"mon","start":"09:00","end":"09:50"}],"keyDates":[{"date":"2026-10-15","title":"Midterm exam"}],"topics":["Cell structure and function","Genetics and heredity"]}

Rules:
- "day" must be one of: mon, tue, wed, thu, fri, sat, sun (lowercase, one per meeting -- a class that meets Mon/Wed/Fri gets three separate entries).
- "start"/"end" are 24-hour "HH:MM". Omit a meeting you can't find a real time for -- never guess.
- "meetings" can be an empty array if the syllabus states no fixed meeting schedule.
- "date" is "YYYY-MM-DD" if a full date (with year) is stated or clearly inferable from context; otherwise use whatever the syllabus actually says (e.g. "Oct 15", "Week 6") rather than inventing a year.
- "title" is a short label for what happens on that date, under 15 words.
- "topics" is an ordered list of short phrases (3-8 words each) naming what the course covers, in the exact order a week-by-week or unit-by-unit schedule/outline section of the syllabus lists them. Only pull these from an actual course schedule/table of contents/unit list -- if the syllabus has no such outline, return an empty array rather than inventing topics from vague hints.
- Include at most 10 meetings, 30 key dates, and 40 topics. If the document isn't a syllabus or has no usable schedule info, return {"meetings":[],"keyDates":[],"topics":[]}.`;

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

function sanitizeMeetings(raw: unknown): SyllabusMeeting[] {
  if (!Array.isArray(raw)) return [];
  const out: SyllabusMeeting[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const day = (item as Record<string, unknown>).day;
    const start = (item as Record<string, unknown>).start;
    const end = (item as Record<string, unknown>).end;
    if (typeof day !== "string" || !DAY_KEYS.has(day)) continue;
    if (typeof start !== "string" || !TIME_RE.test(start)) continue;
    if (typeof end !== "string" || !TIME_RE.test(end)) continue;
    out.push({ day, start, end });
    if (out.length >= MAX_MEETINGS) break;
  }
  return out;
}

function sanitizeKeyDates(raw: unknown): SyllabusKeyDate[] {
  if (!Array.isArray(raw)) return [];
  const out: SyllabusKeyDate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const date = (item as Record<string, unknown>).date;
    const title = (item as Record<string, unknown>).title;
    if (typeof date !== "string" || typeof title !== "string") continue;
    const d = date.trim().slice(0, MAX_DATE_CHARS);
    const t = title.trim().slice(0, MAX_TITLE_CHARS);
    if (!d || !t) continue;
    out.push({ date: d, title: t });
    if (out.length >= MAX_KEY_DATES) break;
  }
  return out;
}

function sanitizeTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().slice(0, MAX_TOPIC_CHARS);
    if (!t) continue;
    out.push(t);
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

// Same extraction shape as flashcards-routes.ts's extractNotesFromRequest
// (multipart file -> Workers AI toMarkdown(), or a pasted-text JSON body) --
// duplicated rather than shared since each route file in this codebase
// owns its own small helpers (see e.g. every route file's own json()).
async function extractDocumentText(request: Request, env: Env): Promise<{ text?: string; error?: string; status?: number }> {
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch (e) {
      return { error: "Invalid form submission", status: 400 };
    }
    const file = form.get("file");
    if (!file || typeof file === "string" || !("arrayBuffer" in file) || file.size === 0) {
      return { error: "Attach a file, or paste the syllabus text instead", status: 400 };
    }
    if (file.size > MAX_UPLOAD_SIZE) return { error: "That file is too large (max 8MB)", status: 400 };
    if (file.type && !ALLOWED_UPLOAD_TYPES.has(file.type)) return { error: "Unsupported file type — PDF, DOC, DOCX, TXT, PNG, JPG, or WEBP only", status: 400 };

    const buf = await file.arrayBuffer();
    if (file.type && !matchesDeclaredType(buf, file.type)) return { error: "That file's content doesn't match its declared type", status: 400 };

    if (file.type === "text/plain") {
      return { text: new TextDecoder().decode(buf) };
    }
    try {
      const result = await env.AI.toMarkdown({ name: file.name || "upload", blob: new Blob([buf], { type: file.type }) });
      if (result.format === "error") return { error: "Couldn't read that file — try a different one, or paste the text instead", status: 502 };
      return { text: result.data };
    } catch (e) {
      return { error: "Couldn't read that file — try a different one, or paste the text instead", status: 502 };
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return { error: "Invalid JSON body", status: 400 };
  }
  const text = body && typeof body === "object" && "text" in body ? (body as Record<string, unknown>).text : undefined;
  if (typeof text !== "string" || !text.trim()) return { error: "Paste the syllabus text, or attach a file", status: 400 };
  return { text };
}

export async function handleSyllabusParse(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.AI) return json({ error: "Server not configured — Workers AI binding is missing" }, 500);

  const extracted = await extractDocumentText(request, env);
  if (extracted.error) return json({ error: extracted.error }, extracted.status || 400);
  if (!extracted.text || !extracted.text.trim()) return json({ error: "Couldn't find any readable text in that file" }, 400);
  const text = extracted.text.trim().slice(0, MAX_TEXT_CHARS);

  let result: { response?: string; result?: string };
  try {
    result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text }
      ],
      max_tokens: 1400
    });
  } catch (e) {
    return json({ error: "Could not reach AI provider" }, 502);
  }

  const raw = (result && (result.response || result.result)) || "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch (e) {
    return json({ error: "Couldn't read a schedule out of that document — try again or paste the text instead." }, 502);
  }

  const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const meetings = sanitizeMeetings(rec.meetings);
  const keyDates = sanitizeKeyDates(rec.keyDates);
  const topics = sanitizeTopics(rec.topics);
  if (!meetings.length && !keyDates.length && !topics.length) {
    return json({ error: "Couldn't find a class schedule or key dates in that document." }, 502);
  }

  return json({ meetings, keyDates, topics });
}
