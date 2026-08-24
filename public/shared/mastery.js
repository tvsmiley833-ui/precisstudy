export function computeUnitStatus(record) {
  if (!record || record.total < 2) return "not-assessed";
  const pct = Math.round((record.correct / record.total) * 100);
  if (pct >= 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

export function computeReadiness(mastery, unitIds) {
  const assessed = unitIds
    .map(id => mastery[id])
    .filter(record => record && record.total >= 2);

  if (assessed.length === 0) {
    return { pct: null, assessedCount: 0, totalCount: unitIds.length };
  }

  const sumPct = assessed.reduce((sum, record) => sum + (record.correct / record.total) * 100, 0);
  return {
    pct: Math.round(sumPct / assessed.length),
    assessedCount: assessed.length,
    totalCount: unitIds.length
  };
}

export function recommendNext(mastery, unitIds, unitNames) {
  const assessed = unitIds
    .map(id => ({ id, record: mastery[id] }))
    .filter(u => u.record && u.record.total >= 2)
    .map(u => ({ id: u.id, pct: Math.round((u.record.correct / u.record.total) * 100) }));

  if (assessed.length === 0) return { type: "diagnostic" };

  const weakest = assessed.reduce((min, u) => (u.pct < min.pct ? u : min), assessed[0]);
  if (weakest.pct >= 80) return { type: "review" };

  return { type: "practice", unitId: weakest.id, unitName: unitNames[weakest.id], pct: weakest.pct };
}

export function buildSchedule(mastery, unitIds, unitNames, days, minutesPerDay) {
  if (days <= 0 || minutesPerDay <= 0) {
    return { allMastered: false, days: [] };
  }

  const weak = [];
  for (const id of unitIds) {
    const record = mastery[id];
    const isAssessed = record && record.total >= 2;
    const pct = isAssessed ? Math.round(record.correct / record.total * 100) : null;

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
  const schedule = [];

  for (let i = 0; i < studyDays; i++) {
    const weakUnit = weak[i % weak.length];
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

const SYNC_DEBOUNCE_MS = 10000;

const STREAK_TOUCHED_KEY = "ssStreakTouchedLocalDate";

function todayLocalDate() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Records that the student did something today, at most once per local day
// (studying any subject counts, so this is deliberately not subject-scoped).
async function touchStreak() {
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

export function createMastery(subject, unitIds, unitNames) {
  const storageKey = "ssMastery_" + subject;
  let state = { mastery: {}, examples: {}, cardsKnown: [] };
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
    if (window.__ssSignedIn === false) { dirty = false; return; } // known signed-out (e.g. anonymous diagnostic) - don't spam 401s
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
      await mergeFromServer();
    },
    recordAnswer(unitId, correct) {
      const rec = state.mastery[unitId] || (state.mastery[unitId] = { correct: 0, total: 0 });
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

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && window.__ssMasteryInstances) {
      window.__ssMasteryInstances.forEach(m => m.flushSyncNow());
    }
  });
  window.addEventListener("beforeunload", () => {
    if (window.__ssMasteryInstances) {
      window.__ssMasteryInstances.forEach(m => m.flushSyncNow());
    }
  });
}
