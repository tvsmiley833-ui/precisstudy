import { getSession } from "./auth.js";
import { getGoogleToken, deleteGoogleToken } from "./google-token.js";
import {
  syncGoogleAssignments, googleCacheKey, DEFAULT_SETTINGS,
  type GoogleSettings, type Feed, type Assignment
} from "./google-sync.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

const CACHE_FRESH_MS = 15 * 60 * 1000;
const MAX_CALENDAR_IDS = 25;
const MAX_CALENDAR_ID_LEN = 512;

export function googleSettingsKey(email: string): string {
  return "gsettings:" + email;
}

async function loadSettings(env: { PROGRESS: KVNamespace }, email: string): Promise<GoogleSettings> {
  const raw = await env.PROGRESS.get(googleSettingsKey(email));
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    const calendarIds = Array.isArray(parsed?.calendarIds)
      ? parsed.calendarIds.filter((s: unknown): s is string => typeof s === "string")
      : DEFAULT_SETTINGS.calendarIds;
    return {
      calendarIds: calendarIds.length ? calendarIds : [...DEFAULT_SETTINGS.calendarIds],
      schoolworkOnly: parsed?.schoolworkOnly !== false
    };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function handleAssignments(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  const skipCache = new URL(request.url).searchParams.get("refresh") === "1";
  if (!skipCache) {
    const raw = await env.PROGRESS.get(googleCacheKey(session.email));
    if (raw) {
      try {
        const entry = JSON.parse(raw) as { items: Assignment[]; fetchedAt: string };
        const age = Date.now() - Date.parse(entry.fetchedAt);
        if (Number.isFinite(age) && age >= 0 && age < CACHE_FRESH_MS) {
          return json({ connected: true, items: entry.items, fetchedAt: entry.fetchedAt } satisfies Feed);
        }
      } catch (e) {
        // fall through to a fresh sync
      }
    }
  }

  const settings = await loadSettings(env, session.email);
  const feed = await syncGoogleAssignments(env, session.email, settings);
  return json(feed);
}

export async function handleGoogleCalendars(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  const token = await getGoogleToken(env, session.email);
  if (!token) return json({ connected: false, calendars: [] });

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token"
      })
    });
    const tokenData: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || typeof tokenData?.access_token !== "string") {
      return json({ connected: false, calendars: [] });
    }
    const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });
    if (!listRes.ok) return json({ connected: true, calendars: [] });
    const list: any = await listRes.json();
    const calendars = (Array.isArray(list?.items) ? list.items : []).map((c: any) => ({
      id: String(c.id),
      summary: typeof c.summary === "string" ? c.summary : String(c.id),
      primary: c.primary === true
    }));
    return json({ connected: true, calendars });
  } catch (e) {
    return json({ connected: true, calendars: [] });
  }
}

export async function handleGoogleDisconnect(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  const token = await getGoogleToken(env, session.email);
  if (token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token.refreshToken), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
    } catch (e) {
      // best-effort; the local deletion below is what matters
    }
  }
  await deleteGoogleToken(env, session.email);
  await env.PROGRESS.delete(googleCacheKey(session.email));
  await env.PROGRESS.delete(googleSettingsKey(session.email));
  return json({ ok: true });
}

export async function handleGoogleSettingsGet(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  const settings = await loadSettings(env, session.email);
  const token = await getGoogleToken(env, session.email);
  return json({ ...settings, googleEmail: token?.googleEmail ?? null, connected: !!token });
}

export async function handleGoogleSettingsPost(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const calendarIds = body?.calendarIds;
  if (
    !Array.isArray(calendarIds) ||
    calendarIds.length > MAX_CALENDAR_IDS ||
    !calendarIds.every((s: unknown) => typeof s === "string" && s.length > 0 && s.length <= MAX_CALENDAR_ID_LEN)
  ) {
    return json({ error: "calendarIds must be an array of up to 25 strings, each 512 chars or fewer" }, 400);
  }
  if (typeof body?.schoolworkOnly !== "boolean") {
    return json({ error: "schoolworkOnly must be a boolean" }, 400);
  }

  const value: GoogleSettings = { calendarIds, schoolworkOnly: body.schoolworkOnly };
  await env.PROGRESS.put(googleSettingsKey(session.email), JSON.stringify(value));
  await env.PROGRESS.delete(googleCacheKey(session.email));
  return json(value);
}
