import { getGoogleToken, deleteGoogleToken } from "./google-token.js";

export interface GoogleSettings {
  calendarIds: string[];
  schoolworkOnly: boolean;
  // Opt-in: pushes the student's PrecisStudy study schedule to
  // calendarIds[0] as recurring events (see google-calendar-push.ts).
  // Off by default -- writing to someone's calendar is more invasive than
  // reading it.
  pushScheduleToCalendar: boolean;
}

export const DEFAULT_SETTINGS: GoogleSettings = { calendarIds: ["primary"], schoolworkOnly: true, pushScheduleToCalendar: false };

export interface Assignment {
  id: string;
  source: "classroom" | "calendar";
  title: string;
  courseName: string | null;
  dueAt: string | null; // ISO 8601
  allDay: boolean;
  link: string | null;
  state: "todo" | "submitted" | "done" | "none";
}

export interface Feed {
  connected: boolean;
  items: Assignment[];
  fetchedAt: string;
  reason?: "revoked" | "google_unavailable";
}

interface CacheEntry {
  items: Assignment[];
  fetchedAt: string;
}

const CACHE_TTL_SECONDS = 900;
const CALENDAR_WINDOW_DAYS = 35;
const COURSE_CONCURRENCY = 5;

// Keywords that mark a calendar event as schoolwork. Word-boundary, case-insensitive.
const SCHOOLWORK_RE = /\b(test|quiz|exam|midterm|final|essay|project|paper|due|assignment|presentation|lab report|homework|hw)\b/i;

export function googleCacheKey(email: string): string {
  return "gcache:" + email;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const count = Math.min(limit, items.length);
  const workers = Array.from({ length: count > 0 ? count : 0 }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

// Thrown to abort the sync and fall back to cache / empty. Never escapes this module.
class GoogleUnavailable extends Error {}

async function gfetch(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (!res.ok) throw new GoogleUnavailable(url + " -> " + res.status);
  return res.json();
}

function classroomDueAt(cw: any): { dueAt: string | null; allDay: boolean } {
  const d = cw?.dueDate;
  if (!d || typeof d.year !== "number") return { dueAt: null, allDay: true };
  const yyyy = String(d.year).padStart(4, "0");
  const mm = String(d.month || 1).padStart(2, "0");
  const dd = String(d.day || 1).padStart(2, "0");
  const t = cw?.dueTime;
  if (t && (typeof t.hours === "number" || typeof t.minutes === "number")) {
    const hh = String(t.hours || 0).padStart(2, "0");
    const mi = String(t.minutes || 0).padStart(2, "0");
    return { dueAt: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00.000Z`, allDay: false };
  }
  return { dueAt: `${yyyy}-${mm}-${dd}T00:00:00.000Z`, allDay: true };
}

function submissionState(raw: string | undefined): Assignment["state"] {
  if (raw === "TURNED_IN") return "submitted";
  if (raw === "RETURNED") return "done";
  return "todo";
}

async function fetchClassroom(accessToken: string): Promise<Assignment[]> {
  const first = await gfetch(
    "https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=50",
    accessToken
  );
  let courses: any[] = Array.isArray(first?.courses) ? first.courses : [];
  if (first?.nextPageToken && courses.length < 50) {
    const next = await gfetch(
      "https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=50&pageToken=" +
        encodeURIComponent(first.nextPageToken),
      accessToken
    );
    if (Array.isArray(next?.courses)) courses = courses.concat(next.courses);
  }
  courses = courses.slice(0, 50);

  const perCourse = await mapLimit(courses, COURSE_CONCURRENCY, async (course: any) => {
    const cid = String(course.id);
    const [workRes, subRes] = await Promise.all([
      gfetch(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(cid)}/courseWork?pageSize=50&orderBy=${encodeURIComponent("dueDate desc")}`,
        accessToken
      ),
      gfetch(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(cid)}/courseWork/-/studentSubmissions?userId=me&pageSize=100`,
        accessToken
      )
    ]);
    const subByWork = new Map<string, string>();
    for (const s of (Array.isArray(subRes?.studentSubmissions) ? subRes.studentSubmissions : [])) {
      if (s?.courseWorkId) subByWork.set(String(s.courseWorkId), String(s.state));
    }
    const work: any[] = Array.isArray(workRes?.courseWork) ? workRes.courseWork : [];
    return work.map((cw): Assignment => {
      const { dueAt, allDay } = classroomDueAt(cw);
      return {
        id: `classroom:${cid}:${cw.id}`,
        source: "classroom",
        title: typeof cw.title === "string" ? cw.title : "(untitled)",
        courseName: typeof course.name === "string" ? course.name : null,
        dueAt,
        allDay,
        link: typeof cw.alternateLink === "string" ? cw.alternateLink : null,
        state: submissionState(subByWork.get(String(cw.id)))
      };
    });
  });
  return perCourse.flat();
}

interface CalItem extends Assignment {
  _desc?: string;
}

async function fetchCalendars(accessToken: string, settings: GoogleSettings): Promise<CalItem[]> {
  const calIds = settings.calendarIds.length ? settings.calendarIds : ["primary"];
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + CALENDAR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const perCal = await mapLimit(calIds, COURSE_CONCURRENCY, async (calId: string) => {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250"
    });
    const data = await gfetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` + params.toString(),
      accessToken
    );
    const calName = typeof data?.summary === "string" ? data.summary : null;
    const events: any[] = Array.isArray(data?.items) ? data.items : [];
    return events.map((ev): CalItem => {
      const timed = ev?.start?.dateTime;
      const dateOnly = ev?.start?.date;
      const allDay = !timed && !!dateOnly;
      let dueAt: string | null = null;
      if (timed) dueAt = new Date(timed).toISOString();
      else if (dateOnly) dueAt = `${dateOnly}T00:00:00.000Z`;
      return {
        id: `calendar:${calId}:${ev.id}`,
        source: "calendar",
        title: typeof ev.summary === "string" && ev.summary ? ev.summary : "(no title)",
        courseName: calName,
        dueAt,
        allDay,
        link: typeof ev.htmlLink === "string" ? ev.htmlLink : null,
        state: "none",
        _desc: typeof ev.description === "string" ? ev.description : undefined
      };
    });
  });
  return perCal.flat();
}

