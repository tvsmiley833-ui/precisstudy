import { describe, it, expect } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handleSaveSyllabusDates, syllabusDatesKey, loadSyllabusDates } from "../src/syllabus-dates.js";

const SECRET = "test-session-secret";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { store.set(k, v); store._lastPutOpts = opts; },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

async function cookie(email) {
  const now = Math.floor(Date.now() / 1000);
  return `${SESSION_COOKIE}=${await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET)}`;
}

const env = () => ({ PROGRESS: fakeKV(), SESSION_SECRET: SECRET });
const post = (url, c, body) => new Request(url, { method: "POST", headers: c ? { Cookie: c, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

describe("POST /api/syllabus/dates", () => {
  it("401s with no session", async () => {
    const res = await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", null, { subject: "apush", subjectLabel: "APUSH", keyDates: [] }), env());
    expect(res.status).toBe(401);
  });

  it("400s on invalid JSON body", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const req = new Request("https://precisstudy.com/api/syllabus/dates", { method: "POST", headers: { Cookie: c, "Content-Type": "application/json" }, body: "not json" });
    const res = await handleSaveSyllabusDates(req, e);
    expect(res.status).toBe(400);
  });

  it("filters out non-ISO dates (e.g. 'Week 6') and saves the rest", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const res = await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, {
      subject: "apush",
      subjectLabel: "APUSH",
      keyDates: [
        { date: "2026-10-15", title: "Midterm exam" },
        { date: "Week 6", title: "Unit 3 quiz" },
        { date: "", title: "no date" }
      ]
    }), e);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ saved: 1, submitted: 3 });
    const items = await loadSyllabusDates(e, "s@e.edu");
    expect(items).toEqual([{ subject: "apush", subjectLabel: "APUSH", date: "2026-10-15", title: "Midterm exam" }]);
  });

  it("replaces previously-saved entries for the same subject on resave, rather than duplicating", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, {
      subject: "apush", subjectLabel: "APUSH", keyDates: [{ date: "2026-10-15", title: "Old midterm" }]
    }), e);
    await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, {
      subject: "apush", subjectLabel: "APUSH", keyDates: [{ date: "2026-10-16", title: "New midterm" }]
    }), e);
    const items = await loadSyllabusDates(e, "s@e.edu");
    expect(items).toEqual([{ subject: "apush", subjectLabel: "APUSH", date: "2026-10-16", title: "New midterm" }]);
  });

  it("merges entries from different subjects without clobbering each other", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, {
      subject: "apush", subjectLabel: "APUSH", keyDates: [{ date: "2026-10-15", title: "APUSH midterm" }]
    }), e);
    await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, {
      subject: "geometry", subjectLabel: "Geometry", keyDates: [{ date: "2026-11-01", title: "Geometry final" }]
    }), e);
    const items = await loadSyllabusDates(e, "s@e.edu");
    expect(items.map(i => i.subject).sort()).toEqual(["apush", "geometry"]);
  });

  it("caps total stored items at 200 across subjects", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    e.PROGRESS._store.set(syllabusDatesKey("s@e.edu"), JSON.stringify({
      items: Array.from({ length: 199 }, (_, i) => ({ subject: "sub" + i, subjectLabel: "Sub " + i, date: "2026-01-01", title: "t" }))
    }));
    await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, {
      subject: "geometry", subjectLabel: "Geometry",
      keyDates: [{ date: "2026-11-01", title: "A" }, { date: "2026-11-02", title: "B" }]
    }), e);
    const items = await loadSyllabusDates(e, "s@e.edu");
    expect(items.length).toBe(200);
    // The newest save's entries win over the oldest pre-existing ones once capped.
    expect(items.some(i => i.title === "B")).toBe(true);
  });

  it("400s when subject/subjectLabel/keyDates are missing or malformed", async () => {
    const e = env();
    const c = await cookie("s@e.edu");
    const bad = [
      { subjectLabel: "APUSH", keyDates: [] },
      { subject: "apush", keyDates: [] },
      { subject: "apush", subjectLabel: "APUSH", keyDates: "not-an-array" }
    ];
    for (const body of bad) {
      const res = await handleSaveSyllabusDates(post("https://precisstudy.com/api/syllabus/dates", c, body), e);
      expect(res.status).toBe(400);
    }
  });
});
