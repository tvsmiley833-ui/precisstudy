import { isValidEmail, checkRateLimit, getClientIp, getSession } from "./auth.js";

const SUBMIT_RATE_LIMIT_MAX = 8;
const SUBMIT_RATE_LIMIT_WINDOW = 60 * 60; // 1 hour

function json(body: unknown, status?: number): Response {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

const MAX_MESSAGE_LEN = 2000;
const MAX_PAGE_LEN = 300;
const CATEGORIES = new Set(["bug", "idea", "praise", "other"]);

function validateFields(message: string, emailRaw: string, category: string): string | null {
  if (!message) return "Enter your feedback";
  if (message.length > MAX_MESSAGE_LEN) return "That's a bit long — keep it under 2000 characters";
  if (emailRaw && !isValidEmail(emailRaw)) return "Enter a valid email address, or leave it blank";
  if (category && !CATEGORIES.has(category)) return "Invalid category";
  return null;
}

// Public, unauthenticated endpoint (works for signed-out visitors too), so
// it's rate-limited by IP the same way /api/request-guide is.
export async function handleFeedbackSubmit(request: Request, env: Env): Promise<Response> {
  if (!env.FEEDBACK) return json({ error: "Feedback isn't configured yet" }, 503);

  const ip = getClientIp(request);
  const withinLimit = await checkRateLimit(env.FEEDBACK, "ratelimit:feedback:" + ip, SUBMIT_RATE_LIMIT_MAX, SUBMIT_RATE_LIMIT_WINDOW);
  if (!withinLimit) return json({ error: "Too much feedback submitted recently — try again in a bit" }, 429);

  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LEN) : "";
  const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const page = typeof body?.page === "string" ? body.page.trim().slice(0, MAX_PAGE_LEN) : "";

  const fieldError = validateFields(message, emailRaw, category);
  if (fieldError) return json({ error: fieldError }, 400);

  // A signed-in visitor's account email is more reliable than a hand-typed
  // one for following up, so prefer it when the explicit field is blank.
  const session = await getSession(request, env).catch(() => null);
  const email = emailRaw || session?.email || "";

  const feedbackId = Date.now() + ":" + crypto.randomUUID();
  await env.FEEDBACK.put("fb:" + feedbackId, JSON.stringify({
    message,
    email,
    category: category || "other",
    page,
    status: "new",
    submittedAt: new Date().toISOString()
  }));

  // Best-effort: the feedback is already saved and visible in the admin
  // panel regardless, so a notification failure shouldn't turn a successful
  // submission into an error for the visitor.
  try {
    await notifyAdminsOfNewFeedback(env, message, category, page);
  } catch (e) { /* ignore */ }

  return json({ ok: true });
}

async function notifyAdminsOfNewFeedback(env: Env, message: string, category: string, page: string): Promise<void> {
  if (!env.EMAIL || !env.ADMIN_EMAILS) return;
  const admins = env.ADMIN_EMAILS.split(",").map(e => e.trim()).filter(Boolean);
  if (!admins.length) return;
  const text = `New feedback (${category || "other"})${page ? " on " + page : ""}:\n\n${message}\n\nReview at https://precisstudy.com/admin`;
  await Promise.all(admins.map(to => env.EMAIL.send({
    to,
    from: "login@precisstudy.com",
    subject: `New feedback: ${category || "other"}`,
    text
  }).catch(() => {})));
}
