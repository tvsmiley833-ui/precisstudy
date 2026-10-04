// /planner/: exam date + pace calculator (one connected plan; see plan.js). The weekly builder and assignments live in dashboard-app.js.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var P = window.ssPlan, MIN_PER_Q = 1.5, classes = [], cur = null;
  if (!P || !$('exam-date')) return;

  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  // ---- 1. Exam date
  function renderExam() {
    var e = P.getExam(), n = e ? P.daysUntil(e.date) : null, dEl = $('exam-date');
    dEl.min = P.isoToday();
    if (e) { dEl.value = e.date; $('exam-label').value = e.label || ''; }
    $('exam-clear').hidden = !e;
    $('pl-days').textContent = e && n >= 0 ? String(n) : '–';
    $('pl-days-label').textContent = !e ? 'no date set' : n < 0 ? 'that date has passed, set a new one' : n === 0 ? 'your exam is today' : (n === 1 ? 'day' : 'days') + ' until ' + (e.label || 'your exam');
  }
  $('pl-exam-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    P.setExam($('exam-date').value, $('exam-label').value);
  });
  $('exam-clear').addEventListener('click', function () { $('exam-date').value = ''; $('exam-label').value = ''; P.clearExam(); });

  // ---- 2. Pace
  var daysEl = $('spc-days'), minsEl = $('spc-mins');
  function setDaysFromExam() {
    var e = P.getExam(), n = e ? P.daysUntil(e.date) : -1;
    if (n >= 1) daysEl.value = Math.min(n, +daysEl.max);
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
    if (pct >= 90) { tier.classList.add('spc-tier-ready'); t.textContent = 'Full coverage'; sub.textContent = "At this pace you'll see the whole question bank before test day. Coverage isn't mastery, so check your accuracy too."; }
    else if (pct >= 50) { tier.classList.add('spc-tier-ontrack'); t.textContent = 'Good coverage'; sub.textContent = 'Solid coverage. Keep this pace going.'; }
    else { tier.classList.add('spc-tier-start'); t.textContent = 'Light coverage'; sub.textContent = 'Add a few more minutes a day to cover more ground before your exam.'; }
    var need = total ? Math.ceil(total * MIN_PER_Q / days) : 0, warn = $('spc-warn');
    if (pct < 100 && need > 180) { warn.textContent = 'Heads up: even at 180 min/day, ' + plural(days, 'day') + ' is not enough to see every question. Try at least ' + Math.ceil(total * MIN_PER_Q / 180) + ' days.'; warn.hidden = false; }
    else if (pct < 100 && total) { warn.textContent = 'To see every question in ' + plural(days, 'day') + ', you would need about ' + need + ' min/day.'; warn.hidden = false; }
    else warn.hidden = true;
    document.querySelectorAll('.spc-presets button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.d === days && +b.dataset.m === mins ? 'true' : 'false'); });
    var W = 320, H = 120, L = 30, B = 20, pw = W - L - 8, ph = H - B - 8, maxD = +daysEl.max, pts = [];
    for (var d = 1; d <= maxD; d++) pts.push((L + (d - 1) / (maxD - 1) * pw).toFixed(1) + ',' + (8 + ph - (total ? Math.min(100, d * mins / MIN_PER_Q / total * 100) : 0) / 100 * ph).toFixed(1));
    var cx = L + (days - 1) / (maxD - 1) * pw, cy = 8 + ph - pct / 100 * ph;
    $('spc-chart').innerHTML = '<line x1="' + L + '" y1="' + (8 + ph) + '" x2="' + (W - 8) + '" y2="' + (8 + ph) + '" stroke="var(--border)"/><line x1="' + L + '" y1="8" x2="' + (W - 8) + '" y2="8" stroke="var(--border)" stroke-dasharray="3 3"/>'
      + '<text x="' + (L - 4) + '" y="12" text-anchor="end" font-size="9" fill="var(--text-muted)">100%</text><text x="' + (L - 4) + '" y="' + (8 + ph) + '" text-anchor="end" font-size="9" fill="var(--text-muted)">0%</text>'
      + '<text x="' + L + '" y="' + (H - 4) + '" font-size="9" fill="var(--text-muted)">1 day</text><text x="' + (W - 8) + '" y="' + (H - 4) + '" text-anchor="end" font-size="9" fill="var(--text-muted)">' + maxD + ' days</text>'
      + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--accent-bright)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5" fill="#f5b83d" stroke="var(--bg-card)" stroke-width="2"/>';
    $('spc-chart-cap').textContent = 'Projected coverage at ' + mins + ' min/day: ' + pct + '% of ' + (cur ? cur.title : 'the') + ' question bank after ' + plural(days, 'day') + '. Coverage is not a score prediction.';
  }
  document.querySelectorAll('.spc-presets button').forEach(function (b) { b.addEventListener('click', function () { daysEl.value = b.dataset.d; minsEl.value = b.dataset.m; update(); }); });
  daysEl.addEventListener('input', update); minsEl.addEventListener('input', update);

  $('spc-save-btn').addEventListener('click', function () {
    var days = +daysEl.value, mins = +minsEl.value, st = $('spc-save-status');
    st.textContent = 'Saving…';
    P.setPace(days, mins).then(function (synced) {
      st.textContent = synced ? 'Saved. Your exam date, dashboard and guides now use this plan.' : 'Saved on this device. Sign in to sync it to your dashboard.';
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

  renderExam(); setDaysFromExam(); update();
  fetch('/shared/class-counts.json').then(function (r) { return r.json(); }).then(function (rows) {
    classes = rows;
    var sel = $('pl-class'), saved = '', last = '';
    try { saved = localStorage.getItem('ss-plan-class') || ''; var l = JSON.parse(localStorage.getItem('ss-last-subject') || 'null'); last = l && l.href ? l.href.replace(/\//g, '') : ''; } catch (x) { /* none */ }
    sel.innerHTML = rows.map(function (c) { return '<option value="' + c.slug + '">' + c.title.replace(/&/g, '&amp;') + '</option>'; }).join('');
    var want = [saved, last, 'geometry'].filter(function (s) { return rows.some(function (c) { return c.slug === s; }); })[0] || rows[0].slug;
    sel.value = want; cur = rows.filter(function (c) { return c.slug === want; })[0];
    sel.addEventListener('change', function () { cur = classes.filter(function (c) { return c.slug === sel.value; })[0]; try { localStorage.setItem('ss-plan-class', sel.value); } catch (x) { /* ignore */ } update(); });
    update();
  }).catch(function () { $('spc-save-status').textContent = 'Could not load class sizes. Refresh to try again.'; });
})();
