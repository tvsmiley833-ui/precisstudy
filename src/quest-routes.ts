import { getSession } from "./auth.js";
import { loadBlob, SUBJECTS, type ProgressBlob, type QuestState, type QuestInstance } from "./progress-routes.js";
import { mondayUTC, weeklyDelta, activeDaysThisWeek } from "./leaderboard-routes.js";
import { memberWeakestUnit, unitLabel, SUBJECT_LABELS } from "./study-group-routes.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function saveBlob(env: Env, email: string, blob: ProgressBlob): Promise<void> {
  blob.updatedAt = new Date().toISOString();
  await env.PROGRESS.put("progress:" + email, JSON.stringify(blob));
}

// -- Catalog ---------------------------------------------------------------
// Every entry's progress is measured from data PrecisStudy already records
// server-side -- no new client-side event tracking was added for this
// feature. A few LoamLift-shaped candidates ("study for N minutes", "study a
// subject you haven't touched in 3+ days", "complete a practice exam") were
// considered and deliberately skipped: there's no session-time signal, no
// reliable per-subject "last touched" signal without new tracking, and no
// practice-exam feature/data in this codebase to hook into. Fabricating
// progress for those would be worse than not offering them.
interface DailyQuestDef { key: string; label: string; target: number; xp: number }
interface WeeklyQuestDef { key: string; label: string; target: number; xp: number }

export const DAILY_POOL: DailyQuestDef[] = [
  { key: "answer10", label: "Answer 10 quiz questions today", target: 10, xp: 20 },
  { key: "answer20", label: "Answer 20 quiz questions today", target: 20, xp: 35 },
  { key: "cards5", label: "Master 5 flashcards today", target: 5, xp: 15 },
  { key: "cards10", label: "Master 10 flashcards today", target: 10, xp: 25 },
  { key: "score80", label: "Score 80%+ on any unit quiz today", target: 1, xp: 30 }
];

export const WEEKLY_POOL: WeeklyQuestDef[] = [
  { key: "questions100", label: "Answer 100 questions this week", target: 100, xp: 60 },
  { key: "days4", label: "Study on 4 different days this week", target: 4, xp: 50 },
  { key: "xp500", label: "Earn 500 XP this week", target: 500, xp: 70 },
  { key: "boss", label: "Defeat this week's boss", target: 1, xp: 80 }
];

export const DAILY_BONUS_XP = 30;
const MAX_MASTERED_UNITS_SNAPSHOT = 200;

// Deterministic per-student-per-period pick so refreshing the page (or a
// second device) never reshuffles today's/this week's quests. Simple
// string hash -> seeded shuffle, good enough since this isn't
// security-sensitive, just "feels random but stable".
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededPick<T>(pool: T[], seed: number, count: number): T[] {
  const indices = pool.map((_, i) => i);
  let s = seed || 1;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices.slice(0, count).map(i => pool[i]!);
}

export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level - 1, 1.6));
}

export function levelFromXP(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xpIntoLevel: xp - base, xpForNext: next - base };
}

// -- Measurement helpers -----------------------------------------------
function totalAnsweredOf(blob: ProgressBlob): number {
  let total = 0;
  for (const subject of SUBJECTS) {
    const mastery = blob[subject]?.mastery;
    if (!mastery) continue;
    for (const rec of Object.values(mastery)) total += rec?.total || 0;
  }
  return total;
}

function totalCardsKnownOf(blob: ProgressBlob): number {
  let total = 0;
  for (const subject of SUBJECTS) total += (blob[subject]?.cardsKnown || []).length;
  return total;
}

// Units currently assessed (total>=2, same threshold as computeUnitStatus in
// mastery.js) at >=80%. Capped defensively -- in practice this is bounded by
// how many units a student has actually quizzed, nowhere near the cap.
function masteredUnitsOf(blob: ProgressBlob): string[] {
  const out: string[] = [];
  for (const subject of SUBJECTS) {
    const mastery = blob[subject]?.mastery;
    if (!mastery) continue;
    for (const [unitId, rec] of Object.entries(mastery)) {
      if (!rec || rec.total < 2) continue;
      if (rec.correct / rec.total >= 0.8) {
        out.push(subject + ":" + unitId);
        if (out.length >= MAX_MASTERED_UNITS_SNAPSHOT) return out;
      }
    }
  }
  return out;
}

function unitTotal(blob: ProgressBlob, subject: string, unitId: string): number {
  return blob[subject]?.mastery?.[unitId]?.total || 0;
}
function unitPct(blob: ProgressBlob, subject: string, unitId: string): number | null {
  const rec = blob[subject]?.mastery?.[unitId];
  if (!rec || rec.total < 2) return null;
  return rec.correct / rec.total;
}

function newDailyState(blob: ProgressBlob, email: string, date: string): QuestState["daily"] {
  const picks = seededPick(DAILY_POOL, seedFrom(email + "|d|" + date), 3);
  return {
    date,
    quests: picks.map(p => ({ key: p.key, target: p.target, progress: 0, claimed: false })),
    swapsUsed: 0,
    bonusClaimed: false,
    baseline: {
      totalAnswered: totalAnsweredOf(blob),
      cardsKnown: totalCardsKnownOf(blob),
      masteredUnits: masteredUnitsOf(blob)
    }
  };
}

