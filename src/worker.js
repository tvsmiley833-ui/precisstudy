import { handleChatPost, handleChatOptions, json } from "./chat.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method === "POST") return handleChatPost(request, env);
      if (request.method === "OPTIONS") return handleChatOptions();
      return json({ error: "Method not allowed" }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};
