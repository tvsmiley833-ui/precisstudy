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
  handleLogout,
  handleSignOutEverywhere,
  handleDeleteAccount
} from "./auth-routes.js";
import { handleRequestGuideSubmit } from "./guide-requests.js";
import { handleAdminMe, handleAdminListGuideRequests, handleAdminDeleteGuideRequest, handleAdminUpdateGuideRequestStatus, handleAdminStats, handleAdminGetGuideRequestFile } from "./admin-routes.js";
import { handleGetProgress, handlePostProgress, handlePostProgressReset, handlePostGoal, handlePostEnrolledSubjects, handlePostSchedule, handlePostStreak, handlePostNotificationPrefs, recordDailySnapshots, handlePostShareGenerate, handlePostShareRevoke, handleGetShare } from "./progress-routes.js";
import { handleGenerateFlashcards, handleSaveFlashcards, handleDeleteFlashcards, handleReviewFlashcard } from "./flashcards-routes.js";
import { handlePushSubscribe, handlePushUnsubscribe, handlePushTest, sendDailyReminders, sendScheduledBlockReminders, sendStreakReminders } from "./push-routes.js";
import { handleGoogleConnectStart, handleGoogleConnectCallback } from "./google-connect.js";
import {
  handleAssignments, handleGoogleCalendars, handleGoogleDisconnect,
  handleGoogleSettingsGet, handleGoogleSettingsPost
} from "./google-routes.js";
import { handleCanvasConnect, handleCanvasDisconnect, handleCanvasStatus } from "./canvas-routes.js";

const SUBJECT_PATHS = new Set(["geometry", "chemistry", "algebra1", "algebra2", "ap-lang", "global-history", "ap-biology", "apush", "physics", "biology", "precalc", "us-government", "spanish-1", "spanish-2", "earth-science", "economics", "english-9", "english-10", "world-history", "geography", "health", "psychology", "sociology", "statistics", "computer-science", "art-history", "music-theory", "spanish-3", "french-1", "german-1", "environmental-science", "anatomy", "astronomy", "creative-writing", "journalism", "speech-debate", "ap-chemistry", "ap-physics", "ap-stats", "ap-csa", "ap-psych", "ap-world", "ap-euro", "ap-usgov", "ap-macro", "ap-micro", "ap-human-geography", "sat-math", "sat-reading", "act-prep", "study-skills", "calculus", "calc-ab", "calc-bc", "us-history"]);
const SUBJECT_VIEW_SEGMENTS = new Set(["flashcards", "quiz", "examples", "exam", "reference", "memory"]);

// {title suffix, description template} per view segment. %SUBJECT%/%QUIZ%/
// %CARDS% are substituted from the base page's own real title/description
// (parsed by rewriteViewMeta) -- never invented copy, just a more specific
// framing of counts already on the page.
const VIEW_META: Record<string, { title: string; description: string }> = {
  flashcards: { title: "Flashcards", description: "Study %SUBJECT% with %CARDS% free flashcards — flip through every term and definition. No sign-up." },
  quiz: { title: "Practice Quiz", description: "Practice %SUBJECT% with %QUIZ% free quiz questions covering every unit, with instant feedback. No sign-up." },
  exam: { title: "Practice Exam", description: "Take a full %SUBJECT% practice exam with real timing, built from %QUIZ% real questions. Free, no sign-up." },
  examples: { title: "Worked Examples", description: "Step-by-step worked examples for %SUBJECT%, covering every unit. Free, no sign-up." },
  reference: { title: "Quick Reference", description: "%SUBJECT% quick-reference formulas, terms, and definitions in one place. Free, no sign-up." },
  memory: { title: "Memory Tricks", description: "Mnemonics and memory tricks for %SUBJECT%, organized by unit. Free, no sign-up." }
};

// Rewrites <title> and the meta description for a subject sub-view (e.g.
// /geometry/quiz) using HTMLRewriter (native Workers runtime, no
// dependency) -- derives %SUBJECT%/%QUIZ%/%CARDS% from the base page's own
// already-real <title>/description (read once via a plain regex pass, far
// simpler than driving HTMLRewriter just to extract three strings) rather
// than a second data source, so this can't drift out of sync with what
// generate-guide.mjs baked in.
async function rewriteViewMeta(res: Response, view: string): Promise<Response> {
  const meta = VIEW_META[view];
  if (!meta || !res.headers.get("Content-Type")?.includes("text/html")) return res;

  const html = await res.clone().text();
  const titleText = /<title>([^<]*)<\/title>/.exec(html)?.[1] || "";
  const subject = /^(.+?) Study Guide/.exec(titleText)?.[1] || view;
  const descContent = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || "";
  const quizCount = /(\d+)\s+questions/.exec(descContent)?.[1] || "hundreds of";
  const cardsCount = /(\d+)\s+flashcards/.exec(descContent)?.[1] || "dozens of";

  const title = `${subject} ${meta.title} — PrecisStudy`;
  const description = meta.description
    .replace(/%SUBJECT%/g, subject)
    .replace(/%QUIZ%/g, quizCount)
    .replace(/%CARDS%/g, cardsCount);

  return new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute("content", description); } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute("content", title); } })
    .on('meta[property="og:description"]', { element(el) { el.setAttribute("content", description); } })
    .transform(res);
}

