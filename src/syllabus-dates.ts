import { getSession } from "./auth.js";
import type { Assignment } from "./google-sync.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

export interface SyllabusDateEntry {
  subject: string;
  subjectLabel: string;
  date: string; // ISO YYYY-MM-DD
  title: string;
}

interface SyllabusDatesStore {
  items: SyllabusDateEntry[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SUBJECT_CHARS = 60;
const MAX_SUBJECT_LABEL_CHARS = 80;
const MAX_TITLE_CHARS = 120;
const MAX_KEY_DATES_PER_SAVE = 30; // mirror syllabus-routes.ts's MAX_KEY_DATES
const MAX_TOTAL_ITEMS = 200;

export function syllabusDatesKey(email: string): string {
  return "syldates:" + email;
}

// A subject key's folder under public/ is almost always "/" + the key, but a
// handful of legacy keys (see SYL_SUBJECTS / SYL_UNIT_EXPORTS comments in
// public/syllabus/index.html) don't match their folder 1:1.
const SUBJECT_FOLDER_OVERRIDES: Record<string, string> = {
  aplang: "ap-lang",
  apbiology: "ap-biology",
  globalhistory: "global-history"
};

export function syllabusSubjectLink(subject: string): string {
  return "/" + (SUBJECT_FOLDER_OVERRIDES[subject] || subject);
}

export async function loadSyllabusDates(env: { PROGRESS: KVNamespace }, email: string): Promise<SyllabusDateEntry[]> {
  const raw = await env.PROGRESS.get(syllabusDatesKey(email));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SyllabusDatesStore;
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch (e) {
    return [];
  }
}

export function syllabusDatesToAssignments(items: SyllabusDateEntry[]): Assignment[] {
  return items.map((item, index) => ({
    id: "syllabus-" + item.subject + "-" + index,
    source: "syllabus",
    title: item.title,
    courseName: item.subjectLabel,
    dueAt: item.date + "T23:59:00",
    allDay: true,
    link: syllabusSubjectLink(item.subject),
    state: "none"
  }));
}

export async function handleSaveSyllabusDates(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const subject = body?.subject;
  const subjectLabel = body?.subjectLabel;
  const keyDates = body?.keyDates;
  if (typeof subject !== "string" || !subject.trim()) return json({ error: "subject is required" }, 400);
  if (typeof subjectLabel !== "string" || !subjectLabel.trim()) return json({ error: "subjectLabel is required" }, 400);
  if (!Array.isArray(keyDates)) return json({ error: "keyDates must be an array" }, 400);

  const subjectKey = subject.trim().slice(0, MAX_SUBJECT_CHARS);
  const subjectLabelValue = subjectLabel.trim().slice(0, MAX_SUBJECT_LABEL_CHARS);

  const usable: SyllabusDateEntry[] = [];
  for (const item of keyDates) {
    if (!item || typeof item !== "object") continue;
    const date = (item as Record<string, unknown>).date;
    const title = (item as Record<string, unknown>).title;
    if (typeof date !== "string" || !ISO_DATE_RE.test(date)) continue; // "Week 6" etc. can't be sorted into Upcoming Assignments
    if (typeof title !== "string" || !title.trim()) continue;
    usable.push({ subject: subjectKey, subjectLabel: subjectLabelValue, date, title: title.trim().slice(0, MAX_TITLE_CHARS) });
    if (usable.length >= MAX_KEY_DATES_PER_SAVE) break;
  }

  const existing = await loadSyllabusDates(env, session.email);
  // Replace any previously-saved entries for this subject so re-uploading a
  // syllabus doesn't pile up duplicates, then merge in everything else.
  const merged = existing.filter(e => e.subject !== subjectKey).concat(usable).slice(-MAX_TOTAL_ITEMS);

  await env.PROGRESS.put(syllabusDatesKey(session.email), JSON.stringify({ items: merged } satisfies SyllabusDatesStore));

  return json({ saved: usable.length, submitted: keyDates.length });
}
