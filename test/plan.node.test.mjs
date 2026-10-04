import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function load() {
  const store = new Map();
  const win = { dispatchEvent() {}, CustomEvent: class {} };
  const ctx = { window: win, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, CustomEvent: class {}, fetch: () => Promise.resolve({ ok: false }), Date, JSON, Math, parseInt, Promise };
  new Function(...Object.keys(ctx), readFileSync("public/shared/plan.js", "utf8"))(...Object.values(ctx));
  return { P: win.ssPlan, store };
}
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

test("several exams are kept sorted and ss-exam mirrors the nearest upcoming one", () => {
  const { P, store } = load();
  P.addExam(day(20), "Chem final", "chemistry");
  P.addExam(day(5), "Geometry test", "geometry");
  P.addExam(day(5), "Quiz", "");
  assert.equal(P.getExams().length, 3);
  assert.equal(P.getExams()[0].date, day(5));
  assert.equal(JSON.parse(store.get("ss-exam")).date, day(5));
  assert.equal(P.getExam().date, day(5));
});

test("removing the nearest exam moves ss-exam to the next one, and none clears it", () => {
  const { P, store } = load();
  P.addExam(day(3), "A", ""); P.addExam(day(9), "B", "");
  P.removeExam(P.getExams()[0].id);
  assert.equal(JSON.parse(store.get("ss-exam")).label, "B");
  P.removeExam(P.getExams()[0].id);
  assert.equal(store.has("ss-exam"), false);
});

test("an exam saved before multi-exam support is picked up", () => {
  const { P, store } = load();
  store.set("ss-exam", JSON.stringify({ date: day(7), label: "Old" }));
  assert.equal(P.getExams().length, 1);
  assert.equal(P.getExam().label, "Old");
});

test("past exams are listed but never become the countdown", () => {
  const { P } = load();
  P.addExam(day(-2), "Done", "");
  assert.equal(P.getExams().length, 1);
  assert.equal(P.getExam(), null);
});

test("an exam can cover some units of a class; whole course and classless exams store no units", () => {
  const { P } = load();
  P.addExam(day(4), "Unit test", "chemistry", [2, 4, 4.5, -1, "x"]);
  P.addExam(day(6), "Final", "chemistry", []);
  P.addExam(day(8), "Misc", "", [1]);
  const [a, b, c] = P.getExams();
  assert.deepEqual(a.units, [2, 4]);
  assert.equal(b.units, undefined);
  assert.equal(c.units, undefined);
  assert.deepEqual(P.getExam().units, [2, 4]);
});
