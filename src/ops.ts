// Operations the owner can switch on without code changes: a health check, secret checks, nightly backups to R2, and
// retention cleanup. Each is inert until its binding or variable exists, so deploying this changes nothing on its own.
import { json } from "./http.js";
import { logError, logInfo } from "./log.js";

/** Secrets the site needs for its features; a missing one silently disables the feature, so report it. */
const REQUIRED_SECRETS = [
  "SESSION_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET",
  "ADMIN_EMAILS", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
] as const;

export function missingSecrets(env: Partial<Env>): string[] {
  return REQUIRED_SECRETS.filter((k) => !(env as Record<string, unknown>)[k]);
}

/** GET /api/health: 200 when KV answers, 503 when it doesn't. Names of missing secrets are never exposed, only their count. */
export async function handleHealth(env: Partial<Env>): Promise<Response> {
  let kv = true;
  try { await env.PROGRESS?.get("health:probe"); } catch (e) { kv = false; }
  const missing = missingSecrets(env).length;
  return json({ ok: kv, kv, missingSecrets: missing, time: new Date().toISOString() }, kv ? 200 : 503);
}

/** GET /api/config: public settings the browser needs (currently just the Turnstile site key). */
export function handleConfig(env: Partial<Env>): Response {
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null });
}

/** Logged on each daily run so a missing secret shows up in Workers Logs instead of a feature quietly doing nothing. */
export function logMissingSecrets(env: Partial<Env>): void {
  const missing = missingSecrets(env);
  if (missing.length) logError("missing-secrets", new Error("Worker secrets not set: " + missing.join(", ")), { missing });
}

// ---------------------------------------------------------------- Turnstile

