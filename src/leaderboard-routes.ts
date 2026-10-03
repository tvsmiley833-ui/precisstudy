import { getSession } from "./auth.js";
import { loadBlob, loadHistory, putBlob, indexesReady, LB_INDEX_PREFIX, SUBJECTS, type ProgressBlob } from "./progress-routes.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

// -- Handle generation -------------------------------------------------
// Anonymous, stable-per-student handles like "Quick Fox 42" -- assigned once
// on first opt-in and never regenerated, so a student's rank history reads
// consistently week to week even if they never set a nickname.
const HANDLE_ADJECTIVES = ["Quick", "Clever", "Bold", "Calm", "Sharp", "Bright", "Swift", "Steady", "Curious", "Sunny", "Brave", "Witty", "Nimble", "Eager", "Mighty", "Gentle", "Lucky", "Zesty", "Jolly", "Fierce"];
const HANDLE_NOUNS = ["Fox", "Owl", "Otter", "Falcon", "Panda", "Wolf", "Hawk", "Lynx", "Heron", "Badger", "Comet", "Maple", "Pine", "River", "Ember", "Quartz", "Raven", "Sparrow", "Tiger", "Wren"];

export function generateHandle(): string {
  const adj = HANDLE_ADJECTIVES[Math.floor(Math.random() * HANDLE_ADJECTIVES.length)];
  const noun = HANDLE_NOUNS[Math.floor(Math.random() * HANDLE_NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999: 360,000 combinations
  return `${adj} ${noun} ${num}`;
}

/**
 * A handle nobody else holds: reserved in KV under lbhandle:<handle>, with a few retries on a collision. Even 360,000
 * combinations meet birthday collisions in the hundreds of students, and two students sharing a name on a board is confusing.
 */
export async function reserveHandle(env: { PROGRESS?: KVNamespace }, email: string): Promise<string> {
  if (!env.PROGRESS) return generateHandle();
  const owner = email.toLowerCase();
  for (let i = 0; i < 6; i++) {
    const h = generateHandle();
    try {
      const held = await env.PROGRESS.get("lbhandle:" + h);
      if (held && held !== owner) continue;
      await env.PROGRESS.put("lbhandle:" + h, owner);
      return h;
    } catch (e) { return h; }
  }
  return generateHandle() + Math.floor(Math.random() * 10); // vanishingly rare: all six tries collided
}

export function displayNameFor(lb: NonNullable<ProgressBlob["leaderboard"]>): string {
  return (lb.nickname && lb.nickname.trim()) || lb.handle;
}

// -- Weekly window (ISO calendar week, Monday 00:00 UTC) ---------------
// Deliberate simplification: one global reset instant for every student,
// not per-student-timezone. A student a few hours from UTC midnight on
// Sunday/Monday may see "this week" flip a bit earlier/later than their own
// local Monday -- acceptable for a leaderboard, not worth the complexity of
// per-user week boundaries.
export function mondayUTC(d: Date): string {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

type HistoryEntry = NonNullable<ProgressBlob["history"]>[number];

// (today's cumulative value) - (value as of the most recent entry strictly
// BEFORE this Monday, i.e. Sunday's end-of-day snapshot). Snapshots hold
// end-of-day totals, so a Monday-dated entry already includes Monday's
// activity and must count toward the week, not be swallowed into the
// baseline. If history doesn't reach back that far, treats the whole history
// as this week's (new student mid-week gets full credit rather than a
// confusing negative/zero).
export function weeklyDelta(history: HistoryEntry[], field: "xp" | "totalAnswered", monday: string): number {
  if (!history.length) return 0;
  const latest = history[history.length - 1]![field] || 0;
  let baseline = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]!;
    if (entry.date < monday) {
      baseline = entry[field] || 0;
      break;
    }
  }
  return Math.max(0, latest - baseline);
}

export function activeDaysThisWeek(recentActiveDates: string[] | undefined, monday: string, today: string): number {
  if (!recentActiveDates) return 0;
  return recentActiveDates.filter(d => d >= monday && d <= today).length;
}

export type Metric = "xp" | "questions" | "activedays";
export type Scope = "global" | "subject" | "group";

interface BoardEntry { handle: string; value: number; rank: number }

const MAX_BOARD_SIZE = 50;
const MAX_GROUP_MEMBERS = 50;

export interface LeaderboardGroup {
  members: string[]; // emails
  createdAt: string;
  name?: string;
}

export function groupKey(code: string): string {
  return "lbgroup:" + code;
}

// Membership is one KV key per member ("lbgm:<code>:<email>"), not one shared array: with an array every join and leave was a
// read-modify-write of the same key, so students joining at the same moment overwrote each other (and KV allows only one
// write per second to a key). Groups made before this change keep their member array in the group record; both are merged.
export function memberKey(code: string, email: string): string {
  return "lbgm:" + code + ":" + email.toLowerCase();
}

export async function loadGroup(env: Env, code: string): Promise<LeaderboardGroup | null> {
  if (!env.PROGRESS) return null;
  const raw = await env.PROGRESS.get(groupKey(code));
  if (!raw) return null;
  let group: LeaderboardGroup;
  try {
    group = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const prefix = "lbgm:" + code + ":";
  const listed = await env.PROGRESS.list({ prefix, limit: 200 });
  const seen = new Set<string>();
  const members: string[] = [];
  for (const email of [...(Array.isArray(group.members) ? group.members : []), ...listed.keys.map(k => k.name.slice(prefix.length))]) {
    const lower = email.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); members.push(email); }
  }
  return { ...group, members };
}

