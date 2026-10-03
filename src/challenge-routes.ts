import { getSession } from "./auth.js";
import { loadBlob, SUBJECTS, type ProgressBlob } from "./progress-routes.js";
import { generateHandle, displayNameFor } from "./leaderboard-routes.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

// Quiz content itself is client-side only (embedded QUIZ=[...] per subject
// page) -- the server never sees or stores question text/options/answers.
// A challenge only stores which question numbers (indexes into that
// subject's QUIZ array) were selected, plus each side's final score. Scoring
// happens in the browser, which already has the real QUIZ array loaded.
export interface ChallengeResult {
  correct: number;
  total: number;
  completedAt: string;
}

export interface Challenge {
  subjectKey: string;
  questionNumbers: number[];
  creatorEmail: string;
  creatorResult?: ChallengeResult;
  opponentEmail?: string;
  opponentResult?: ChallengeResult;
  createdAt: string;
  expiresAt: string;
}

const MAX_QUESTIONS = 20;
const MIN_QUESTIONS = 1;
const EXPIRY_DAYS = 14;

export function challengeKey(code: string): string {
  return "challenge:" + code;
}

// Same alphabet/style as the group-code generator in leaderboard-routes.ts
// (no 0/O/1/I -- read aloud / typed by a friend, not just pasted from a link).
const CHALLENGE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateChallengeCode(): string {
  // crypto, not Math.random: a code is the only thing protecting a challenge. 256 is a multiple of the alphabet size (32), so the modulo is unbiased.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += CHALLENGE_CODE_ALPHABET[b % CHALLENGE_CODE_ALPHABET.length];
  return code;
}

export async function loadChallenge(env: Env, code: string): Promise<Challenge | null> {
  if (!env.PROGRESS) return null;
  const raw = await env.PROGRESS.get(challengeKey(code));
  if (!raw) return null;
  try {
    const challenge = JSON.parse(raw) as Challenge;
    return isExpired(challenge) ? null : challenge;
  } catch (e) {
    return null;
  }
}

/** A challenge past its expiresAt (or with an unreadable one) no longer exists as far as anyone can tell. */
export function isExpired(challenge: Pick<Challenge, "expiresAt">, now = Date.now()): boolean {
  const t = Date.parse(challenge.expiresAt);
  return !Number.isFinite(t) || t <= now;
}

async function saveChallenge(env: Env, code: string, challenge: Challenge): Promise<void> {
  // Let KV drop it a day after it expires (KV needs at least 60 s), so abandoned challenges don't pile up forever.
  const secondsLeft = Math.ceil((Date.parse(challenge.expiresAt) - Date.now()) / 1000);
  const ttl = Math.max(60, (Number.isFinite(secondsLeft) ? secondsLeft : 0) + 24 * 60 * 60);
  await env.PROGRESS.put(challengeKey(code), JSON.stringify(challenge), { expirationTtl: ttl });
}

// Per-user list of challenge codes, so listing a user's challenges doesn't scan every challenge in KV.
const MAX_INDEXED_CHALLENGES = 50;
export function challengeIndexKey(email: string): string {
  return "chalidx:" + email.toLowerCase();
}
async function readIndex(env: Env, email: string): Promise<string[] | null> {
  const raw = await env.PROGRESS.get(challengeIndexKey(email));
  if (raw === null) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((c): c is string => typeof c === "string") : [];
  } catch (e) {
    return [];
  }
}
async function addToIndex(env: Env, email: string, code: string): Promise<void> {
  const cur = (await readIndex(env, email)) ?? [];
  const next = [code, ...cur.filter(c => c !== code)].slice(0, MAX_INDEXED_CHALLENGES);
  await env.PROGRESS.put(challengeIndexKey(email), JSON.stringify(next), { expirationTtl: (EXPIRY_DAYS + 2) * 24 * 60 * 60 });
}

