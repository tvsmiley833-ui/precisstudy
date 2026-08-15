import { isValidEmail, checkRateLimit, getClientIp } from "./auth.js";

const SUBMIT_RATE_LIMIT_MAX = 5;
const SUBMIT_RATE_LIMIT_WINDOW = 60 * 60; // 1 hour

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

const MAX_CLASS_LEN = 120;
const MAX_NOTES_LEN = 1000;
const MAX_FILES = 3;
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB per file
const MAX_TOTAL_SIZE = 15 * 1024 * 1024; // 15MB per request
const MAX_FILENAME_LEN = 200;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function validateFields(className, notes, emailRaw) {
  if (!className) return "Tell us which class or subject you need";
  if (className.length > MAX_CLASS_LEN) return "That class name is too long";
  if (emailRaw && !isValidEmail(emailRaw)) return "Enter a valid email address, or leave it blank";
  return null;
}

async function storeFiles(env, requestId, fileEntries) {
  const files = [];
  for (let i = 0; i < fileEntries.length; i++) {
    const f = fileEntries[i];
    const name = f.name ? String(f.name).slice(0, MAX_FILENAME_LEN) : `file-${i + 1}`;
    const type = f.type || "application/octet-stream";
    const fileKey = `reqfile:${requestId}:${i}`;
    const buf = await f.arrayBuffer();
    await env.GUIDE_REQUESTS.put(fileKey, buf, {
      metadata: { filename: name, contentType: type, size: f.size }
    });
    files.push({ key: fileKey, name, size: f.size, type });
  }
  return files;
}

export async function handleRequestGuideSubmit(request, env) {
  if (!env.GUIDE_REQUESTS) return json({ error: "Requests aren't configured yet" }, 503);

  // This is a public, unauthenticated endpoint that accepts file uploads up
  // to 15MB -- without a limit, it's an open invitation to storage-cost/spam
  // abuse. Keyed by IP rather than email since email is optional here.
  const ip = getClientIp(request);
  const withinLimit = await checkRateLimit(env.GUIDE_REQUESTS, "ratelimit:submit:" + ip, SUBMIT_RATE_LIMIT_MAX, SUBMIT_RATE_LIMIT_WINDOW);
  if (!withinLimit) return json({ error: "Too many requests submitted recently — try again in a bit" }, 429);

  const contentType = request.headers.get("Content-Type") || "";
  let className, notes, emailRaw, fileEntries;

  if (contentType.includes("application/json")) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON body" }, 400);
    }
    className = body && typeof body.className === "string" ? body.className.trim() : "";
    notes = body && typeof body.notes === "string" ? body.notes.trim().slice(0, MAX_NOTES_LEN) : "";
    emailRaw = body && typeof body.email === "string" ? body.email.trim() : "";
    fileEntries = [];
  } else {
    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return json({ error: "Invalid form submission" }, 400);
    }
    className = (form.get("className") || "").toString().trim();
    notes = (form.get("notes") || "").toString().trim().slice(0, MAX_NOTES_LEN);
    emailRaw = (form.get("email") || "").toString().trim();
    fileEntries = form.getAll("files").filter(f => f && typeof f === "object" && typeof f.arrayBuffer === "function" && f.size > 0);
  }

  const fieldError = validateFields(className, notes, emailRaw);
  if (fieldError) return json({ error: fieldError }, 400);

  if (fileEntries.length > MAX_FILES) return json({ error: `Attach at most ${MAX_FILES} files` }, 400);

  let totalSize = 0;
  for (const f of fileEntries) {
    if (f.size > MAX_FILE_SIZE) return json({ error: `${f.name} is too large (max 6MB per file)` }, 400);
    totalSize += f.size;
  }
  if (totalSize > MAX_TOTAL_SIZE) return json({ error: "Attachments are too large — 15MB total max" }, 400);
  for (const f of fileEntries) {
    if (f.type && !ALLOWED_TYPES.has(f.type)) {
      return json({ error: `${f.name}: unsupported file type` }, 400);
    }
  }

  const requestId = Date.now() + ":" + crypto.randomUUID();
  const files = fileEntries.length ? await storeFiles(env, requestId, fileEntries) : [];

  await env.GUIDE_REQUESTS.put("req:" + requestId, JSON.stringify({
    className,
    notes,
    email: emailRaw,
    files,
    submittedAt: new Date().toISOString()
  }));

  return json({ ok: true });
}
