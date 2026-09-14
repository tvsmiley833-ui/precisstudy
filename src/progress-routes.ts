import { getSession } from "./auth.js";
import { randomToken } from "./random-token.js";
import { loadGoogleSettings } from "./google-routes.js";
import { pushScheduleToGoogleCalendar } from "./google-calendar-push.js";

const SUBJECTS = ["geometry", "chemistry", "algebra1", "algebra2", "aplang", "globalhistory", "apbiology", "apush", "physics", "biology", "precalc", "act-prep", "anatomy", "ap-chemistry", "ap-csa", "ap-euro", "ap-human-geography", "ap-macro", "ap-micro", "ap-physics", "ap-psych", "ap-stats", "ap-usgov", "ap-world", "art-history", "astronomy", "computer-science", "creative-writing", "earth-science", "economics", "english-10", "english-9", "environmental-science", "french-1", "geography", "german-1", "health", "journalism", "music-theory", "psychology", "sat-math", "sat-reading", "sociology", "spanish-1", "spanish-2", "spanish-3", "speech-debate", "statistics", "study-skills", "us-government", "world-history", "calculus", "calc-ab", "calc-bc", "us-history"];

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

interface SubjectProgress {
  mastery: Record<string, { correct: number; total: number }>;
  examples: Record<string, boolean>;
  cardsKnown: string[];
}

// Per-subject progress lives under subject-name keys alongside the fixed
// metadata keys below, so the blob is an intersection: known metadata typed
// precisely, arbitrary subject keys typed as SubjectProgress.
type ProgressBlob = {
  goal: { days: number; minutesPerDay: number; savedAt: string } | null;
  updatedAt: string | null;
  enrolledSubjects: string[];
  pushSubscriptions: PushSubscriptionRecord[];
  schedule: ScheduleData | null;
  streak: StreakData | null;
  // Opt-in public read-only link (Settings' "Share your progress"). Null
  // until a student generates one; regenerating replaces it (see
  // handlePostShareGenerate) so an old link stops working. The reverse
  // "share:<token>" -> email KV entry is what actually resolves a public
  // request -- this field just lets Settings know a link already exists.
  shareToken?: string | null;
  // One entry per calendar day a snapshot was actually worth taking (a
  // student with nothing assessed yet gets no entry, rather than padding
  // history with all-empty days) -- feeds the accuracy trend sparklines,
  // which need real day-over-day history to plot. Capped in
  // recordDailySnapshots() so this can't grow unbounded.
  history?: { date: string; subjects: Record<string, number>; totalAnswered?: number }[];
  // Per-notification-type opt-out (Settings). A missing key means "on" --
  // see notificationAllowed() in push-routes.ts, which reads this same field.
  notificationPrefs?: { daily?: boolean; streak?: boolean; blocks?: boolean } | null;
  // AI-generated flashcard decks (see flashcards-routes.ts), independent of
  // the per-guide FLASHCARDS arrays baked into guide pages at generate time.
  // Capped at MAX_CUSTOM_DECKS, oldest evicted first.
  customDecks?: { id: string; name: string; cards: { front: string; back: string }[]; createdAt: string }[];
} & Record<string, SubjectProgress>;