// Ensures the caller has a stable handle to display, reusing the exact same
// leaderboard.handle/nickname identity fields -- a student doesn't need to be
// opted into leaderboards to use challenges, but if they already have a
// handle (from opting in) it's reused rather than minting a second identity.
async function ensureHandle(env: Env, email: string): Promise<{ handle: string; nickname: string | null }> {
  const blob = await loadBlob(env, email);
  if (blob.leaderboard?.handle) {
    return { handle: blob.leaderboard.handle, nickname: blob.leaderboard.nickname || null };
  }
  const handle = generateHandle();
  blob.leaderboard = {
    optedIn: blob.leaderboard?.optedIn || false,
    handle,
    nickname: blob.leaderboard?.nickname || null,
    groupCode: blob.leaderboard?.groupCode || null
  };
  blob.updatedAt = new Date().toISOString();
  await env.PROGRESS.put("progress:" + email, JSON.stringify(blob));
  return { handle, nickname: blob.leaderboard.nickname || null };
}

async function handleFor(env: Env, email: string): Promise<string> {
  const blob: ProgressBlob = await loadBlob(env, email);
  if (blob.leaderboard?.handle) return displayNameFor(blob.leaderboard as NonNullable<ProgressBlob["leaderboard"]>);
  const { handle, nickname } = await ensureHandle(env, email);
  return (nickname && nickname.trim()) || handle;
}

export async function handlePostChallengeCreate(request: Request, env: Env): Promise<Response> {
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
  const subjectKey = typeof rec.subjectKey === "string" ? rec.subjectKey : "";
  if (!SUBJECTS.includes(subjectKey)) return json({ error: "Invalid subject" }, 400);

  const questionNumbers = Array.isArray(rec.questionNumbers)
    ? rec.questionNumbers.filter(n => typeof n === "number" && Number.isInteger(n) && n >= 0)
    : [];
  if (questionNumbers.length < MIN_QUESTIONS || questionNumbers.length > MAX_QUESTIONS) {
    return json({ error: `Pick between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions` }, 400);
  }

  await ensureHandle(env, session.email);

  let code = generateChallengeCode();
  for (let i = 0; i < 5 && (await loadChallenge(env, code)); i++) code = generateChallengeCode();

  const now = new Date();
  const expires = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const challenge: Challenge = {
    subjectKey,
    questionNumbers,
    creatorEmail: session.email,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString()
  };
  await saveChallenge(env, code, challenge);
  await addToIndex(env, session.email, code);

  return json({ ok: true, code, subjectKey, questionCount: questionNumbers.length, expiresAt: challenge.expiresAt });
}

export async function handlePostChallengeClaim(request: Request, env: Env, code: string): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const challenge = await loadChallenge(env, code);
  if (!challenge) return json({ error: "That challenge doesn't exist or has expired" }, 404);

  if (challenge.creatorEmail.toLowerCase() === session.email.toLowerCase()) {
    return json({ error: "You can't claim your own challenge" }, 400);
  }
  if (challenge.opponentEmail && challenge.opponentEmail.toLowerCase() !== session.email.toLowerCase()) {
    return json({ error: "This challenge has already been claimed" }, 409);
  }

  if (!challenge.opponentEmail) {
    challenge.opponentEmail = session.email;
    await ensureHandle(env, session.email);
    await saveChallenge(env, code, challenge);
    await addToIndex(env, session.email, code);
  }

  return json({ ok: true, code, subjectKey: challenge.subjectKey, questionNumbers: challenge.questionNumbers });
}

export async function handlePostChallengeSubmit(request: Request, env: Env, code: string): Promise<Response> {
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
  const correct = typeof rec.correct === "number" && Number.isInteger(rec.correct) && rec.correct >= 0 ? rec.correct : null;
  const total = typeof rec.total === "number" && Number.isInteger(rec.total) && rec.total > 0 ? rec.total : null;
  if (correct === null || total === null || correct > total) {
    return json({ error: "Invalid result -- correct/total must be non-negative integers with correct <= total" }, 400);
  }

  const challenge = await loadChallenge(env, code);
  if (!challenge) return json({ error: "That challenge doesn't exist or has expired" }, 404);

  const email = session.email.toLowerCase();
  const isCreator = challenge.creatorEmail.toLowerCase() === email;
  const isOpponent = challenge.opponentEmail?.toLowerCase() === email;
  if (!isCreator && !isOpponent) return json({ error: "You're not a participant in this challenge" }, 403);

  const result: ChallengeResult = { correct, total, completedAt: new Date().toISOString() };
  if (isCreator) {
    if (challenge.creatorResult) return json({ error: "You've already submitted a result for this challenge" }, 409);
    challenge.creatorResult = result;
  } else {
    if (challenge.opponentResult) return json({ error: "You've already submitted a result for this challenge" }, 409);
    challenge.opponentResult = result;
  }
  await saveChallenge(env, code, challenge);

  return json({ ok: true, result });
}

