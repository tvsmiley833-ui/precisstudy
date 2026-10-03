// Everything we store about one person, removed in one place. Used by "Delete my account".
//
// Keys are written with the email exactly as the session carries it, but the old deletion code only
// removed lowercased keys and only three of them. This walks every per-user key and every reverse-lookup
// token, drops the person from group leaderboards and challenges, strips their address from feedback and
// guide requests, and revokes the Google grant.
import { getGoogleToken, googleTokenKey } from "./google-token.js";
import { canvasTokenKey } from "./canvas-token.js";
import { googleCacheKey } from "./google-sync.js";
import { googleSettingsKey } from "./google-routes.js";
import { syllabusDatesKey } from "./syllabus-dates.js";
import { groupKey } from "./leaderboard-routes.js";
import { challengeKey, challengeIndexKey } from "./challenge-routes.js";

const SCAN_LIMIT = 1000; // stay under the Worker's per-request KV operation limit

export interface DeletionReport {
  keysDeleted: number;
  groupsLeft: number;
  challengesDeleted: number;
  recordsScrubbed: number;
  googleRevoked: boolean;
  scanTruncated: boolean;
  canvasTokenRemoved: boolean;
}

function same(a: unknown, b: string): boolean {
  return typeof a === "string" && a.toLowerCase() === b.toLowerCase();
}

export async function deleteUserData(env: Env, sessionEmail: string): Promise<DeletionReport> {
  const report: DeletionReport = { keysDeleted: 0, groupsLeft: 0, challengesDeleted: 0, recordsScrubbed: 0, googleRevoked: false, scanTruncated: false, canvasTokenRemoved: false };
  const emails = [...new Set([sessionEmail, sessionEmail.toLowerCase()])];
  const kv = env.PROGRESS;
  const del = async (key: string): Promise<void> => {
    if (await kv.get(key) !== null) {
      await kv.delete(key);
      report.keysDeleted++;
    }
  };

  // 1. Read the progress blob(s) first: they name the reverse-lookup tokens and the group.
  const reverseKeys = new Set<string>();
  const groupCodes = new Set<string>();
  for (const e of emails) {
    const raw = await kv.get("progress:" + e);
    if (!raw) continue;
    try {
      const blob = JSON.parse(raw) as { shareToken?: string; calendarToken?: string; inviteToken?: string; leaderboard?: { groupCode?: string | null } };
      if (blob.shareToken) reverseKeys.add("share:" + blob.shareToken);
      if (blob.calendarToken) reverseKeys.add("cal:" + blob.calendarToken);
      if (blob.inviteToken) reverseKeys.add("invite:" + blob.inviteToken);
      if (blob.leaderboard?.groupCode) groupCodes.add(blob.leaderboard.groupCode);
    } catch (err) { /* unreadable blob: still delete it below */ }
  }

  // 2. Revoke the Google grant (best effort), then drop our copy of the token.
  for (const e of emails) {
    try {
      const token = env.SESSION_SECRET ? await getGoogleToken(env as { PROGRESS: KVNamespace; SESSION_SECRET: string }, e) : null;
      if (token?.refreshToken) {
        const res = await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token.refreshToken), {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (res.ok) report.googleRevoked = true;
      }
    } catch (err) { /* the grant can still be revoked from the Google account page */ }
  }

  // 3. Per-user keys, under both spellings of the address.
  for (const e of emails) {
    if (await kv.get(canvasTokenKey(e)) !== null) report.canvasTokenRemoved = true;
    for (const key of [
      "progress:" + e, "login:" + e.toLowerCase(), googleTokenKey(e), googleSettingsKey(e), googleCacheKey(e),
      syllabusDatesKey(e), canvasTokenKey(e), challengeIndexKey(e),
    ]) await del(key);
  }
  for (const key of reverseKeys) await del(key);

  // 4. Leaderboard groups: remove the member, delete the group when nobody is left.
  for (const code of groupCodes) {
    const raw = await kv.get(groupKey(code));
    if (!raw) continue;
    try {
      const group = JSON.parse(raw) as { members: string[] };
      const members = (group.members || []).filter(m => !emails.some(e => same(m, e)));
      if (members.length === (group.members || []).length) continue;
      report.groupsLeft++;
      if (members.length) await kv.put(groupKey(code), JSON.stringify({ ...group, members }));
      else { await kv.delete(groupKey(code)); report.keysDeleted++; }
    } catch (err) { /* leave an unreadable group alone */ }
  }

  // 5. Challenges (14-day objects) that name the person are removed.
  let ops = 0;
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: challengeKey(""), cursor });
    for (const k of page.keys) {
      if (ops++ >= SCAN_LIMIT) { report.scanTruncated = true; break; }
      const raw = await kv.get(k.name);
      if (!raw) continue;
      try {
        const c = JSON.parse(raw) as { creatorEmail?: string; opponentEmail?: string };
        if (emails.some(e => same(c.creatorEmail, e) || same(c.opponentEmail, e))) {
          await kv.delete(k.name);
          report.challengesDeleted++;
        }
      } catch (err) { /* skip */ }
    }
    cursor = page.list_complete || report.scanTruncated ? undefined : page.cursor;
  } while (cursor);

  // 6. Feedback and guide requests keep their text but lose the address.
  const stores: Array<[KVNamespace | undefined, string]> = [[env.FEEDBACK, "fb:"], [env.GUIDE_REQUESTS, "req:"]];
  for (const [store, prefix] of stores) {
    if (!store) continue;
    let c2: string | undefined;
    do {
      const page = await store.list({ prefix, cursor: c2 });
      for (const k of page.keys) {
        if (ops++ >= SCAN_LIMIT) { report.scanTruncated = true; break; }
        const raw = await store.get(k.name);
        if (!raw) continue;
        try {
          const rec = JSON.parse(raw) as { email?: string };
          if (emails.some(e => same(rec.email, e))) {
            rec.email = "";
            await store.put(k.name, JSON.stringify(rec));
            report.recordsScrubbed++;
          }
        } catch (err) { /* skip */ }
      }
      c2 = page.list_complete || report.scanTruncated ? undefined : page.cursor;
    } while (c2);
  }

  return report;
}