// The shared JS every page loads via a plain <script src="/shared/x.js">
// tag -- same list as `ls public/shared/*.js`. Kept as an explicit list
// (not read from disk at request time) so a typo here fails loudly in
// review rather than silently caching-forever a file nobody versioned.
const SHARED_JS_FILES = new Set(["celebrate.js", "chalk-cursor.js", "command-palette.js", "high-contrast.js", "mastery.js", "unit-titles.js"]);

// Per-isolate cache: hashing 6 small files is cheap, but there's no reason
// to redo it every request when the isolate will serve many requests
// before Cloudflare recycles it, and a fresh deploy always gets a fresh
// isolate (so this can't serve a version map for code that no longer
// exists).
let sharedAssetVersions: Map<string, string> | null = null;

async function getSharedAssetVersions(env: Env): Promise<Map<string, string>> {
  if (sharedAssetVersions) return sharedAssetVersions;
  const versions = new Map<string, string>();
  await Promise.all([...SHARED_JS_FILES].map(async file => {
    try {
      const res = await env.ASSETS.fetch(new Request(`https://precisstudy.com/shared/${file}`));
      if (!res.ok) return;
      const digest = await crypto.subtle.digest("SHA-256", await res.arrayBuffer());
      const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
      versions.set(file, hex);
    } catch (e) { /* leave that one file unversioned -- it still loads, just without long-lived caching */ }
  }));
  sharedAssetVersions = versions;
  return versions;
}

// Rewrites every <script src="/shared/x.js"> on the page to
// /shared/x.js?v=<hash-of-actual-current-bytes>, so the browser (and the
// long Cache-Control set for /shared/ requests carrying that query string,
// below) can cache it for a year without ever serving a stale copy after
// the next deploy -- a content change produces a different URL instead of
// invalidating the old one.
async function injectAssetVersions(res: Response, env: Env): Promise<Response> {
  if (!res.headers.get("Content-Type")?.includes("text/html")) return res;
  const versions = await getSharedAssetVersions(env);
  if (!versions.size) return res;
  return new HTMLRewriter()
    .on('script[src^="/shared/"]', {
      element(el) {
        const src = el.getAttribute("src");
        if (!src) return;
        const file = src.slice("/shared/".length).split("?")[0];
        const v = file && versions.get(file);
        if (v) el.setAttribute("src", `/shared/${file}?v=${v}`);
      }
    })
    .transform(res);
}

const SUBJECT_VIEW_RE = /^\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/;

const AUTH_ROUTES: Record<string, Record<string, (request: Request, env: Env) => Promise<Response>>> = {
  "/auth/google/start": { GET: handleGoogleStart },
  "/auth/google/callback": { GET: handleGoogleCallback },
  "/auth/github/start": { GET: handleGithubStart },
  "/auth/github/callback": { GET: handleGithubCallback },
  "/auth/email/start": { POST: handleEmailStart },
  "/auth/verify": { GET: handleVerify, POST: handleVerifyConfirm },
  "/auth/me": { GET: handleMe },
  "/auth/logout": { POST: handleLogout },
  "/auth/sign-out-everywhere": { POST: handleSignOutEverywhere },
  "/auth/delete-account": { POST: handleDeleteAccount },
  "/auth/google/connect/start": { GET: handleGoogleConnectStart },
  "/auth/google/connect/callback": { GET: handleGoogleConnectCallback }
};