function newWeeklyState(email: string, weekStart: string): QuestState["weekly"] {
  const picks = seededPick(WEEKLY_POOL, seedFrom(email + "|w|" + weekStart), 2);
  return {
    weekStart,
    quests: picks.map(p => ({ key: p.key, target: p.target, progress: 0, claimed: false })),
    swapsUsed: 0
  };
}

function ensureQuestState(blob: ProgressBlob, email: string, localDate: string): QuestState {
  const monday = mondayUTC(new Date());
  let quest = blob.quest;
  if (!quest) quest = { xp: 0, daily: newDailyState(blob, email, localDate), weekly: newWeeklyState(email, monday), boss: null };
  if (quest.daily.date !== localDate) quest.daily = newDailyState(blob, email, localDate);
  if (quest.weekly.weekStart !== monday) quest.weekly = newWeeklyState(email, monday);
  if (quest.boss && quest.boss.weekStart !== monday) quest.boss = null;
  return quest;
}

// Summons the boss on the first sign of assessed activity this week (mirrors
// LoamLift's "log a workout to summon it" -- no boss until something real
// happened this week), targeting the student's own current weakest assessed
// unit across their enrolled subjects (same single-student computation
// study-group-routes.ts uses for its weak-spots aggregate).
function reconcileBoss(blob: ProgressBlob, quest: QuestState, monday: string, today: string): void {
  if (!quest.boss) {
    const history = Array.isArray(blob.history) ? blob.history : [];
    const activeThisWeek = weeklyDelta(history, "totalAnswered", monday) > 0 || activeDaysThisWeek(blob.streak?.recentActiveDates, monday, today) > 0;
    if (!activeThisWeek) return;
    const weakest = memberWeakestUnit(blob);
    if (!weakest) return;
    quest.boss = {
      weekStart: monday,
      subject: weakest.subject,
      unitId: weakest.unitId,
      unitName: unitLabel(weakest.subject, weakest.unitId),
      baselineTotal: unitTotal(blob, weakest.subject, weakest.unitId),
      defeated: false
    };
    return;
  }
  if (quest.boss.defeated) return;
  const total = unitTotal(blob, quest.boss.subject, quest.boss.unitId);
  const pct = unitPct(blob, quest.boss.subject, quest.boss.unitId);
  if (total > quest.boss.baselineTotal && pct !== null && pct >= 0.8) {
    quest.boss.defeated = true;
  }
}

function reconcileProgress(blob: ProgressBlob, quest: QuestState, monday: string, today: string): void {
  const totalAnswered = totalAnsweredOf(blob);
  const cardsKnown = totalCardsKnownOf(blob);
  const mastered = new Set(masteredUnitsOf(blob));
  const baselineMastered = new Set(quest.daily.baseline.masteredUnits);
  const newlyMastered = [...mastered].some(k => !baselineMastered.has(k));

  for (const q of quest.daily.quests) {
    if (q.claimed) continue;
    switch (q.key) {
      case "answer10":
      case "answer20":
        q.progress = Math.max(0, Math.min(q.target, totalAnswered - quest.daily.baseline.totalAnswered));
        break;
      case "cards5":
      case "cards10":
        q.progress = Math.max(0, Math.min(q.target, cardsKnown - quest.daily.baseline.cardsKnown));
        break;
      case "score80":
        q.progress = newlyMastered ? 1 : 0;
        break;
    }
  }

  reconcileBoss(blob, quest, monday, today);
  const history = Array.isArray(blob.history) ? blob.history : [];
  for (const q of quest.weekly.quests) {
    if (q.claimed) continue;
    switch (q.key) {
      case "questions100":
        q.progress = weeklyDelta(history, "totalAnswered", monday);
        break;
      case "days4":
        q.progress = activeDaysThisWeek(blob.streak?.recentActiveDates, monday, today);
        break;
      case "xp500":
        q.progress = weeklyDelta(history, "xp", monday);
        break;
      case "boss":
        q.progress = quest.boss?.defeated ? 1 : 0;
        break;
    }
  }
}

function publicQuestState(quest: QuestState) {
  const level = levelFromXP(quest.xp);
  return {
    xp: quest.xp,
    level,
    daily: {
      date: quest.daily.date,
      swapsUsed: quest.daily.swapsUsed,
      bonusClaimed: quest.daily.bonusClaimed,
      quests: quest.daily.quests.map(decorateDaily)
    },
    weekly: {
      weekStart: quest.weekly.weekStart,
      swapsUsed: quest.weekly.swapsUsed,
      quests: quest.weekly.quests.map(decorateWeekly)
    },
    boss: quest.boss ? {
      subject: quest.boss.subject,
      subjectLabel: SUBJECT_LABELS[quest.boss.subject] || quest.boss.subject,
      unitName: quest.boss.unitName,
      defeated: quest.boss.defeated
    } : null
  };
}

