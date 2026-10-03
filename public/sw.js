// Runtime cache, not a precache: pages are cached as students actually visit
// them, so this needs no hardcoded list of the 50+ guide routes to keep in
// sync. Pages and /shared/ code are network-first (cache only as the offline
// fallback): shared modules are imported without version strings, so serving
// them stale could pair an old module with a new page. Everything else
// (images, fonts) is stale-while-revalidate. /api and /auth are always
// network-only -- caching signed-in student data would be stale/wrong the
// moment it's out of date, and those routes already fail gracefully offline
// (see public/shared/mastery.js's catch blocks).
const CACHE_VERSION = "ss-v3";
const OFFLINE_URL = "/offline.html";
const NETWORK_TIMEOUT_MS = 4000; // a slow network falls back to the cached copy instead of hanging
const MAX_PAGES = 80; // bounded: oldest cached pages are dropped first

// Web push: src/push-routes.ts sends JSON {title, body, url}. Without these two handlers the
// browser shows a generic "site updated in the background" notice (or nothing) and Safari drops
// subscriptions that show no notification.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = typeof data.title === "string" && data.title ? data.title : "PrecisStudy";
  // Same-site paths only: "//host" and "/\host" would resolve to another origin.
  const url = typeof data.url === "string" && /^\/(?![\/\\])/.test(data.url) ? data.url : "/dashboard";
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/apple-touch-icon.png",
    badge: "/favicon.png",
    tag: "precisstudy-reminder",
    data: { url }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      if (w.url === target && "focus" in w) return w.focus();
    }
    return self.clients.openWindow(target);
  }));
});

self.addEventListener("install", (event) => {
  // The offline page is the one thing precached, so a first-ever offline visit still gets something useful.
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.add(OFFLINE_URL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(() => null) : null))
     .then(() => self.clients.claim())
  );
});

function isCacheable(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return false;
  return true;
}

const OFFLINE = async (request, cache) => {
  if (request && request.mode === "navigate") {
    const page = await cache.match(OFFLINE_URL);
    if (page) return page;
  }
  return new Response("Offline and this page hasn't been visited before.", { status: 503, headers: { "Content-Type": "text/plain" } });
};

// Versioned assets (?v=<hash>) change URL on every deploy; keep only the newest copy of each path.
async function putFresh(cache, request, res) {
  const url = new URL(request.url);
  if (url.searchParams.has("v")) {
    const stale = (await cache.keys()).filter((k) => {
      const u = new URL(k.url);
      return u.pathname === url.pathname && u.search !== url.search;
    });
    await Promise.all(stale.map((k) => cache.delete(k)));
  }
  await cache.put(request, res);
  if (request.mode === "navigate") {
    const pages = (await cache.keys()).filter((k) => k.mode === "navigate" || new URL(k.url).pathname.endsWith("/"));
    if (pages.length > MAX_PAGES) await Promise.all(pages.slice(0, pages.length - MAX_PAGES).map((k) => cache.delete(k)));
  }
}

function isNetworkFirst(request, url) {
  return request.mode === "navigate" || url.pathname.startsWith("/shared/") || url.pathname.endsWith("/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isCacheable(event.request, url)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const networkFetch = (async () => {
        // Navigation preload starts the request while this worker boots; use it instead of a second fetch.
        const pre = event.preloadResponse ? await event.preloadResponse : null;
        const res = pre || (await fetch(event.request));
        if (res.ok) event.waitUntil(putFresh(cache, event.request, res.clone()));
        return res;
      })();

      if (isNetworkFirst(event.request, url)) {
        const cached = await cache.match(event.request);
        try {
          if (!cached) return await networkFetch;
          // With a cached copy on hand, don't make the student wait on a slow network.
          return await Promise.race([
            networkFetch,
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), NETWORK_TIMEOUT_MS)),
          ]);
        } catch (e) {
          networkFetch.catch(() => null);
          return cached || (await OFFLINE(event.request, cache));
        }
      }

      const cached = await cache.match(event.request);
      if (cached) {
        // Stale-while-revalidate: serve the cached copy now, refresh it for next time.
        event.waitUntil(networkFetch.catch(() => null));
        return cached;
      }
      return networkFetch.catch(() => OFFLINE(event.request, cache));
    })
  );
});
