import { getSession } from "./auth.js";
import { randomToken } from "./random-token.js";

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

interface Flashcard {
  front: string;
  back: string;
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

export async function handleGenerateFlashcards(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!env.AI) return json({ error: "Server not configured — Workers AI binding is missing" }, 500);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const text = body && typeof body === "object" && "text" in body ? (body as Record<string, unknown>).text : undefined;
  if (typeof text !== "string" || !text.trim()) return json({ error: "Paste some notes to generate flashcards from" }, 400);
  const notes = text.trim().slice(0, MAX_TEXT_CHARS);

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
