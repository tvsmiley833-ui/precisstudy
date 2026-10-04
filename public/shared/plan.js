// One study plan across the site: the exam date (and its label) lives under 'ss-exam' on this device, and a signed-in
// student's saved goal ({days, minutesPerDay}) is kept in step with it, so the homepage, guides, dashboard and planner agree.
(function () {
  var KEY = 'ss-exam', LIST_KEY = 'ss-exams', MINS_KEY = 'ss-plan-mins';
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysUntil(s) { var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(s + 'T00:00:00') - t) / 864e5); }
  // Several exams can be saved ('ss-exams'); 'ss-exam' always mirrors the nearest upcoming one so every page that
  // reads a single date (homepage, guides, dashboard) keeps working.
  function list() {
    var l = null;
    try { l = JSON.parse(localStorage.getItem(LIST_KEY) || 'null'); } catch (x) { /* fall through */ }
    if (!Array.isArray(l)) {
      l = [];
      try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) l.push({ id: 'e0', date: o.date, label: o.label || '', slug: '' }); } catch (x) { /* none */ }
    }
    return l.filter(function (e) { return e && /^\d{4}-\d{2}-\d{2}$/.test(e.date); }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function nearest(l) { var t = iso(new Date()); return l.filter(function (e) { return e.date >= t; })[0] || null; }
  function save(l) {
    l = l.slice(0, 20);
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(l));
      var n = nearest(l);
      if (n) localStorage.setItem(KEY, JSON.stringify({ date: n.date, label: n.label || '' })); else localStorage.removeItem(KEY);
    } catch (x) { /* storage blocked */ }
    changed();
    var n2 = nearest(l);
    if (n2) syncGoal(Math.max(1, daysUntil(n2.date)), getMinutes());
  }
  function getExams() { return list(); }
  function getExam() { var n = nearest(list()); return n ? { date: n.date, label: n.label || '', slug: n.slug || '' } : null; }
  function getMinutes() { try { var m = parseInt(localStorage.getItem(MINS_KEY), 10); if (m >= 10 && m <= 180) return m; } catch (x) { /* default */ } return 30; }
  function changed() { try { window.dispatchEvent(new CustomEvent('ss-plan-changed')); } catch (x) { /* old browser */ } }
  // Best effort: signed-out visitors and offline requests simply keep the local copy.
  function syncGoal(days, minutes) {
    if (!(days > 0)) return Promise.resolve(false);
    return fetch('/api/goal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: days, minutesPerDay: minutes || getMinutes() }) })
      .then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  function addExam(date, label, slug) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    var l = list();
    l.push({ id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: date, label: String(label || '').trim().slice(0, 40), slug: String(slug || '').slice(0, 60) });
    save(l.sort(function (a, b) { return a.date < b.date ? -1 : 1; }));
    return true;
  }
  function removeExam(id) { save(list().filter(function (e) { return e.id !== id; })); }
  function clearExam() { save([]); }
  // Kept for older callers: replaces the nearest exam's date, or adds one.
  function setExam(date, label) { var n = nearest(list()); if (n) removeExam(n.id); return addExam(date, label, n ? n.slug : ''); }
  // The pace calculator saves days + minutes; the nearest exam's date follows (today + days) so the countdown matches the plan.
  function setPace(days, minutes) {
    try { localStorage.setItem(MINS_KEY, String(minutes)); } catch (x) { /* ignore */ }
    var d = new Date(); d.setDate(d.getDate() + days);
    var l = list(), n = nearest(l);
    if (n) n.date = iso(d); else l.push({ id: 'e' + Date.now().toString(36), date: iso(d), label: '', slug: '' });
    var t = iso(d); l.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    try { localStorage.setItem(LIST_KEY, JSON.stringify(l)); localStorage.setItem(KEY, JSON.stringify({ date: t, label: n ? n.label || '' : '' })); } catch (x) { /* ignore */ }
    changed();
    return syncGoal(days, minutes);
  }
  window.ssPlan = { getExam: getExam, getExams: getExams, addExam: addExam, removeExam: removeExam, setExam: setExam, clearExam: clearExam, setPace: setPace, daysUntil: daysUntil, getMinutes: getMinutes, isoToday: function () { return iso(new Date()); } };
})();
