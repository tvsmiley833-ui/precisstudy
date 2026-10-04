import { getSession } from "./auth.js";
import { randomToken } from "./random-token.js";
import { loadGoogleSettings } from "./google-routes.js";
import { pushScheduleToGoogleCalendar } from "./google-calendar-push.js";
import { consumeRef } from "./auth-state.js";
import { effectiveStreak, nextStreak } from "./streak.js";
import { json } from "./http.js";

export const SUBJECTS = ["geometry", "chemistry", "algebra1", "algebra2", "aplang", "globalhistory", "apbiology", "apush", "physics", "biology", "precalc", "act-prep", "anatomy", "ap-chemistry", "ap-csa", "ap-euro", "ap-human-geography", "ap-macro", "ap-micro", "ap-physics", "ap-psych", "ap-stats", "ap-usgov", "ap-world", "art-history", "astronomy", "computer-science", "creative-writing", "earth-science", "economics", "english-10", "english-9", "environmental-science", "french-1", "french-2", "french-3", "geography", "german-1", "health", "journalism", "music-theory", "psychology", "sat-math", "sat-reading", "sociology", "spanish-1", "spanish-2", "spanish-3", "speech-debate", "statistics", "study-skills", "us-government", "world-history", "calculus", "calc-ab", "calc-bc", "us-history"];

interface SubjectProgress {
  mastery: Record<string, { correct: number; total: number }>;
  examples: Record<string, boolean>;
  cardsKnown: string[];
  // Personalized unit ordering learned from a syllabus upload (/syllabus) --
  // the ordered list of unit ids this student's class covers them in.
  // Optional/absent for anyone who hasn't uploaded a syllabus for this
  // subject; unit-order.js (run on the actual study guide page) reorders
  // UNITS to match this on the next load.
  unitOrder?: number[];
  // Spaced-repetition schedule for flashcards, keyed by card term:
  // [Leitner box 1-5, next due (epoch ms), last reviewed (epoch ms)].
  srs?: Record<string, [number, number, number]>;
}

// Per-subject progress lives under subject-name keys alongside the fixed
// metadata keys below, so the blob is an intersection: known metadata typed
// precisely, arbitrary subject keys typed as SubjectProgress.
export type ProgressBlob = {
  goal: { days: number; minutesPerDay: number; savedAt: string } | null;
  updatedAt: string | null;
  // One-time data migrations already applied (see migratePhysicsUnits, migrateAlgebra2Units).
  migrations?: string[];
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
  // Opt-in read-only calendar feed (Settings' "Subscribe to your schedule")
  // that lets a student add their weekly study blocks to Apple/Google/
  // Outlook calendar as a subscribed .ics URL. Same shape as shareToken:
  // null until generated, regenerating replaces it so an old URL stops
  // working. Reverse "cal:<token>" -> email KV entry resolves a public,
  // unauthenticated .ics request (see handleGetCalendarFeed).
  calendarToken?: string | null;
  // Opt-in personal invite link (Settings' "Invite classmates"). Same
  // generate/reverse-KV shape as shareToken/calendarToken, except it's never
  // revoked -- an old link going dead would just look broken to whoever's
  // holding it, with no privacy upside the way revoking a progress-share or
  // calendar link has. invitesAccepted only ever increments, from
  // creditInviteIfAny() at a brand-new account's first sign-in.
  inviteToken?: string | null;
  invitesAccepted?: number;
  // One entry per calendar day a snapshot was actually worth taking (a
  // student with nothing assessed yet gets no entry, rather than padding
  // history with all-empty days) -- feeds the accuracy trend sparklines,
  // which need real day-over-day history to plot. Capped in
  // recordDailySnapshots() so this can't grow unbounded.
  // `xp` is the lifetime XP total as of that day (server-side port of
  // computeXP in public/dashboard/index.html -- see recordDailySnapshots),
  // added alongside the existing readiness/totalAnswered fields so Weekly
  // Leaderboards can diff today's value against ~7 entries ago to get "XP
  // earned this week" without a separate weekly counter.
  history?: { date: string; subjects: Record<string, number>; totalAnswered?: number; xp?: number }[];
  // Per-notification-type opt-out (Settings). A missing key means "on" --
  // see notificationAllowed() in push-routes.ts, which reads this same field.
  notificationPrefs?: { daily?: boolean; streak?: boolean; blocks?: boolean } | null;
  // Settings > Profile. timezone, when set, overrides the browser-reported one for the streak day and reminders.
  profile?: { displayName?: string | null; timezone?: string | null; timeFormat?: "12h" | "24h" | null; studyMinutes?: number | null; canvasSync?: "always" | "hourly" | "daily" | "manual"; hasAvatar?: boolean; createdAt?: string } | null;
  // AI-generated flashcard decks (see flashcards-routes.ts), independent of
  // the per-guide FLASHCARDS arrays baked into guide pages at generate time.
  // Capped at MAX_CUSTOM_DECKS, oldest evicted first.
  customDecks?: { id: string; name: string; cards: { front: string; back: string }[]; createdAt: string }[];
  // Weekly Leaderboards opt-in (see leaderboard-routes.ts). Absent/optedIn:false
  // means this student never appears in or contributes to any leaderboard
  // computation -- enforced at read time in leaderboard-routes.ts, not just
  // by omission here. handle is assigned once, on first opt-in, and stays
  // stable across weeks; nickname (if set) displays instead of handle.
  // groupCode mirrors the reciprocal-membership lbgroup:<code> KV entry --
  // null/absent means "not in a group". A student belongs to at most one
  // group at a time.
  leaderboard?: { optedIn: boolean; handle: string; nickname?: string | null; groupCode?: string | null } | null;
  // Daily/weekly Quests (see quest-routes.ts) -- additive, own independent XP
  // total (never reads/writes computeServerXP or the dashboard's XP). Absent
  // entirely for anyone who hasn't opened /quest yet -- generated fresh on
  // first GET /api/quest, same "blob.streak == null" degrade-gracefully
  // pattern used elsewhere in this file.
  quest?: QuestState | null;
} & Record<string, SubjectProgress>;

