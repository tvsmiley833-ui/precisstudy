import { getSession } from "./auth.js";
import { randomToken } from "./random-token.js";
import { ALLOWED_UPLOAD_TYPES, matchesDeclaredType } from "./file-validation.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

interface Flashcard {
  front: string;
  back: string;
  ease?: number;
  interval?: number;
  reps?: number;
  due?: string;
}

const SM2_MIN_EASE = 1.3;
const SM2_DEFAULT_EASE = 2.5;

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Standard SM-2, with the original 0-5 quality scale collapsed to the
// 4-button Again/Hard/Good/Easy rating most students recognize from Anki.
// Cards with no prior SRS state (undefined ease/interval/reps) start from
// the algorithm's own defaults, so an old deck saved before this feature
// shipped behaves exactly like a brand-new deck the first time it's rated.
export function sm2(card: Pick<Flashcard, "ease" | "interval" | "reps">, rating: "again" | "hard" | "good" | "easy"): { ease: number; interval: number; reps: number; due: string } {
  const ease = card.ease ?? SM2_DEFAULT_EASE;
  const reps = card.reps ?? 0;
  const interval = card.interval ?? 0;

  if (rating === "again") {
    return { ease, reps: 0, interval: 1, due: todayPlus(1) };
  }

  if (rating === "hard") {
    const nextInterval = Math.max(1, Math.round(interval * 1.2));
    const nextEase = Math.max(SM2_MIN_EASE, ease - 0.15);
    return { ease: nextEase, reps: reps + 1, interval: nextInterval, due: todayPlus(nextInterval) };
  }

  // good or easy: same rep-based progression, "easy" adds a bonus multiplier
  // and nudges ease up instead of leaving it unchanged.
  let nextInterval: number;
  if (reps === 0) nextInterval = 1;
  else if (reps === 1) nextInterval = 6;
  else nextInterval = Math.round(interval * ease);

  const nextEase = rating === "easy" ? ease + 0.15 : ease;
  if (rating === "easy") nextInterval = Math.round(nextInterval * 1.3);

  return { ease: nextEase, reps: reps + 1, interval: nextInterval, due: todayPlus(nextInterval) };
}

interface FlashcardDeck {
  id: string;
  name: string;
  cards: Flashcard[];
  createdAt: string;
}

// Mirrors the ProgressBlob shape push-routes.ts keeps for itself -- each
// route file types only the fields it touches rather than sharing one god
// type across the whole blob.
interface ProgressBlob {
  customDecks?: FlashcardDeck[];
}

async function loadBlob(env: Env, email: string): Promise<ProgressBlob> {
  if (!env.PROGRESS) return {};
  const raw = await env.PROGRESS.get("progress:" + email);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

const MAX_TEXT_CHARS = 6000;
const MAX_CARDS = 20;
const MIN_CARDS = 5;
const MAX_FIELD_CHARS = 300;
const MAX_DECKS = 20;
const MAX_DECK_NAME_CHARS = 80;

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `You turn a student's notes into flashcards for studying. Read the notes and produce between ${MIN_CARDS} and ${MAX_CARDS} flashcards covering the key facts, terms, and concepts.

Respond with ONLY a JSON array, no other text, no markdown code fences. Each element must be an object with exactly two string fields: "front" (a short question or term) and "back" (a concise answer or definition, under 2 sentences).

Example response:
[{"front":"What is photosynthesis?","back":"The process by which plants convert light energy into chemical energy stored in glucose."}]`;

function extractJsonArray(text: string): string {
  // Models sometimes wrap the array in a code fence or a sentence despite
  // instructions -- pull out the first [...] span rather than failing on
  // anything but a bare array.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

function sanitizeCards(raw: unknown): Flashcard[] {
  if (!Array.isArray(raw)) return [];
  const cards: Flashcard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const front = (item as Record<string, unknown>).front;
    const back = (item as Record<string, unknown>).back;
    if (typeof front !== "string" || typeof back !== "string") continue;
    const f = front.trim().slice(0, MAX_FIELD_CHARS);
    const b = back.trim().slice(0, MAX_FIELD_CHARS);
    if (!f || !b) continue;
    cards.push({ front: f, back: b });
    if (cards.length >= MAX_CARDS) break;
  }
  return cards;
}

const MAX_UPLOAD_SIZE = 8 * 1024 * 1024; // 8MB -- one document, not the multi-file allowance guide-requests.ts has

// Extracts study-note text from either a pasted-text JSON body (unchanged
// behavior) or an uploaded document (multipart/form-data, field "file").
// PDFs/DOCs/images go through Workers AI's toMarkdown() -- same AI binding
// already used for generation, no new dependency or third-party service --
// text/plain is read directly since there's nothing to convert.
async function extractNotesFromRequest(request: Request, env: Env): Promise<{ notes?: string; error?: string; status?: number }> {
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch (e) {
      return { error: "Invalid form submission", status: 400 };
    }
    const file = form.get("file");
    if (!file || typeof file === "string" || !("arrayBuffer" in file) || file.size === 0) {
      return { error: "Attach a file, or paste your notes instead", status: 400 };
    }
    if (file.size > MAX_UPLOAD_SIZE) return { error: "That file is too large (max 8MB)", status: 400 };
    if (file.type && !ALLOWED_UPLOAD_TYPES.has(file.type)) return { error: "Unsupported file type — PDF, DOC, DOCX, TXT, PNG, JPG, or WEBP only", status: 400 };

    const buf = await file.arrayBuffer();
    if (file.type && !matchesDeclaredType(buf, file.type)) return { error: "That file's content doesn't match its declared type", status: 400 };

    if (file.type === "text/plain") {
      return { notes: new TextDecoder().decode(buf) };
    }
    try {
      const result = await env.AI.toMarkdown({ name: file.name || "upload", blob: new Blob([buf], { type: file.type }) });
      if (result.format === "error") return { error: "Couldn't read that file — try a different one, or paste the text instead", status: 502 };
      return { notes: result.data };
    } catch (e) {
      return { error: "Couldn't read that file — try a different one, or paste the text instead", status: 502 };
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return { error: "Invalid JSON body", status: 400 };
  }
  const text = body && typeof body === "object" && "text" in body ? (body as Record<string, unknown>).text : undefined;
  if (typeof text !== "string" || !text.trim()) return { error: "Paste some notes to generate flashcards from", status: 400 };
  return { notes: text };
}

export async function handleGenerateFlashcards(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.AI) return json({ error: "Server not configured — Workers AI binding is missing" }, 500);

  const extracted = await extractNotesFromRequest(request, env);
  if (extracted.error) return json({ error: extracted.error }, extracted.status || 400);
  if (!extracted.notes || !extracted.notes.trim()) return json({ error: "Couldn't find any readable text in that file" }, 400);
  const notes = extracted.notes.trim().slice(0, MAX_TEXT_CHARS);

  let result: { response?: string; result?: string };
  try {
    result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: notes }
      ],
      max_tokens: 1800
    });
  } catch (e) {
    return json({ error: "Could not reach AI provider" }, 502);
  }

  const raw = (result && (result.response || result.result)) || "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(raw));
  } catch (e) {
    return json({ error: "Couldn't generate flashcards from that text — try again or shorten it." }, 502);
  }

  const cards = sanitizeCards(parsed);
  if (!cards.length) return json({ error: "Couldn't generate flashcards from that text — try again or shorten it." }, 502);

  return json({ cards });
}

