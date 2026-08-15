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
import { handleGetProgress, handlePostProgress, handlePostGoal, handlePostEnrolledSubjects } from "./progress-routes.js";
import { handlePushSubscribe, handlePushUnsubscribe, handlePushTest, sendDailyReminders } from "./push-routes.js";

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

export default {
  async fetch(request, env) {
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

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendDailyReminders(env));
  }
};