export async function handleGetChallenge(request: Request, env: Env, code: string): Promise<Response> {
  if (!env.PROGRESS) return json({ error: "Not configured" }, 503);
  const challenge = await loadChallenge(env, code);
  if (!challenge) return json({ error: "That challenge doesn't exist or has expired" }, 404);

  const session = await getSession(request, env);
  const email = session?.email.toLowerCase();
  const isCreator = !!email && challenge.creatorEmail.toLowerCase() === email;
  const isOpponent = !!email && challenge.opponentEmail?.toLowerCase() === email;
  const role: "creator" | "opponent" | "none" = isCreator ? "creator" : isOpponent ? "opponent" : "none";

  // Never expose real emails -- always resolve to the anonymous
  // handle/nickname, same privacy rule as leaderboards/study groups.
  const creatorHandle = await handleFor(env, challenge.creatorEmail);
  const opponentHandle = challenge.opponentEmail ? await handleFor(env, challenge.opponentEmail) : null;

  return json({
    ok: true,
    code,
    subjectKey: challenge.subjectKey,
    questionCount: challenge.questionNumbers.length,
    questionNumbers: role === "none" ? undefined : challenge.questionNumbers,
    claimed: !!challenge.opponentEmail,
    creatorHandle,
    opponentHandle,
    creatorResult: challenge.creatorResult || null,
    opponentResult: challenge.opponentResult || null,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
    role
  });
}

// GET /api/challenges -- the calling student's own challenges (created or
// claimed), so they have a way back to pending ones without keeping the link.
// This scans progress:* the same way computeLeaderboards does for its own
// aggregate, but here it's a per-user index over challenge:* instead --
// acceptable at v1 scale (KV list + filter), revisit if challenge volume grows.
export async function handleGetChallenges(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  const email = session.email.toLowerCase();
  const results: Array<{ code: string; subjectKey: string; role: "creator" | "opponent"; claimed: boolean; done: boolean }> = [];

  let codes = await readIndex(env, email);
  if (codes === null) {
    // First look since the per-user index was introduced: rebuild it from a bounded scan (challenges expire after
    // 14 days, so this fallback fades away on its own), then use the index from now on.
    codes = [];
    let cursor: string | undefined;
    let scanned = 0;
    do {
      const list = await env.PROGRESS.list({ prefix: "challenge:", cursor });
      for (const key of list.keys) {
        if (scanned++ >= 500) break;
        const challenge = await loadChallenge(env, key.name.slice("challenge:".length));
        if (!challenge) continue;
        if (challenge.creatorEmail.toLowerCase() === email || challenge.opponentEmail?.toLowerCase() === email) codes.push(key.name.slice("challenge:".length));
      }
      cursor = list.list_complete || scanned >= 500 ? undefined : list.cursor;
    } while (cursor);
    await env.PROGRESS.put(challengeIndexKey(email), JSON.stringify(codes.slice(0, MAX_INDEXED_CHALLENGES)), { expirationTtl: (EXPIRY_DAYS + 2) * 24 * 60 * 60 });
  }

  for (const code of codes) {
    const challenge = await loadChallenge(env, code); // null once expired or deleted
    if (!challenge) continue;
    const isCreator = challenge.creatorEmail.toLowerCase() === email;
    const isOpponent = challenge.opponentEmail?.toLowerCase() === email;
    if (!isCreator && !isOpponent) continue;
    results.push({
      code,
      subjectKey: challenge.subjectKey,
      role: isCreator ? "creator" : "opponent",
      claimed: !!challenge.opponentEmail,
      done: !!(challenge.creatorResult && challenge.opponentResult)
    });
  }

  results.sort((a, b) => Number(a.done) - Number(b.done));
  return json({ ok: true, challenges: results });
}