export interface QuestInstance {
  key: string;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface QuestState {
  xp: number;
  // One-time XP for finishing /onboarding (Sage's setup). Absent on older blobs.
  setupClaimed?: boolean;
  daily: {
    date: string; // local date (YYYY-MM-DD), student's own clock -- matches touchStreak's convention
    quests: QuestInstance[];
    swapsUsed: number;
    bonusClaimed: boolean;
    // Snapshot of measurable totals as of daily generation, so "today's"
    // progress can be a simple delta against current totals without any new
    // per-event tracking. masteredUnits is capped (see quest-routes.ts).
    baseline: { totalAnswered: number; cardsKnown: number; masteredUnits: string[] };
  };
  weekly: {
    weekStart: string; // Monday, UTC (mondayUTC()) -- matches leaderboard reset convention
    quests: QuestInstance[];
    swapsUsed: number;
  };
  boss: {
    weekStart: string;
    subject: string;
    unitId: string;
    unitName: string;
    baselineTotal: number;
    defeated: boolean;
  } | null;
}

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
  // Banked streak freezes (0-2): one is earned at every 7-day milestone and bridges one missed day (see streak.ts).
  freezes?: number;
  // Rolling set of the last ~14 distinct localDates touchStreak() recorded
  // (see handlePostStreak) -- unlike `current`, which resets to 1 on any gap,
  // this lets the Weekly Leaderboards "Active days this week" metric count
  // how many of the last 7 calendar days were active without disturbing the
  // consecutive-day streak logic other features (dashboard streak display,
  // sendStreakReminders) already depend on.
  recentActiveDates?: string[];
}

const MAX_RECENT_ACTIVE_DATES = 14;

function emptySubject(): SubjectProgress {
  return { mastery: {}, examples: {}, cardsKnown: [] };
}

const MAX_SRS_CARDS = 3000;
const MAX_SRS_KEY_LEN = 200;
const MAX_SRS_TIME = 4102444800000; // 2100-01-01

const MAX_MASTERY_COUNT = 1_000_000;
const MAX_MASTERY_UNITS = 200;
const MAX_EXAMPLES = 2000;
const MAX_CARDS_KNOWN = 5000;

/** Keeps only well-formed { correct, total } entries (non-negative integers, correct <= total) for numeric unit ids. */
export function sanitizeMastery(raw: unknown): SubjectProgress["mastery"] {
  const out: SubjectProgress["mastery"] = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [unit, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_MASTERY_UNITS) break;
    if (!/^\d{1,4}$/.test(unit) || !v || typeof v !== "object") continue;
    const { correct, total } = v as { correct?: unknown; total?: unknown };
    if (!Number.isInteger(correct) || !Number.isInteger(total)) continue;
    const c = correct as number, t = total as number;
    if (c < 0 || t < 0 || c > t || t > MAX_MASTERY_COUNT) continue;
    out[unit] = { correct: c, total: t };
    n++;
  }
  return out;
}

/**
 * Merges two per-unit mastery maps. Answer counters only ever increase, so the entry with the larger total is the more
 * recent one (ties: more correct). This stops a stale tab or second device from overwriting answers recorded elsewhere.
 */