// The page markup relies throughout on inline <script> blocks, inline
// onclick="..." handlers, and inline style="..." attributes, so a
// nonce/hash-based CSP isn't realistic without a much larger refactor --
// 'unsafe-inline' is required for script-src and style-src as a result.
// This still blocks the thing that matters most: loading any script,
// object, or frame from a host that isn't explicitly listed below, which
// stops a large class of injection payloads even though inline execution
// of the page's own script/style is allowed. Third-party origins the site
// actually loads: Google AdSense (script + ad iframes), Cloudflare's own
// Web Analytics beacon (auto-injected by the zone), and the optional Desmos
// graphing calculator embed (guide-template toolkit menu; inert unless
// DESMOS_API_KEY is configured in scripts/guide-template/logic.js). Fonts
// are self-hosted (public/fonts/), so no fonts.googleapis.com / fonts.gstatic.com needed.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://static.cloudflareinsights.com https://www.desmos.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://cloudflareinsights.com https://www.desmos.com",
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
      run("dailySnapshots", recordDailySnapshots(env));
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
    const staticPages = ["/", "/about/", "/request/", "/privacy/", "/terms/", "/parents-bill-of-rights/"];
    const sortedSubjects = [...SUBJECT_PATHS].sort();
    const locs = [
      ...staticPages,
      ...sortedSubjects.map(s => `/${s}/`),
      // Real, distinct, bookmarkable/shareable URLs (see the routing comment
      // above) -- listing them lets these get crawled and indexed with their
      // own rewritten title/description instead of staying undiscoverable.
      ...sortedSubjects.flatMap(s => [...SUBJECT_VIEW_SEGMENTS].sort().map(v => `/${s}/${v}`))
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
    if (request.method === "PATCH") return handleAdminUpdateGuideRequestStatus(request, env);
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

  if (url.pathname === "/api/progress/reset") {
    if (request.method === "POST") return handlePostProgressReset(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/share/generate") {
    if (request.method === "POST") return handlePostShareGenerate(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/share/revoke") {
    if (request.method === "POST") return handlePostShareRevoke(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/share") {
    if (request.method === "GET") return handleGetShare(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/goal") {
    if (request.method === "POST") return handlePostGoal(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/notification-prefs") {
    if (request.method === "POST") return handlePostNotificationPrefs(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/flashcards/generate") {
    if (request.method === "POST") return handleGenerateFlashcards(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/flashcards/save") {
    if (request.method === "POST") return handleSaveFlashcards(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/flashcards/delete") {
    if (request.method === "POST") return handleDeleteFlashcards(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/flashcards/review") {
    if (request.method === "POST") return handleReviewFlashcard(request, env);
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

  if (url.pathname === "/api/assignments") {
    if (request.method === "GET") return handleAssignments(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/google/calendars") {
    if (request.method === "GET") return handleGoogleCalendars(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/google/disconnect") {
    if (request.method === "POST") return handleGoogleDisconnect(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/google/settings") {
    if (request.method === "GET") return handleGoogleSettingsGet(request, env);
    if (request.method === "POST") return handleGoogleSettingsPost(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/canvas/connect") {
    if (request.method === "POST") return handleCanvasConnect(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/canvas/disconnect") {
    if (request.method === "POST") return handleCanvasDisconnect(request, env);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/canvas/status") {
    if (request.method === "GET") return handleCanvasStatus(request, env);
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
  // The <title>/description are rewritten per view (see rewriteViewMeta) so a search
  // result or a link shared for e.g. /geometry/flashcards accurately describes what's
  // there -- the underlying page (and everything the crawler indexes as content) is
  // still the same single-page guide, so this is metadata accuracy for real,
  // independently-linkable URLs, not a claim that these are separately-ranking pages.
  const subjectMatch = SUBJECT_VIEW_RE.exec(url.pathname);
  if (subjectMatch) {
    const subject = subjectMatch[1];
    const view = subjectMatch[2];
    if (subject && view && SUBJECT_PATHS.has(subject) && SUBJECT_VIEW_SEGMENTS.has(view)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = `/${subject}/`;
      const res = await env.ASSETS.fetch(new Request(assetUrl, request));
      return injectAssetVersions(await rewriteViewMeta(res, view), env);
    }
  }

  // A request for one of the shared JS files WITH the ?v=<hash> query
  // string this Worker itself injects (see injectAssetVersions) is safe to
  // cache for a year: the hash is the actual file's content, so a future
  // edit produces a different URL instead of invalidating this one. A bare
  // /shared/x.js request (no ?v=, e.g. someone's old bookmark or a stale
  // cached page from before this shipped) keeps the platform default so it
  // can't go stale indefinitely.
  if (url.pathname.startsWith("/shared/") && SHARED_JS_FILES.has(url.pathname.slice("/shared/".length))) {
    const res = await env.ASSETS.fetch(request);
    if (!url.searchParams.has("v")) return res;
    const headers = new Headers(res.headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(res.body, { status: res.status, headers });
  }

  return injectAssetVersions(await env.ASSETS.fetch(request), env);
}