function applySchoolworkFilter(classroom: Assignment[], calendar: CalItem[], settings: GoogleSettings): Assignment[] {
  const keptCal = settings.schoolworkOnly === false
    ? calendar
    : calendar.filter((it) => SCHOOLWORK_RE.test(it.title + " " + (it._desc || "")));
  const strippedCal: Assignment[] = keptCal.map(({ _desc, ...rest }) => rest);
  return [...classroom, ...strippedCal];
}

function sortItems(items: Assignment[]): Assignment[] {
  return [...items].sort((a, b) => {
    if (a.dueAt && b.dueAt) {
      if (a.dueAt < b.dueAt) return -1;
      if (a.dueAt > b.dueAt) return 1;
      return a.title.localeCompare(b.title);
    }
    if (a.dueAt && !b.dueAt) return -1;
    if (!a.dueAt && b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

export async function syncGoogleAssignments(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  email: string,
  settings: GoogleSettings
): Promise<Feed> {
  const token = await getGoogleToken(env, email);
  if (!token) return { connected: false, items: [], fetchedAt: nowIso() };

  // 1. Refresh -> access token (never stored).
  let accessToken: string;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token"
      })
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || typeof data?.access_token !== "string") {
      if (data?.error === "invalid_grant") {
        await deleteGoogleToken(env, email);
        await env.PROGRESS.delete(googleCacheKey(email));
        return { connected: false, items: [], fetchedAt: nowIso(), reason: "revoked" };
      }
      return staleOrEmpty(env, email);
    }
    accessToken = data.access_token;
  } catch (e) {
    return staleOrEmpty(env, email);
  }

  // 2 + 3. Fetch + normalize. Any non-2xx from Classroom/Calendar -> GoogleUnavailable.
  try {
    const [classroom, calendar] = await Promise.all([
      fetchClassroom(accessToken),
      fetchCalendars(accessToken, settings)
    ]);
    const items = sortItems(applySchoolworkFilter(classroom, calendar, settings));
    const fetchedAt = nowIso();
    const entry: CacheEntry = { items, fetchedAt };
    await env.PROGRESS.put(googleCacheKey(email), JSON.stringify(entry), { expirationTtl: CACHE_TTL_SECONDS });
    return { connected: true, items, fetchedAt };
  } catch (e) {
    return staleOrEmpty(env, email);
  }
}

async function staleOrEmpty(env: { PROGRESS: KVNamespace }, email: string): Promise<Feed> {
  const raw = await env.PROGRESS.get(googleCacheKey(email));
  if (raw) {
    try {
      const entry = JSON.parse(raw) as CacheEntry;
      return { connected: true, items: entry.items || [], fetchedAt: entry.fetchedAt || nowIso(), reason: "google_unavailable" };
    } catch (e) {
      // fall through
    }
  }
  return { connected: true, items: [], fetchedAt: nowIso(), reason: "google_unavailable" };
}
