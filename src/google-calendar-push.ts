import { getGoogleToken } from "./google-token.js";

interface ScheduleBlock {
  day: string; // mon/tue/wed/thu/fri/sat/sun
  start: string; // HH:MM
  end: string; // HH:MM
  subjectKey: string;
  subjectLabel: string;
}

const DAY_TO_BYDAY: Record<string, string> = { mon: "MO", tue: "TU", wed: "WE", thu: "TH", fri: "FR", sat: "SA", sun: "SU" };
const DAY_TO_JS_WEEKDAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function blockKey(b: Pick<ScheduleBlock, "day" | "start" | "subjectKey">): string {
  return b.day + "|" + b.start + "|" + b.subjectKey;
}

// The next local calendar date (in `timezone`) that falls on `day`, today
// included -- DTSTART just anchors the RRULE's day-of-week/time, so if
// today's instance's time has already passed, that's fine: it simply means
// this week's occurrence reads as already-elapsed and next week's is the
// first one actually seen.
function nextDateForDay(day: string, timezone: string): string {
  const target = DAY_TO_JS_WEEKDAY[day];
  if (target === undefined) throw new Error("invalid day: " + day);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date());
  const y = Number(parts.find(p => p.type === "year")!.value);
  const m = Number(parts.find(p => p.type === "month")!.value);
  const d = Number(parts.find(p => p.type === "day")!.value);
  const weekdayStr = parts.find(p => p.type === "weekday")!.value;
  const jsWeekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayWeekday = jsWeekdayNames.indexOf(weekdayStr);
  const delta = (target - todayWeekday + 7) % 7;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

async function getAccessToken(env: { PROGRESS: KVNamespace; SESSION_SECRET: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string }, email: string): Promise<string | null> {
  const token = await getGoogleToken(env, email);
  if (!token) return null;
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
    if (!res.ok || typeof data?.access_token !== "string") return null;
    return data.access_token;
  } catch (e) {
    return null;
  }
}

async function createEvent(accessToken: string, calendarId: string, block: ScheduleBlock, timezone: string): Promise<string | null> {
  const date = nextDateForDay(block.day, timezone);
  const body = {
    summary: block.subjectLabel + " (PrecisStudy)",
    start: { dateTime: `${date}T${block.start}:00`, timeZone: timezone },
    end: { dateTime: `${date}T${block.end}:00`, timeZone: timezone },
    recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=" + DAY_TO_BYDAY[block.day]],
    reminders: { useDefault: true }
  };
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null; // includes 403 (missing calendar.events scope) -- fail closed, don't throw
    const data: any = await res.json().catch(() => ({}));
    return typeof data?.id === "string" ? data.id : null;
  } catch (e) {
    return null;
  }
}

async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + accessToken }
    });
  } catch (e) {
    // best-effort -- an orphaned event on the student's calendar is a minor
    // annoyance, not worth failing the schedule save over
  }
}

// Best-effort, never throws: a Google hiccup should never block saving the
// student's schedule inside PrecisStudy itself. Returns previousEventIds
// unchanged on any failure that prevents diffing (no token, refresh
// failure) so a transient outage doesn't silently orphan Calendar events by
// forgetting about them.
export async function pushScheduleToGoogleCalendar(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  email: string,
  blocks: ScheduleBlock[],
  timezone: string,
  previousEventIds: Record<string, string>,
  calendarId: string
): Promise<Record<string, string>> {
  const accessToken = await getAccessToken(env, email);
  if (!accessToken) return previousEventIds;

  const nextKeys = new Set(blocks.map(blockKey));
  const result: Record<string, string> = {};

  for (const [key, eventId] of Object.entries(previousEventIds)) {
    if (!nextKeys.has(key)) {
      await deleteEvent(accessToken, calendarId, eventId);
    } else {
      result[key] = eventId; // unchanged -- keep as-is, no API call needed
    }
  }

  for (const block of blocks) {
    const key = blockKey(block);
    if (result[key]) continue; // already carried over above
    const eventId = await createEvent(accessToken, calendarId, block, timezone);
    if (eventId) result[key] = eventId;
  }

  return result;
}