function decorateDaily(q: QuestInstance) {
  const def = DAILY_POOL.find(d => d.key === q.key);
  return { key: q.key, label: def?.label || q.key, target: q.target, progress: q.progress, xp: def?.xp || 0, claimed: q.claimed };
}
function decorateWeekly(q: QuestInstance) {
  const def = WEEKLY_POOL.find(d => d.key === q.key);
  return { key: q.key, label: def?.label || q.key, target: q.target, progress: q.progress, xp: def?.xp || 0, claimed: q.claimed };
}

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function localDateFrom(request: Request): string {
  const url = new URL(request.url);
  const q = url.searchParams.get("localDate");
  if (q && LOCAL_DATE_RE.test(q)) return q;
  return new Date().toISOString().slice(0, 10);
}

export async function handleGetQuest(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const blob = await loadBlob(env, session.email);
  const localDate = localDateFrom(request);
  const monday = mondayUTC(new Date());
  const quest = ensureQuestState(blob, session.email, localDate);
  reconcileProgress(blob, quest, monday, localDate);
  blob.quest = quest;
  await saveBlob(env, session.email, blob);

  return json({ ok: true, quest: publicQuestState(quest) });
}

export async function handlePostQuestSwap(request: Request, env: Env): Promise<Response> {
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
  const scope = rec.scope === "daily" || rec.scope === "weekly" ? rec.scope : undefined;
  const key = typeof rec.key === "string" ? rec.key : undefined;
  if (!scope || !key) return json({ error: "scope and key are required" }, 400);

  const blob = await loadBlob(env, session.email);
  const localDate = localDateFrom(request);
  const monday = mondayUTC(new Date());
  const quest = ensureQuestState(blob, session.email, localDate);
  reconcileProgress(blob, quest, monday, localDate);

  const group = scope === "daily" ? quest.daily : quest.weekly;
  const pool = scope === "daily" ? DAILY_POOL : WEEKLY_POOL;
  if (group.swapsUsed >= 1) return json({ error: scope === "daily" ? "You've already used today's swap" : "You've already used this week's swap" }, 400);

  const idx = group.quests.findIndex(q => q.key === key);
  if (idx === -1) return json({ error: "That quest isn't currently active" }, 404);
  if (group.quests[idx]!.claimed) return json({ error: "Can't swap a quest you've already claimed" }, 400);

  const activeKeys = new Set(group.quests.map(q => q.key));
  const candidates = pool.filter(p => !activeKeys.has(p.key));
  if (!candidates.length) return json({ error: "No other quests available to swap in" }, 400);
  const replacement = seededPick(candidates, seedFrom(session.email + "|swap|" + scope + "|" + (scope === "daily" ? localDate : monday)), 1)[0]!;

  group.quests[idx] = { key: replacement.key, target: replacement.target, progress: 0, claimed: false };
  group.swapsUsed += 1;

  reconcileProgress(blob, quest, monday, localDate);
  blob.quest = quest;
  await saveBlob(env, session.email, blob);
  return json({ ok: true, quest: publicQuestState(quest) });
}

export async function handlePostQuestClaim(request: Request, env: Env): Promise<Response> {
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
  const scope = rec.scope === "daily" || rec.scope === "weekly" ? rec.scope : undefined;
  const key = typeof rec.key === "string" ? rec.key : undefined;
  if (!scope || !key) return json({ error: "scope and key are required" }, 400);

  const blob = await loadBlob(env, session.email);
  const localDate = localDateFrom(request);
  const monday = mondayUTC(new Date());
  const quest = ensureQuestState(blob, session.email, localDate);
  reconcileProgress(blob, quest, monday, localDate);

  if (key === "bonus" && scope === "daily") {
    if (quest.daily.bonusClaimed) return json({ ok: true, quest: publicQuestState(quest), alreadyClaimed: true });
    const allClaimed = quest.daily.quests.length === 3 && quest.daily.quests.every(q => q.claimed);
    if (!allClaimed) return json({ error: "Claim all three daily quests first" }, 400);
    quest.daily.bonusClaimed = true;
    quest.xp += DAILY_BONUS_XP;
    blob.quest = quest;
    await saveBlob(env, session.email, blob);
    return json({ ok: true, quest: publicQuestState(quest), xpAwarded: DAILY_BONUS_XP });
  }

  const group = scope === "daily" ? quest.daily : quest.weekly;
  const pool = scope === "daily" ? DAILY_POOL : WEEKLY_POOL;
  const q = group.quests.find(x => x.key === key);
  if (!q) return json({ error: "That quest isn't currently active" }, 404);
  if (q.claimed) return json({ ok: true, quest: publicQuestState(quest), alreadyClaimed: true });
  if (q.progress < q.target) return json({ error: "This quest isn't complete yet" }, 400);

  q.claimed = true;
  const def = pool.find(p => p.key === key);
  const xpAwarded = def?.xp || 0;
  quest.xp += xpAwarded;
  blob.quest = quest;
  await saveBlob(env, session.email, blob);
  return json({ ok: true, quest: publicQuestState(quest), xpAwarded });
}
