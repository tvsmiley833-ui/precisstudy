import { getSession } from "./auth.js";
import { loadBlob, SUBJECTS, type ProgressBlob } from "./progress-routes.js";
import { SUBJECT_UNIT_NAMES } from "./subject-units-data.js";
import { loadGroup, setGroupName, mondayUTC, weeklyDelta, activeDaysThisWeek, displayNameFor } from "./leaderboard-routes.js";
import { json } from "./http.js";

const MAX_GROUP_NAME_LENGTH = 40;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;

function sanitizeGroupName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(CONTROL_CHARS_RE, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_GROUP_NAME_LENGTH);
}

// Sets/clears the group's display name. Any current member may set it --
// there's no separate "owner" concept in the underlying group primitive
// (leaderboard-routes.ts), so membership itself is the authorization check.
export async function handlePostGroupName(request: Request, env: Env): Promise<Response> {
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
  const code = blob.leaderboard?.groupCode;
  if (!blob.leaderboard?.optedIn || !code) return json({ error: "You're not in a group" }, 400);

  const group = await loadGroup(env, code);
  if (!group) return json({ error: "That group doesn't exist" }, 404);
  const isMember = group.members.some(e => e.toLowerCase() === session.email.toLowerCase());
  if (!isMember) return json({ error: "You're not a member of this group" }, 403);

  const name = "name" in rec && rec.name != null ? sanitizeGroupName(rec.name) : null;
  await setGroupName(env, code, name || undefined);
  return json({ ok: true, name: name || null });
}

// -- Weak-spots aggregation ----------------------------------------------
// For each opted-in member, finds their single weakest assessed unit per
// subject (same pct calc as topWeakUnits() in public/shared/mastery.js,
// ported here since this needs to run server-side across every member's own
// raw mastery data -- something no member should be able to read directly
// about another). Then counts, across members, how many times each
// (subject, unit) pair was *someone's* single weakest unit, and ranks by
// that count -- "3 of 5 members are weakest on Geometry - Circle Theorems."
export interface WeakSpotAgg {
  subject: string;
  subjectLabel: string;
  unitId: string;
  unitName: string;
  memberCount: number;
}

// Exported for quest-routes.ts's boss target -- the single-student version
// (not the group aggregate below) of "what's this student's weakest spot".
export function memberWeakestUnit(blob: ProgressBlob): { subject: string; unitId: string; pct: number } | null {
  let weakest: { subject: string; unitId: string; pct: number } | null = null;
  for (const subject of SUBJECTS) {
    const mastery = (blob as unknown as Record<string, { mastery?: Record<string, { correct: number; total: number }> }>)[subject]?.mastery;
    if (!mastery) continue;
    for (const [unitId, rec] of Object.entries(mastery)) {
      if (!rec || rec.total < 2) continue;
      const pct = Math.round((rec.correct / rec.total) * 100);
      if (!weakest || pct < weakest.pct) weakest = { subject, unitId, pct };
    }
  }
  return weakest;
}

export function unitLabel(subject: string, unitId: string): string {
  return SUBJECT_UNIT_NAMES[subject]?.[unitId] || `Unit ${unitId}`;
}

