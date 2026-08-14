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

const SYNC_DEBOUNCE_MS = 10000;

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
    },
    markExampleDone(id) {
      state.examples[id] = true;
      saveLocal();
      scheduleSync();
    },
    markCardKnown(id) {
      if (!state.cardsKnown.includes(id)) state.cardsKnown.push(id);
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
