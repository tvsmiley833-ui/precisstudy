import { handleChatPost, handleChatOptions, json } from "./chat.js";
import {
  handleGoogleStart,
  handleGoogleCallback,
  handleGithubStart,
  handleGithubCallback,
  handleEmailStart,
  handleVerify,
  handleMe,
  handleLogout
} from "./auth-routes.js";
import { handleRequestGuideSubmit } from "./guide-requests.js";
import { handleAdminMe, handleAdminListGuideRequests, handleAdminDeleteGuideRequest, handleAdminStats, handleAdminGetGuideRequestFile } from "./admin-routes.js";
import { handleGetProgress, handlePostProgress, handlePostGoal, handlePostEnrolledSubjects, handlePostSchedule, handlePostStreak } from "./progress-routes.js";
import { handlePushSubscribe, handlePushUnsubscribe, handlePushTest, sendDailyReminders, sendScheduledBlockReminders, sendStreakReminders } from "./push-routes.js";

const SUBJECT_PATHS = new Set(["geometry", "chemistry", "algebra1", "algebra2", "ap-lang", "global-history"]);
const SUBJECT_VIEW_SEGMENTS = new Set(["flashcards", "quiz", "examples", "exam", "reference", "memory"]);

const AUTH_ROUTES = {
  "/auth/google/start": { GET: handleGoogleStart },
  "/auth/google/callback": { GET: handleGoogleCallback },
  "/auth/github/start": { GET: handleGithubStart },
  "/auth/github/callback": { GET: handleGithubCallback },
  "/auth/email/start": { POST: handleEmailStart },
  "/auth/verify": { GET: handleVerify },
  "/auth/me": { GET: handleMe },
  "/auth/logout": { POST: handleLogout }
};

// The page markup relies throughout on inline <script> blocks, inline
// onclick="..." handlers, and inline style="..." attributes, so a
// nonce/hash-based CSP isn't realistic without a much larger refactor --
// 'unsafe-inline' is required for script-src and style-src as a result.
// This still blocks the thing that matters most: loading any script,
// object, or frame from a host that isn't explicitly listed below, which
// stops a large class of injection payloads even though inline execution
// of the page's own script/style is allowed. Third-party origins the site
// actually loads: Google AdSense (script + ad iframes), Google Fonts, and
// Cloudflare's own Web Analytics beacon (auto-injected by the zone).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://cloudflareinsights.com",
  "frame-src https://*.doubleclick.net https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": CSP,
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()"
};

function withSecurityHeaders(response) {
  const res = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(name, value);
  return res;
}

export default {
  async fetch(request, env) {
    return withSecurityHeaders(await handleFetch(request, env));
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(sendScheduledBlockReminders(env));
      ctx.waitUntil(sendStreakReminders(env));
    } else {
      ctx.waitUntil(sendDailyReminders(env));
    }
  }
};

async function handleFetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method === "POST") return handleChatPost(request, env);
      if (request.method === "OPTIONS") return handleChatOptions();
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/request-guide") {
      if (request.method === "POST") return handleRequestGuideSubmit(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/me") {
      if (request.method === "GET") return handleAdminMe(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/guide-requests") {
      if (request.method === "GET") return handleAdminListGuideRequests(request, env);
      if (request.method === "DELETE") return handleAdminDeleteGuideRequest(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/stats") {
      if (request.method === "GET") return handleAdminStats(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/guide-request-file") {
      if (request.method === "GET") return handleAdminGetGuideRequestFile(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/progress") {
      if (request.method === "GET") return handleGetProgress(request, env);
      if (request.method === "POST") return handlePostProgress(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/goal") {
      if (request.method === "POST") return handlePostGoal(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/enrolled-subjects") {
      if (request.method === "POST") return handlePostEnrolledSubjects(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/schedule") {
      if (request.method === "POST") return handlePostSchedule(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/streak") {
      if (request.method === "POST") return handlePostStreak(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/push/subscribe") {
      if (request.method === "POST") return handlePushSubscribe(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/push/unsubscribe") {
      if (request.method === "POST") return handlePushUnsubscribe(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/push/test") {
      if (request.method === "POST") return handlePushTest(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    const authRoute = AUTH_ROUTES[url.pathname];
    if (authRoute) {
      const handler = authRoute[request.method];
      if (handler) return handler(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    // Real per-view URLs (e.g. /geometry/quiz, /chemistry/flashcards) all serve the same
    // subject bundle -- the client reads the URL on load to activate the right tab, and
    // keeps the URL in sync as the student switches tabs, so each view is bookmarkable,
    // shareable, and survives back/forward and refresh instead of resetting to the guide.
    const subjectMatch = url.pathname.match(/^\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
    if (subjectMatch && SUBJECT_PATHS.has(subjectMatch[1]) && SUBJECT_VIEW_SEGMENTS.has(subjectMatch[2])) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = `/${subjectMatch[1]}/`;
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    return env.ASSETS.fetch(request);
}