export function mergeMastery(a: SubjectProgress["mastery"] | undefined, b: SubjectProgress["mastery"] | undefined): SubjectProgress["mastery"] {
  const out: SubjectProgress["mastery"] = { ...(a || {}) };
  for (const [unit, rec] of Object.entries(b || {})) {
    const cur = out[unit];
    if (!cur || rec.total > cur.total || (rec.total === cur.total && rec.correct > cur.correct)) out[unit] = rec;
  }
  return out;
}

/** Worked examples are only ever marked done, so merging is a union of the true flags. */
export function mergeExamples(a: SubjectProgress["examples"] | undefined, b: SubjectProgress["examples"] | undefined): SubjectProgress["examples"] {
  const out: SubjectProgress["examples"] = {};
  for (const src of [a || {}, b || {}]) {
    for (const [id, done] of Object.entries(src)) {
      if (done === true && Object.keys(out).length < MAX_EXAMPLES && id.length <= 120) out[id] = true;
    }
  }
  return out;
}

// Drops anything malformed rather than rejecting the whole save, same as unitOrder.
function sanitizeSrs(raw: unknown): SubjectProgress["srs"] {
  const out: Record<string, [number, number, number]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [term, rec] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_SRS_CARDS) break;
    if (!term || term.length > MAX_SRS_KEY_LEN || !Array.isArray(rec) || rec.length < 2) continue;
    const box = Math.round(Number(rec[0]));
    const due = Number(rec[1]);
    const t = rec.length > 2 ? Number(rec[2]) : 0;
    if (!Number.isFinite(box) || box < 1 || box > 5) continue;
    if (!Number.isFinite(due) || due < 0 || due > MAX_SRS_TIME) continue;
    out[term] = [box, Math.round(due), Number.isFinite(t) && t >= 0 && t <= MAX_SRS_TIME ? Math.round(t) : 0];
    n++;
  }
  return out;
}

const MAX_UNIT_ORDER = 100;

// Defensive parsing like the rest of this file's POST handlers: strip
// anything malformed rather than rejecting the whole request.
function sanitizeUnitOrder(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_UNIT_ORDER) break;
  }
  return out;
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

export function isValidTimezone(tz: string): boolean {
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

// Physics gained a new Unit 1 on 2026-09-23 (commit 83e3975, pushed 21:10
// UTC), so every old unit N became N+1. Progress saved before then is keyed
// by the old numbers; shift it once. Blobs last written after the cutoff may
// already mix both numberings, so they are only flagged, never shifted.
const PHYSICS_SHIFT_MIGRATION = "physics-units-v2";
const PHYSICS_SHIFT_CUTOFF = "2026-09-23T21:10:00.000Z";

/** Moves numeric unit keys >= `from` up by one (a unit was inserted at position `from`). */
export function shiftUnitKeys<T>(record: Record<string, T>, from = 1): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    const n = Number(k);
    out[Number.isInteger(n) && n >= from && n > 0 ? String(n + 1) : k] = v;
  }
  return out;
}

/** Worked-example ids are "<unit>-<index>": move the unit part of every id at or after `from` up by one, like shiftUnitKeys. */
export function shiftExampleKeys<T>(record: Record<string, T>, from = 1): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    const m = /^(\d+)-(.+)$/.exec(k);
    const n = m ? Number(m[1]) : NaN;
    out[m && n >= from && n > 0 ? `${n + 1}-${m[2]}` : k] = v;
  }
  return out;
}

// Algebra II gained a new Unit 2 (Completing the Square), so old units 2-12 became 3-13
// (Unit 1 is unchanged). Same rules as the Physics shift above: progress last written before
// the cutoff is shifted once; blobs written after it already use the new numbers and are only flagged.
const ALGEBRA2_SHIFT_MIGRATION = "algebra2-units-v2";
export const ALGEBRA2_SHIFT_CUTOFF = "2026-10-01T02:35:55.000Z";

// Returns true when the blob changed and should be written back.
export function migrateAlgebra2Units(blob: ProgressBlob): boolean {
  const done = Array.isArray(blob.migrations) ? blob.migrations : [];
  if (done.includes(ALGEBRA2_SHIFT_MIGRATION)) return false;
  const algebra2 = blob.algebra2;
  const hasData = !!algebra2 && (Object.keys(algebra2.mastery || {}).length > 0 || !!algebra2.unitOrder?.length);
  if (!hasData) return false;
  if (blob.updatedAt && blob.updatedAt < ALGEBRA2_SHIFT_CUTOFF) {
    algebra2.mastery = shiftUnitKeys(algebra2.mastery || {}, 2);
    if (algebra2.examples) algebra2.examples = shiftExampleKeys(algebra2.examples, 2);
    if (blob.quest) blob.quest.boss = null; // a boss is tied to unit ids that just moved
    if (algebra2.unitOrder) algebra2.unitOrder = algebra2.unitOrder.map(id => (id >= 2 ? id + 1 : id));
  }
  blob.migrations = [...done, ALGEBRA2_SHIFT_MIGRATION];
  return true;
}