/** True when no secret is configured (the check is off) or Cloudflare confirms the token. Fails closed when configured. */
export async function verifyTurnstile(env: Partial<Env>, token: unknown, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------- Retention

/** Keys written as "<prefix>:<epoch ms>:<uuid>"; returns the epoch ms or null. */
export function keyTimestamp(name: string, prefix: string): number | null {
  if (!name.startsWith(prefix)) return null;
  const n = Number(name.slice(prefix.length).split(":")[0]);
  return Number.isFinite(n) && n > 1e12 ? n : null;
}

/**
 * Deletes feedback and guide requests (and their attached files) older than RETENTION_DAYS. Off unless the variable is a
 * positive number. Bounded per run so it can never hit the subrequest limit; the next daily run continues.
 */
export async function runRetention(env: Partial<Env>, now = Date.now(), budget = 300): Promise<{ deleted: number }> {
  const days = Number(env.RETENTION_DAYS);
  if (!Number.isFinite(days) || days <= 0) return { deleted: 0 };
  const cutoff = now - days * 86400000;
  let deleted = 0;

  const sweep = async (kv: KVNamespace | undefined, prefix: string, extra?: (id: string) => Promise<number>) => {
    if (!kv) return;
    let cursor: string | undefined;
    do {
      const list = await kv.list({ prefix, cursor });
      for (const k of list.keys) {
        if (deleted >= budget) return;
        const ts = keyTimestamp(k.name, prefix);
        if (ts === null || ts >= cutoff) continue;
        await kv.delete(k.name);
        deleted++;
        if (extra) deleted += await extra(k.name.slice(prefix.length));
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor && deleted < budget);
  };

  await sweep(env.FEEDBACK, "fb:");
  await sweep(env.GUIDE_REQUESTS, "req:", async (id) => {
    let n = 0;
    const files = await env.GUIDE_REQUESTS!.list({ prefix: `reqfile:${id}:` });
    for (const f of files.keys) { await env.GUIDE_REQUESTS!.delete(f.name); n++; }
    return n;
  });
  if (deleted) logInfo("retention", { deleted, days });
  return { deleted };
}

// ---------------------------------------------------------------- Backups

const BACKUP_STATE_KEY = "backup:state";
const BACKUP_KEEP_DAYS = 30;
// Counters and caches that are cheap to rebuild and pointless to restore.
const SKIP_PREFIXES = ["chatday:", "rl:", "lb:", "cron:", "backup:", "qclaim:", "gcache:"];

interface BackupState { date: string; ns: "PROGRESS" | "FEEDBACK" | "GUIDE_REQUESTS"; cursor?: string; part: number; done: boolean }

const NAMESPACES: Array<"PROGRESS" | "FEEDBACK" | "GUIDE_REQUESTS"> = ["PROGRESS", "FEEDBACK", "GUIDE_REQUESTS"];

/**
 * Resumable nightly dump of the KV namespaces to R2 as NDJSON ({"key":…,"value":…} per line), 30 days kept. Does a bounded
 * slice per call (KV reads count against the subrequest limit); the five-minute cron keeps calling it until the day's dump is done.
 * Does nothing without the BACKUPS binding. Restore with scripts/restore-backup.mjs.
 */
export async function runBackup(env: Partial<Env>, opts: { start: boolean; batch?: number; today?: string } = { start: false }): Promise<{ written: number; done: boolean }> {
  const bucket = env.BACKUPS;
  if (!bucket || !env.PROGRESS) return { written: 0, done: true };
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const batch = opts.batch ?? 150;

  let state: BackupState | null = null;
  try { state = JSON.parse((await env.PROGRESS.get(BACKUP_STATE_KEY)) || "null"); } catch (e) { state = null; }
  if (!state || state.date !== today) {
    if (!opts.start) return { written: 0, done: true }; // the daily run begins a dump; the frequent run only continues one
    state = { date: today, ns: "PROGRESS", part: 0, done: false };
  }
  if (state.done) return { written: 0, done: true };

  const kv = env[state.ns];
  if (!kv) { state = nextNamespace(state); await env.PROGRESS.put(BACKUP_STATE_KEY, JSON.stringify(state), { expirationTtl: 3 * 86400 }); return { written: 0, done: state.done }; }

  const list = await kv.list({ cursor: state.cursor, limit: batch });
  const lines: string[] = [];
  for (const k of list.keys) {
    if (SKIP_PREFIXES.some((p) => k.name.startsWith(p))) continue;
    const { value, metadata } = await kv.getWithMetadata<unknown>(k.name, "arrayBuffer");
    if (value === null) continue;
    const bytes = new Uint8Array(value as ArrayBuffer);
    let text: string | null = null;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch (e) { text = null; }
    lines.push(JSON.stringify(text !== null ? { key: k.name, value: text, metadata } : { key: k.name, base64: btoa(String.fromCharCode(...bytes)), metadata }));
  }
  if (lines.length) await bucket.put(`backups/${today}/${state.ns.toLowerCase()}-${String(state.part).padStart(5, "0")}.ndjson`, lines.join("\n") + "\n");

  state = list.list_complete ? nextNamespace(state) : { ...state, cursor: list.cursor, part: state.part + 1 };
  await env.PROGRESS.put(BACKUP_STATE_KEY, JSON.stringify(state), { expirationTtl: 3 * 86400 });
  if (state.done) await pruneBackups(bucket, today);
  return { written: lines.length, done: state.done };
}

function nextNamespace(s: BackupState): BackupState {
  const i = NAMESPACES.indexOf(s.ns);
  const next = NAMESPACES[i + 1];
  return next ? { date: s.date, ns: next, part: 0, done: false } : { ...s, done: true };
}

async function pruneBackups(bucket: R2Bucket, today: string): Promise<void> {
  const cutoff = new Date(Date.parse(today) - BACKUP_KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  let cursor: string | undefined;
  do {
    const l = await bucket.list({ prefix: "backups/", cursor });
    const old = l.objects.map((o) => o.key).filter((k) => (k.split("/")[1] ?? "9999") < cutoff);
    if (old.length) await bucket.delete(old);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
}