interface PushSubscriptionRecord {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

interface ScheduleData {
  blocks: ScheduleBlock[];
  timezone: string | null;
  notifyEnabled: boolean;
  savedAt: string;
  // Opt-in Google Calendar push (see google-calendar-push.ts). Key:
  // `${day}|${start}|${subjectKey}` -> the Calendar event id for that block.
  googleEventIds?: Record<string, string>;
}

interface ScheduleBlock {
  day: string;
  start: string;
  end: string;
  subjectKey: string;
  subjectLabel: string;
}

interface StreakData {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  timezone: string | null;
}

function emptySubject(): SubjectProgress {
  return { mastery: {}, examples: {}, cardsKnown: [] };
}

function emptyBlob(): ProgressBlob {
  const blob = { goal: null, updatedAt: null, enrolledSubjects: [], pushSubscriptions: [], schedule: null, streak: null, notificationPrefs: null } as unknown as ProgressBlob;
  for (const subject of SUBJECTS) blob[subject] = emptySubject();
  return blob;
}

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  if (ay === undefined || am === undefined || ad === undefined || by === undefined || bm === undefined || bd === undefined) return NaN;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

const DAY_KEYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTimezone(tz: string): boolean {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

function isValidBlock(b: unknown): b is ScheduleBlock {
  return !!(
    b &&
    typeof b === "object" &&
    DAY_KEYS.has((b as Record<string, unknown>).day as string) &&
    TIME_RE.test((b as Record<string, unknown>).start as string) &&
    TIME_RE.test((b as Record<string, unknown>).end as string) &&
    SUBJECTS.includes((b as Record<string, unknown>).subjectKey as string) &&
    typeof (b as Record<string, unknown>).subjectLabel === "string" &&
    ((b as Record<string, unknown>).subjectLabel as string).length > 0 &&
    ((b as Record<string, unknown>).subjectLabel as string).length <= 120
  );
}

async function loadBlob(env: Env, email: string): Promise<ProgressBlob> {
  if (!env.PROGRESS) return emptyBlob();
  const raw = await env.PROGRESS.get("progress:" + email);
  if (!raw) return emptyBlob();
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(emptyBlob(), parsed);
  } catch (e) {
    return emptyBlob();
  }
}

// Mirrors computeReadiness() in public/shared/mastery.js (same total>=2
// threshold, same average-of-assessed-units formula) -- reimplemented here
// rather than imported since that module is written for the browser and
// this runs in the Worker.
function readinessPct(mastery: SubjectProgress["mastery"] | undefined): number | null {
  if (!mastery) return null;
  const assessed = Object.values(mastery).filter(r => r && r.total >= 2);
  if (!assessed.length) return null;
  const sum = assessed.reduce((s, r) => s + (r.correct / r.total) * 100, 0);
  return Math.round(sum / assessed.length);
}

const MAX_HISTORY_DAYS = 60;

// Cron-triggered (see worker.ts's daily "0 22 * * *" branch): appends one
// snapshot per student per day of each assessed subject's current readiness
// -- the accuracy trend sparklines feature needs this real history to exist
// before it can plot anything, so this starts collecting it now even though
// no UI reads `history` yet. Skips a student entirely once today's snapshot
// is already recorded, and skips a subject with nothing assessed rather
// than recording a meaningless 0.
export async function recordDailySnapshots(env: Env): Promise<{ checked: number; recorded: number }> {
  if (!env.PROGRESS) return { checked: 0, recorded: 0 };
  const today = new Date().toISOString().slice(0, 10);

  let cursor: string | undefined;
  let checked = 0;
  let recorded = 0;

  do {
    const list = await env.PROGRESS.list({ prefix: "progress:", cursor });
    for (const key of list.keys) {
      checked++;
      const raw = await env.PROGRESS.get(key.name);
      if (!raw) continue;
      let blob: ProgressBlob;
      try {
        blob = JSON.parse(raw);
      } catch (e) {
        continue;
      }

      const history = Array.isArray(blob.history) ? blob.history : [];
      if (history.length && history[history.length - 1]?.date === today) continue;

      const subjects: Record<string, number> = {};
      let totalAnswered = 0;
      for (const subject of SUBJECTS) {
        const mastery = blob[subject]?.mastery;
        const pct = readinessPct(mastery);
        if (pct !== null) subjects[subject] = pct;
        if (mastery) totalAnswered += Object.values(mastery).reduce((s, r) => s + (r?.total || 0), 0);
      }
      if (!Object.keys(subjects).length) continue;

      history.push({ date: today, subjects, totalAnswered });
      while (history.length > MAX_HISTORY_DAYS) history.shift();
      blob.history = history;

      await env.PROGRESS.put(key.name, JSON.stringify(blob));
      recorded++;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { checked, recorded };
}

export async function handleGetProgress(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  return json(blob);
}

export async function handlePostProgress(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const subject = body && typeof body === "object" && "subject" in body ? String((body as Record<string, unknown>).subject) : undefined;
  if (!subject || !SUBJECTS.includes(subject)) return json({ error: "Unknown subject" }, 400);

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const mastery = typeof rec.mastery === "object" && rec.mastery !== null ? rec.mastery : {};
  const examples = typeof rec.examples === "object" && rec.examples !== null ? rec.examples : {};
  const cardsKnown = Array.isArray(rec.cardsKnown) ? rec.cardsKnown : [];

  const blob = await loadBlob(env, session.email);
  blob[subject] = { mastery: mastery as SubjectProgress["mastery"], examples: examples as SubjectProgress["examples"], cardsKnown: cardsKnown.filter(c => typeof c === "string") as string[] };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}

// "Reset all progress" (Settings) -- wipes mastery/examples/cardsKnown for
// every subject, same as if the student had never touched any guide, but
// deliberately leaves goal/schedule/streak/enrolledSubjects alone: this is a
// study-progress reset, not account deletion (see handleDeleteAccount for
// that).
export async function handlePostProgressReset(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  for (const subject of SUBJECTS) blob[subject] = emptySubject();
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}

// Settings' "Share your progress": generates a new opt-in public link,
// replacing (and invalidating) any previous one. Only ever a POST from the
// owning student's own session -- the resulting token is what a parent/tutor
// then uses, unauthenticated, via handleGetShare.
export async function handlePostShareGenerate(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const oldToken = blob.shareToken;
  const token = randomToken();
  blob.shareToken = token;
  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  await env.PROGRESS.put("share:" + token, session.email);
  if (oldToken) await env.PROGRESS.delete("share:" + oldToken);
  return json({ token });
}

export async function handlePostShareRevoke(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const token = blob.shareToken;
  blob.shareToken = null;
  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  if (token) await env.PROGRESS.delete("share:" + token);
  return json({ ok: true });
}

// Public, unauthenticated -- a parent/tutor opens this with just the token
// from the link, no account needed. Deliberately returns only the same
// rollups already shown on the (authenticated) dashboard -- never the
// student's email, push subscriptions, schedule, or raw per-question
// mastery records.
export async function handleGetShare(request: Request, env: Env): Promise<Response> {
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return json({ error: "Invalid link" }, 400);

  const email = await env.PROGRESS.get("share:" + token);
  if (!email) return json({ error: "This share link is invalid or has been revoked" }, 404);

  const blob = await loadBlob(env, email);
  if (blob.shareToken !== token) return json({ error: "This share link is invalid or has been revoked" }, 404);

  const subjects: { key: string; pct: number; assessedUnits: number }[] = [];
  for (const key of SUBJECTS) {
    const subj = blob[key];
    if (!subj) continue;
    const assessed = Object.values(subj.mastery || {}).filter(r => r && r.total >= 2);
    if (!assessed.length) continue;
    const sum = assessed.reduce((s, r) => s + (r.correct / r.total) * 100, 0);
    subjects.push({ key, pct: Math.round(sum / assessed.length), assessedUnits: assessed.length });
  }
  subjects.sort((a, b) => b.pct - a.pct);

  return json({
    streak: blob.streak ? { current: blob.streak.current, longest: blob.streak.longest } : null,
    subjects
  });
}

export async function handlePostEnrolledSubjects(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const raw = (body && typeof body === "object" && "subjects" in body && Array.isArray((body as Record<string, unknown>).subjects) ? (body as Record<string, unknown>).subjects : []) as unknown[];
  const enrolledSubjects = [...new Set(raw.filter((s): s is string => typeof s === "string" && SUBJECTS.includes(s)))];

  const blob = await loadBlob(env, session.email);
  blob.enrolledSubjects = enrolledSubjects;
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, enrolledSubjects });
}

export async function handlePostSchedule(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const rawBlocks = (body && typeof body === "object" && "blocks" in body && Array.isArray((body as Record<string, unknown>).blocks) ? (body as Record<string, unknown>).blocks : []) as unknown[];
  if (rawBlocks.length > 50) return json({ error: "Too many blocks" }, 400);
  if (!rawBlocks.every(isValidBlock)) return json({ error: "Invalid schedule block" }, 400);

  const notifyEnabled = !!(body && typeof body === "object" && "notifyEnabled" in body && (body as Record<string, unknown>).notifyEnabled);
  const timezone = body && typeof body === "object" && "timezone" in body ? String((body as Record<string, unknown>).timezone) : undefined;
  if (notifyEnabled && (!timezone || !isValidTimezone(timezone))) {
    return json({ error: "A valid timezone is required to enable notifications" }, 400);
  }

  const blocks = rawBlocks.map(b => ({
    day: b.day,
    start: b.start,
    end: b.end,
    subjectKey: b.subjectKey,
    subjectLabel: b.subjectLabel.slice(0, 120)
  }));

  const blob = await loadBlob(env, session.email);
  const validTimezone = timezone && isValidTimezone(timezone) ? timezone : null;
  const previousGoogleEventIds = blob.schedule?.googleEventIds || {};

  let googleEventIds: Record<string, string> | undefined = previousGoogleEventIds;
  // Pushing needs a timezone to anchor event times against -- without one
  // there's nothing meaningful to schedule, so leave any existing Calendar
  // events exactly as they were (don't push, don't clear).
  if (env.GOOGLE_CLIENT_ID && validTimezone) {
    try {
      const settings = await loadGoogleSettings(env, session.email);
      if (settings.pushScheduleToCalendar) {
        googleEventIds = await pushScheduleToGoogleCalendar(env, session.email, blocks, validTimezone, previousGoogleEventIds, settings.calendarIds[0] || "primary");
      }
    } catch (e) {
      // Calendar push is best-effort and must never block saving the
      // schedule inside PrecisStudy itself.
    }
  }

  blob.schedule = {
    blocks,
    timezone: validTimezone,
    notifyEnabled,
    savedAt: new Date().toISOString(),
    ...(Object.keys(googleEventIds || {}).length ? { googleEventIds } : {})
  };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, schedule: blob.schedule });
}

