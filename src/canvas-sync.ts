import { fetchWithTimeout } from "./http.js";
import { getCanvasToken } from "./canvas-token.js";
import type { Assignment } from "./google-sync.js";

interface CanvasFeed {
  connected: boolean;
  items: Assignment[];
  fetchedAt?: string;
}

export type CanvasSyncMode = "always" | "hourly" | "daily" | "manual";
export const CANVAS_SYNC_MODES: CanvasSyncMode[] = ["always", "hourly", "daily", "manual"];
const TTL_MS: Record<CanvasSyncMode, number> = { always: 0, hourly: 3600_000, daily: 86_400_000, manual: Infinity };
export function canvasCacheKey(email: string): string { return "ccache:" + email.toLowerCase(); }

/** The student's chosen sync frequency (Settings > Canvas), read from the saved profile; "always" when unset. */
async function canvasMode(env: { PROGRESS: KVNamespace }, email: string): Promise<CanvasSyncMode> {
  try {
    const raw = await env.PROGRESS.get("progress:" + email);
    const m = (JSON.parse(raw || "{}") as { profile?: { canvasSync?: string } }).profile?.canvasSync;
    return CANVAS_SYNC_MODES.includes(m as CanvasSyncMode) ? (m as CanvasSyncMode) : "always";
  } catch (e) { return "always"; }
}

/** syncCanvasAssignments behind a cache whose lifetime is the student's chosen frequency. `force` (Sync now) always goes live. */
export async function syncCanvasCached(env: { PROGRESS: KVNamespace; SESSION_SECRET: string }, email: string, force = false): Promise<CanvasFeed> {
  const token = await getCanvasToken(env, email);
  if (!token) return { connected: false, items: [] };
  const mode = await canvasMode(env, email);
  if (!force && mode !== "always") {
    try {
      const hit = JSON.parse((await env.PROGRESS.get(canvasCacheKey(email))) || "null") as { items: Assignment[]; fetchedAt: string } | null;
      if (hit && Array.isArray(hit.items)) {
        const age = Date.now() - Date.parse(hit.fetchedAt);
        if (Number.isFinite(age) && age >= 0 && age < TTL_MS[mode]) return { connected: true, items: hit.items, fetchedAt: hit.fetchedAt };
        if (mode === "manual") return { connected: true, items: hit.items, fetchedAt: hit.fetchedAt };
      } else if (mode === "manual") return { connected: true, items: [] };
    } catch (e) { /* fall through to a live fetch */ }
  }
  const feed = await syncCanvasAssignments(env, email);
  const fetchedAt = new Date().toISOString();
  try { await env.PROGRESS.put(canvasCacheKey(email), JSON.stringify({ items: feed.items, fetchedAt })); } catch (e) { /* cache is best effort */ }
  return { ...feed, fetchedAt };
}

interface CanvasUpcomingEvent {
  id: number | string;
  title?: string;
  due_at?: string | null;
  html_url?: string | null;
}

// Canvas's own "what's due soon" endpoint -- a single call, no per-course
// enumeration needed (unlike Classroom, which has to list courses then
// fetch each course's coursework). Entries without due_at are plain
// calendar events, not assignments, and are dropped -- this feed is about
// assignments, matching what the Classroom side already provides.
export async function syncCanvasAssignments(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string
): Promise<CanvasFeed> {
  const token = await getCanvasToken(env, email);
  if (!token) return { connected: false, items: [] };

  try {
    const res = await fetchWithTimeout(`https://${token.domain}/api/v1/users/self/upcoming_events`, {
      headers: { Authorization: "Bearer " + token.apiToken }
    });
    if (!res.ok) return { connected: true, items: [] };
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return { connected: true, items: [] };

    const items: Assignment[] = [];
    for (const raw of data as CanvasUpcomingEvent[]) {
      if (!raw || typeof raw !== "object" || !raw.due_at) continue;
      items.push({
        id: "canvas-" + raw.id,
        source: "canvas",
        title: typeof raw.title === "string" ? raw.title : "Untitled assignment",
        courseName: null,
        dueAt: raw.due_at,
        allDay: false,
        link: raw.html_url || null,
        state: "todo"
      });
    }
    return { connected: true, items };
  } catch (e) {
    return { connected: true, items: [] };
  }
}