// Returns true when the blob changed and should be written back.
export function migratePhysicsUnits(blob: ProgressBlob): boolean {
  const done = Array.isArray(blob.migrations) ? blob.migrations : [];
  if (done.includes(PHYSICS_SHIFT_MIGRATION)) return false;
  const physics = blob.physics;
  const hasData = !!physics && (Object.keys(physics.mastery || {}).length > 0 || !!physics.unitOrder?.length);
  if (!hasData) return false;
  if (blob.updatedAt && blob.updatedAt < PHYSICS_SHIFT_CUTOFF) {
    physics.mastery = shiftUnitKeys(physics.mastery || {});
    if (physics.examples) physics.examples = shiftExampleKeys(physics.examples);
    if (blob.quest) blob.quest.boss = null; // a boss is tied to unit ids that just moved
    if (physics.unitOrder) physics.unitOrder = physics.unitOrder.map(id => id + 1);
  }
  blob.migrations = [...done, PHYSICS_SHIFT_MIGRATION];
  return true;
}

/**
 * Runs every unit-renumbering migration on a blob that has just been read from KV. It MUST happen at load time, before any
 * handler stamps a new updatedAt: the migrations decide "old numbering vs new" from updatedAt, so a quest, push, challenge,
 * flashcard or leaderboard write that lands first would otherwise lock the old numbering in as if it were the new one.
 * Returns true when the blob changed.
 */
export function applyUnitMigrations(blob: ProgressBlob): boolean {
  const a = migratePhysicsUnits(blob);
  const b = migrateAlgebra2Units(blob);
  return a || b;
}

type HistoryEntries = NonNullable<ProgressBlob["history"]>;

export function historyKey(email: string): string {
  return "history:" + email;
}

/**
 * The daily snapshots live in their own key. They used to sit inside the progress blob, so the nightly job rewrote every
 * student's whole blob; KV reads can be up to a minute stale, which let it put an older copy over answers a student had just
 * saved. Writing only this key means the job can never touch anything else.
 */