export async function handlePostStreak(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const localDate = body && typeof body === "object" && "localDate" in body ? String((body as Record<string, unknown>).localDate) : undefined;
  if (!localDate || typeof localDate !== "string" || !LOCAL_DATE_RE.test(localDate)) {
    return json({ error: "localDate must be an ISO date string (YYYY-MM-DD)" }, 400);
  }

  const requestedTimezone = body && typeof body === "object" && "timezone" in body ? String((body as Record<string, unknown>).timezone) : undefined;
  const timezone = isValidTimezone(requestedTimezone!) ? requestedTimezone : null;

  const blob = await loadBlob(env, session.email);
  const prev = blob.streak || { current: 0, longest: 0, lastActiveDate: null, timezone: null };

  if (prev.lastActiveDate === localDate) {
    // Same day as last recorded -- no streak change, but still refresh the
    // timezone in case it drifted (e.g. the student is traveling).
    const streak = timezone ? { ...prev, timezone } : prev;
    if (timezone && timezone !== prev.timezone) {
      blob.streak = streak;
      blob.updatedAt = new Date().toISOString();
      await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
    }
    return json({ ok: true, streak, changed: false });
  }

  const gap = prev.lastActiveDate ? daysBetween(prev.lastActiveDate, localDate) : null;
  if (gap !== null && gap < 0) {
    // localDate is older than what's on record (clock skew or an out-of-order
    // request) -- ignore rather than let it reset or corrupt an existing streak.
    return json({ ok: true, streak: prev, changed: false });
  }
  const current = gap === 1 ? prev.current + 1 : 1;
  const streak = { current, longest: Math.max(prev.longest, current), lastActiveDate: localDate, timezone: timezone || prev.timezone || null };

  blob.streak = streak;
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, streak, changed: true });
}

