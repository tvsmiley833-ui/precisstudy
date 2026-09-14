// Runtime cache, not a precache: pages are cached as students actually visit
// them (cache-first, background revalidate), so this needs no hardcoded list
// of the 50+ guide routes to keep in sync. /api and /auth are always
// network-only -- caching signed-in student data would be stale/wrong the
// moment it's out of date, and those routes already fail gracefully offline
// (see public/shared/mastery.js's catch blocks).
const CACHE_VERSION = "ss-v1";

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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isCacheable(event.request, url)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Stale-while-revalidate: serve the cached copy instantly, refresh
        // the cache in the background for next time.
        networkFetch;
        return cached;
      }
      const fresh = await networkFetch;
      return fresh || new Response("Offline and this page hasn't been visited before.", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      });
    })
  );
});
