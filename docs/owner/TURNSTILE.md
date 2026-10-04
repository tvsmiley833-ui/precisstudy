# Turnstile (spam check on public forms)

The feedback box and the guide-request form are open to anyone. The code is ready and **off** until you set two values.

## Your steps
1. Cloudflare dashboard → Turnstile → **Add widget**. Domains: `precisstudy.com` (and `www.precisstudy.com`). Mode: *Managed*. Copy the **site key** and **secret key**.
2. Set them:
   ```bash
   npx wrangler secret put TURNSTILE_SECRET        # paste the secret key
   ```
   and add the site key as a plain variable in `wrangler.jsonc` under `"vars"`: `"TURNSTILE_SITE_KEY": "0x4AAAA..."` (it is public by design).
3. `npm run deploy`. The widget now appears in the feedback dialog and the request form, and the server refuses submissions without a valid token.

Until then the honeypot field (already live) catches simple bots. Attachments could additionally require sign-in; tell me if you want that.
