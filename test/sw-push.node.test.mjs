// public/sw.js must turn a push message into a visible notification and open the right page on click.
// The server (src/push-routes.ts) sends JSON {title, body, url}; the service worker used to have no push handler at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadSw() {
  const listeners = {};
  const shown = [];
  const opened = [];
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    location: { origin: "https://precisstudy.com" },
    registration: { showNotification: (title, opts) => { shown.push({ title, opts }); return Promise.resolve(); } },
    clients: {
      matchAll: () => Promise.resolve([]),
      openWindow: (url) => { opened.push(url); return Promise.resolve(); },
      claim: () => Promise.resolve(),
    },
    skipWaiting() {},
  };
  const ctx = { self, caches: { keys: () => Promise.resolve([]), open: () => Promise.resolve({}), delete: () => Promise.resolve() }, URL, Response, fetch: () => Promise.reject(new Error("offline")) };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), ctx);
  return { listeners, shown, opened };
}

function pushEvent(payload) {
  let waited;
  return {
    data: { json: () => JSON.parse(payload), text: () => payload },
    waitUntil: (p) => { waited = p; },
    done: () => waited,
  };
}

test("a push message becomes a notification with its title, body and target url", async () => {
  const { listeners, shown } = loadSw();
  assert.equal(typeof listeners.push, "function");
  const ev = pushEvent(JSON.stringify({ title: "Time to study", body: "Keep your streak going", url: "/dashboard" }));
  listeners.push(ev);
  await ev.done();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Time to study");
  assert.equal(shown[0].opts.body, "Keep your streak going");
  assert.equal(shown[0].opts.data.url, "/dashboard");
});

test("a push with a malformed or off-site url falls back to the dashboard", async () => {
  const { listeners, shown } = loadSw();
  for (const url of ["https://evil.example/", "//evil.example", 42, undefined]) {
    const ev = pushEvent(JSON.stringify({ title: "x", body: "y", url }));
    listeners.push(ev);
    await ev.done();
  }
  assert.ok(shown.every(s => s.opts.data.url === "/dashboard"));
});

test("a push with a non-JSON body still shows a notification", async () => {
  const { listeners, shown } = loadSw();
  const ev = pushEvent("plain text");
  listeners.push(ev);
  await ev.done();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "PrecisStudy");
});

test("clicking the notification closes it and opens the target page", async () => {
  const { listeners, opened } = loadSw();
  assert.equal(typeof listeners.notificationclick, "function");
  let closed = false, waited;
  listeners.notificationclick({
    notification: { close: () => { closed = true; }, data: { url: "/dashboard" } },
    waitUntil: (p) => { waited = p; },
  });
  await waited;
  assert.ok(closed);
  assert.deepEqual(opened, ["https://precisstudy.com/dashboard"]);
});
