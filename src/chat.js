// Object.create(null): SUBJECTS is indexed with a client-controlled path
// segment (see subjectFromReferer below). A plain {} object literal would
// let a Referer like "/constructor" or "/toString" resolve via the
// Object.prototype chain instead of falling through to undefined — a
// null-prototype object has no inherited keys to leak.
export const SUBJECTS = Object.assign(Object.create(null), {
  geometry: "You are a concise, friendly tutor helping a student study for the NYS Geometry Regents exam. Keep answers short (2-5 sentences), accurate, and focused on the question asked."
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
