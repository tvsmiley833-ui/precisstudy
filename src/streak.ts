// A stored streak only means something while it is still alive: it survives today and tomorrow's grace (lastActiveDate is
// today, or yesterday and still savable). Anything older has lapsed, whatever number was last written.

export interface StreakLike { current?: number; longest?: number; lastActiveDate?: string | null; timezone?: string | null; freezes?: number }

export const MAX_FREEZES = 2;
const FREEZE_EVERY = 7; // one freeze is earned each time the streak reaches a multiple of 7 days

function dayIn(timezone: string | null | undefined, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch (e) {
    return at.toISOString().slice(0, 10);
  }
}

/** The student's local today and yesterday as YYYY-MM-DD. */
export function localDays(timezone: string | null | undefined, now: Date = new Date()): { today: string; yesterday: string } {
  return { today: dayIn(timezone, now), yesterday: dayIn(timezone, new Date(now.getTime() - 24 * 3600 * 1000)) };
}

/** The streak length that is still alive right now; 0 once a day has been missed. */
export function effectiveStreak(streak: StreakLike | null | undefined, now: Date = new Date()): number {
  if (!streak || !(Number(streak.current) > 0) || !streak.lastActiveDate) return 0;
  const { today, yesterday } = localDays(streak.timezone, now);
  if (streak.lastActiveDate === today || streak.lastActiveDate === yesterday) return Number(streak.current);
  // One missed day is still savable while a freeze is banked: the next activity consumes it.
  const twoAgo = dayIn(streak.timezone, new Date(now.getTime() - 48 * 3600 * 1000));
  return streak.lastActiveDate === twoAgo && Number(streak.freezes) > 0 ? Number(streak.current) : 0;
}

function dayNumber(d: string): number { return Math.round(Date.parse(d + "T00:00:00Z") / 86400000); }

export interface StreakStep { current: number; longest: number; freezes: number; usedFreeze: boolean; earnedFreeze: boolean }

/**
 * The streak after activity on `localDate` (a new day, later than prev.lastActiveDate). A one-day gap continues the streak;
 * a two-day gap (exactly one missed day) is bridged by a banked freeze; anything else restarts at 1. Reaching a multiple of
 * 7 days earns a freeze, up to MAX_FREEZES.
 */
export function nextStreak(prev: StreakLike, localDate: string): StreakStep {
  const gap = prev.lastActiveDate ? dayNumber(localDate) - dayNumber(prev.lastActiveDate) : null;
  let freezes = Math.min(MAX_FREEZES, Math.max(0, Math.floor(Number(prev.freezes) || 0)));
  const before = Number(prev.current) || 0;
  let current = 1, usedFreeze = false;
  if (gap === 1) current = before + 1;
  else if (gap === 2 && freezes > 0 && before > 0) { current = before + 1; freezes--; usedFreeze = true; }
  const earnedFreeze = current > 1 && current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES;
  if (earnedFreeze) freezes++;
  return { current, longest: Math.max(Number(prev.longest) || 0, current), freezes, usedFreeze, earnedFreeze };
}