export async function addMember(env: Env, code: string, email: string): Promise<void> {
  await env.PROGRESS.put(memberKey(code, email), "1");
}

/** Removes a member: their own key (no contention with anyone else), plus their entry in a pre-change member array if present. */
export async function removeMember(env: Env, code: string, email: string): Promise<void> {
  await env.PROGRESS.delete(memberKey(code, email));
  const raw = await env.PROGRESS.get(groupKey(code));
  if (!raw) return;
  try {
    const group = JSON.parse(raw) as LeaderboardGroup;
    const legacy = Array.isArray(group.members) ? group.members : [];
    const kept = legacy.filter(e => e.toLowerCase() !== email.toLowerCase());
    if (kept.length !== legacy.length) await env.PROGRESS.put(groupKey(code), JSON.stringify({ ...group, members: kept }));
  } catch (e) { /* unreadable group record: nothing to tidy */ }
}

/** Renames a group. Only the name is changed, so it never touches membership. */
export async function setGroupName(env: Env, code: string, name: string | undefined): Promise<void> {
  const raw = await env.PROGRESS.get(groupKey(code));
  if (!raw) return;
  try {
    const group = JSON.parse(raw) as LeaderboardGroup;
    if (name) group.name = name; else delete group.name;
    await env.PROGRESS.put(groupKey(code), JSON.stringify(group));
  } catch (e) { /* unreadable group record */ }
}

async function saveBlob(env: Env, email: string, blob: ProgressBlob): Promise<void> {
  blob.updatedAt = new Date().toISOString();
  await putBlob(env, email, blob);
}

// A short, unambiguous code (no 0/O/1/I) for a shareable group join code --
// distinct token style from randomToken() since this one gets read aloud /
// typed by a classmate, not just pasted from a link.
const GROUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateGroupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += GROUP_CODE_ALPHABET[Math.floor(Math.random() * GROUP_CODE_ALPHABET.length)];
  return code;
}

export async function handlePostOptIn(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  if (blob.leaderboard?.optedIn) {
    return json({ ok: true, leaderboard: blob.leaderboard });
  }

  const handle = blob.leaderboard?.handle || (await reserveHandle(env, session.email));
  blob.leaderboard = { optedIn: true, handle, nickname: blob.leaderboard?.nickname || null, groupCode: blob.leaderboard?.groupCode || null };
  await saveBlob(env, session.email, blob);
  await env.PROGRESS.put(LB_INDEX_PREFIX + session.email, "1"); // lets the leaderboard job read only opted-in students
  return json({ ok: true, leaderboard: blob.leaderboard });
}

