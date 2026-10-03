// A stored streak only means something while it is still alive: it survives today and tomorrow's grace (lastActiveDate is
// today, or yesterday and still savable). Anything older has lapsed, whatever number was last written.

export interface StreakLike { current?: number; longest?: number; lastActiveDate?: string | null; timezone?: string | null }

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
  return streak.lastActiveDate === today || streak.lastActiveDate === yesterday ? Number(streak.current) : 0;
}
