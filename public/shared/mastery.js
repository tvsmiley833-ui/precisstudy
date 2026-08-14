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
