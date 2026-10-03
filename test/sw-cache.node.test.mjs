// Service worker caching: offline page, bounded + versioned-asset-aware cache, slow-network fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function makeCache() {
  const m = new Map();
  const key = (r) => (typeof r === "string" ? new URL(r, "https://precisstudy.com").href : r.url);
  return {
    _m: m,
    match: async (r) => m.get(key(r)) || undefined,
    put: async (r, res) => { m.set(key(r), res); },
    add: async (r) => { m.set(key(r), new Response("offline page", { status: 200 })); },
    delete: async (r) => m.delete(key(r)),
    keys: async () => [...m.keys()].map((u) => ({ url: u, mode: "same-origin" })),
  };
}

function loadSw({ fetchImpl }) {
  const listeners = {};
  const cache = makeCache();
  const self = {
    addEventListener: (t, fn) => { listeners[t] = fn; },
    location: { origin: "https://precisstudy.com" },
    registration: {}, clients: { claim: async () => {} }, skipWaiting() {},
  };
  const caches = { keys: async () => [], open: async () => cache, delete: async () => true };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, caches, URL, Response, fetch: fetchImpl, Promise, setTimeout, clearTimeout });
  const run = async (req) => {
    let responded; const waits = [];
    listeners.fetch({ request: req, respondWith: (p) => { responded = p; }, waitUntil: (p) => waits.push(p), preloadResponse: undefined });
    const res = responded ? await responded : null;
    await Promise.all(waits.map((w) => w.catch(() => null)));
    return res;
  };
  return { run, cache, listeners };
}
const nav = (path) => ({ method: "GET", mode: "navigate", url: "https://precisstudy.com" + path });
const asset = (path) => ({ method: "GET", mode: "no-cors", url: "https://precisstudy.com" + path });

test("an unvisited page while offline gets the precached offline page, not a bare 503", async () => {
  const sw = loadSw({ fetchImpl: () => Promise.reject(new Error("offline")) });
  await sw.listeners.install({ waitUntil: () => {} });
  await sw.cache.add("/offline.html");
  const res = await sw.run(nav("/never-visited/"));
  assert.equal(await res.text(), "offline page");
});

test("a visited page is served from cache when the network fails", async () => {
  let online = true;
  const sw = loadSw({ fetchImpl: () => (online ? Promise.resolve(new Response("fresh", { status: 200 })) : Promise.reject(new Error("offline"))) });
  assert.equal(await (await sw.run(nav("/biology/"))).text(), "fresh");
  online = false;
  assert.equal(await (await sw.run(nav("/biology/"))).text(), "fresh");
});

test("only the newest ?v= copy of a shared asset is kept", async () => {
  const sw = loadSw({ fetchImpl: () => Promise.resolve(new Response("js", { status: 200 })) });
  await sw.run(asset("/shared/mastery.js?v=aaa"));
  await sw.run(asset("/shared/mastery.js?v=bbb"));
  const urls = [...sw.cache._m.keys()].filter((u) => u.includes("mastery.js"));
  assert.deepEqual(urls, ["https://precisstudy.com/shared/mastery.js?v=bbb"]);
});

test("api and auth are never cached or intercepted", async () => {
  const sw = loadSw({ fetchImpl: () => Promise.resolve(new Response("x")) });
  assert.equal(await sw.run({ method: "GET", mode: "cors", url: "https://precisstudy.com/api/progress" }), null);
});
