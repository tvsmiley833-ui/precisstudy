// Runtime cache, not a precache: pages are cached as students actually visit
// them, so this needs no hardcoded list of the 50+ guide routes to keep in
// sync. Pages and /shared/ code are network-first (cache only as the offline
// fallback): shared modules are imported without version strings, so serving
// them stale could pair an old module with a new page. Everything else
// (images, fonts) is stale-while-revalidate. /api and /auth are always
// network-only -- caching signed-in student data would be stale/wrong the
// moment it's out of date, and those routes already fail gracefully offline
// (see public/shared/mastery.js's catch blocks).
const CACHE_VERSION = "ss-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isCacheable(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return false;
  return true;
}

const OFFLINE = () => new Response("Offline and this page hasn't been visited before.", {
  status: 503,
  headers: { "Content-Type": "text/plain" }
});

function isNetworkFirst(request, url) {
  return request.mode === "navigate" || url.pathname.startsWith("/shared/") || url.pathname.endsWith("/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isCacheable(event.request, url)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const networkFetch = fetch(event.request).then((res) => {
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      });

      if (isNetworkFirst(event.request, url)) {
        try {
          return await networkFetch;
        } catch (e) {
          return (await cache.match(event.request)) || OFFLINE();
        }
      }

      const cached = await cache.match(event.request);
      if (cached) {
        // Stale-while-revalidate: serve the cached copy now, refresh it for next time.
        event.waitUntil(networkFetch.catch(() => null));
        return cached;
      }
      return networkFetch.catch(OFFLINE);
    })
  );
});