export async function handleSaveFlashcards(request: Request, env: Env): Promise<Response> {
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
  const name = typeof rec.name === "string" ? rec.name.trim().slice(0, MAX_DECK_NAME_CHARS) : "";
  const cards = sanitizeCards(rec.cards);
  if (!name) return json({ error: "Give this deck a name" }, 400);
  if (!cards.length) return json({ error: "A deck needs at least one card" }, 400);

  const blob = await loadBlob(env, session.email);
  const decks = Array.isArray(blob.customDecks) ? blob.customDecks : [];
  const deck: FlashcardDeck = { id: randomToken(), name, cards, createdAt: new Date().toISOString() };
  decks.push(deck);
  while (decks.length > MAX_DECKS) decks.shift();
  blob.customDecks = decks;

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, deck });
}

export async function handleDeleteFlashcards(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.PROGRESS) return json({ error: "Progress sync isn't configured yet" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const id = body && typeof body === "object" && "id" in body ? (body as Record<string, unknown>).id : undefined;
  if (typeof id !== "string" || !id) return json({ error: "Missing deck id" }, 400);

  const blob = await loadBlob(env, session.email);
  const decks = Array.isArray(blob.customDecks) ? blob.customDecks : [];
  blob.customDecks = decks.filter(d => d.id !== id);

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true });
}

const SM2_RATINGS = new Set(["again", "hard", "good", "easy"]);

export async function handleReviewFlashcard(request: Request, env: Env): Promise<Response> {
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
  const deckId = rec.deckId;
  const cardIndex = rec.cardIndex;
  const rating = rec.rating;
  if (typeof deckId !== "string" || !deckId) return json({ error: "Missing deckId" }, 400);
  if (typeof cardIndex !== "number" || !Number.isInteger(cardIndex) || cardIndex < 0) return json({ error: "Invalid cardIndex" }, 400);
  if (typeof rating !== "string" || !SM2_RATINGS.has(rating)) return json({ error: "rating must be one of again/hard/good/easy" }, 400);

  const blob = await loadBlob(env, session.email);
  const decks = Array.isArray(blob.customDecks) ? blob.customDecks : [];
  const deck = decks.find(d => d.id === deckId);
  if (!deck) return json({ error: "Deck not found" }, 404);
  const card = deck.cards[cardIndex];
  if (!card) return json({ error: "Card not found" }, 404);

  const result = sm2(card, rating as "again" | "hard" | "good" | "easy");
  card.ease = result.ease;
  card.interval = result.interval;
  card.reps = result.reps;
  card.due = result.due;

  await env.PROGRESS.put("progress:" + session.email, JSON.stringify(blob));
  return json({ ok: true, card: { due: result.due, interval: result.interval } });
}