// Removes the student from all *future* computation (opted-out students are
// filtered out of both the cron aggregation and any live group read below).
// Any already-cached global/subject board (computed at most once a day) will
// keep showing them until the next cron run -- an acceptable, documented
// latency rather than something worth rebuilding boards synchronously for.
export async function handlePostOptOut(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  if (blob.leaderboard) blob.leaderboard.optedIn = false;
  await saveBlob(env, session.email, blob);
  await env.PROGRESS.delete(LB_INDEX_PREFIX + session.email);
  return json({ ok: true });
}

const MAX_NICKNAME_LENGTH = 24;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;

function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(CONTROL_CHARS_RE, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_NICKNAME_LENGTH);
}

export async function handlePostNickname(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const blob = await loadBlob(env, session.email);
  if (!blob.leaderboard?.optedIn) return json({ error: "Opt in to leaderboards first" }, 400);

  // Explicit null/"" clears the nickname (falls back to the anonymous handle).
  const nickname = "nickname" in rec && rec.nickname != null ? sanitizeNickname(rec.nickname) : null;
  blob.leaderboard.nickname = nickname;
  await saveBlob(env, session.email, blob);
  return json({ ok: true, leaderboard: blob.leaderboard });
}

export async function handlePostGroupCreate(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  if (!blob.leaderboard?.optedIn) return json({ error: "Opt in to leaderboards first" }, 400);

  // Replace any prior group membership (a student belongs to at most one
  // group at a time -- simplification called out in the data model).
  const oldCode = blob.leaderboard.groupCode;
  if (oldCode) await removeMember(env, oldCode, session.email);

  let code = generateGroupCode();
  // Extremely unlikely collision given the 33^6 code space, but check anyway.
  for (let i = 0; i < 5 && (await loadGroup(env, code)); i++) code = generateGroupCode();

  const group: LeaderboardGroup = { members: [], createdAt: new Date().toISOString() };
  await env.PROGRESS.put(groupKey(code), JSON.stringify(group));
  await addMember(env, code, session.email);

  blob.leaderboard.groupCode = code;
  await saveBlob(env, session.email, blob);
  return json({ ok: true, groupCode: code });
}

export async function handlePostGroupJoin(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code = typeof rec.code === "string" ? rec.code.trim().toUpperCase() : "";
  if (!code) return json({ error: "A group code is required" }, 400);

  const blob = await loadBlob(env, session.email);
  if (!blob.leaderboard?.optedIn) return json({ error: "Opt in to leaderboards first" }, 400);

  const group = await loadGroup(env, code);
  if (!group) return json({ error: "That group code doesn't exist" }, 404);

  const alreadyMember = group.members.some(e => e.toLowerCase() === session.email.toLowerCase());
  if (!alreadyMember) {
    if (group.members.length >= MAX_GROUP_MEMBERS) {
      return json({ error: `This group is full (max ${MAX_GROUP_MEMBERS} members)` }, 400);
    }

    // Leave any prior group first (replaces membership, doesn't stack).
    const oldCode = blob.leaderboard.groupCode;
    if (oldCode && oldCode !== code) await removeMember(env, oldCode, session.email);

    await addMember(env, code, session.email);
  }

  blob.leaderboard.groupCode = code;
  await saveBlob(env, session.email, blob);
  return json({ ok: true, groupCode: code });
}

export async function handlePostGroupLeave(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const code = blob.leaderboard?.groupCode;
  if (code) await removeMember(env, code, session.email);
  if (blob.leaderboard) blob.leaderboard.groupCode = null;
  await saveBlob(env, session.email, blob);
  return json({ ok: true });
}

