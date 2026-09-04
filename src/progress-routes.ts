import { getSession } from "./auth.js";

const SUBJECTS = ["geometry", "chemistry", "algebra1", "algebra2", "aplang", "globalhistory", "apbiology", "apush", "physics", "biology", "precalc", "act-prep", "anatomy", "ap-chemistry", "ap-csa", "ap-euro", "ap-macro", "ap-micro", "ap-physics", "ap-psych", "ap-stats", "ap-usgov", "ap-world", "art-history", "astronomy", "computer-science", "creative-writing", "earth-science", "economics", "english-10", "english-9", "environmental-science", "french-1", "geography", "german-1", "health", "journalism", "music-theory", "psychology", "sat-math", "sat-reading", "sociology", "spanish-1", "spanish-2", "spanish-3", "speech-debate", "statistics", "study-skills", "us-government", "world-history", "calculus", "calc-ab", "calc-bc", "us-history"];

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
  const blob = { goal: null, updatedAt: null, enrolledSubjects: [], pushSubscriptions: [], schedule: null, streak: null } as unknown as ProgressBlob;
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
  blob.schedule = {
    blocks,
    timezone: validTimezone,
    notifyEnabled,
    savedAt: new Date().toISOString()
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