import { test } from "node:test";
import assert from "node:assert/strict";

function env({ focused = false, active = null } = {}) {
  const handlers = {};
  const mk = (name) => ({ addEventListener: (t, f) => { (handlers[name + t] ||= []).push(f); }, removeEventListener: (t, f) => { handlers[name + t] = (handlers[name + t] || []).filter(x => x !== f); } });
  const doc = { ...mk("d"), hidden: false, fullscreenElement: null, activeElement: active, hasFocus: () => focused, documentElement: {} };
  const win = mk("w");
  globalThis.document = doc; globalThis.window = win;
  const fire = (name, t) => (handlers[name + t] || []).slice().forEach(f => f());
  return { doc, fire, handlers };
}
const tick = () => new Promise(r => setTimeout(r, 5));
const mod = await import("../public/shared/exam-lockdown.js");

test("a fullscreen exit counts once and adds no time away", async () => {
  const e = env(); const warns = [];
  mod.enterLockdown(() => warns.push(1));
  e.doc.fullscreenElement = {}; e.fire("d", "fullscreenchange");
  e.doc.fullscreenElement = null; e.fire("d", "fullscreenchange");
  const s = mod.exitLockdown();
  assert.deepEqual([s.exitCount, s.totalTimeAwayMs], [1, 0]);
  assert.equal(warns.length, 1);
});

test("blur is ignored when the page still has focus or focus moved into an iframe", async () => {
  const a = env({ focused: true }); mod.enterLockdown(); a.fire("w", "blur"); await tick();
  assert.equal(mod.exitLockdown().exitCount, 0);
  const b = env({ focused: false, active: { tagName: "IFRAME" } }); mod.enterLockdown(); b.fire("w", "blur"); await tick();
  assert.equal(mod.exitLockdown().exitCount, 0);
  const c = env({ focused: false }); mod.enterLockdown(); c.fire("w", "blur"); await tick();
  assert.equal(mod.exitLockdown().exitCount, 1);
});

test("the warning is shown again when the student comes back", async () => {
  const e = env(); const warns = [];
  mod.enterLockdown(() => warns.push(1));
  e.doc.hidden = true; e.fire("d", "visibilitychange");
  e.doc.hidden = false; e.fire("d", "visibilitychange");
  assert.equal(warns.length, 2);
  mod.exitLockdown();
});

test("pagehide ends lockdown and removes every listener", () => {
  const e = env(); mod.enterLockdown();
  e.fire("w", "pagehide");
  assert.ok(Object.values(e.handlers).every(l => l.length === 0));
});