export async function handlePostGoal(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const days = Number(body && typeof body === "object" && "days" in body ? (body as Record<string, unknown>).days : undefined);
  const minutesPerDay = Number(body && typeof body === "object" && "minutesPerDay" in body ? (body as Record<string, unknown>).minutesPerDay : undefined);
  if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(minutesPerDay) || minutesPerDay <= 0) {
    return json({ error: "days and minutesPerDay must be positive numbers" }, 400);
  }

  const blob = await loadBlob(env, session.email);
  blob.goal = { days, minutesPerDay, savedAt: new Date().toISOString() };
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, goal: blob.goal });
}

// Settings' per-notification-type toggles. Partial merge (like handlePostGoal
// isn't, but this needs to be -- flipping one switch shouldn't silently reset
// the other two to their defaults), so only keys actually present in the body
// are written; an omitted key keeps whatever was stored before.
export async function handlePostNotificationPrefs(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
  const rec = body as Record<string, unknown>;

  const blob = await loadBlob(env, session.email);
  const prefs = { ...(blob.notificationPrefs || {}) };
  for (const key of ["daily", "streak", "blocks"] as const) {
    if (key in rec) {
      if (typeof rec[key] !== "boolean") return json({ error: `${key} must be a boolean` }, 400);
      prefs[key] = rec[key] as boolean;
    }
  }
  blob.notificationPrefs = prefs;
  blob.updatedAt = new Date().toISOString();

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, notificationPrefs: prefs });
}