export async function loadHistory(env: Env, email: string): Promise<HistoryEntries | null> {
  if (!env.PROGRESS) return null;
  const raw = await env.PROGRESS.get(historyKey(email));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * Saves a progress blob WITHOUT its history (see loadHistory). A copy of history still inside an old blob is moved to the
 * history key first, but only if that key does not exist yet, so a newer history is never overwritten by a stale copy.
 * The object passed in is left untouched: callers often return it to the client afterwards.
 */
export async function putBlob(env: Env, email: string, blob: object): Promise<void> {
  const { history, ...rest } = blob as { history?: unknown };
  if (Array.isArray(history) && history.length && (await env.PROGRESS.get(historyKey(email))) === null) {
    await env.PROGRESS.put(historyKey(email), JSON.stringify(history));
  }
  await env.PROGRESS.put("progress:" + email, JSON.stringify(rest));
}

export async function loadBlobMigrated(env: Env, email: string, opts: { history?: boolean } = {}): Promise<{ blob: ProgressBlob; migrated: boolean }> {
  if (!env.PROGRESS) return { blob: emptyBlob(), migrated: false };
  const raw = await env.PROGRESS.get("progress:" + email);
  if (!raw) return { blob: emptyBlob(), migrated: false };
  try {
    const blob: ProgressBlob = Object.assign(emptyBlob(), JSON.parse(raw));
    if (opts.history !== false) {
      const history = await loadHistory(env, email);
      if (history) blob.history = history;
    }
    return { blob, migrated: applyUnitMigrations(blob) };
  } catch (e) {
    return { blob: emptyBlob(), migrated: false };
  }
}

/** `history: false` skips the extra history read, for callers (link previews, public summaries) that never look at it. */
export async function loadBlob(env: Env, email: string, opts: { history?: boolean } = {}): Promise<ProgressBlob> {
  return (await loadBlobMigrated(env, email, opts)).blob;
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

// Server-side port of computeXP/computeBadges in public/dashboard/index.html,
// so the daily snapshot (and therefore any leaderboard built on top of it)
// agrees with the number the dashboard shows. One deliberate simplification:
// the "Guide Complete"/"Guide Master" badges (all units in a subject at 80%+)
// need each subject's full unit-id catalog, which is baked into the static
// guide pages (SUBJECTS_CONFIG) and not available in this Worker -- so this
// omits just those two badges' +50 XP each from the total. Every other badge
// (streaks, cards known, perfect units, explorer, planner) is computed
// identically since it only needs data already in the blob.
function computeServerXP(blob: ProgressBlob): number {
  let totalCorrect = 0, totalCardsKnown = 0, totalExamplesDone = 0, perfectUnits = 0;
  for (const subject of SUBJECTS) {
    const subj = blob[subject];
    if (!subj) continue;
    for (const rec of Object.values(subj.mastery || {})) {
      totalCorrect += rec?.correct || 0;
      if (rec && rec.total >= 5 && rec.correct === rec.total) perfectUnits++;
    }
    totalCardsKnown += (subj.cardsKnown || []).length;
    totalExamplesDone += Object.keys(subj.examples || {}).length;
  }
  const longest = blob.streak?.longest || 0;
  const enrolledCount = (blob.enrolledSubjects || []).length;
  let badgesUnlocked = 0;
  if (longest >= 3) badgesUnlocked++;
  if (longest >= 7) badgesUnlocked++;
  if (longest >= 30) badgesUnlocked++;
  if (longest >= 100) badgesUnlocked++;
  if (totalCardsKnown >= 25) badgesUnlocked++;
  if (totalCardsKnown >= 100) badgesUnlocked++;
  if (totalCardsKnown >= 500) badgesUnlocked++;
  if (enrolledCount >= 3) badgesUnlocked++;
  if (blob.goal) badgesUnlocked++;
  if (perfectUnits >= 1) badgesUnlocked++;
  if (perfectUnits >= 5) badgesUnlocked++;
  const streakBonus = effectiveStreak(blob.streak); // a lapsed streak no longer adds XP
  return totalCorrect * 10 + totalCardsKnown * 2 + totalExamplesDone * 5 + streakBonus * 5 + badgesUnlocked * 50 + (blob.quest?.xp || 0); // quest claims count toward the one level
}

const MAX_HISTORY_DAYS = 60;

// ---- Cron support: index keys and a resumable daily pass ----------------------------------------------------------
//
// A scheduled run may make about 1,000 KV/subrequest calls, and every job used to list ALL students and read each blob, so
// somewhere past a few hundred students the runs started failing part-way through. Two tiny index keys now let the frequent
// and leaderboard jobs read only the students who matter, and the daily pass works through the students in batches across
// several runs, remembering where it stopped.

export const PUSH_INDEX_PREFIX = "pushsub:"; // one key per student who has at least one push subscription
export const LB_INDEX_PREFIX = "lbopt:"; // one key per student who opted in to leaderboards
const INDEX_READY_KEY = "cron:idx-ready";
const SNAP_STATE_KEY = "cron:snap";
const SNAP_BATCH = 120; // each student costs up to ~5 KV operations, so a batch stays well under the per-run limit

/** True once a complete daily pass has built both indexes; until then the jobs fall back to scanning every student. */
export async function indexesReady(env: Env): Promise<boolean> {
  return !!env.PROGRESS && (await env.PROGRESS.get(INDEX_READY_KEY)) === "1";
}

export interface SnapshotState {
  date: string; // UTC day this pass belongs to
  cursor?: string; // where the next batch continues
  done: boolean; // every student has been visited
  lbDone?: boolean; // the leaderboards for this day have been computed
}

export async function readSnapshotState(env: Env): Promise<SnapshotState | null> {
  if (!env.PROGRESS) return null;
  const raw = await env.PROGRESS.get(SNAP_STATE_KEY);
  if (!raw) return null;
  try {
    const st = JSON.parse(raw) as SnapshotState;
    return st && typeof st.date === "string" ? st : null;
  } catch (e) {
    return null;
  }
}

export async function writeSnapshotState(env: Env, state: SnapshotState): Promise<void> {
  await env.PROGRESS.put(SNAP_STATE_KEY, JSON.stringify(state), { expirationTtl: 3 * 24 * 60 * 60 });
}

async function ensureIndex(env: Env, key: string, wanted: boolean): Promise<void> {
  const has = (await env.PROGRESS.get(key)) !== null;
  if (wanted && !has) await env.PROGRESS.put(key, "1");
  else if (!wanted && has) await env.PROGRESS.delete(key);
}

// Cron-triggered (the daily "0 22 * * *" run, continued by the "*/5" run until it reports done). Appends one snapshot per
// student per day of each assessed subject's current readiness -- the accuracy-trend sparklines and weekly leaderboards need
// this history. It writes ONLY the student's history key, never their progress blob (see loadHistory for why), and it
// backfills the push and leaderboard index keys from the blobs it reads. Each call handles one batch of students and records
// its position, so the work is spread over as many runs as it needs. Skips a student already snapshotted today and a subject
// with nothing assessed rather than recording a meaningless 0.
export async function recordDailySnapshots(env: Env, opts: { batch?: number } = {}): Promise<{ checked: number; recorded: number; done: boolean }> {
  if (!env.PROGRESS) return { checked: 0, recorded: 0, done: true };
  const today = new Date().toISOString().slice(0, 10);
  const batch = Math.max(1, opts.batch ?? SNAP_BATCH);

  let state = await readSnapshotState(env);
  if (!state || state.date !== today) state = { date: today, done: false };
  if (state.done) return { checked: 0, recorded: 0, done: true };

  const list = await env.PROGRESS.list({ prefix: "progress:", cursor: state.cursor, limit: batch });
  let checked = 0;
  let recorded = 0;
  for (const key of list.keys) {
    checked++;
    try {
      const raw = await env.PROGRESS.get(key.name);
      if (!raw) continue;
      const blob = JSON.parse(raw) as ProgressBlob;
      const email = key.name.slice("progress:".length);

      await ensureIndex(env, PUSH_INDEX_PREFIX + email, Array.isArray(blob.pushSubscriptions) && blob.pushSubscriptions.length > 0);
      await ensureIndex(env, LB_INDEX_PREFIX + email, !!blob.leaderboard?.optedIn);

      const history: HistoryEntries = (await loadHistory(env, email)) ?? (Array.isArray(blob.history) ? blob.history : []);
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

      const xp = computeServerXP(blob);
      history.push({ date: today, subjects, totalAnswered, xp });
      while (history.length > MAX_HISTORY_DAYS) history.shift();

      // Only the history key is written: the student's progress blob is never touched by this job.
      await env.PROGRESS.put(historyKey(email), JSON.stringify(history));
      recorded++;
    } catch (e) {
      // One unreadable record must not stop the rest of the students from being processed.
    }
  }

  if (list.list_complete) {
    state = { ...state, cursor: undefined, done: true };
    await env.PROGRESS.put(INDEX_READY_KEY, "1");
  } else {
    state = { ...state, cursor: list.cursor };
  }
  await writeSnapshotState(env, state);
  return { checked, recorded, done: state.done };
}

export async function handleGetProgress(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const { blob, migrated } = await loadBlobMigrated(env, session.email);
  if (migrated) await putBlob(env, session.email, blob);
  return json(blob);
}

/**
 * GET /api/stats: streak, XP and level as the dashboard shows them, for the pill on guide pages. One KV read and no writes
 * (the pill used to call /api/quest, which writes on every GET and reports the separate quest XP, so the two pages disagreed).
 */
export async function handleGetStats(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);
  const blob = await loadBlob(env, session.email, { history: false });
  const xp = computeServerXP(blob);
  let level = 1;
  while (Math.round(100 * Math.pow(level, 1.6)) <= xp) level++; // same curve as the dashboard's levelFromXP
  return json({ streak: effectiveStreak(blob.streak || { current: 0 }), xp, level });
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
  const mastery = sanitizeMastery(rec.mastery);
  const examples = typeof rec.examples === "object" && rec.examples !== null ? rec.examples as SubjectProgress["examples"] : {};
  const cardsKnown = Array.isArray(rec.cardsKnown) ? rec.cardsKnown : [];
  const blob = await loadBlob(env, session.email);
  // Mark old physics / algebra II data migrated before this save stamps a fresh updatedAt
  // (which would otherwise make it look post-cutoff and skip the shift).
  migratePhysicsUnits(blob);
  migrateAlgebra2Units(blob);
  // unitOrder isn't part of mastery.js's regular autosync payload (it only
  // ever sends mastery/examples/cardsKnown), so a POST that omits it should
  // preserve whatever was already saved rather than wiping it out.
  const unitOrder = "unitOrder" in rec ? sanitizeUnitOrder(rec.unitOrder) : blob[subject]?.unitOrder;
  // Like unitOrder: a POST that omits srs (older cached client) keeps what was saved.
  const srs = "srs" in rec ? sanitizeSrs(rec.srs) : blob[subject]?.srs;
  // Merge (don't replace) the counters: a stale tab/second device must not erase answers recorded elsewhere.
  const mergedMastery = mergeMastery(blob[subject]?.mastery, mastery);
  const mergedExamples = mergeExamples(blob[subject]?.examples, examples);
  blob[subject] = {
    mastery: mergedMastery,
    examples: mergedExamples,
    cardsKnown: cardsKnown.filter(c => typeof c === "string").slice(0, MAX_CARDS_KNOWN) as string[],
    ...(unitOrder && unitOrder.length ? { unitOrder } : {}),
    ...(srs && Object.keys(srs).length ? { srs } : {})
  };
  blob.updatedAt = new Date().toISOString();

  await putBlob(env, session.email, blob);
  // The merged counters go back so the client can adopt anything another device recorded.
  return json({ ok: true, mastery: mergedMastery, examples: mergedExamples });
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

  await putBlob(env, session.email, blob);
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
  await putBlob(env, session.email, blob);
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
  await putBlob(env, session.email, blob);
  if (token) await env.PROGRESS.delete("share:" + token);
  return json({ ok: true });
}

// The exact public rollup the share page shows (and the link-preview tags
// summarise) -- one place so the two can never expose different fields.
export function summarizeShare(blob: ProgressBlob) {
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
  return {
    streak: blob.streak ? { current: effectiveStreak(blob.streak), longest: blob.streak.longest } : null,
    subjects
  };
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

  return json(summarizeShare(blob));
}

// Settings' "Subscribe to your schedule": generates a new opt-in public .ics
// feed URL, replacing (and invalidating) any previous one -- same
// generate/revoke/resolve shape as the share-link trio above.
export async function handlePostCalendarGenerate(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const oldToken = blob.calendarToken;
  const token = randomToken();
  blob.calendarToken = token;
  await putBlob(env, session.email, blob);
  await env.PROGRESS.put("cal:" + token, session.email);
  if (oldToken) await env.PROGRESS.delete("cal:" + oldToken);
  return json({ token });
}

export async function handlePostCalendarRevoke(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const token = blob.calendarToken;
  blob.calendarToken = null;
  await putBlob(env, session.email, blob);
  if (token) await env.PROGRESS.delete("cal:" + token);
  return json({ ok: true });
}

// One fixed, arbitrary Monday-anchored week (2024-01-01 was a Monday) used
// as the RRULE anchor date for every block -- a weekly RRULE recurs forever
// off DTSTART's weekday regardless of how far in the past DTSTART itself is,
// so the exact anchor date never matters, only which day of the week it
// lands on. Avoids ever computing "today in the student's timezone".
const ICS_ANCHOR_DATE: Record<string, string> = {
  mon: "20240101", tue: "20240102", wed: "20240103", thu: "20240104",
  fri: "20240105", sat: "20240106", sun: "20240107"
};
const ICS_BYDAY: Record<string, string> = {
  mon: "MO", tue: "TU", wed: "WE", thu: "TH", fri: "FR", sat: "SA", sun: "SU"
};

export function icsEscape(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** RFC 5545: content lines are at most 75 octets; longer ones continue on a line that starts with one space. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  let out = "", cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out += cur + "\r\n "; cur = ""; bytes = 0; limit = 74; }
    cur += ch; bytes += n;
  }
  return out + cur;
}

function icsTimestampUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Public, unauthenticated -- any calendar app (Apple/Google/Outlook) can
// subscribe to this URL with just the token, no account or cookie, the same
// way it works for any other iCal subscription feed. Never includes
// anything beyond the schedule's own subject labels and times.
export async function handleGetCalendarFeed(request: Request, env: Env): Promise<Response> {
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return json({ error: "Invalid link" }, 400);

  const email = await env.PROGRESS.get("cal:" + token);
  if (!email) return json({ error: "This calendar link is invalid or has been revoked" }, 404);

  const blob = await loadBlob(env, email);
  if (blob.calendarToken !== token) return json({ error: "This calendar link is invalid or has been revoked" }, 404);

  const tzid = blob.schedule?.timezone && isValidTimezone(blob.schedule.timezone) ? blob.schedule.timezone : "Etc/UTC";
  const blocks = blob.schedule?.blocks || [];
  const now = icsTimestampUTC(new Date());

  const events = blocks.map(b => {
    const anchor = ICS_ANCHOR_DATE[b.day];
    const byday = ICS_BYDAY[b.day];
    if (!anchor || !byday) return "";
    const start = b.start.replace(":", "") + "00";
    const end = b.end.replace(":", "") + "00";
    const uid = `${b.day}-${b.start}-${b.subjectKey}-${token}@precisstudy.com`;
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${tzid}:${anchor}T${start}`,
      `DTEND;TZID=${tzid}:${anchor}T${end}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
      icsFold(`SUMMARY:${icsEscape(b.subjectLabel)} study block`),
      "END:VEVENT"
    ].join("\r\n");
  }).filter(Boolean);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PrecisStudy//Study Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:PrecisStudy Study Schedule",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...events,
    "END:VCALENDAR"
  ].join("\r\n") + "\r\n";

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="precisstudy-schedule.ics"',
      "Cache-Control": "private, max-age=3600"
    }
  });
}

