import { getCanvasToken } from "./canvas-token.js";
import type { Assignment } from "./google-sync.js";

interface CanvasFeed {
  connected: boolean;
  items: Assignment[];
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
    const res = await fetch(`https://${token.domain}/api/v1/users/self/upcoming_events`, {
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
