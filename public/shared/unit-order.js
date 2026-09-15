// @ts-check
/**
 * Applies a student's personalized unit order (learned from a syllabus
 * upload, see /syllabus) to a subject page's UNITS array. Mirrors the
 * localStorage-first/server-sync pattern already used by mastery.js:
 * localStorage is read synchronously on page load so ordering can happen
 * before anything renders, and refreshUnitOrder() pulls the latest saved
 * order from the server in the background for the *next* load.
 */

/**
 * @param {string} subjectKey
 * @returns {string}
 */
function storageKey(subjectKey) {
  return "ssUnitOrder_" + subjectKey;
}

/**
 * Reorders UNITS in place to match a stored personalized order, if one
 * exists. No-op (never throws) if there's nothing stored, it's unparsable,
 * or it's empty.
 * @param {string} subjectKey
 * @param {Array<{id: number|string}>} UNITS
 */
export function applyStoredUnitOrder(subjectKey, UNITS) {
  try {
    if (!Array.isArray(UNITS) || !UNITS.length) return;
    const raw = localStorage.getItem(storageKey(subjectKey));
    if (!raw) return;
    const order = JSON.parse(raw);
    if (!Array.isArray(order) || !order.length) return;

    const orderIndex = new Map();
    order.forEach((id, i) => {
      if (!orderIndex.has(id)) orderIndex.set(id, i);
    });

    const originalIndex = new Map(UNITS.map((u, i) => [u.id, i]));

    UNITS.sort((a, b) => {
      const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Infinity;
      const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Infinity;
      if (ai !== bi) return ai - bi;
      // Both unmatched (or somehow tied) - keep original relative order.
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
    });
  } catch (e) { /* localStorage unavailable or corrupt - leave UNITS untouched */ }
}

/**
 * Fetches the student's saved unitOrder for this subject from the server
 * and caches it to localStorage for the next page load. Deliberately
 * eventually-consistent (like mastery.js's own sync) - never blocks or
 * reorders anything on this load.
 * @param {string} subjectKey
 */
export async function refreshUnitOrder(subjectKey) {
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const blob = await res.json();
    const unitOrder = blob && blob[subjectKey] && blob[subjectKey].unitOrder;
    if (!Array.isArray(unitOrder) || !unitOrder.length) return;

    const key = storageKey(subjectKey);
    let existing = null;
    try { existing = localStorage.getItem(key); } catch (e) { /* ignore */ }
    const serialized = JSON.stringify(unitOrder);
    if (existing !== serialized) {
      try { localStorage.setItem(key, serialized); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* offline or not logged in - keep whatever's cached */ }
}
