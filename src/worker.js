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

    const authRoute = AUTH_ROUTES[url.pathname];
    if (authRoute) {
      const handler = authRoute[request.method];
      if (handler) return handler(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};