// -- Cron aggregation ----------------------------------------------------
// Called once a day from worker.ts's daily cron branch, right after
// recordDailySnapshots (which this depends on for fresh history). Scans
// every progress:* key ONCE, builds Global + per-subject boards for all
// three metrics in that single pass, and caches each as its own small KV
// entry -- so a page load never scans all users. Non-opted-in students are
// filtered out before any value is read from their blob, and their emails
// are never written into cached board output (handle/nickname only).
export async function computeLeaderboards(env: Env): Promise<{ checked: number; boardsWritten: number }> {
  if (!env.PROGRESS) return { checked: 0, boardsWritten: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const monday = mondayUTC(new Date());

  type Row = { handle: string; xp: number; questions: number; activedays: number };
  const globalRows: Row[] = [];
  const subjectRows: Record<string, Row[]> = {};

  // Once the daily pass has built the opt-in index, only opted-in students are read; until then every student is scanned.
  // The privacy gate below still checks each blob, so a stale index entry can never put someone on a board.
  const useIndex = await indexesReady(env);
  const prefix = useIndex ? LB_INDEX_PREFIX : "progress:";
  let cursor: string | undefined;
  let checked = 0;

  do {
    const list = await env.PROGRESS.list({ prefix, cursor });
    for (const key of list.keys) {
      checked++;
      try {
        const email = key.name.slice(prefix.length);
        const raw = await env.PROGRESS.get("progress:" + email);
        if (!raw) continue;
        const blob: ProgressBlob = JSON.parse(raw);

        // Hard privacy gate: a non-opted-in student's data never enters any
        // computation, board, or cache below.
        if (!blob.leaderboard?.optedIn) continue;

        // History lives in its own key now; an old blob may still carry it inline.
        const history = (await loadHistory(env, email)) ?? (Array.isArray(blob.history) ? blob.history : []);
        const handle = displayNameFor(blob.leaderboard);
        const xp = weeklyDelta(history, "xp", monday);
        const questions = weeklyDelta(history, "totalAnswered", monday);
        const activedays = activeDaysThisWeek(blob.streak?.recentActiveDates, monday, today);

        const row: Row = { handle, xp, questions, activedays };
        globalRows.push(row);

        // Per-subject boards: a student contributes to a subject's board only
        // if that subject's latest snapshot actually has a readiness entry
        // (i.e. they've been assessed in it at some point this history window).
        const lastEntry = history[history.length - 1];
        if (lastEntry?.subjects) {
          for (const subjectKey of Object.keys(lastEntry.subjects)) {
            if (!SUBJECTS.includes(subjectKey)) continue;
            (subjectRows[subjectKey] ||= []).push(row);
          }
        }
      } catch (e) {
        // skip an unreadable record rather than failing every board
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  const metrics: Metric[] = ["xp", "questions", "activedays"];

  function toBoard(rows: Row[], metric: Metric): BoardEntry[] {
    return rows
      .filter(r => r[metric] > 0)
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, MAX_BOARD_SIZE)
      .map((r, i) => ({ handle: r.handle, value: r[metric], rank: i + 1 }));
  }

  let boardsWritten = 0;
  const writes: Promise<unknown>[] = [];
  for (const metric of metrics) {
    writes.push(env.PROGRESS.put(`lb:global:${metric}`, JSON.stringify(toBoard(globalRows, metric))));
    boardsWritten++;
  }
  // Only build per-subject boards for subjects that actually have opted-in
  // students with data -- no point precomputing dozens of empty boards.
  for (const subjectKey of Object.keys(subjectRows)) {
    for (const metric of metrics) {
      const board = toBoard(subjectRows[subjectKey]!, metric);
      if (!board.length) continue;
      writes.push(env.PROGRESS.put(`lb:subject:${subjectKey}:${metric}`, JSON.stringify(board)));
      boardsWritten++;
    }
  }
  // A board with nobody on it this week must still be overwritten, or last week's rankings (and handles that have since
  // opted out) would keep showing. Blank any previously written subject board that wasn't rebuilt above.
  try {
    const written = new Set<string>();
    for (const subjectKey of Object.keys(subjectRows)) for (const metric of metrics) if (toBoard(subjectRows[subjectKey]!, metric).length) written.add(`lb:subject:${subjectKey}:${metric}`);
    let cur: string | undefined;
    do {
      const l = await env.PROGRESS.list({ prefix: "lb:subject:", cursor: cur });
      for (const k of l.keys) if (!written.has(k.name)) writes.push(env.PROGRESS.put(k.name, "[]"));
      cur = l.list_complete ? undefined : l.cursor;
    } while (cur);
  } catch (e) { /* the fresh boards are already queued; a failed sweep just leaves yesterday's empty-board state */ }
  await Promise.all(writes);

  return { checked, boardsWritten };
}

async function loadCachedBoard(env: Env, key: string): Promise<BoardEntry[]> {
  if (!env.PROGRESS) return [];
  const raw = await env.PROGRESS.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Group boards are small (<=50 members) and computed live -- no cache needed,
// and this always reflects opt-out immediately (unlike Global/Subject).
async function computeGroupBoard(env: Env, code: string, metric: Metric): Promise<BoardEntry[]> {
  const group = await loadGroup(env, code);
  if (!group) return [];
  const today = new Date().toISOString().slice(0, 10);
  const monday = mondayUTC(new Date());

  const rows: { handle: string; value: number }[] = [];
  for (const email of group.members) {
    const blob = await loadBlob(env, email);
    if (!blob.leaderboard?.optedIn) continue;
    const history = Array.isArray(blob.history) ? blob.history : [];
    let value = 0;
    if (metric === "xp") value = weeklyDelta(history, "xp", monday);
    else if (metric === "questions") value = weeklyDelta(history, "totalAnswered", monday);
    else value = activeDaysThisWeek(blob.streak?.recentActiveDates, monday, today);
    if (value > 0) rows.push({ handle: displayNameFor(blob.leaderboard), value });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, MAX_BOARD_SIZE).map((r, i) => ({ handle: r.handle, value: r.value, rank: i + 1 }));
}

export async function handleGetLeaderboard(request: Request, env: Env): Promise<Response> {
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") || "global") as Scope;
  const metric = (url.searchParams.get("metric") || "xp") as Metric;
  const subject = url.searchParams.get("subject") || "";

  if (!["xp", "questions", "activedays"].includes(metric)) return json({ error: "Invalid metric" }, 400);
  if (!["global", "subject", "group"].includes(scope)) return json({ error: "Invalid scope" }, 400);
  if (scope === "subject" && !SUBJECTS.includes(subject)) return json({ error: "Invalid subject" }, 400);

  // A non-opted-in visitor may still browse the read-only Global/Subject
  // board; they just get no "self" info and can't view a Group board (which
  // requires being a member). This never reveals anything about the
  // viewer's own progress since a non-opted-in viewer has none exposed here.
  const session = await getSession(request, env);
  let self: { optedIn: boolean; handle?: string; nickname?: string | null; groupCode?: string | null } = { optedIn: false };
  let selfBlob: ProgressBlob | null = null;
  if (session) {
    selfBlob = await loadBlob(env, session.email);
    if (selfBlob.leaderboard?.optedIn) {
      self = {
        optedIn: true,
        handle: selfBlob.leaderboard.handle,
        nickname: selfBlob.leaderboard.nickname || null,
        groupCode: selfBlob.leaderboard.groupCode || null
      };
    }
  }

  let board: BoardEntry[];
  if (scope === "global") {
    board = await loadCachedBoard(env, `lb:global:${metric}`);
  } else if (scope === "subject") {
    board = await loadCachedBoard(env, `lb:subject:${subject}:${metric}`);
  } else {
    if (!session || !selfBlob?.leaderboard?.optedIn) return json({ error: "Opt in to leaderboards to view your group" }, 401);
    const code = selfBlob.leaderboard.groupCode;
    if (!code) return json({ error: "You're not in a group" }, 400);
    board = await computeGroupBoard(env, code, metric);
  }

  return json({ scope, metric, subject: scope === "subject" ? subject : undefined, board, self });
}
