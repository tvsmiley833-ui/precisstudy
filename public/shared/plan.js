// One study plan across the site: the exam date (and its label) lives under 'ss-exam' on this device, and a signed-in
// student's saved goal ({days, minutesPerDay}) is kept in step with it, so the homepage, guides, dashboard and planner agree.
(function () {
  var KEY = 'ss-exam', MINS_KEY = 'ss-plan-mins';
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysUntil(s) { var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(s + 'T00:00:00') - t) / 864e5); }
  function getExam() {
    try { var e = JSON.parse(localStorage.getItem(KEY) || 'null'); if (e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) return e; } catch (x) { /* none saved */ }
    return null;
  }
  function getMinutes() { try { var m = parseInt(localStorage.getItem(MINS_KEY), 10); if (m >= 10 && m <= 180) return m; } catch (x) { /* default */ } return 30; }
  function changed() { try { window.dispatchEvent(new CustomEvent('ss-plan-changed')); } catch (x) { /* old browser */ } }
  // Best effort: signed-out visitors and offline requests simply keep the local copy.
  function syncGoal(days, minutes) {
    if (!(days > 0)) return Promise.resolve(false);
    return fetch('/api/goal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: days, minutesPerDay: minutes || getMinutes() }) })
      .then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  function setExam(date, label) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    try { localStorage.setItem(KEY, JSON.stringify({ date: date, label: String(label || '').trim().slice(0, 40) })); } catch (x) { /* storage blocked */ }
    changed();
    syncGoal(Math.max(1, daysUntil(date)), getMinutes());
    return true;
  }
  function clearExam() { try { localStorage.removeItem(KEY); } catch (x) { /* ignore */ } changed(); }
  // The pace calculator saves days + minutes; the exam date follows (today + days) so the countdown matches the plan.
  function setPace(days, minutes) {
    try { localStorage.setItem(MINS_KEY, String(minutes)); } catch (x) { /* ignore */ }
    var d = new Date(); d.setDate(d.getDate() + days);
    var e = getExam();
    try { localStorage.setItem(KEY, JSON.stringify({ date: iso(d), label: e ? e.label : '' })); } catch (x) { /* ignore */ }
    changed();
    return syncGoal(days, minutes);
  }
  window.ssPlan = { getExam: getExam, setExam: setExam, clearExam: clearExam, setPace: setPace, daysUntil: daysUntil, getMinutes: getMinutes, isoToday: function () { return iso(new Date()); } };
})();