// Settings' "Invite classmates": returns the student's existing invite token
// if they already have one, otherwise mints one -- idempotent, unlike the
// share/calendar generators, since regenerating would silently break a link
// a classmate might already have saved with no real upside.
export async function handlePostInviteGenerate(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  if (blob.inviteToken) return json({ token: blob.inviteToken, invitesAccepted: blob.invitesAccepted || 0 });

  const token = randomToken();
  blob.inviteToken = token;
  await putBlob(env, session.email, blob);
  await env.PROGRESS.put("invite:" + token, session.email);
  return json({ token, invitesAccepted: 0 });
}

// Called from auth-routes.ts right after a brand-new account's first
// sign-in (see recordLogin's isNewUser) -- resolves the ss_ref cookie an
// invite link set when the visitor first landed, credits the inviting
// student, and is a total no-op if there's no cookie, the token doesn't
// resolve, or someone would otherwise be credited for referring themselves.
// Best-effort: never throws, so a lookup hiccup can't break sign-in.
export async function creditInviteIfAny(env: Env, request: Request, newUserEmail: string): Promise<void> {
  try {
    if (!env.PROGRESS) return;
    const token = consumeRef(request);
    if (!token) return;
    const inviterEmail = await env.PROGRESS.get("invite:" + token);
    if (!inviterEmail || inviterEmail.toLowerCase() === newUserEmail.toLowerCase()) return;
    const blob = await loadBlob(env, inviterEmail);
    if (blob.inviteToken !== token) return;
    blob.invitesAccepted = (blob.invitesAccepted || 0) + 1;
    await putBlob(env, inviterEmail, blob);
  } catch (e) { /* ignore -- sign-in must not fail because of this */ }
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

  await putBlob(env, session.email, blob);
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

  await putBlob(env, session.email, blob);
  return json({ ok: true, schedule: blob.schedule });
}

