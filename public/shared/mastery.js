// @ts-check
/**
 * @typedef {Object} MasteryRecord
 * @property {number} correct
 * @property {number} total
 *
 * @typedef {Object} MasteryState
 * @property {Record<string, MasteryRecord>} mastery
 * @property {Record<string, boolean>} examples
 * @property {string[]} cardsKnown
 */

/**
 * @param {MasteryRecord | undefined} record
 * @returns {"not-assessed" | "green" | "amber" | "red"}
 */
export function computeUnitStatus(record) {
  if (!record || record.total < 2) return "not-assessed";
  const pct = Math.round((record.correct / record.total) * 100);
  if (pct >= 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

/**
 * @param {Record<string, MasteryRecord>} mastery
 * @param {number[]} unitIds
 * @returns {{ pct: number | null; assessedCount: number; totalCount: number }}
 */
export function computeReadiness(mastery, unitIds) {
  const assessed = unitIds
    .map(id => mastery[String(id)])
    .filter(record => record && record.total >= 2);

  if (assessed.length === 0) {
    return { pct: null, assessedCount: 0, totalCount: unitIds.length };
  }

  const sumPct = assessed.reduce((sum, record) => sum + ((record?.correct ?? 0) / (record?.total || 1)) * 100, 0);
  return {
    pct: Math.round(sumPct / assessed.length),
    assessedCount: assessed.length,
    totalCount: unitIds.length
  };
}

/**
 * @param {Record<string, MasteryRecord>} mastery
 * @param {number[]} unitIds
 * @param {Record<number, string>} unitNames
 * @returns {{ type: "diagnostic" | "review" | "practice"; unitId?: number; unitName?: string; pct?: number }}
 */
export function recommendNext(mastery, unitIds, unitNames) {
  const assessed = unitIds
    .map(id => ({ id, record: mastery[String(id)] }))
    .filter(u => u.record && u.record.total >= 2)
    .map(u => ({ id: u.id, pct: Math.round(((u.record?.correct ?? 0) / (u.record?.total || 1)) * 100) }));

  if (assessed.length === 0) return { type: "diagnostic" };

  const weakest = assessed.reduce((min, u) => (min && u.pct < min.pct ? u : min || u));
  if (!weakest || weakest.pct >= 80) return { type: "review" };

  return { type: "practice", unitId: weakest.id, unitName: unitNames[weakest.id], pct: weakest.pct };
}

/**
 * Like recommendNext, but returns up to n assessed units ranked weakest
 * first instead of collapsing to a single next action -- for a "top weak
 * areas" breakdown rather than a one-line recommendation.
 * @param {Record<string, MasteryRecord>} mastery
 * @param {number[]} unitIds
 * @param {Record<number, string>} unitNames
 * @param {number} [n]
 * @returns {{ unitId: number; unitName: string; pct: number }[]}
 */
export function topWeakUnits(mastery, unitIds, unitNames, n = 3) {
  return unitIds
    .map(id => ({ id, record: mastery[String(id)] }))
    .filter(u => u.record && u.record.total >= 2)
    .map(u => ({ unitId: u.id, unitName: unitNames[u.id], pct: Math.round(((u.record?.correct ?? 0) / (u.record?.total || 1)) * 100) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, n);
}

/**
 * @param {Record<string, MasteryRecord>} mastery
 * @param {number[]} unitIds
 * @param {Record<number, string>} unitNames
 * @param {number} days
 * @param {number} minutesPerDay
 * @returns {{ allMastered: boolean; days: Array<{day: number; unitId?: number; unitName?: string; pct?: number | null; type?: "exam"}> }}
 */
export function buildSchedule(mastery, unitIds, unitNames, days, minutesPerDay) {
  if (days <= 0 || minutesPerDay <= 0) {
    return { allMastered: false, days: [] };
  }

  const weak = [];
  for (const id of unitIds) {
    const record = mastery[String(id)];
    const isAssessed = record && record.total >= 2;
    const pct = isAssessed ? Math.round((record.correct / record.total) * 100) : null;

    if (pct === null || pct < 80) {
      weak.push({ id, pct });
    }
  }

  if (weak.length === 0) {
    return { allMastered: true, days: [] };
  }

  weak.sort((a, b) => {
    if (a.pct === null && b.pct === null) return 0;
    if (a.pct === null) return -1;
    if (b.pct === null) return 1;
    return a.pct - b.pct;
  });

  const hasExamDay = days >= 5;
  const studyDays = hasExamDay ? days - 1 : days;
  /** @type {Array<{day: number; unitId?: number; unitName?: string; pct?: number | null; type?: "exam"}>} */
  const schedule = [];

  for (let i = 0; i < studyDays; i++) {
    const weakUnit = weak[i % weak.length];
    if (!weakUnit) continue;
    schedule.push({
      day: i + 1,
      unitId: weakUnit.id,
      unitName: unitNames[weakUnit.id],
      pct: weakUnit.pct
    });
  }

  if (hasExamDay) {
    schedule.push({
      day: days,
      type: "exam"
    });
  }

  return { allMastered: false, days: schedule };
}

/**
 * Moves numeric unit keys up by one (Physics gained a new Unit 1).
 * @template T
 * @param {Record<string, T>} record
 * @returns {Record<string, T>}
 */
export function shiftUnitKeys(record) {
  /** @type {Record<string, T>} */
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    const n = Number(k);
    out[Number.isInteger(n) && n > 0 ? String(n + 1) : k] = v;
  }
  return out;
}

const PHYSICS_SHIFT_FLAG = "ssMigrated_physics-units-v2";

/**
 * One-time shift of locally saved Physics progress (signed-out students;
 * signed-in ones are migrated server-side and overwrite this on merge).
 * Local data has no timestamp, so a "12" key -- a unit that only exists in
 * the new numbering -- is the one sign it is already new-style.
 * @param {MasteryState} state
 * @returns {boolean} true if the state changed
 */
export function migrateLocalPhysics(state) {
  try {
    if (localStorage.getItem(PHYSICS_SHIFT_FLAG)) return false;
    localStorage.setItem(PHYSICS_SHIFT_FLAG, "1");
  } catch (e) { return false; }
  const keys = Object.keys(state.mastery);
  if (!keys.length || keys.includes("12")) return false;
  state.mastery = shiftUnitKeys(state.mastery);
  return true;
}

/**
 * Session lookup shared by every script on the page through one cached
 * promise (window.__ssMe), so signed-out visitors never hit /api/progress
 * and see 401s. Inlined per module rather than imported: shared modules are
 * served without cache-busting, so a new import can meet a stale file.
 * @returns {Promise<boolean>}
 */
function isSignedIn() {
  const w = /** @type {Window & { __ssMe?: Promise<any> }} */ (window);
  w.__ssMe = w.__ssMe || fetch("/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null);
  return w.__ssMe.then(d => !!(d && d.loggedIn));
}

const SYNC_DEBOUNCE_MS = 10000;

const STREAK_TOUCHED_KEY = "ssStreakTouchedLocalDate";

function todayLocalDate() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Records that the student did something today, at most once per local day
// (studying any subject counts, so this is deliberately not subject-scoped).
async function touchStreak() {
  if (!(await isSignedIn())) return;
  const today = todayLocalDate();
  try {
    if (localStorage.getItem(STREAK_TOUCHED_KEY) === today) return;
  } catch (e) { /* localStorage unavailable - fall through and try the network call anyway */ }
  try {
    const res = await fetch("/api/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localDate: today, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    });
    if (res.ok) {
      try { localStorage.setItem(STREAK_TOUCHED_KEY, today); } catch (e) { /* ignore */ }
      const data = await res.json();
      if (typeof window !== "undefined" && data && data.streak) {
        window.dispatchEvent(new CustomEvent("ss-streak-updated", { detail: data.streak }));
      }
    }
  } catch (e) { /* offline or not logged in - try again next time something is recorded */ }
}

/**
 * @param {string} subject
 * @param {number[]} unitIds
 * @param {Record<number, string>} unitNames
 * @returns {{
 *   init: () => Promise<void>;
 *   recordAnswer: (unitId: number, correct: boolean) => void;
 *   markExampleDone: (id: string) => void;
 *   markCardKnown: (id: string) => void;
 *   unmarkCardKnown: (id: string) => void;
 *   getSnapshot: () => MasteryState;
 *   getReadiness: () => { pct: number | null; assessedCount: number; totalCount: number };
 *   getRecommendation: () => { type: string; unitId?: number; unitName?: string; pct?: number };
 *   flushSyncNow: () => void;
 * }}
 */
export function createMastery(subject, unitIds, unitNames) {
  const storageKey = "ssMastery_" + subject;
  /** @type {MasteryState} */
  let state = { mastery: {}, examples: {}, cardsKnown: [] };
  /** @type {ReturnType<typeof setTimeout> | null} */
  let syncTimer = null;
  let dirty = false;

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) state = Object.assign(state, JSON.parse(raw));
    } catch (e) { /* localStorage unavailable or corrupt - keep defaults */ }
  }

  function saveLocal() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function scheduleSync() {
    dirty = true;
    if (syncTimer) return;
    syncTimer = setTimeout(pushToServer, SYNC_DEBOUNCE_MS);
  }

  async function pushToServer() {
    syncTimer = null;
    if (!dirty) return;
    if (!(await isSignedIn())) { dirty = false; return; } // signed out - local progress only, don't spam 401s
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject, mastery: state.mastery, examples: state.examples, cardsKnown: state.cardsKnown })
      });
      if (res.ok) {
        dirty = false;
      } else {
        scheduleSync(); // server rejected it (e.g. session expired) - retry on the next cycle
      }
    } catch (e) {
      scheduleSync(); // offline - stay dirty and retry on the next cycle
    }
  }

  function flushSyncNow() {
    if (dirty) pushToServer();
  }

  async function mergeFromServer() {
    if (!(await isSignedIn())) return;
    try {
      const res = await fetch("/api/progress");
      if (!res.ok) return;
      const blob = await res.json();
      const serverSubject = blob && blob[subject];
      if (serverSubject) {
        state = { mastery: serverSubject.mastery || {}, examples: serverSubject.examples || {}, cardsKnown: serverSubject.cardsKnown || [] };
        saveLocal();
      }
    } catch (e) { /* offline or not logged in - keep local state */ }
  }

  return {
    async init() {
      load();
      if (subject === "physics" && migrateLocalPhysics(state)) saveLocal();
      await mergeFromServer();
    },
    recordAnswer(unitId, correct) {
      const rec = state.mastery[String(unitId)] || (state.mastery[String(unitId)] = { correct: 0, total: 0 });
      rec.total++;
      if (correct) rec.correct++;
      saveLocal();
      scheduleSync();
      touchStreak();
    },
    markExampleDone(id) {
      state.examples[id] = true;
      saveLocal();
      scheduleSync();
      touchStreak();
    },
    markCardKnown(id) {
      if (!state.cardsKnown.includes(id)) state.cardsKnown.push(id);
      saveLocal();
      scheduleSync();
      touchStreak();
    },
    unmarkCardKnown(id) {
      const idx = state.cardsKnown.indexOf(id);
      if (idx !== -1) state.cardsKnown.splice(idx, 1);
      saveLocal();
      scheduleSync();
    },
    getSnapshot() {
      return state;
    },
    getReadiness() {
      return computeReadiness(state.mastery, unitIds);
    },
    getRecommendation() {
      return recommendNext(state.mastery, unitIds, unitNames);
    },
    flushSyncNow
  };
}

/**
 * Global window fields other scripts on subject pages rely on:
 * - __ssSignedIn: set by page bootstrap before any sync runs
 * - __ssMasteryInstances: all live createMastery() instances, for flush-on-hide
 * @typedef {{ __ssSignedIn?: boolean; __ssMasteryInstances?: Array<{ flushSyncNow: () => void }> }} MasteryWindow
 */

if (typeof window !== "undefined") {
  const w = /** @type {Window & typeof globalThis & MasteryWindow} */ (window);
  w.addEventListener("visibilitychange", () => {
    if (document.hidden && w.__ssMasteryInstances) {
      w.__ssMasteryInstances.forEach(m => m.flushSyncNow());
    }
  });
  w.addEventListener("beforeunload", () => {
    if (w.__ssMasteryInstances) {
      w.__ssMasteryInstances.forEach(m => m.flushSyncNow());
    }
  });
}
