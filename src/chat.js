// Object.create(null): SUBJECTS is indexed with a client-controlled path
// segment (see subjectFromReferer below). A plain {} object literal would
// let a Referer like "/constructor" or "/toString" resolve via the
// Object.prototype chain instead of falling through to undefined — a
// null-prototype object has no inherited keys to leak.
export const SUBJECTS = Object.assign(Object.create(null), {
  geometry: "You are a concise, friendly tutor helping a student study Geometry. Keep answers short (2-5 sentences), accurate, and focused on the question asked.",
  chemistry: "You are a concise, friendly tutor helping a student study Chemistry. Keep answers short (2-5 sentences), accurate, and focused on the question asked.",
  algebra1: "You are a concise, friendly tutor helping a student study Algebra I. Keep answers short (2-5 sentences), accurate, and focused on the question asked.",
  algebra2: "You are a concise, friendly tutor helping a student study Algebra II. Keep answers short (2-5 sentences), accurate, and focused on the question asked.",
  "ap-lang": "You are a concise, friendly tutor helping a student study for AP English Language and Composition. Keep answers short (2-5 sentences), accurate, and focused on the question asked.",
  "global-history": "You are a concise, friendly tutor helping a student study Global History. Keep answers short (2-5 sentences), accurate, and focused on the question asked."
});

export const DEFAULT_SUBJECT = "geometry";

const MAX_INPUT_CHARS = 2000;
const MAX_HISTORY = 9;

export function sanitizeMessages(historyRaw) {
  const raw = Array.isArray(historyRaw) ? historyRaw.slice(-MAX_HISTORY) : [];
  const mapped = raw
    .filter(m => m && m.content)
    .map(m => ({
      role: (m.role === "assistant" || m.role === "bot") ? "assistant" : "user",
      content: String(m.content).slice(0, MAX_INPUT_CHARS)
    }));

  const merged = [];
  for (const m of mapped) {
    if (merged.length && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += "\n\n" + m.content;
    } else {
      merged.push(m);
    }
  }

  while (merged.length && merged[0].role !== "user") merged.shift();
  while (merged.length && merged[merged.length - 1].role !== "user") merged.pop();

  return merged;
}

export function subjectFromReferer(refererHeader) {
  if (!refererHeader) return DEFAULT_SUBJECT;
  let path;
  try {
    path = new URL(refererHeader).pathname;
  } catch (e) {
    return DEFAULT_SUBJECT;
  }
  const segment = path.split("/").filter(Boolean)[0];
  return (segment && SUBJECTS[segment]) ? segment : DEFAULT_SUBJECT;
}

export const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

export function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export async function handleChatPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messages = sanitizeMessages(body && body.history);
  if (!messages.length) return json({ error: "Empty message" }, 400);

  if (!env.AI) return json({ error: "Server not configured — Workers AI binding is missing" }, 500);

  const subject = subjectFromReferer(request.headers.get("Referer"));
  const systemPrompt = SUBJECTS[subject];

  let result;
  try {
    result = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: systemPrompt }].concat(messages),
      max_tokens: 400
    });
  } catch (e) {
    return json({ error: "Could not reach AI provider", detail: String(e && e.message || e).slice(0, 300) }, 502);
  }

  const reply = (result && (result.response || result.result)) || "";
  return json({ reply: reply });
}

export function handleChatOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