/**
 * The client says what its local date is, which decides streak days and quest days, so it can't be taken at face value: a
 * made-up future date would add a streak day (or a fresh set of quests) per request. Local time differs from UTC by at most a
 * day, so a date more than one day away from the server's date is not real.
 */
export function isPlausibleLocalDate(localDate: string, now = new Date()): boolean {
  if (!LOCAL_DATE_RE.test(localDate)) return false;
  const serverDay = now.toISOString().slice(0, 10);
  return Math.abs(daysBetween(serverDay, localDate)) <= 1;
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
  if (!isPlausibleLocalDate(localDate)) return json({ error: "localDate is too far from today" }, 400);

  const requestedTimezone = body && typeof body === "object" && "timezone" in body ? String((body as Record<string, unknown>).timezone) : undefined;
  const blob = await loadBlob(env, session.email);
  const pinnedTz = blob.profile?.timezone;
  const timezone = pinnedTz && isValidTimezone(pinnedTz) ? pinnedTz : (isValidTimezone(requestedTimezone!) ? requestedTimezone : null);
  const prev = blob.streak || { current: 0, longest: 0, lastActiveDate: null, timezone: null };

  if (prev.lastActiveDate === localDate) {
    // Same day as last recorded -- no streak change, but still refresh the
    // timezone in case it drifted (e.g. the student is traveling).
    const streak = timezone ? { ...prev, timezone } : prev;
    if (timezone && timezone !== prev.timezone) {
      blob.streak = streak;
      blob.updatedAt = new Date().toISOString();
      await putBlob(env, session.email, blob);
    }
    return json({ ok: true, streak, changed: false });
  }

  const gap = prev.lastActiveDate ? daysBetween(prev.lastActiveDate, localDate) : null;
  if (gap !== null && gap < 0) {
    // localDate is older than what's on record (clock skew or an out-of-order
    // request) -- ignore rather than let it reset or corrupt an existing streak.
    return json({ ok: true, streak: prev, changed: false });
  }
  const step = nextStreak(prev, localDate);
  const current = step.current;
  const recentActiveDates = [...new Set([...(prev.recentActiveDates || []), localDate])]
    .sort()
    .slice(-MAX_RECENT_ACTIVE_DATES);
  const streak = { current, longest: step.longest, lastActiveDate: localDate, timezone: timezone || prev.timezone || null, recentActiveDates, freezes: step.freezes };

  blob.streak = streak;
  blob.updatedAt = new Date().toISOString();

  await putBlob(env, session.email, blob);
  return json({ ok: true, streak, changed: true, usedFreeze: step.usedFreeze, earnedFreeze: step.earnedFreeze });
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

  await putBlob(env, session.email, blob);
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

  await putBlob(env, session.email, blob);
  return json({ ok: true, notificationPrefs: prefs });
}

/**
 * "Download my data": everything saved for the signed-in account as one JSON file. Push endpoints and share/calendar tokens
 * are left out: they are credentials, not the student's data, and a downloaded file may sit on a shared computer.
 */
export async function handleGetExport(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);
  const blob = await loadBlob(env, session.email);
  const { pushSubscriptions, shareToken, calendarToken, inviteToken, ...rest } = blob as ProgressBlob & Record<string, unknown>;
  void pushSubscriptions; void shareToken; void calendarToken; void inviteToken;
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: session.email, name: session.name ?? null }, data: rest }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="precisstudy-my-data.json"',
      "Cache-Control": "private, no-store"
    }
  });
}
