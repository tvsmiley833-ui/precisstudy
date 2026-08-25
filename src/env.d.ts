// Shared Cloudflare bindings, declared once for the whole worker.
// KVNamespace / Fetcher / Ai / SendEmail come from @cloudflare/workers-types
// (loaded globally via tsconfig "types"); this only names the Env shape.

interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  MAGIC_LINKS: KVNamespace;
  GUIDE_REQUESTS: KVNamespace;
  PROGRESS: KVNamespace;
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
}
