import { handleChatPost, handleChatOptions, json } from "./chat.js";
import { logError } from "./log.js";
import {
  handleGoogleStart,
  handleGoogleCallback,
  handleGithubStart,
  handleGithubCallback,
  handleEmailStart,
  handleVerify,
  handleVerifyConfirm,
  handleMe,
  handleLogout
} from "./auth-routes.js";
import { handleRequestGuideSubmit } from "./guide-requests.js";
import { handleAdminMe, handleAdminListGuideRequests, handleAdminDeleteGuideRequest, handleAdminStats, handleAdminGetGuideRequestFile } from "./admin-routes.js";
import { handleGetProgress, handlePostProgress, handlePostGoal, handlePostEnrolledSubjects, handlePostSchedule, handlePostStreak } from "./progress-routes.js";
import { handlePushSubscribe, handlePushUnsubscribe, handlePushTest, sendDailyReminders, sendScheduledBlockReminders, sendStreakReminders } from "./push-routes.js";

const SUBJECT_PATHS = new Set(["geometry", "chemistry", "algebra1", "algebra2", "ap-lang", "global-history", "ap-biology", "apush", "physics", "biology", "precalc", "us-government", "spanish-1", "spanish-2", "earth-science", "economics", "english-9", "english-10", "world-history", "geography", "health", "psychology", "sociology", "statistics", "computer-science", "art-history", "music-theory", "spanish-3", "french-1", "german-1", "environmental-science", "anatomy", "astronomy", "creative-writing", "journalism", "speech-debate", "ap-chemistry", "ap-physics", "ap-stats", "ap-csa", "ap-psych", "ap-world", "ap-euro", "ap-usgov", "ap-macro", "ap-micro", "sat-math", "sat-reading", "act-prep", "study-skills", "calculus", "calc-ab", "calc-bc", "us-history"]);
const SUBJECT_VIEW_SEGMENTS = new Set(["flashcards", "quiz", "examples", "exam", "reference", "memory"]);
const SUBJECT_VIEW_RE = /^\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/;

const AUTH_ROUTES: Record<string, Record<string, (request: Request, env: Env) => Promise<Response>>> = {
  "/auth/google/start": { GET: handleGoogleStart },
  "/auth/google/callback": { GET: handleGoogleCallback },
  "/auth/github/start": { GET: handleGithubStart },
  "/auth/github/callback": { GET: handleGithubCallback },
  "/auth/email/start": { POST: handleEmailStart },
  "/auth/verify": { GET: handleVerify, POST: handleVerifyConfirm },
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
// actually loads: Google AdSense (script + ad iframes) and Cloudflare's own
// Web Analytics beacon (auto-injected by the zone). Fonts are self-hosted
// (public/fonts/), so no fonts.googleapis.com / fonts.gstatic.com needed.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://cloudflareinsights.com",
  "frame-src https://*.doubleclick.net https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": CSP,
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()"
};

function withSecurityHeaders(response: Response): Response {
  const res = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(name, value);
  return res;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return withSecurityHeaders(await handleFetch(request, env));
    } catch (e) {
      // An unhandled rejection here would otherwise surface as Cloudflare's
      // bare 500 with none of SECURITY_HEADERS applied.
      const u = new URL(request.url);
      logError("worker.fetch", e, { method: request.method, path: u.pathname });
      return withSecurityHeaders(json({ error: "Internal error" }, 500));
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // A cron job that rejects would otherwise fail silently (no request, no
    // response) -- log it so Workers Logs shows which trigger broke and why.
    const run = (name: string, p: Promise<unknown>) =>
      ctx.waitUntil(p.catch((e) => logError("cron:" + name, e, { cron: controller.cron })));
    if (controller.cron === "*/5 * * * *") {
      run("blockReminders", sendScheduledBlockReminders(env));
      run("streakReminders", sendStreakReminders(env));
    } else {
      run("dailyReminders", sendDailyReminders(env));
    }
  }
};

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Google's site-verification HTML file must be served at this exact path with
  // no redirect -- Cloudflare's default asset routing 307s away the .html extension,
  // which Google's verifier won't follow. Bypass that here.
  if (url.pathname === "/google70342a91216260b3.html") {
    return new Response("google-site-verification: google70342a91216260b3.html", {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // Single canonical host. The Worker answers on studystacks.org, the www
  // variants, and *.workers.dev, all serving byte-identical pages whose
  // <link rel="canonical"> already points at precisstudy.com. Serving those
  // as 200s makes Search Console report every duplicate as "Alternate page
  // with proper canonical tag" and splits crawl/ranking signal across hosts.
  // 301 the safe methods to the canonical origin so there is one indexable
  // URL per page; non-idempotent methods fall through (the client always
  // calls /api and /auth on precisstudy.com already, and /auth self-bounces).
  // Google's file-based site verification does not follow redirects, so any
  // /google*.html token keeps serving on every host.
  if (
    url.hostname !== "precisstudy.com" &&
    (request.method === "GET" || request.method === "HEAD") &&
    !(url.pathname.startsWith("/google") && url.pathname.endsWith(".html"))
  ) {
    // Normalise a bare subject path to its trailing-slash form so an off-host
    // hit lands on the canonical URL in one hop instead of 301 -> 308.
    const seg = url.pathname.split("/").filter(Boolean);
    const path = (seg.length === 1 && SUBJECT_PATHS.has(seg[0]!)) ? `/${seg[0]}/` : url.pathname;
    return new Response(null, {
      status: 301,
      headers: {
        Location: "https://precisstudy.com" + path + url.search,
        "Cache-Control": "public, max-age=86400"
      }
    });
  }

  // Generated from SUBJECT_PATHS so it can never drift from the live routes the
  // way a checked-in sitemap.xml did (it listed 17 of 50+ pages).
  if (url.pathname === "/sitemap.xml") {
    const staticPages = ["/", "/about/", "/request/", "/privacy/", "/terms/"];
    const locs = [
      ...staticPages,
      ...[...SUBJECT_PATHS].sort().map(s => `/${s}/`)
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
      + locs.map(p => `  <url><loc>https://precisstudy.com${p}</loc></url>`).join("\n")
      + `\n</urlset>\n`;
    return new Response(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }
    });
  }

  if (url.pathname === "/api/chat") {
    if (request.method === "POST") return handleChatPost(request, env);
    if (request.method === "OPTIONS") return handleChatOptions(request);
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
  const subjectMatch = SUBJECT_VIEW_RE.exec(url.pathname);
  if (subjectMatch) {
    const subject = subjectMatch[1];
    const view = subjectMatch[2];
    if (subject && view && SUBJECT_PATHS.has(subject) && SUBJECT_VIEW_SEGMENTS.has(view)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = `/${subject}/`;
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
  }

  return env.ASSETS.fetch(request);
}