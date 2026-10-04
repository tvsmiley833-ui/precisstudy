// /planner/: exam date + pace calculator (one connected plan; see plan.js). The weekly builder and assignments live in dashboard-app.js.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var P = window.ssPlan, MIN_PER_Q = 1.5, classes = [], cur = null;
  if (!P || !$('exam-date')) return;

  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  // ---- 1. Exam date
  var classTitles = {};
  function renderExam() {
    var l = P.getExams(), e = P.getExam(), n = e ? P.daysUntil(e.date) : null, dEl = $('exam-date');
    dEl.min = P.isoToday();
    var on = !!e;
    $('pl-badge').classList.toggle('on', on);
    $('pl-days').textContent = on ? String(n) : '';
    $('pl-days-label').textContent = !e ? 'No upcoming exam' : n === 0 ? 'Exam day' : (n === 1 ? 'day' : 'days') + ' until ' + (e.label || classTitles[e.slug] || 'your next exam');
    $('pl-exams').innerHTML = l.map(function (x) {
      var d = P.daysUntil(x.date), past = d < 0, name = x.label || classTitles[x.slug] || 'Exam';
      return '<li class="pl-exam' + (past ? ' past' : '') + '"><button type="button" class="pl-exam-main" data-id="' + x.id + '" title="Plan my pace for this exam"><b>' + esc(name) + '</b><span>' + (x.slug && classTitles[x.slug] && x.label ? esc(classTitles[x.slug]) + ' · ' : '') + x.date + ' · ' + (past ? 'passed' : d === 0 ? 'today' : plural(d, 'day')) + '</span></button>'
        + '<button type="button" class="pl-exam-del" data-del="' + x.id + '" aria-label="Remove ' + esc(name) + '"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></li>';
    }).join('');
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  $('pl-exams').addEventListener('click', function (ev) {
    var del = ev.target.closest('[data-del]'), pick = ev.target.closest('[data-id]');
    if (del) { P.removeExam(del.dataset.del); toast('Exam removed'); return; }
    if (pick) {
      var x = P.getExams().filter(function (q) { return q.id === pick.dataset.id; })[0];
      if (!x) return;
      var d = P.daysUntil(x.date);
      if (x.slug && classes.some(function (c) { return c.slug === x.slug; })) { $('pl-class').value = x.slug; cur = classes.filter(function (c) { return c.slug === x.slug; })[0]; }
      if (d >= 1) { unlocked = true; daysEl.disabled = false; $('pl-lock').hidden = true; daysEl.value = Math.min(d, +daysEl.max); }
      update(); $('pl-pace-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  // The whole date box opens the picker, not just the tiny icon.
  $('exam-date').addEventListener('click', function () { try { this.showPicker(); } catch (x) { /* unsupported */ } });
  function toast(msg, bad) {
    var t = $('sb-toast'); if (!t) return;
    t.textContent = msg; t.style.background = bad ? '#b3362c' : ''; t.classList.add('visible');
    setTimeout(function () { t.classList.remove('visible'); }, 3200);
  }
  $('pl-exam-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var d = $('exam-date').value;
    if (d < P.isoToday()) { toast('Pick a date that is today or later', true); return; }
    P.addExam(d, $('exam-label').value, $('exam-class').value);
    $('exam-date').value = ''; $('exam-label').value = '';
    toast('Exam added');
  });

  // ---- 2. Pace
  var daysEl = $('spc-days'), minsEl = $('spc-mins'), unlocked = false;
  $('pl-unlock').addEventListener('click', function () { unlocked = true; setDaysFromExam(); daysEl.focus(); });
  $('pl-reset').addEventListener('click', function () { unlocked = false; setDaysFromExam(); if (!P.getExam()) daysEl.value = 14; minsEl.value = 30; update(); });
  function setDaysFromExam() {
    var e = P.getExam(), n = e ? P.daysUntil(e.date) : -1;
    var lock = n >= 1 && !unlocked;
    if (n >= 1) daysEl.value = Math.min(n, +daysEl.max);
    daysEl.disabled = lock; $('pl-lock').hidden = !lock;
    minsEl.value = P.getMinutes();
  }
  function update() {
    var days = +daysEl.value, mins = +minsEl.value, total = cur ? cur.questions : 0, units = cur ? cur.units : 0;
    $('spc-days-val').textContent = plural(days, 'day');
    $('spc-mins-val').textContent = mins + ' min';
    var q = Math.min(total, Math.round(days * mins / MIN_PER_Q)), pct = total ? Math.min(100, Math.round(q / total * 100)) : 0;
    $('spc-questions').textContent = q.toLocaleString();
    $('spc-units').textContent = total ? Math.min(units, Math.max(1, Math.round(pct / 100 * units))) : 0;
    $('spc-pct').textContent = pct + '%';
    var tier = $('spc-tier'), t = $('spc-tier-title'), sub = $('spc-tier-sub');
    tier.classList.remove('spc-tier-ready', 'spc-tier-ontrack', 'spc-tier-start');
    if (pct >= 90) { tier.classList.add('spc-tier-ready'); t.textContent = '✓ Full coverage'; sub.textContent = "At this pace you'll see the whole question bank before test day. Coverage isn't mastery, so check your accuracy too."; }
    else if (pct >= 50) { tier.classList.add('spc-tier-ontrack'); t.textContent = '✓ Good coverage'; sub.textContent = 'Solid coverage. Keep this pace going.'; }
    else { tier.classList.add('spc-tier-start'); t.textContent = '↗ Light coverage'; sub.textContent = 'Add a few more minutes a day to cover more ground before your exam.'; }
    var need = total ? Math.ceil(total * MIN_PER_Q / days) : 0, warn = $('spc-warn');
    if (pct < 100 && need > 180) { warn.textContent = 'Need 100%? Try at least ' + Math.ceil(total * MIN_PER_Q / 180) + ' days.'; warn.hidden = false; }
    else if (pct < 100 && total) { warn.innerHTML = 'Need 100%? Increase to <button type="button" class="pl-link" id="pl-snap">' + need + ' min/day</button>.'; warn.hidden = false; $('pl-snap').onclick = function () { minsEl.value = Math.min(180, Math.max(10, Math.ceil(need / 5) * 5)); update(); }; }
    else warn.hidden = true;
    document.querySelectorAll('.spc-presets button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.d === days && +b.dataset.m === mins ? 'true' : 'false'); });
    var W = 320, H = 120, L = 30, B = 20, pw = W - L - 8, ph = H - B - 8, maxD = +daysEl.max, pts = [];
    for (var d = 1; d <= maxD; d++) pts.push((L + (d - 1) / (maxD - 1) * pw).toFixed(1) + ',' + (8 + ph - (total ? Math.min(100, d * mins / MIN_PER_Q / total * 100) : 0) / 100 * ph).toFixed(1));
    var cx = L + (days - 1) / (maxD - 1) * pw, cy = 8 + ph - pct / 100 * ph;
    $('spc-chart').innerHTML = '<line x1="' + L + '" y1="' + (8 + ph) + '" x2="' + (W - 8) + '" y2="' + (8 + ph) + '" stroke="var(--border)"/><line x1="' + L + '" y1="8" x2="' + (W - 8) + '" y2="8" stroke="var(--text-muted)" stroke-opacity=".6" stroke-dasharray="3 3"/>'
      + '<text x="' + (L - 4) + '" y="12" text-anchor="end" font-size="9" fill="var(--text-muted)">100%</text><text x="' + (L - 4) + '" y="' + (8 + ph) + '" text-anchor="end" font-size="9" fill="var(--text-muted)">0%</text>'
      + '<text x="' + L + '" y="' + (H - 4) + '" font-size="9" fill="var(--text-muted)">1 day</text><text x="' + (W - 8) + '" y="' + (H - 4) + '" text-anchor="end" font-size="9" fill="var(--text-muted)">' + maxD + ' days</text>'
      + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--accent-bright)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="6" fill="#f5b83d" stroke="var(--bg-card)" stroke-width="2"><title>' + pct + '% of the question bank after ' + plural(days, 'day') + '</title></circle>';
    $('spc-chart-cap').textContent = 'Projected coverage at ' + mins + ' min/day: ' + pct + '% of ' + (cur ? cur.title : 'the') + ' question bank after ' + plural(days, 'day') + '. Coverage is not a score prediction.';
  }
  document.querySelectorAll('.spc-presets button').forEach(function (b) { b.addEventListener('click', function () { daysEl.value = b.dataset.d; minsEl.value = b.dataset.m; update(); }); });
  daysEl.addEventListener('input', update); minsEl.addEventListener('input', update);

  $('spc-save-btn').addEventListener('click', function () {
    var days = +daysEl.value, mins = +minsEl.value, st = $('spc-save-status');
    st.textContent = 'Saving…';
    P.setPace(days, mins).then(function (synced) {
      st.textContent = synced ? 'Saved. Your exam date, dashboard and guides now use this plan.' : 'Saved on this device. Sign in to sync it to your dashboard.';
      toast(synced ? 'Plan saved' : 'Saved on this device only', !synced && false);
    });
  });

  // Daily study events from tomorrow to the exam, plus the exam itself. Floating local times so every calendar app agrees.
  $('pl-ics-btn').addEventListener('click', function () {
    var days = +daysEl.value, mins = +minsEl.value, name = cur ? cur.title : 'class', e = P.getExam();
    function stamp(d, h, m) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(h).padStart(2, '0') + String(m).padStart(2, '0') + '00'; }
    var now = new Date(), nowStamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PrecisStudy//Study Plan//EN', 'CALSCALE:GREGORIAN'];
    for (var i = 1; i <= days; i++) {
      var d = new Date(); d.setDate(d.getDate() + i);
      var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, mins);
      L.push('BEGIN:VEVENT', 'UID:plan-' + stamp(d, 17, 0) + '-' + (cur ? cur.slug : 'x') + '@precisstudy.com', 'DTSTAMP:' + nowStamp + 'Z', 'DTSTART:' + stamp(d, 17, 0), 'DTEND:' + stamp(end, end.getHours(), end.getMinutes()),
        'SUMMARY:Study ' + name + ' (' + mins + ' min)', 'URL:https://precisstudy.com/' + (cur ? cur.slug : '') + '/', 'END:VEVENT');
    }
    if (e) { var x = e.date.replace(/-/g, ''); L.push('BEGIN:VEVENT', 'UID:exam-' + x + '@precisstudy.com', 'DTSTAMP:' + nowStamp + 'Z', 'DTSTART;VALUE=DATE:' + x, 'SUMMARY:' + (e.label || 'Exam'), 'END:VEVENT'); }
    L.push('END:VCALENDAR');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([L.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'precisstudy-study-plan.ics'; document.body.appendChild(a); a.click(); a.remove();
  });

  window.addEventListener('ss-plan-changed', function () { renderExam(); setDaysFromExam(); update(); });


  // ---- Phones: the 7-column grid becomes one day at a time (tabs and arrows; dragging still paints).
  (function () {
    var grid = $('sb-grid'), nav = $('pl-daynav'), tabs = $('pl-daytabs');
    if (!grid || !nav) return;
    var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], order = [1, 2, 3, 4, 5, 6, 0], cur = order.indexOf(new Date().getDay());
    nav.hidden = false;
    tabs.innerHTML = order.map(function (d, i) { return '<button type="button" role="tab" data-i="' + i + '">' + names[d] + '</button>'; }).join('');
    function apply() {
      [].forEach.call(grid.children, function (el, i) { var c = i % 8; el.classList.toggle('pl-off', c !== 0 && c !== cur + 1); });
      [].forEach.call(tabs.children, function (b, i) { b.setAttribute('aria-selected', i === cur ? 'true' : 'false'); });
    }
    function go(i) { cur = (i + 7) % 7; apply(); }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) go(+b.dataset.i); });
    $('pl-day-prev').addEventListener('click', function () { go(cur - 1); });
    $('pl-day-next').addEventListener('click', function () { go(cur + 1); });
    new MutationObserver(apply).observe(grid, { childList: true });
    apply();
  })();
  renderExam(); setDaysFromExam(); update();
  var keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], st = document.createElement('style');
  st.textContent = '#sb-grid .sb-grid-cell[data-cell^="' + keys[new Date().getDay()] + '-"]:not(.sb-grid-filled){background:color-mix(in srgb,var(--accent-bright) 12%,var(--bg))}';
  document.head.appendChild(st);
  fetch('/shared/class-counts.json').then(function (r) { return r.json(); }).then(function (rows) {
    classes = rows;
    rows.forEach(function (c) { classTitles[c.slug] = c.title; });
    $('exam-class').innerHTML = '<option value="">Not tied to a class</option>' + rows.map(function (c) { return '<option value="' + c.slug + '">' + esc(c.title) + '</option>'; }).join('');
    renderExam();
    var sel = $('pl-class'), saved = '', last = '';
    try { saved = localStorage.getItem('ss-plan-class') || ''; var l = JSON.parse(localStorage.getItem('ss-last-subject') || 'null'); last = l && l.href ? l.href.replace(/\//g, '') : ''; } catch (x) { /* none */ }
    sel.innerHTML = rows.map(function (c) { return '<option value="' + c.slug + '">' + c.title.replace(/&/g, '&amp;') + '</option>'; }).join('');
    var ne = P.getExam(), want = [ne && ne.slug, saved, last, 'geometry'].filter(function (s) { return rows.some(function (c) { return c.slug === s; }); })[0] || rows[0].slug;
    sel.value = want; cur = rows.filter(function (c) { return c.slug === want; })[0];
    sel.addEventListener('change', function () { cur = classes.filter(function (c) { return c.slug === sel.value; })[0]; try { localStorage.setItem('ss-plan-class', sel.value); } catch (x) { /* ignore */ } update(); });
    update();
  }).catch(function () { $('spc-save-status').textContent = 'Could not load class sizes. Refresh to try again.'; });
})();
