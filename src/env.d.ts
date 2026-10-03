// Shared Cloudflare bindings, declared once for the whole worker.
// KVNamespace / Fetcher / Ai / SendEmail come from @cloudflare/workers-types
// (loaded globally via tsconfig "types"); this only names the Env shape.

interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  MAGIC_LINKS: KVNamespace;
  GUIDE_REQUESTS: KVNamespace;
  PROGRESS: KVNamespace;
  FEEDBACK: KVNamespace;
  EMAIL: SendEmail;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ADMIN_EMAILS: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  CHAT_RATE_LIMIT: RateLimit;
  CLIENT_LOG_RATE_LIMIT: RateLimit;
  HEAVY_RATE_LIMIT: RateLimit; // AI / school-connection routes, per IP
  FORM_RATE_LIMIT: RateLimit; // public forms and the sign-in email, per IP
  CHAT_GLOBAL_RATE_LIMIT: RateLimit; // total chat throughput across everyone
  CHAT_DAILY_PER_IP?: string; // optional override of the per-IP daily chat cap
  AI_DAILY_PER_USER?: string; // optional override of the per-person daily AI-job cap
}