// Subject display labels mirror LB_SUBJECTS in public/leaderboards/index.html.
export const SUBJECT_LABELS: Record<string, string> = {
  geometry: "Geometry", chemistry: "Chemistry", algebra1: "Algebra I", algebra2: "Algebra II",
  aplang: "AP English Lang & Comp", globalhistory: "Global History", apbiology: "AP Biology", apush: "APUSH",
  "us-history": "US History", physics: "Physics", biology: "Biology", precalc: "PreCalculus",
  "act-prep": "ACT Prep", anatomy: "Anatomy & Physiology", "ap-chemistry": "AP Chemistry", "ap-csa": "AP Computer Science A",
  "ap-euro": "AP European History", "ap-macro": "AP Macroeconomics", "ap-micro": "AP Microeconomics",
  "ap-physics": "AP Physics 1", "ap-psych": "AP Psychology", "ap-stats": "AP Statistics", "ap-usgov": "AP US Government",
  "ap-world": "AP World History", "ap-human-geography": "AP Human Geography", "art-history": "Art History",
  astronomy: "Astronomy", "computer-science": "Computer Science", "creative-writing": "Creative Writing",
  "earth-science": "Earth Science", economics: "Economics", "english-10": "English 10", "english-9": "English 9",
  "environmental-science": "Environmental Science", "french-1": "French 1", geography: "Geography", "german-1": "German 1",
  health: "Health", journalism: "Journalism", "music-theory": "Music Theory", psychology: "Psychology",
  "sat-math": "SAT Math Prep", "sat-reading": "SAT Reading & Writing", sociology: "Sociology", "spanish-1": "Spanish 1",
  "spanish-2": "Spanish 2", "spanish-3": "Spanish 3", "speech-debate": "Speech & Debate", statistics: "Statistics",
  "study-skills": "Study Skills", "us-government": "US Government", "world-history": "World History",
  calculus: "Calculus", "calc-ab": "AP Calculus AB", "calc-bc": "AP Calculus BC"
};

export function computeWeakSpots(memberBlobs: ProgressBlob[]): WeakSpotAgg[] {
  const counts = new Map<string, WeakSpotAgg>();
  for (const blob of memberBlobs) {
    const weakest = memberWeakestUnit(blob);
    if (!weakest) continue;
    const key = weakest.subject + ":" + weakest.unitId;
    const existing = counts.get(key);
    if (existing) {
      existing.memberCount++;
    } else {
      counts.set(key, {
        subject: weakest.subject,
        subjectLabel: SUBJECT_LABELS[weakest.subject] || weakest.subject,
        unitId: weakest.unitId,
        unitName: unitLabel(weakest.subject, weakest.unitId),
        memberCount: 1
      });
    }
  }
  return [...counts.values()].sort((a, b) => b.memberCount - a.memberCount);
}

// GET /api/study-group -- returns the caller's group name, member roster
// (handle + this-week stats, computed the same way computeGroupBoard() in
// leaderboard-routes.ts does -- reusing its weeklyDelta/activeDaysThisWeek/
// mondayUTC/displayNameFor helpers directly rather than re-deriving weekly
// numbers a second way), and the weak-spots aggregate. Requires the caller
// to be an opted-in member of a group -- a non-member (or non-opted-in
// visitor) gets nothing back about that group's roster or weak spots.
export async function handleGetStudyGroup(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const selfBlob = await loadBlob(env, session.email);
  if (!selfBlob.leaderboard?.optedIn) return json({ error: "Opt in to leaderboards to use study groups" }, 401);
  const code = selfBlob.leaderboard.groupCode;
  if (!code) return json({ error: "You're not in a group" }, 400);

  const group = await loadGroup(env, code);
  if (!group) return json({ error: "That group doesn't exist" }, 404);
  const isMember = group.members.some(e => e.toLowerCase() === session.email.toLowerCase());
  if (!isMember) return json({ error: "You're not a member of this group" }, 403);

  const today = new Date().toISOString().slice(0, 10);
  const monday = mondayUTC(new Date());

  const memberBlobs: ProgressBlob[] = [];
  const roster: { handle: string; xp: number; questions: number; activeDaysThisWeek: number }[] = [];
  for (const email of group.members) {
    const blob = await loadBlob(env, email);
    if (!blob.leaderboard?.optedIn) continue;
    memberBlobs.push(blob);

    const history = Array.isArray(blob.history) ? blob.history : [];
    roster.push({
      handle: displayNameFor(blob.leaderboard),
      xp: weeklyDelta(history, "xp", monday),
      questions: weeklyDelta(history, "totalAnswered", monday),
      activeDaysThisWeek: activeDaysThisWeek(blob.streak?.recentActiveDates, monday, today)
    });
  }

  const weakSpots = computeWeakSpots(memberBlobs);

  return json({
    ok: true,
    groupCode: code,
    name: group.name || null,
    memberCount: group.members.length,
    roster,
    weakSpots
  });
}
