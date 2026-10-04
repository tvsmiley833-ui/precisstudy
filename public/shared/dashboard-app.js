import { computeReadiness, recommendNext, topWeakUnits, buildSchedule, dueCards, daysUntil } from '/shared/mastery.js';
import { geometryUnits, chemistryUnits, algebra1Units, algebra2Units, aplangUnits, globalHistoryUnits, apbiologyUnits, apushUnits, physicsUnits, biologyUnits, precalcUnits, usGovernmentUnits, actPrepUnits, anatomyUnits, apChemistryUnits, apCsaUnits, apEuroUnits, apMacroUnits, apMicroUnits, apPhysicsUnits, apPsychUnits, apStatsUnits, apUsgovUnits, apWorldUnits, apHumanGeographyUnits, artHistoryUnits, astronomyUnits, computerScienceUnits, creativeWritingUnits, earthScienceUnits, economicsUnits, english10Units, english9Units, environmentalScienceUnits, french1Units, french2Units, french3Units, geographyUnits, german1Units, healthUnits, journalismUnits, musicTheoryUnits, psychologyUnits, satMathUnits, satReadingUnits, sociologyUnits, spanish1Units, spanish2Units, spanish3Units, speechDebateUnits, statisticsUnits, studySkillsUnits, worldHistoryUnits, calculusUnits, calcAbUnits, calcBcUnits, usHistoryUnits } from '/shared/unit-titles.js';

// Category grouping for the "unassessed classes" accordion below -- same
// taxonomy used on the homepage and in Settings, so a class always lands in
// the category a student already recognizes from elsewhere on the site.
const SUBJECT_CATEGORY = {
  geometry: 'math', algebra1: 'math', algebra2: 'math', precalc: 'math', statistics: 'math', calculus: 'math',
  aplang: 'ap', apbiology: 'ap', apush: 'ap', 'ap-chemistry': 'ap', 'ap-csa': 'ap', 'ap-euro': 'ap', 'ap-macro': 'ap',
  'ap-micro': 'ap', 'ap-physics': 'ap', 'ap-psych': 'ap', 'ap-stats': 'ap', 'ap-usgov': 'ap', 'ap-world': 'ap',
  'ap-human-geography': 'ap', 'calc-ab': 'ap', 'calc-bc': 'ap',
  chemistry: 'science', physics: 'science', biology: 'science', anatomy: 'science', astronomy: 'science', 'earth-science': 'science', 'environmental-science': 'science',
  globalhistory: 'humanities', 'us-history': 'humanities', 'art-history': 'humanities', economics: 'humanities', geography: 'humanities',
  psychology: 'humanities', sociology: 'humanities', 'us-government': 'humanities', 'world-history': 'humanities',
  'creative-writing': 'english', 'english-10': 'english', 'english-9': 'english', journalism: 'english', 'speech-debate': 'english',
  'french-1': 'languages', 'french-2': 'languages', 'french-3': 'languages', 'german-1': 'languages', 'spanish-1': 'languages', 'spanish-2': 'languages', 'spanish-3': 'languages',
  'computer-science': 'electives', health: 'electives', 'music-theory': 'electives', 'study-skills': 'electives',
  'act-prep': 'testprep', 'sat-math': 'testprep', 'sat-reading': 'testprep'
};
const CATEGORY_LABELS = { math: 'Math', science: 'Science', humanities: 'History', english: 'English', languages: 'Languages', electives: 'Electives & Skills', ap: 'AP Courses', testprep: 'Test Prep' };
const CATEGORY_ORDER = ['math', 'science', 'humanities', 'english', 'languages', 'electives', 'ap', 'testprep'];

const SUBJECTS_CONFIG = [
  { key: 'geometry', label: 'Geometry', href: '/geometry', units: geometryUnits },
  { key: 'chemistry', label: 'Chemistry', href: '/chemistry', units: chemistryUnits },
  { key: 'algebra1', label: 'Algebra I', href: '/algebra1', units: algebra1Units },
  { key: 'algebra2', label: 'Algebra II', href: '/algebra2', units: algebra2Units },
  { key: 'aplang', label: 'AP English Lang & Comp', href: '/ap-lang', units: aplangUnits },
  { key: 'globalhistory', label: 'Global History', href: '/global-history', units: globalHistoryUnits },
  { key: 'apbiology', label: 'AP Biology', href: '/ap-biology', units: apbiologyUnits },
  { key: 'apush', label: 'APUSH', href: '/apush', units: apushUnits },
  { key: 'us-history', label: 'US History', href: '/us-history', units: usHistoryUnits },
  { key: 'physics', label: 'Physics', href: '/physics', units: physicsUnits },
  { key: 'biology', label: 'Biology', href: '/biology', units: biologyUnits },
  { key: 'precalc', label: 'PreCalculus', href: '/precalc', units: precalcUnits },
  { key: 'act-prep', label: 'ACT Prep', href: '/act-prep', units: actPrepUnits },
  { key: 'anatomy', label: 'Anatomy & Physiology', href: '/anatomy', units: anatomyUnits },
  { key: 'ap-chemistry', label: 'AP Chemistry', href: '/ap-chemistry', units: apChemistryUnits },
  { key: 'ap-csa', label: 'AP Computer Science A', href: '/ap-csa', units: apCsaUnits },
  { key: 'ap-euro', label: 'AP European History', href: '/ap-euro', units: apEuroUnits },
  { key: 'ap-macro', label: 'AP Macroeconomics', href: '/ap-macro', units: apMacroUnits },
  { key: 'ap-micro', label: 'AP Microeconomics', href: '/ap-micro', units: apMicroUnits },
  { key: 'ap-physics', label: 'AP Physics 1', href: '/ap-physics', units: apPhysicsUnits },
  { key: 'ap-psych', label: 'AP Psychology', href: '/ap-psych', units: apPsychUnits },
  { key: 'ap-stats', label: 'AP Statistics', href: '/ap-stats', units: apStatsUnits },
  { key: 'ap-usgov', label: 'AP US Government', href: '/ap-usgov', units: apUsgovUnits },
  { key: 'ap-world', label: 'AP World History', href: '/ap-world', units: apWorldUnits },
  { key: 'ap-human-geography', label: 'AP Human Geography', href: '/ap-human-geography', units: apHumanGeographyUnits },
  { key: 'art-history', label: 'Art History', href: '/art-history', units: artHistoryUnits },
  { key: 'astronomy', label: 'Astronomy', href: '/astronomy', units: astronomyUnits },
  { key: 'computer-science', label: 'Computer Science', href: '/computer-science', units: computerScienceUnits },
  { key: 'creative-writing', label: 'Creative Writing', href: '/creative-writing', units: creativeWritingUnits },
  { key: 'earth-science', label: 'Earth Science', href: '/earth-science', units: earthScienceUnits },
  { key: 'economics', label: 'Economics', href: '/economics', units: economicsUnits },
  { key: 'english-10', label: 'English 10', href: '/english-10', units: english10Units },
  { key: 'english-9', label: 'English 9', href: '/english-9', units: english9Units },
  { key: 'environmental-science', label: 'Environmental Science', href: '/environmental-science', units: environmentalScienceUnits },
  { key: 'french-1', label: 'French 1', href: '/french-1', units: french1Units },
  { key: 'french-2', label: 'French 2', href: '/french-2', units: french2Units },
  { key: 'french-3', label: 'French 3', href: '/french-3', units: french3Units },
  { key: 'geography', label: 'Geography', href: '/geography', units: geographyUnits },
  { key: 'german-1', label: 'German 1', href: '/german-1', units: german1Units },
  { key: 'health', label: 'Health', href: '/health', units: healthUnits },
  { key: 'journalism', label: 'Journalism', href: '/journalism', units: journalismUnits },
  { key: 'music-theory', label: 'Music Theory', href: '/music-theory', units: musicTheoryUnits },
  { key: 'psychology', label: 'Psychology', href: '/psychology', units: psychologyUnits },
  { key: 'sat-math', label: 'SAT Math Prep', href: '/sat-math', units: satMathUnits },
  { key: 'sat-reading', label: 'SAT Reading & Writing', href: '/sat-reading', units: satReadingUnits },
  { key: 'sociology', label: 'Sociology', href: '/sociology', units: sociologyUnits },
  { key: 'spanish-1', label: 'Spanish 1', href: '/spanish-1', units: spanish1Units },
  { key: 'spanish-2', label: 'Spanish 2', href: '/spanish-2', units: spanish2Units },
  { key: 'spanish-3', label: 'Spanish 3', href: '/spanish-3', units: spanish3Units },
  { key: 'speech-debate', label: 'Speech & Debate', href: '/speech-debate', units: speechDebateUnits },
  { key: 'statistics', label: 'Statistics', href: '/statistics', units: statisticsUnits },
  { key: 'study-skills', label: 'Study Skills', href: '/study-skills', units: studySkillsUnits },
  { key: 'us-government', label: 'US Government', href: '/us-government', units: usGovernmentUnits },
  { key: 'world-history', label: 'World History', href: '/world-history', units: worldHistoryUnits },
  { key: 'calculus', label: 'Calculus', href: '/calculus', units: calculusUnits },
  { key: 'calc-ab', label: 'AP Calculus AB', href: '/calc-ab', units: calcAbUnits },
  { key: 'calc-bc', label: 'AP Calculus BC', href: '/calc-bc', units: calcBcUnits },
];

// Scoped to the same enrolled-classes list Settings/the homepage use, once
// loadDashboard() knows it -- keeps the schedule builder's subject picker
// in sync too, instead of always offering all 50 guides regardless of what
// the student actually takes.
let SUBJECTS_FOR_SCHEDULE = SUBJECTS_CONFIG;

function statusColor(pct) {
  if (pct === null) return 'var(--status-none)';
  if (pct >= 80) return 'var(--status-green)';
  if (pct >= 50) return 'var(--status-amber)';
  return 'var(--status-red)';
}

function renderSubject(subjectKey, label, href, subjectData, unitIds, unitNames) {
  const el = document.getElementById('dash-subject-' + subjectKey);
  if (!el) return;

  if (!unitIds.length) {
    el.innerHTML = '<div style="font-weight:800;font-size:18px;color:var(--text);">' + label + '</div>'
      + '<p style="color:var(--text-muted);font-size:14px;margin:8px 0 0;">Unit data isn\'t available for this subject yet.</p>';
    return;
  }

  const readiness = computeReadiness(subjectData.mastery || {}, unitIds);
  const rec = recommendNext(subjectData.mastery || {}, unitIds, unitNames);

  let recHtml;
  if (rec.type === 'diagnostic') {
    recHtml = '<a href="' + href + '" class="ss-cta-btn" style="display:inline-block;background:var(--accent-solid);color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Take the diagnostic →</a>';
  } else if (rec.type === 'practice') {
    const weakUnits = topWeakUnits(subjectData.mastery || {}, unitIds, unitNames, 3);
    const weakListHtml = weakUnits.length > 1
      ? '<ul style="margin:0 0 10px;padding-left:18px;font-size:13px;color:var(--text-muted);">' + weakUnits.map(u =>
          '<li>' + u.unitName + ' — <b style="color:' + statusColor(u.pct) + ';">' + u.pct + '%</b></li>'
        ).join('') + '</ul>'
      : '<p style="margin:0 0 10px;font-size:14px;color:var(--text-muted);">You\'re weakest here: <b style="color:var(--text);">' + rec.unitName + '</b> (' + rec.pct + '%)</p>';
    recHtml = weakListHtml
      + '<a href="' + href + '?practice=' + rec.unitId + '" class="ss-cta-btn" style="display:inline-block;background:var(--accent-solid);color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Practice ' + rec.unitName + ' →</a>';
  } else {
    recHtml = '<p style="margin:0;font-size:14px;color:var(--text-muted);">Every assessed topic is scoring well — try the practice exam or review flashcards.</p>';
  }

  const scoreText = readiness.pct === null ? '—' : readiness.pct + '%';
  const notAssessedCount = readiness.totalCount - readiness.assessedCount;
  const caveat = notAssessedCount > 0
    ? (readiness.enough ? '' : 'Only ' + readiness.assessedCount + ' of ' + readiness.totalCount + ' units practiced so far, so this is an early read. ') + notAssessedCount + ' of ' + readiness.totalCount + ' units not yet assessed'
    : 'All ' + readiness.totalCount + ' units assessed';

  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">'
    + '<div style="font-weight:800;font-size:18px;color:var(--text);">' + label + '</div>'
    + '<div style="text-align:right;"><div style="font-weight:800;font-size:28px;line-height:1;color:' + statusColor(readiness.pct) + ';">' + scoreText + '</div>'
    + (readiness.pct === null ? '' : '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;" title="Average score across the units you\'ve been assessed on">' + (readiness.enough ? 'exam readiness' : 'early read') + '</div>') + '</div>'
    + '</div>'
    + '<p style="margin:0 0 16px;font-size:13px;color:var(--text-muted);">' + caveat + '</p>'
    + '<div style="border-top:1px solid var(--border);padding-top:14px;">' + recHtml + '</div>'
    + '<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px;">'
    + '<div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:10px;">Study Schedule</div>'
    + '<div id="sched-form-' + subjectKey + '" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">'
    + '<label style="font-size:13px;color:var(--text-muted);">Days until your exam<br/>'
    + '<input id="sched-days-' + subjectKey + '" type="number" min="1" max="60" value="14" style="width:70px;padding:7px 9px;border:1px solid var(--border);border-radius:10px;font-size:14px;color:var(--text);background:var(--bg-card);margin-top:4px;"/></label>'
    + '<label style="font-size:13px;color:var(--text-muted);">Minutes per day<br/>'
    + '<input id="sched-minutes-' + subjectKey + '" type="number" min="10" max="180" value="' + (ssPrefs().studyMinutes || 30) + '" style="width:70px;padding:7px 9px;border:1px solid var(--border);border-radius:10px;font-size:14px;color:var(--text);background:var(--bg-card);margin-top:4px;"/></label>'
    + '<button id="sched-build-' + subjectKey + '" class="ss-cta-btn" style="background:var(--accent-solid);color:#fff;border:none;padding:9px 16px;border-radius:999px;font-size:14px;font-weight:700;cursor:pointer;">Build my schedule</button>'
    + '</div>'
    + '<div id="sched-result-' + subjectKey + '" style="margin-top:14px;"></div>'
    + '</div>';

  const buildBtn = document.getElementById('sched-build-' + subjectKey);
  const resultEl = document.getElementById('sched-result-' + subjectKey);
  if (buildBtn) {
    buildBtn.addEventListener('click', function () {
      const daysInput = document.getElementById('sched-days-' + subjectKey);
      const minutesInput = document.getElementById('sched-minutes-' + subjectKey);
      const days = parseInt(daysInput.value, 10);
      const minutes = parseInt(minutesInput.value, 10);
      const result = buildSchedule(subjectData.mastery || {}, unitIds, unitNames, days, minutes);

      if (result.allMastered) {
        resultEl.innerHTML = '<p style="margin:0;font-size:14px;color:var(--status-green);">Every assessed unit is 80%+ — nothing weak to schedule. Try the practice exam.</p>';
        return;
      }
      if (!result.days.length) {
        resultEl.innerHTML = '<p style="margin:0;font-size:13px;color:var(--text-muted);">Enter a valid number of days and minutes to build a schedule.</p>';
        return;
      }

      const items = result.days.map(function (entry) {
        if (entry.type === 'exam') {
          return '<li style="margin-bottom:6px;font-size:14px;color:var(--text-muted);"><b style="color:var(--text);">Day ' + entry.day + '</b> — Practice Exam</li>';
        }
        const pctText = entry.pct === null ? 'not yet assessed' : entry.pct + '%';
        return '<li style="margin-bottom:6px;font-size:14px;color:var(--text-muted);"><b style="color:var(--text);">Day ' + entry.day + '</b> — '
          + '<a href="' + href + '?practice=' + entry.unitId + '" style="color:var(--accent);font-weight:700;text-decoration:none;">' + entry.unitName + '</a>'
          + ' (' + pctText + ')</li>';
      }).join('');
      resultEl.innerHTML = '<ol style="margin:0;padding-left:20px;">' + items + '</ol>';
    });
  }
}

// Same key -> hex map as the SUBJECTS swatches in /settings, so a subject's
// color is identical everywhere it appears on the site.
const SUBJECT_COLORS = {
  geometry: '#936e2a', chemistry: '#0f7a70', algebra1: '#2563a8', algebra2: '#1c7a4a',
  aplang: '#8b2942', globalhistory: '#b5541f', apbiology: '#2e7d4f', apush: '#1e4d8b',
  'us-history': '#8a5a2b', physics: '#7a3ba8', biology: '#2e7d4f', precalc: '#0f6e73',
  'act-prep': '#b91c1c', anatomy: '#be123c', 'ap-chemistry': '#0369a1', 'ap-csa': '#1e40af',
  'ap-euro': '#166534', 'ap-macro': '#065f46', 'ap-micro': '#9a3412', 'ap-physics': '#1d4ed8',
  'ap-psych': '#9333ea', 'ap-stats': '#c2410c', 'ap-usgov': '#1e3a8a', 'ap-world': '#a16207',
  'ap-human-geography': '#0e7490', 'art-history': '#9f1239', astronomy: '#4338ca',
  'computer-science': '#4338ca', 'creative-writing': '#db2777', 'earth-science': '#0e7490',
  economics: '#7c3aed', 'english-10': '#b45309', 'english-9': '#be185d',
  'environmental-science': '#15803d', 'french-1': '#2563eb', 'french-2': '#1d4ed8', 'french-3': '#4338ca', geography: '#02845c',
  'german-1': '#334155', health: '#dc2626', journalism: '#0f766e', 'music-theory': '#b45309',
  psychology: '#7c3aed', 'sat-math': '#0369a1', 'sat-reading': '#7c2d12', sociology: '#057f9c',
  'spanish-1': '#c2410c', 'spanish-2': '#9a3412', 'spanish-3': '#c54808',
  'speech-debate': '#7e22ce', statistics: '#af5f01', 'study-skills': '#4d7c0f',
  'us-government': '#23744f', 'world-history': '#8558ec', calculus: '#0e7490',
  'calc-ab': '#4338ca', 'calc-bc': '#7c3aed'
};
const SB_DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' }
];
let sbFreeBlocks = []; // [{id, day, start:'HH:MM', end:'HH:MM'}]
let sbSelectedSubjects = []; // [{key, unitMode:'auto'|'<unitId>'}], order = priority (index 0 = highest)
let sbBlob = null;
// Populated by loadDashAssignments() -- reused by sbBuildSchedule() to flag
// a scheduled study day that coincides with something due. Classroom only
// gives due DATES (not times), so "conflict" here means day-of-week overlap
// with an upcoming due date, not a real time clash.
let sbAssignmentsCache = [];

// ----- Weekly free-time grid: click/drag paints hour cells, which are the
// primary way to build sbFreeBlocks -- the dropdown add-block form (below,
// under "or add a specific time block") stays available for typing an exact
// time, but every grid interaction recomputes sbFreeBlocks in full from the
// painted cells, coalescing contiguous same-day hours into blocks. -----
const SB_GRID_HOURS = []; // 6am .. 10pm (last cell covers 10pm-11pm)
for (let h = 6; h <= 22; h++) SB_GRID_HOURS.push(h);
let sbGridCells = new Set(); // "<day>-<hour>"
let sbGridPaintMode = null; // true = painting on, false = painting off, null = not dragging

function sbPad2(n) { return String(n).padStart(2, '0'); }

function sbHourLabel(h) {
  const ampm = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ampm;
}

function sbSeedGridFromBlocks() {
  sbGridCells = new Set();
  sbFreeBlocks.forEach(function (b) {
    const startMin = sbTimeToMinutes(b.start), endMin = sbTimeToMinutes(b.end);
    if (startMin === null || endMin === null) return;
    SB_GRID_HOURS.forEach(function (h) {
      // Mark this hour filled if the saved block overlaps it at all, so
      // blocks entered via the manual form (possibly not hour-aligned)
      // still show up as painted cells.
      if (startMin < (h + 1) * 60 && endMin > h * 60) sbGridCells.add(b.day + '-' + h);
    });
  });
}

function sbCellsToBlocks() {
  const blocks = [];
  SB_DAYS.forEach(function (d) {
    let runStart = null;
    SB_GRID_HOURS.forEach(function (h, i) {
      const has = sbGridCells.has(d.key + '-' + h);
      if (has && runStart === null) runStart = h;
      const nextH = SB_GRID_HOURS[i + 1];
      const contiguous = has && nextH !== undefined && nextH === h + 1 && sbGridCells.has(d.key + '-' + nextH);
      if (has && !contiguous) {
        blocks.push({ id: d.key + '-' + runStart + '-' + (h + 1), day: d.key, start: sbPad2(runStart) + ':00', end: sbPad2(h + 1) + ':00' });
        runStart = null;
      } else if (!has) {
        runStart = null;
      }
    });
  });
  return blocks;
}

function sbApplyGridToBlocks() {
  sbFreeBlocks = sbCellsToBlocks();
  sbRenderBlocks();
}

function sbRenderGrid() {
  const grid = document.getElementById('sb-grid');
  if (!grid) return;
  let html = '<div></div>' + SB_DAYS.map(function (d) { return '<div class="sb-grid-hd">' + d.label + '</div>'; }).join('');
  SB_GRID_HOURS.forEach(function (h) {
    html += '<div class="sb-grid-time">' + sbHourLabel(h) + '</div>';
    SB_DAYS.forEach(function (d) {
      const key = d.key + '-' + h;
      const filled = sbGridCells.has(key) ? ' sb-grid-filled' : '';
      html += '<div class="sb-grid-cell' + filled + '" data-cell="' + key + '" role="button" tabindex="0" aria-label="' + d.label + ' ' + sbHourLabel(h) + '"></div>';
    });
  });
  grid.innerHTML = html;

  function setCell(el, on) {
    const key = el.dataset.cell;
    if (on) sbGridCells.add(key); else sbGridCells.delete(key);
    el.classList.toggle('sb-grid-filled', on);
  }

  grid.querySelectorAll('.sb-grid-cell').forEach(function (cell) {
    cell.addEventListener('mousedown', function (e) {
      e.preventDefault();
      sbGridPaintMode = !cell.classList.contains('sb-grid-filled');
      setCell(cell, sbGridPaintMode);
    });
    cell.addEventListener('mouseenter', function () {
      if (sbGridPaintMode !== null) setCell(cell, sbGridPaintMode);
    });
    cell.addEventListener('touchstart', function (e) {
      e.preventDefault();
      sbGridPaintMode = !cell.classList.contains('sb-grid-filled');
      setCell(cell, sbGridPaintMode);
    }, { passive: false });
    cell.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCell(cell, !cell.classList.contains('sb-grid-filled')); sbApplyGridToBlocks(); }
    });
  });
  grid.addEventListener('touchmove', function (e) {
    if (sbGridPaintMode === null) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.classList && el.classList.contains('sb-grid-cell')) setCell(el, sbGridPaintMode);
  }, { passive: true });

  document.addEventListener('mouseup', function () {
    if (sbGridPaintMode !== null) { sbGridPaintMode = null; sbApplyGridToBlocks(); }
  });
  document.addEventListener('touchend', function () {
    if (sbGridPaintMode !== null) { sbGridPaintMode = null; sbApplyGridToBlocks(); }
  });
}

function sbPopulateDaySelect() {
  const sel = document.getElementById('sb-block-day');
  if (!sel) return;
  sel.innerHTML = SB_DAYS.map(function (d) { return '<option value="' + d.key + '">' + d.label + '</option>'; }).join('');
}

function sbTimeToMinutes(t) {
  const parts = (t || '').split(':');
  const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function ssPrefs() { try { return JSON.parse(localStorage.getItem('ss_prefs') || '{}') || {}; } catch (e) { return {}; } }
// Keep the saved time-format / study-length preferences current across devices (Settings > Profile).
fetch('/api/profile').then(r => r.ok ? r.json() : null).then(p => { if (p) try { localStorage.setItem('ss_prefs', JSON.stringify({ timeFormat: p.timeFormat || null, studyMinutes: p.studyMinutes || null })); } catch (e) {} }).catch(() => {});

function sbFormatTime(mins) {
  let h = Math.floor(mins / 60), m = mins % 60;
  if (ssPrefs().timeFormat === '24h') return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return h + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + ampm;
}

function sbAddBlock() {
  const day = document.getElementById('sb-block-day').value;
  const startEl = document.getElementById('sb-block-start');
  const endEl = document.getElementById('sb-block-end');
  const statusEl = document.getElementById('sb-status');
  const startMin = sbTimeToMinutes(startEl.value);
  const endMin = sbTimeToMinutes(endEl.value);
  if (startMin === null || endMin === null) { statusEl.textContent = 'Pick a start and end time.'; return; }
  if (endMin <= startMin) { statusEl.textContent = 'End time must be after the start time.'; return; }
  statusEl.textContent = '';
  sbFreeBlocks.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), day: day, start: startEl.value, end: endEl.value });
  sbRenderBlocks();
  sbSeedGridFromBlocks();
  sbRenderGrid();
}

// Quick-start presets: replace the current free-time grid with a common
// pattern instead of making a student paint 5-7 blocks by hand. "Light"
// targets a sustainable daily habit; "Exam Crunch" front-loads more time
// for a short push before a test.
const SB_PRESETS = {
  light: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '16:00', end: '16:15' },
  crunch: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '17:00', end: '18:00' }
};

function sbApplyPreset(name) {
  const preset = SB_PRESETS[name];
  if (!preset) return;
  sbFreeBlocks = preset.days.map(function (day) {
    return { id: 'preset-' + name + '-' + day, day: day, start: preset.start, end: preset.end };
  });
  sbRenderBlocks();
  sbSeedGridFromBlocks();
  sbRenderGrid();
  const statusEl = document.getElementById('sb-status');
  if (statusEl) statusEl.textContent = 'Preset applied — feel free to adjust any day before building your schedule.';
}

// Queues every not-yet-assessed subject's diagnostic back-to-back instead of
// making the student bounce back to the dashboard after each one: the queue
// is read by ssDiagBatchRenderContinue() in the guide template's logic.js,
// which offers a one-click "Next subject" button once each diagnostic ends.
function sbStartDiagBatch(subjects) {
  if (!subjects || !subjects.length) return;
  const queue = subjects.map(function (s) { return { href: s.href, label: s.label }; });
  const first = queue.shift();
  try { sessionStorage.setItem('ssDiagBatchQueue', JSON.stringify(queue)); } catch (e) { /* ignore */ }
  location.href = first.href + (first.href.indexOf('?') === -1 ? '?' : '&') + 'diagnostic=1';
}

function sbRemoveBlock(id) {
  sbFreeBlocks = sbFreeBlocks.filter(function (b) { return b.id !== id; });
  sbRenderBlocks();
  sbSeedGridFromBlocks();
  sbRenderGrid();
}

function sbRenderBlocks() {
  const wrap = document.getElementById('sb-blocks-list');
  if (!wrap) return;
  const byDay = {};
  sbFreeBlocks.forEach(function (b) { (byDay[b.day] = byDay[b.day] || []).push(b); });
  Object.keys(byDay).forEach(function (k) {
    byDay[k].sort(function (a, b) { return sbTimeToMinutes(a.start) - sbTimeToMinutes(b.start); });
  });

  const rows = SB_DAYS.filter(function (d) { return byDay[d.key] && byDay[d.key].length; }).map(function (d) {
    const chips = byDay[d.key].map(function (b) {
      return '<span class="sb-block-chip">' + sbFormatTime(sbTimeToMinutes(b.start)) + '–' + sbFormatTime(sbTimeToMinutes(b.end))
        + '<button type="button" data-remove-block="' + b.id + '" aria-label="Remove block">✕</button></span>';
    }).join('');
    return '<div class="sb-block-day-row"><span class="sb-block-day-label">' + d.label + '</span>' + chips + '</div>';
  }).join('');

  wrap.innerHTML = rows || '<div style="font-size:12.5px;color:var(--text-muted);">No free blocks added yet.</div>';
  wrap.querySelectorAll('button[data-remove-block]').forEach(function (btn) {
    btn.addEventListener('click', function () { sbRemoveBlock(btn.dataset.removeBlock); });
  });
}

function sbRenderSubjects() {
  const wrap = document.getElementById('sb-subjects');
  if (!wrap) return;

  // Grouped by the same category taxonomy as Settings' class list, in the
  // same order, so subjects are easy to scan instead of one flat 50-item list.
  const byCat = {};
  SUBJECTS_FOR_SCHEDULE.forEach(function (s) {
    const cat = SUBJECT_CATEGORY[s.key] || 'electives';
    (byCat[cat] = byCat[cat] || []).push(s);
  });

  let html = '';
  CATEGORY_ORDER.forEach(function (catKey) {
    const subjects = byCat[catKey];
    if (!subjects || !subjects.length) return;
    const openCount = subjects.filter(function (s) {
      return sbSelectedSubjects.some(function (x) { return x.key === s.key; });
    }).length;
    html += '<details class="sb-cat"' + (openCount ? ' open' : '') + '>'
      + '<summary><span>' + CATEGORY_LABELS[catKey] + '</span>'
      + '<span class="sb-cat-count">' + subjects.length + '</span>'
      + '<svg class="sb-cat-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
      + '</summary>'
      + '<div class="sb-cat-body">';
    subjects.forEach(function (s) {
      const idx = sbSelectedSubjects.findIndex(function (x) { return x.key === s.key; });
      const sel = idx === -1 ? null : sbSelectedSubjects[idx];
      html += '<div class="sb-subject-row"><label>'
        + '<input type="checkbox" data-subj="' + s.key + '"' + (sel ? ' checked' : '') + '/>'
        + '<span class="sb-swatch" style="background:' + SUBJECT_COLORS[s.key] + '"></span>' + s.label + '</label>';
      if (sel) {
        const subjLabelEsc = ssEscapeHtml(s.label);
        html += '<select class="sb-unit-sel" data-subj-unit="' + s.key + '" aria-label="Unit to study for ' + subjLabelEsc + '">'
          + '<option value="auto"' + (sel.unitMode === 'auto' ? ' selected' : '') + '>Auto (weakest first)</option>'
          + s.units.map(function (u) {
              return '<option value="' + u.id + '"' + (sel.unitMode === String(u.id) ? ' selected' : '') + '>' + ssEscapeHtml(u.name) + '</option>';
            }).join('')
          + '</select>'
          + '<button class="sb-prio-btn" data-prio-up="' + s.key + '" aria-label="Move ' + subjLabelEsc + ' up in priority"' + (idx <= 0 ? ' disabled' : '') + '>↑</button>'
          + '<button class="sb-prio-btn" data-prio-down="' + s.key + '" aria-label="Move ' + subjLabelEsc + ' down in priority"' + (idx >= sbSelectedSubjects.length - 1 ? ' disabled' : '') + '>↓</button>';
      }
      html += '</div>';
    });
    html += '</div></details>';
  });
  wrap.innerHTML = html;

  wrap.querySelectorAll('input[data-subj]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const key = cb.dataset.subj;
      if (cb.checked) {
        if (!sbSelectedSubjects.find(function (x) { return x.key === key; })) sbSelectedSubjects.push({ key: key, unitMode: 'auto' });
      } else {
        sbSelectedSubjects = sbSelectedSubjects.filter(function (x) { return x.key !== key; });
      }
      sbRenderSubjects();
    });
  });
  wrap.querySelectorAll('select[data-subj-unit]').forEach(function (selEl) {
    selEl.addEventListener('change', function () {
      const item = sbSelectedSubjects.find(function (x) { return x.key === selEl.dataset.subjUnit; });
      if (item) item.unitMode = selEl.value;
    });
  });
  wrap.querySelectorAll('button[data-prio-up]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = sbSelectedSubjects.findIndex(function (x) { return x.key === btn.dataset.prioUp; });
      if (idx > 0) {
        const tmp = sbSelectedSubjects[idx - 1]; sbSelectedSubjects[idx - 1] = sbSelectedSubjects[idx]; sbSelectedSubjects[idx] = tmp;
        sbRenderSubjects();
      }
    });
  });
  wrap.querySelectorAll('button[data-prio-down]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = sbSelectedSubjects.findIndex(function (x) { return x.key === btn.dataset.prioDown; });
      if (idx < sbSelectedSubjects.length - 1) {
        const tmp = sbSelectedSubjects[idx + 1]; sbSelectedSubjects[idx + 1] = sbSelectedSubjects[idx]; sbSelectedSubjects[idx] = tmp;
        sbRenderSubjects();
      }
    });
  });
}

// Smooth weighted round-robin: higher-priority subjects (earlier in the
// array) get proportionally more of the free days, interleaved rather
// than clustered on consecutive days.
function sbWeightedRoundRobin(items, dayCount) {
  if (!items.length) return [];
  const weights = items.map(function (_, i) { return items.length - i; });
  const totalWeight = weights.reduce(function (a, b) { return a + b; }, 0);
  const credits = items.map(function () { return 0; });
  const result = [];
  for (let i = 0; i < dayCount; i++) {
    weights.forEach(function (w, idx) { credits[idx] += w; });
    let maxIdx = 0;
    for (let j = 1; j < credits.length; j++) if (credits[j] > credits[maxIdx]) maxIdx = j;
    result.push(items[maxIdx]);
    credits[maxIdx] -= totalWeight;
  }
  return result;
}

// Classroom due dates are calendar dates, not day-of-week -- map each
// upcoming (next 7 days, not yet done/submitted) due date to the weekday it
// falls on so sbBuildSchedule() can flag a recurring weekly slot that lands
// on a day something's due.
function sbUpcomingDueDayKeys() {
  const DOW_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const keys = new Set();
  (sbAssignmentsCache || []).forEach(function (item) {
    if (!item.dueAt || item.state === 'done' || item.state === 'submitted') return;
    const d = new Date(item.dueAt);
    if (isNaN(d.getTime()) || d < now || d > in7) return;
    keys.add(DOW_TO_KEY[d.getDay()]);
  });
  return keys;
}

function sbBuildSchedule() {
  const statusEl = document.getElementById('sb-status');
  const resultEl = document.getElementById('sb-result');

  if (!sbFreeBlocks.length) { statusEl.textContent = 'Add at least one free time block.'; resultEl.innerHTML = ''; return; }
  if (!sbSelectedSubjects.length) { statusEl.textContent = 'Pick at least one subject.'; resultEl.innerHTML = ''; return; }
  statusEl.textContent = '';

  const orderedBlocks = SB_DAYS.reduce(function (acc, d) {
    const dayBlocks = sbFreeBlocks.filter(function (b) { return b.day === d.key; })
      .sort(function (a, b) { return sbTimeToMinutes(a.start) - sbTimeToMinutes(b.start); });
    return acc.concat(dayBlocks);
  }, []);

  const assignment = sbWeightedRoundRobin(sbSelectedSubjects, orderedBlocks.length);
  const blocksByDay = {};
  const resolvedBlocks = [];

  orderedBlocks.forEach(function (block, i) {
    const subj = assignment[i];
    const cfg = SUBJECTS_CONFIG.find(function (s) { return s.key === subj.key; });
    const unitNames = {}; cfg.units.forEach(function (u) { unitNames[u.id] = u.name; });
    const unitIds = cfg.units.map(function (u) { return u.id; });
    const subjectData = (sbBlob && sbBlob[subj.key]) || {};

    let unitId = null, unitLabel = '';
    if (subj.unitMode && subj.unitMode !== 'auto') {
      unitId = parseInt(subj.unitMode, 10);
      unitLabel = unitNames[unitId] || '';
    } else {
      const rec = recommendNext(subjectData.mastery || {}, unitIds, unitNames);
      if (rec.type === 'practice') { unitId = rec.unitId; unitLabel = rec.unitName + ' (' + rec.pct + '%)'; }
      else if (rec.type === 'diagnostic') { unitLabel = 'Diagnostic — not started yet'; }
      else { unitLabel = 'Practice Exam — everything mastered!'; }
    }

    const href = unitId ? cfg.href + '?practice=' + unitId : cfg.href;
    const timeLabel = sbFormatTime(sbTimeToMinutes(block.start)) + '–' + sbFormatTime(sbTimeToMinutes(block.end));
    (blocksByDay[block.day] = blocksByDay[block.day] || []).push({
      subjectLabel: cfg.label, color: SUBJECT_COLORS[subj.key] || '#475569', unitLabel: unitLabel, href: href, timeLabel: timeLabel,
      start: block.start, end: block.end
    });
    resolvedBlocks.push({ day: block.day, start: block.start, end: block.end, subjectKey: subj.key, subjectLabel: cfg.label });
  });

  const dueDayKeys = sbUpcomingDueDayKeys();

  resultEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">'
    + SB_DAYS.map(function (d) {
        const blocks = blocksByDay[d.key];
        if (!blocks || !blocks.length) return '<div class="sb-block-empty">' + d.label + '<br/>Not scheduled</div>';
        const conflictNote = dueDayKeys.has(d.key)
          ? '<div class="sb-conflict-note">⚠️ Something\'s due this day</div>' : '';
        return '<div style="display:flex;flex-direction:column;gap:8px;min-width:0;">'
          + conflictNote
          + blocks.map(function (block, i) {
              // Back-to-back blocks (this one's end lines up with the next
              // one's start) get a short break noted between them instead of
              // running straight into the next subject with zero breathing
              // room -- purely visual, doesn't shorten either block.
              const next = blocks[i + 1];
              const backToBack = next && next.start === block.end;
              return '<a class="sb-block" href="' + block.href + '" style="background:' + block.color + '">'
                + '<div class="sb-block-day">' + d.label + ' · ' + block.timeLabel + '</div>'
                + '<div class="sb-block-subject">' + ssEscapeHtml(block.subjectLabel) + '</div>'
                + '<div class="sb-block-unit">' + ssEscapeHtml(block.unitLabel) + '</div>'
                + '</a>'
                + (backToBack ? '<div class="sb-buffer-note">↓ 5 min break</div>' : '');
            }).join('')
          + '</div>';
      }).join('')
    + '</div>';

  try {
    localStorage.setItem('ssScheduleConfig', JSON.stringify({ blocks: sbFreeBlocks, subjects: sbSelectedSubjects }));
  } catch (e) { /* ignore */ }

  sbSyncScheduleAndMaybeAskNotify(resolvedBlocks);
}

// ----- push notifications for scheduled blocks -----
const SB_VAPID_PUBLIC_KEY = 'BFLqJyuV9vTCmo9TTgfsX9yOgI1DhUopA1Bm7Kw-Raxt5aD9286kiIVFLPcCWuInwcNzsTIuuAX-439U_D2WH1Q';

function sbUrlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function sbPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

async function sbGetPushSubscription() {
  if (!sbPushSupported()) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function sbPersistSchedule(blocks, notifyEnabled) {
  if (!SS_SESSION) return;
  const statusEl = document.getElementById('sb-status');
  let timezone = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: blocks, notifyEnabled: !!notifyEnabled, timezone: timezone })
    });
    // A non-2xx here (expired session, server error) previously looked
    // identical to success -- the schedule still renders from local state,
    // so nothing else would ever surface that it silently failed to sync.
    if (statusEl) statusEl.textContent = res.ok ? 'Synced ✓' : "Couldn't sync to your account — saved on this device only";
    if (statusEl && res.ok) setTimeout(function () { if (statusEl.textContent === 'Synced ✓') statusEl.textContent = ''; }, 2500);
  } catch (e) {
    // offline - the schedule still works locally, just won't drive
    // server-side reminders until the next successful sync
    if (statusEl) statusEl.textContent = "Offline — saved on this device only";
  }
}

async function sbSyncScheduleAndMaybeAskNotify(blocks) {
  if (!SS_SESSION || !blocks.length) return;

  const prompt = document.getElementById('sb-notify-prompt');
  const status = document.getElementById('sb-notify-status');
  let alreadySubscribed = false;
  try { alreadySubscribed = !!(await sbGetPushSubscription()); } catch (e) { /* unsupported browser */ }

  if (alreadySubscribed) {
    await sbPersistSchedule(blocks, true);
    if (prompt) prompt.style.display = 'none';
    return;
  }

  await sbPersistSchedule(blocks, false);

  let alreadyAsked = false;
  try { alreadyAsked = localStorage.getItem('ssScheduleNotifyAsked') === '1'; } catch (e) { /* ignore */ }
  if (alreadyAsked || !sbPushSupported() || (typeof Notification !== 'undefined' && Notification.permission === 'denied')) return;

  if (prompt) {
    prompt.style.display = 'block';
    status.textContent = '';
  }

  const yesBtn = document.getElementById('sb-notify-yes-btn');
  const noBtn = document.getElementById('sb-notify-no-btn');
  if (yesBtn) yesBtn.onclick = async function () {
    status.textContent = '';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        status.textContent = "Notifications weren't allowed — you can turn them on later in Settings.";
        try { localStorage.setItem('ssScheduleNotifyAsked', '1'); } catch (e) { /* ignore */ }
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: sbUrlBase64ToUint8Array(SB_VAPID_PUBLIC_KEY)
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() })
      });
      await sbPersistSchedule(blocks, true);
      try { localStorage.setItem('ssScheduleNotifyAsked', '1'); } catch (e) { /* ignore */ }
      status.textContent = "Enabled! You'll get a reminder when each block starts.";
      setTimeout(function () { if (prompt) prompt.style.display = 'none'; }, 1800);
    } catch (e) {
      status.textContent = 'Something went wrong — try again from Settings.';
    }
  };
  if (noBtn) noBtn.onclick = function () {
    try { localStorage.setItem('ssScheduleNotifyAsked', '1'); } catch (e) { /* ignore */ }
    if (prompt) prompt.style.display = 'none';
  };
}

function sbRestoreSavedConfig() {
  try {
    const raw = localStorage.getItem('ssScheduleConfig');
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    if (Array.isArray(cfg.blocks)) sbFreeBlocks = cfg.blocks.filter(function (b) {
      return b && b.id && b.day && b.start && b.end;
    });
    if (Array.isArray(cfg.subjects)) sbSelectedSubjects = cfg.subjects.filter(function (s) {
      return SUBJECTS_CONFIG.some(function (c) { return c.key === s.key; });
    });
    return true;
  } catch (e) { return false; }
}

// True when this browser holds saved practice for any guide (written by each guide's mastery module).
function ssLocalProgressCount() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('ssMastery_') === 0 && localStorage.getItem(k) && localStorage.getItem(k) !== '{}') n++;
    }
  } catch (e) {}
  return n;
}
function ssHasLocalProgress() { return ssLocalProgressCount() > 0; }

function localFallback() {
  // Same keys/shape the shared module writes on each subject's page (same
  // origin, so this page can read them directly) - used only if the server
  // fetch below fails.
  function readLocal(subject) {
    try {
      const raw = localStorage.getItem('ssMastery_' + subject);
      return raw ? JSON.parse(raw) : { mastery: {} };
    } catch (e) { return { mastery: {} }; }
  }
  const blob = {};
  SUBJECTS_CONFIG.forEach(s => { blob[s.key] = readLocal(s.key); });
  return blob;
}

// Time-of-day + first-name + streak-status greeting under the dashboard
// heading. First name only (not the full session name, which may be a
// full "First Last" from the OAuth provider) to keep it a greeting, not a
// formal address. Streak status only speaks up when it's actually at risk
// (today not yet active) or notably long -- otherwise it stays quiet
// rather than repeating what the streak badge below already shows.
function renderDashGreeting(session, blob) {
  const el = document.getElementById('dash-greeting');
  if (!el) return;
  const hour = new Date().getHours();
  const timeGreeting = hour < 5 ? 'Burning the midnight oil' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good evening';
  const firstName = (session && session.name || '').trim().split(/\s+/)[0];
  let text = firstName ? `${timeGreeting}, ${firstName}.` : `${timeGreeting}.`;

  const streak = blob && blob.streak;
  if (streak && streak.current > 0) {
    const today = streak.timezone ? new Intl.DateTimeFormat('en-CA', { timeZone: streak.timezone }).format(new Date()) : null;
    const activeToday = today && streak.lastActiveDate === today;
    if (!activeToday) text += ` Your ${streak.current}-day streak is waiting on you today.`;
    else if (streak.current >= 7) text += ` ${streak.current} days strong — keep it up.`;
  }
  el.textContent = text;

  // A signed-in student who has never saved any classes hasn't really been
  // onboarded yet -- send them straight to the setup wizard instead of
  // showing them an empty dashboard. The ob-done flag is an escape hatch for
  // someone who deliberately finished the wizard without picking classes,
  // so they don't get bounced back in on every dashboard visit.
  const enrolledCount = (blob && blob.enrolledSubjects || []).length;
  let obDone = false;
  try { obDone = localStorage.getItem('ob-step-v2') === '4' || localStorage.getItem('ob-done-v2') === '1'; } catch (e) {}
  if (!enrolledCount && !obDone) {
    location.replace('/onboarding');
    return;
  }
}

function renderSkeletons() {
  const subjectsEl = document.getElementById('dash-subjects');
  // About as many placeholders as the student has classes with progress (not one per guide on the site).
  const placeholders = Array.from({ length: Math.min(6, Math.max(2, ssLocalProgressCount())) });
  subjectsEl.innerHTML = placeholders.map(function(){
    return '<div class="ss-card" aria-hidden="true">'
      + '<div class="skel-bar" style="width:140px;height:20px;margin-bottom:14px;"></div>'
      + '<div class="skel-bar" style="width:100%;height:10px;margin-bottom:10px;"></div>'
      + '<div class="skel-bar" style="width:70%;height:10px;margin-bottom:18px;"></div>'
      + '<div class="skel-bar" style="width:100%;height:36px;border-radius:10px;"></div>'
      + '</div>';
  }).join('');
}

function dashFormatDueDate(dueAt) {
  if (!dueAt) return 'No due date';
  const d = new Date(dueAt);
  if (isNaN(d.getTime())) return 'No due date';
  const now = new Date();
  const startOfDay = function (dt) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); };
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (dayDiff < 0) return 'Overdue';
  if (dayDiff === 0) return 'Due today';
  if (dayDiff === 1) return 'Due tomorrow';
  if (dayDiff < 7) return 'Due ' + d.toLocaleDateString(undefined, { weekday: 'short' });
  return 'Due ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dashFormatSyncAge(fetchedAt) {
  if (!fetchedAt) return '';
  const ms = Date.now() - Date.parse(fetchedAt);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'Last synced just now';
  if (mins < 60) return 'Last synced ' + mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
  const hours = Math.round(mins / 60);
  if (hours < 24) return 'Last synced ' + hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
  const days = Math.round(hours / 24);
  return 'Last synced ' + days + ' day' + (days === 1 ? '' : 's') + ' ago';
}

async function loadDashAssignments(forceRefresh) {
  const body = document.getElementById('dash-assignments-body');
  const syncRow = document.getElementById('dash-assignments-sync');
  const syncLabel = document.getElementById('dash-assignments-sync-label');
  if (!body) return;
  if (syncRow) syncRow.style.display = 'none';

  // Always fetch assignments regardless of Google-connected status -- a
  // student who only uses the syllabus feature (never connects Google)
  // still has syllabus-sourced items to show, and this is the only fetch
  // that returns them. Google's connected state only decides what the
  // *empty*-state fallback says.
  let settings = { connected: false };
  try {
    const sres = await fetch('/api/google/settings');
    if (sres.status !== 401 && sres.ok) settings = await sres.json();
  } catch (e) {
    // best-effort -- an unreachable settings endpoint shouldn't block the
    // assignments fetch below, it only affects the empty-state CTA copy
  }

  let data;
  try {
    const ares = await fetch('/api/assignments' + (forceRefresh ? '?refresh=1' : ''));
    if (ares.status === 401) { body.innerHTML = ''; return; }
    if (!ares.ok) throw new Error('bad status ' + ares.status);
    data = await ares.json();
    sbAssignmentsCache = data.items || [];
  } catch (e) {
    body.innerHTML = '<p style="margin:0;font-size:13.5px;color:var(--text-muted);">Couldn\'t load your assignments right now.</p>';
    return;
  }

  if (!data.items || !data.items.length) {
    if (!settings.connected) {
      body.innerHTML = '<p style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);">See your Google Classroom assignments and calendar right here.</p>'
        + '<a class="ss-cta-btn" href="/auth/google/connect/start?next=' + encodeURIComponent(location.pathname) + '" style="display:inline-block;background:var(--accent-solid);color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:13.5px;font-weight:700;">Connect Google Classroom</a>';
    } else {
      body.innerHTML = '<p style="margin:0;font-size:13.5px;color:var(--text-muted);">You\'re all caught up — nothing due.</p>';
    }
    return;
  }

  if (syncRow && syncLabel && data.fetchedAt) {
    syncLabel.textContent = dashFormatSyncAge(data.fetchedAt);
    syncRow.style.display = 'flex';
  }

  const items = (data.items || []).slice().sort(function (a, b) {
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt) - new Date(b.dueAt);
  }).slice(0, 6);

  if (!items.length) {
    body.innerHTML = '<p style="margin:0;font-size:13.5px;color:var(--text-muted);">You\'re all caught up — nothing due.</p>';
    return;
  }

  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:2px;">' + items.map(function (item) {
    const isDone = item.state === 'done' || item.state === 'submitted';
    const titleHtml = ssEscapeHtml(item.title || 'Untitled');
    const courseHtml = item.courseName ? ssEscapeHtml(item.courseName) + ' · ' : '';
    const dueLabel = dashFormatDueDate(item.dueAt);
    // Only the genuinely time-pressured states (overdue/today/tomorrow) get
    // a colored pill -- badging every far-future due date too would just be
    // visual noise with nothing urgent to signal. An already-submitted
    // assignment never gets an urgency badge even if its due date is past --
    // Classroom already knows it's handled, so a red "Overdue" pill there
    // would be a false alarm, not a real one.
    const urgentColors = { 'Overdue': 'var(--status-red)', 'Due today': 'var(--status-red)', 'Due tomorrow': 'var(--status-amber)' };
    const badgeColor = isDone ? null : urgentColors[dueLabel];
    const dueHtml = isDone
      ? '<span style="display:inline-block;background:var(--done-badge-bg);color:var(--status-badge-text);font-weight:700;font-size:11px;padding:2px 8px;border-radius:999px;margin-left:4px;">✓ ' + (item.state === 'done' ? 'Graded' : 'Submitted') + '</span>'
      : (badgeColor
        ? '<span style="display:inline-block;background:' + badgeColor + ';color:var(--status-badge-text);font-weight:700;font-size:11px;padding:2px 8px;border-radius:999px;margin-left:4px;">' + ssEscapeHtml(dueLabel) + '</span>'
        : ssEscapeHtml(dueLabel));
    const titleStyle = 'font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      + (isDone ? 'opacity:.6;text-decoration:line-through;' : '');
    const inner = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:9px 0;border-top:1px solid var(--border);">'
      + '<div style="min-width:0;"><div style="' + titleStyle + '">' + titleHtml + '</div>'
      + '<div style="font-size:12.5px;color:var(--text-muted);">' + courseHtml + dueHtml + '</div></div>'
      + '</div>';
    const safeLink = /^https:\/\//i.test(item.link || '') ? item.link : null;
    return safeLink
      ? '<a href="' + ssEscapeHtml(safeLink) + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">' + inner + '</a>'
      : inner;
  }).join('') + '</div>';
}

// "Continue where you left off": the progress data model has no per-subject
// last-active timestamp (only a global blob.updatedAt), so this reads a
// localStorage marker the dashboard itself stamps when a student clicks
// into a subject card (see renderDashSubjects above). Honest but limited:
// it only knows about visits that started from this dashboard, on this
// device/browser -- a visit made directly from a bookmark, or from another
// device, won't update it. Hidden entirely for first-time users.
// "Today's plan": turns the goal saved in onboarding (test in N days,
// M minutes a day) into today's concrete work -- practice questions on the
// student's weakest assessed unit plus a flashcard review -- with a live
// countdown and a progress bar for questions answered today. Without a
// saved goal it still names the weakest unit (the old focus banner).
// Saves a study goal from the Today's plan picker (20 min/day; onboarding or Settings can change it).
async function ssSaveTestGoal(e) {
  e.preventDefault();
  const form = e.target, btn = form.querySelector('button');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const r = await fetch('/api/goal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: Number(form.days.value), minutesPerDay: 20 }) });
    if (!r.ok) throw new Error();
    location.reload();
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Couldn\u2019t save, try again';
  }
  return false;
}
function renderTodayPlan(subjects, blob) {
  const el = document.getElementById('dash-focus');
  if (!el) return;
  let worst = null; // weakest assessed unit across the student's classes
  subjects.forEach(function (s) {
    const unitNames = {};
    s.units.forEach(u => { unitNames[u.id] = u.name; });
    const weak = topWeakUnits((blob[s.key] || {}).mastery || {}, s.units.map(u => u.id), unitNames, 1);
    if (weak.length && (!worst || weak[0].pct < worst.pct)) worst = Object.assign({ subject: s }, weak[0]);
  });
  const goal = blob.goal && blob.goal.days && blob.goal.minutesPerDay ? blob.goal : null;
  // Spaced-repetition cards due now (per subject, from the account's saved schedule), and the exam
  // date saved on the homepage -- used when there is no onboarding goal.
  const due = dueCards(blob, subjects.map(s => s.key));
  const dueSubject = due.best ? subjects.find(s => s.key === due.best.key) : null;
  let exam = null;
  try {
    const e = JSON.parse(localStorage.getItem('ss-exam') || 'null');
    const d = e ? daysUntil(e.date) : null;
    if (d !== null && d >= 0) exam = { days: d, label: e.label || 'Exam' };
  } catch (x) { /* no saved exam date */ }
  if (!goal && !dueSubject && !exam && (!worst || worst.pct >= 80)) { el.style.display = 'none'; el.innerHTML = ''; return; }

  const MIN_PER_Q = 1.5, CARDS_PER_MIN = 3;
  let head = '', tasks = [], progress = '';
  if (goal) {
    const saved = goal.savedAt ? new Date(goal.savedAt) : new Date();
    const elapsed = Math.floor((Date.now() - saved.getTime()) / 86400000);
    const left = Math.max(0, goal.days - elapsed);
    head = left === 0 ? 'Test day — you\'ve got this.' : (left === 1 ? 'Test tomorrow' : 'Test in ' + left + ' days');
    const qTarget = Math.max(5, Math.round((goal.minutesPerDay * 0.7) / MIN_PER_Q));
    const cardTarget = Math.max(5, Math.round(goal.minutesPerDay * 0.3 * CARDS_PER_MIN));
    // Answered today = current total minus the last daily snapshot taken before today.
    const today = new Date().toISOString().slice(0, 10);
    const hist = (blob.history || []).filter(h => h.date < today);
    let total = 0;
    SUBJECTS_CONFIG.forEach(s => Object.values(((blob[s.key] || {}).mastery) || {}).forEach(r => { total += r.total || 0; }));
    const base = hist.length ? (hist[hist.length - 1].totalAnswered || 0) : null;
    if (base !== null) {
      const done = Math.max(0, total - base), pct = Math.min(100, Math.round(done / qTarget * 100));
      progress = '<div class="tp-progress"><div class="tp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + qTarget + '" aria-valuenow="' + Math.min(done, qTarget) + '" aria-label="Questions answered today"><span style="width:' + pct + '%"></span></div>'
        + '<span>' + Math.min(done, qTarget) + ' / ' + qTarget + ' questions today' + (done >= qTarget ? ' — done!' : '') + '</span></div>';
    }
    const practiceSubj = worst ? worst.subject : subjects[0];
    tasks.push(worst && worst.pct < 80
      ? { href: worst.subject.href + '?practice=' + worst.unitId, title: 'Practice ' + qTarget + ' questions', sub: worst.unitName + ' · ' + worst.subject.label + ' · ' + worst.pct + '% so far' }
      : { href: practiceSubj.href + '/quiz', title: 'Practice ' + qTarget + ' questions', sub: practiceSubj.label + ' · mixed units' });
    if (!dueSubject) tasks.push({ href: practiceSubj.href + '/flashcards', title: 'Review ' + cardTarget + ' flashcards', sub: practiceSubj.label });
  } else {
    head = exam ? (exam.days === 0 ? exam.label + ' is today' : exam.label + ' in ' + exam.days + ' day' + (exam.days === 1 ? '' : 's')) : 'Today\'s focus';
    if (worst && worst.pct < 80) tasks.push({ href: worst.subject.href + '?practice=' + worst.unitId, title: worst.unitName, sub: worst.subject.label + ' — your weakest topic at ' + worst.pct + '%' });
  }
  // Due cards go first: spaced repetition only works if they are reviewed on time.
  if (dueSubject) {
    tasks.unshift({
      href: dueSubject.href + '/flashcards?due=1',
      title: 'Review ' + due.total + ' due flashcard' + (due.total === 1 ? '' : 's'),
      sub: dueSubject.label + (due.best.n < due.total ? ' (most of them) · more in other classes' : '') + ' · due now'
    });
  }
  const ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  el.style.display = 'block';
  el.innerHTML = '<section class="ss-card today-plan" aria-labelledby="tp-h">'
    + '<div class="tp-top"><div><div class="tp-label">Today\'s plan' + (goal ? ' · ' + goal.minutesPerDay + ' min' : '') + '</div>'
    + '<h2 id="tp-h" class="tp-head">' + ssEscapeHtml(head) + '</h2></div>'
    + (goal ? '' : '<form class="tp-set-form" onsubmit="return ssSaveTestGoal(event)"><label for="tp-days">My test is</label> <select id="tp-days" name="days"><option value="7">this week</option><option value="14">in 2 weeks</option><option value="30" selected>in a month</option><option value="90">later this year</option></select> <button class="tp-set" type="submit">Plan my study</button></form>') + '</div>'
    + progress
    + '<ol class="tp-tasks">' + tasks.map(t => '<li><a href="' + ssEscapeHtml(t.href) + '"><span><b>' + ssEscapeHtml(t.title) + '</b><small>' + ssEscapeHtml(t.sub) + '</small></span>' + ICON + '</a></li>').join('') + '</ol>'
    + '</section>';
}

function renderResumeBanner(availableSubjects) {
  const el = document.getElementById('dash-resume');
  if (!el) return;
  let last;
  try {
    last = JSON.parse(localStorage.getItem('ss-last-subject') || 'null');
  } catch (e) { last = null; }

  if (!last || !last.key || !last.href) { el.style.display = 'none'; el.innerHTML = ''; return; }
  // Only resume into a subject still visible on this dashboard (e.g. not
  // removed from the student's class list since the last visit).
  const stillAvailable = availableSubjects.some(s => s.key === last.key);
  if (!stillAvailable) { el.style.display = 'none'; el.innerHTML = ''; return; }

  el.style.display = 'block';
  el.innerHTML = '<div class="ss-resume-card">'
    + '<div><div style="font-size:12.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Continue where you left off</div>'
    + '<div style="font-size:18px;font-weight:800;color:var(--text);margin-top:2px;">' + ssEscapeHtml(last.label) + '</div></div>'
    + '<a href="' + ssEscapeHtml(last.href) + '" class="ss-cta-btn" style="background:var(--accent-solid);color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;white-space:nowrap;">Resume →</a>'
    + '</div>';
}

async function loadDashboard() {
  const session = await ssCheckSession();
  const gate = document.getElementById('dash-gate');
  const content = document.getElementById('dash-content');
  // Someone who has practised without an account already has progress on this device: show it, with a nudge to sync,
  // instead of a sign-in wall. Only a visitor with nothing saved sees the sign-in card.
  const anon = !session;
  if (anon && !ssHasLocalProgress()) {
    gate.style.display = 'block';
    gate.querySelector('.ss-login-box').innerHTML = ssLoginBoxHtml();
    return;
  }
  content.style.display = 'block';
  renderSkeletons();
  if (anon) {
    const card = document.getElementById('dash-assignments-card');
    if (card) card.style.display = 'none';
    const strip = document.createElement('div');
    strip.style.cssText = 'max-width:840px;margin:0 auto 14px;padding:12px 16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card);font-size:14px;color:var(--text);text-align:center;';
    strip.innerHTML = '<div style="margin-bottom:8px;">This is your progress saved on this device. Sign in to sync it across devices and keep your streak.</div><div class="ss-login-box"></div>';
    content.insertBefore(strip, content.firstChild);
    strip.querySelector('.ss-login-box').innerHTML = ssLoginBoxHtml();
  } else loadDashAssignments().catch(function () {
    const body = document.getElementById('dash-assignments-body');
    if (body) body.innerHTML = '<p style="margin:0;font-size:13.5px;color:var(--text-muted);">Couldn\'t load your assignments right now.</p>';
  });
  const refreshBtn = document.getElementById('dash-assignments-refresh-btn');
  if (refreshBtn && !anon) refreshBtn.addEventListener('click', function () {
    refreshBtn.disabled = true;
    const label = document.getElementById('dash-assignments-sync-label');
    if (label) label.textContent = 'Refreshing…';
    loadDashAssignments(true).finally(function () { refreshBtn.disabled = false; });
  });

  let blob;
  let syncFailed = false;
  try {
    if (anon) throw new Error('local only');
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error('bad response');
    blob = await res.json();
  } catch (e) {
    blob = localFallback();
    syncFailed = !anon;
  }

  if (syncFailed) {
    const notice = document.createElement('p');
    notice.style.cssText = 'max-width:840px;margin:0 auto 12px;font-size:13px;color:var(--text-muted);text-align:center;';
    notice.textContent = "Couldn't sync with your account — showing your last saved progress on this device.";
    content.insertBefore(notice, content.firstChild);
  }

  // Same "enrolled classes" preference Settings writes and the homepage
  // reads (blob.enrolledSubjects, from /api/progress) -- keeps the
  // dashboard in sync with Settings instead of always listing every guide.
  renderDashGreeting(session, blob);

  const enrolledSet = new Set(blob.enrolledSubjects || []);
  SUBJECTS_FOR_SCHEDULE = enrolledSet.size === 0 ? SUBJECTS_CONFIG : SUBJECTS_CONFIG.filter(s => enrolledSet.has(s.key));
  const noteEl = document.getElementById('dash-classes-note');
  const filterInputEl = document.getElementById('dash-subject-filter');
  let dashShowAll = enrolledSet.size === 0;
  window.dashShowAllClasses = function(){ dashShowAll = true; renderDashSubjects(); };

  // Badges are derived entirely from data already in `blob` -- no new
  // storage, no new API routes. Computed over every subject with saved
  // progress (SUBJECTS_CONFIG), not just the enrolled/visible subset, so a
  // badge earned before a student edited their class list still counts.
  // XP/leveling: layers on top of the same badge/mastery data (computeBadges,
  // Object.values(subj.mastery)) rather than tracking anything new server-side
  // -- consistent with how badges themselves are purely derived, no new
  // storage or API routes. Levels use a rising curve (each level needs more
  // XP than the last) so early levels come quickly and later ones feel earned.
  function xpForLevel(level) {
    return Math.round(100 * Math.pow(Math.max(0, level - 1), 1.6));
  }
  function levelFromXP(xp) {
    let level = 1;
    while (xpForLevel(level + 1) <= xp) level++;
    return level;
  }
  function computeXP(blob) {
    let totalCorrect = 0, totalCardsKnown = 0, totalExamplesDone = 0;
    SUBJECTS_CONFIG.forEach(function (s) {
      const subj = blob[s.key];
      if (!subj) return;
      Object.values(subj.mastery || {}).forEach(function (rec) { totalCorrect += rec.correct || 0; });
      totalCardsKnown += (subj.cardsKnown || []).length;
      totalExamplesDone += Object.keys(subj.examples || {}).length;
    });
    const streakBonus = (blob.streak && blob.streak.current) || 0;
    const badgesUnlocked = computeBadges(blob).filter(function (b) { return b.unlocked; }).length;
    return {
      xp: totalCorrect * 10 + totalCardsKnown * 2 + totalExamplesDone * 5 + streakBonus * 5 + badgesUnlocked * 50,
      totalCorrect: totalCorrect, totalCardsKnown: totalCardsKnown, totalExamplesDone: totalExamplesDone, badgesUnlocked: badgesUnlocked
    };
  }
  function renderDashLevel(blob) {
    const el = document.getElementById('dash-level');
    const stats = computeXP(blob);
    if (!stats.xp) { el.style.display = 'none'; return; }
    const level = levelFromXP(stats.xp);
    const floor = xpForLevel(level), ceil = xpForLevel(level + 1);
    const pct = ceil > floor ? Math.round((stats.xp - floor) / (ceil - floor) * 100) : 100;
    el.style.display = 'block';
    el.innerHTML = '<div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;min-width:220px;">'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span style="font-weight:800;font-size:15px;color:var(--text);">⭐ Level ' + level + '</span>'
      + '<span style="font-size:12.5px;color:var(--text-muted);">' + stats.xp + ' XP</span>'
      + '</div>'
      + '<div style="width:220px;height:8px;border-radius:999px;background:var(--border);overflow:hidden;">'
      + '<div style="width:' + pct + '%;height:100%;background:var(--accent-solid, var(--accent));border-radius:999px;"></div>'
      + '</div>'
      + '<span style="font-size:11px;color:var(--text-muted);">' + (ceil - stats.xp) + ' XP to Level ' + (level + 1) + '</span>'
      + '</div>';
  }

  function computeBadges(blob) {
    const streak = blob.streak || { current: 0, longest: 0 };
    let cardsKnownTotal = 0;
    let completeGuides = 0;
    let perfectUnits = 0;
    SUBJECTS_CONFIG.forEach(function (s) {
      const subj = blob[s.key];
      if (!subj) return;
      cardsKnownTotal += (subj.cardsKnown || []).length;
      const unitIds = s.units.map(function (u) { return u.id; });
      if (unitIds.length > 0 && unitIds.every(function (id) {
        const rec = subj.mastery && subj.mastery[String(id)];
        return rec && rec.total >= 2 && (rec.correct / rec.total) >= 0.8;
      })) completeGuides++;
      Object.keys(subj.mastery || {}).forEach(function (unitId) {
        const rec = subj.mastery[unitId];
        if (rec.total >= 5 && rec.correct === rec.total) perfectUnits++;
      });
    });
    const enrolledCount = (blob.enrolledSubjects || []).length;

    return [
      { emoji: '🔥', label: 'Spark', unlocked: streak.longest >= 3, hint: 'Reach a 3-day streak' },
      { emoji: '🔥', label: 'On Fire', unlocked: streak.longest >= 7, hint: 'Reach a 7-day streak' },
      { emoji: '🔥', label: 'Unstoppable', unlocked: streak.longest >= 30, hint: 'Reach a 30-day streak' },
      { emoji: '🔥', label: 'Legend', unlocked: streak.longest >= 100, hint: 'Reach a 100-day streak' },
      { emoji: '📚', label: 'Getting Started', unlocked: cardsKnownTotal >= 25, hint: 'Mark 25 flashcards as known' },
      { emoji: '📚', label: 'Scholar', unlocked: cardsKnownTotal >= 100, hint: 'Mark 100 flashcards as known' },
      { emoji: '📚', label: 'Master', unlocked: cardsKnownTotal >= 500, hint: 'Mark 500 flashcards as known' },
      { emoji: '🧭', label: 'Explorer', unlocked: enrolledCount >= 3, hint: 'Enroll in 3 or more classes' },
      { emoji: '🎯', label: 'Planner', unlocked: !!blob.goal, hint: 'Save a study goal' },
      { emoji: '🎓', label: 'Guide Complete', unlocked: completeGuides >= 1, hint: 'Get every unit in a guide to 80%+ accuracy' },
      { emoji: '🎓', label: 'Guide Master', unlocked: completeGuides >= 3, hint: 'Fully master 3 guides' },
      { emoji: '💯', label: 'Perfectionist', unlocked: perfectUnits >= 1, hint: 'Score 100% on a unit (5+ questions answered)' },
      { emoji: '💯', label: 'Flawless Five', unlocked: perfectUnits >= 5, hint: 'Score 100% on 5 different units' }
    ];
  }

  function renderDashBadges(blob) {
    const el = document.getElementById('dash-badges');
    const badges = computeBadges(blob);
    if (!badges.some(function (b) { return b.unlocked; })) return;
    el.style.display = 'flex';
    el.innerHTML = badges.map(function (b) {
      return '<span title="' + ssEscapeHtml(b.unlocked ? b.label : b.label + ' — ' + b.hint) + '" '
        + 'style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:13px;font-weight:700;'
        + (b.unlocked
          ? 'background:var(--chip-bg);color:var(--chip-text);'
          : 'background:transparent;border:1px dashed var(--border, #444);color:var(--text-muted);opacity:.55;filter:grayscale(1);')
        + '">' + b.emoji + ' ' + ssEscapeHtml(b.label) + '</span>';
    }).join('');
  }

  // Printable progress report for a parent/tutor: builds a throwaway
  // #ss-print-container with just a clean summary table, hides everything
  // else via body.ss-printing (see CSS), and calls window.print() -- same
  // technique as the guide pages' worksheet/flashcard-sheet export, so a
  // parent gets a PDF via the browser's own "Save as PDF" print target
  // instead of this needing a PDF-generation dependency.
  function ssRunPrintJob(title, bodyHtml) {
    const old = document.getElementById('ss-print-container');
    if (old) old.remove();
    const container = document.createElement('div');
    container.id = 'ss-print-container';
    container.innerHTML = '<h1>' + title + '</h1>' + bodyHtml;
    document.body.appendChild(container);
    document.body.classList.add('ss-printing');
    function cleanup() {
      document.body.classList.remove('ss-printing');
      container.remove();
      window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () { window.print(); }, 50);
  }
  function printProgressReport(blob) {
    const studentName = (SS_SESSION && SS_SESSION.name) || 'Student';
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const rows = SUBJECTS_CONFIG.map(function (s) {
      const subj = blob[s.key];
      if (!subj) return null;
      const unitIds = s.units.map(function (u) { return u.id; });
      const readiness = computeReadiness(subj.mastery || {}, unitIds);
      if (readiness.pct === null) return null;
      return { label: s.label, pct: readiness.pct, assessed: readiness.assessedCount, total: readiness.totalCount };
    }).filter(Boolean).sort(function (a, b) { return b.pct - a.pct; });

    const table = !rows.length ? '<p>No graded classes yet.</p>'
      : '<table><thead><tr><th>Class</th><th>Accuracy</th><th>Units assessed</th></tr></thead><tbody>'
        + rows.map(function (r) { return '<tr><td>' + ssEscapeHtml(r.label) + '</td><td>' + r.pct + '%</td><td>' + r.assessed + ' / ' + r.total + '</td></tr>'; }).join('')
        + '</tbody></table>';

    const streak = blob.streak || { current: 0, longest: 0 };
    const xpStats = computeXP(blob);
    const level = levelFromXP(xpStats.xp);
    const badgesUnlocked = computeBadges(blob).filter(function (b) { return b.unlocked; });
    const badgesHtml = badgesUnlocked.length
      ? '<p class="ss-print-badges">' + badgesUnlocked.map(function (b) { return b.emoji + ' ' + ssEscapeHtml(b.label); }).join(' &nbsp;·&nbsp; ') + '</p>'
      : '<p class="ss-print-badges">No badges unlocked yet.</p>';

    const body = '<div class="ss-print-meta">' + ssEscapeHtml(studentName) + ' &nbsp;·&nbsp; ' + dateStr + '</div>'
      + '<h2>Summary</h2>'
      + '<p>Level ' + level + ' (' + xpStats.xp + ' XP) &nbsp;·&nbsp; ' + streak.current + '-day streak (best ' + streak.longest + ') &nbsp;·&nbsp; ' + xpStats.totalCardsKnown + ' flashcards known</p>'
      + '<h2>Accuracy by Class</h2>' + table
      + '<h2>Badges Earned</h2>' + badgesHtml;

    ssRunPrintJob('PrecisStudy Progress Report', body);
  }

  // Forecasted AP/SAT/ACT scores: a rough, disclosed-as-rough mapping from
  // current quiz accuracy (readiness.pct, the same number already shown on
  // every subject card) onto each exam's real scale. Deliberately simple,
  // coarse bands -- these are estimates, not a psychometric model, and the
  // UI says so.
  function forecastScore(subjectKey, pct) {
    if (subjectKey === 'sat-math' || subjectKey === 'sat-reading') {
      const score = Math.round((200 + (pct / 100) * 600) / 10) * 10;
      return { value: score, scale: '200–800' };
    }
    if (subjectKey === 'act-prep') {
      return { value: Math.max(1, Math.round(1 + (pct / 100) * 35)), scale: '1–36' };
    }
    // AP 1-5 scale: coarse bands roughly matching published AP score
    // distributions (a 5 needs consistently strong accuracy, not just 80%+).
    let apScore;
    if (pct >= 90) apScore = 5;
    else if (pct >= 75) apScore = 4;
    else if (pct >= 60) apScore = 3;
    else if (pct >= 40) apScore = 2;
    else apScore = 1;
    return { value: apScore, scale: '1–5' };
  }
  function renderDashForecasts(blob) {
    const el = document.getElementById('dash-forecast-body');
    const card = document.getElementById('dash-forecast-card');
    const rows = SUBJECTS_CONFIG
      .filter(function (s) { const cat = SUBJECT_CATEGORY[s.key]; return cat === 'ap' || cat === 'testprep'; })
      .map(function (s) {
        const subj = blob[s.key];
        if (!subj) return null;
        const unitIds = s.units.map(function (u) { return u.id; });
        const readiness = computeReadiness(subj.mastery || {}, unitIds);
        if (readiness.pct === null || !readiness.enough) return null;
        return { label: s.label, href: s.href, pct: readiness.pct, forecast: forecastScore(s.key, readiness.pct) };
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.pct - a.pct; });

    if (!rows.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    el.innerHTML = rows.map(function (r) {
      return '<a href="' + r.href + '" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid var(--border);border-radius:12px;text-decoration:none;color:var(--text);">'
        + '<span style="font-weight:700;font-size:14px;">' + ssEscapeHtml(r.label) + '<span style="font-weight:500;color:var(--text-muted);font-size:12.5px;"> · ' + r.pct + '% accuracy</span></span>'
        + '<span style="font-weight:800;font-size:16px;color:var(--accent);">' + r.forecast.value + '<span style="font-weight:600;color:var(--text-muted);font-size:11.5px;"> / ' + r.forecast.scale + '</span></span>'
        + '</a>';
    }).join('');
  }

  // GitHub-style activity heatmap, built from blob.history (see
  // recordDailySnapshots() server-side) -- each entry carries a *cumulative*
  // totalAnswered, so a day's real activity is the delta from the day
  // before. History only started recording recently, so most of the grid
  // will read as empty for a while; that's expected, not a bug.
  function renderDashHeatmap(blob) {
    const el = document.getElementById('dash-heatmap-body');
    const card = document.getElementById('dash-heatmap-card');
    const history = Array.isArray(blob.history) ? blob.history.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }) : [];
    if (!history.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    const deltaByDate = {};
    history.forEach(function (entry, i) {
      const prev = i > 0 ? (history[i - 1].totalAnswered || 0) : null;
      deltaByDate[entry.date] = prev === null ? 0 : Math.max(0, (entry.totalAnswered || 0) - prev);
    });

    const WEEKS = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start on the Sunday of the week 13 weeks ago, so the grid always ends
    // on the current week's column regardless of what day today is.
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7);

    function bucket(n) {
      if (!n) return 0;
      if (n < 5) return 1;
      if (n < 15) return 2;
      if (n < 30) return 3;
      return 4;
    }
    const BUCKET_BG = [
      'color-mix(in srgb, var(--text) 16%, transparent)',
      'color-mix(in srgb, var(--accent-bright, var(--accent)) 45%, transparent)',
      'color-mix(in srgb, var(--accent-bright, var(--accent)) 70%, transparent)',
      'color-mix(in srgb, var(--accent-bright, var(--accent)) 90%, transparent)',
      'var(--accent-solid, var(--accent-bright, var(--accent)))'
    ];

    let cells = '';
    let totalQ = 0, activeDays = 0, bestN = 0, bestDate = '';
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const n = deltaByDate[dateStr] || 0;
      totalQ += n; if (n) activeDays++; if (n > bestN) { bestN = n; bestDate = dateStr; }
      const bg = BUCKET_BG[bucket(n)];
      const label = n ? (n + ' question' + (n === 1 ? '' : 's') + ' on ' + dateStr) : ('No activity on ' + dateStr);
      cells += '<div title="' + ssEscapeHtml(label) + '" style="width:16px;height:16px;border-radius:4px;background:' + bg + ';"></div>';
    }

    // Colour alone can't carry this, so the grid gets a text summary that screen readers (and everyone else) can read.
    const summary = totalQ
      ? totalQ + ' question' + (totalQ === 1 ? '' : 's') + ' answered on ' + activeDays + ' day' + (activeDays === 1 ? '' : 's') + ' in the last ' + WEEKS + ' weeks. Busiest day: ' + bestDate + ' (' + bestN + ').'
      : 'No questions answered in the last ' + WEEKS + ' weeks.';
    el.innerHTML = '<div role="img" aria-label="' + ssEscapeHtml('Activity grid. ' + summary) + '" style="display:grid;grid-template-rows:repeat(7,16px);grid-auto-flow:column;gap:4px;overflow-x:auto;padding-bottom:4px;">' + cells + '</div>'
      + '<div style="display:flex;align-items:center;gap:5px;margin-top:10px;font-size:13px;color:var(--text-muted);">'
      + '<span>Less</span>'
      + BUCKET_BG.map(function (bg) { return '<span style="width:14px;height:14px;border-radius:3px;background:' + bg + ';display:inline-block;"></span>'; }).join('')
      + '<span>More</span></div>'
      + '<p style="margin:8px 0 0;font-size:13px;color:var(--text-muted);">' + ssEscapeHtml(summary) + '</p>';
  }

  function renderDashAnalytics(blob) {
    const card = document.getElementById('dash-analytics-card');
    const rows = [];
    let totalCorrect = 0, totalAnswered = 0, totalCardsKnown = 0;
    SUBJECTS_CONFIG.forEach(function (s) {
      const subj = blob[s.key];
      if (!subj) return;
      const masteryVals = Object.values(subj.mastery || {});
      const answered = masteryVals.reduce(function (sum, r) { return sum + r.total; }, 0);
      if (answered === 0 && (subj.cardsKnown || []).length === 0) return;
      const correct = masteryVals.reduce(function (sum, r) { return sum + r.correct; }, 0);
      const pct = answered > 0 ? Math.round((correct / answered) * 100) : null;
      totalCorrect += correct;
      totalAnswered += answered;
      totalCardsKnown += (subj.cardsKnown || []).length;
      rows.push({ label: s.label, pct, answered, cardsKnown: (subj.cardsKnown || []).length });
    });
    if (!rows.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    const overallPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null;
    document.getElementById('dash-analytics-summary').innerHTML = [
      { n: totalAnswered, l: 'questions answered' },
      { n: overallPct === null ? '—' : overallPct + '%', l: 'overall accuracy' },
      { n: totalCardsKnown, l: 'cards mastered' }
    ].map(function (stat) {
      return '<div><div style="font-size:24px;font-weight:800;color:var(--text);">' + stat.n + '</div>'
        + '<div style="font-size:12.5px;color:var(--text-muted);">' + stat.l + '</div></div>';
    }).join('');

    rows.sort(function (a, b) { return (a.pct === null ? 101 : a.pct) - (b.pct === null ? 101 : b.pct); });
    document.getElementById('dash-analytics-table').innerHTML = rows.map(function (r) {
      const pctLabel = r.pct === null ? 'not assessed yet' : r.pct + '% accuracy';
      const barColor = r.pct === null ? 'var(--border, #444)' : r.pct >= 80 ? '#3fae6a' : r.pct >= 50 ? '#936e2a' : '#c25454';
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13.5px;">'
        + '<div style="width:150px;flex-shrink:0;color:var(--text);">' + ssEscapeHtml(r.label) + '</div>'
        + '<div style="flex:1;height:8px;border-radius:999px;background:var(--border, #333);overflow:hidden;">'
        + '<div style="height:100%;border-radius:999px;background:' + barColor + ';width:' + (r.pct === null ? 0 : r.pct) + '%;"></div></div>'
        + '<div style="width:110px;flex-shrink:0;text-align:right;color:var(--text-muted);">' + pctLabel + '</div>'
        + '</div>';
    }).join('');
  }

  function renderDashSubjects() {
    const list = dashShowAll ? SUBJECTS_CONFIG : SUBJECTS_CONFIG.filter(s => enrolledSet.has(s.key));
    if (enrolledSet.size === 0) {
      noteEl.innerHTML = '<a href="/settings/" style="color:var(--accent);font-weight:700;text-decoration:none;">📚 Tell us which classes you\'re taking →</a>';
    } else if (dashShowAll) {
      noteEl.innerHTML = 'Showing all classes · <a href="/settings/" style="color:var(--text-muted);text-decoration:none;">edit your classes</a>';
    } else {
      noteEl.innerHTML = 'Showing your classes — <a href="#" onclick="dashShowAllClasses();return false;" style="color:var(--accent);font-weight:700;text-decoration:none;">show all</a>'
        + ' · <a href="/settings/" style="color:var(--text-muted);text-decoration:none;">edit</a>';
    }

    const filterWrap = document.getElementById('dash-subject-filter-wrap');
    const filterInput = document.getElementById('dash-subject-filter');
    filterWrap.style.display = list.length > 8 ? 'block' : 'none';
    const filterClearBtn = document.getElementById('dash-subject-filter-clear');
    if (filterClearBtn) filterClearBtn.style.display = (filterInput && filterInput.value) ? 'block' : 'none';
    const filterTerm = (filterInput && filterInput.value || '').trim().toLowerCase();
    const visibleList = filterTerm ? list.filter(s => s.label.toLowerCase().includes(filterTerm)) : list;

    const subjectsEl = document.getElementById('dash-subjects');
    const unassessedEl = document.getElementById('dash-unassessed');
    subjectsEl.innerHTML = '';
    unassessedEl.innerHTML = '';
    if (filterTerm && !visibleList.length) {
      subjectsEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:14px;">No classes match "' + ssEscapeHtml(filterInput.value.trim()) + '".</p>';
      return;
    }

    // Split into "has at least one assessed unit" (gets a full stat card, as
    // before) vs. fully unassessed (grouped into collapsed category
    // accordions below) -- with dozens of classes enrolled, rendering every
    // untouched class as a full card was the single most-repeated complaint:
    // a wall of identical "take the diagnostic" cards to scroll past.
    const assessed = [];
    const unassessed = [];
    visibleList.forEach(s => {
      const unitIds = s.units.map(u => u.id);
      const readiness = computeReadiness((blob[s.key] || {}).mastery || {}, unitIds);
      (readiness.pct === null ? unassessed : assessed).push(s);
    });


    assessed.forEach(s => {
      const card = document.createElement('div');
      card.id = 'dash-subject-' + s.key;
      card.className = 'ss-card';
      // Stamp which subject the student navigated into from here, so a
      // future dashboard visit can offer a one-click "Resume" -- there's no
      // per-subject "last active" timestamp in the progress data model, so
      // this is the only honest signal the dashboard itself can produce.
      card.addEventListener('click', function (e) {
        const link = e.target.closest('a[href]');
        if (!link || !card.contains(link)) return;
        try {
          localStorage.setItem('ss-last-subject', JSON.stringify({ key: s.key, label: s.label, href: s.href, ts: Date.now() }));
        } catch (err) { /* ignore */ }
      });
      subjectsEl.appendChild(card);

      const unitIds = s.units.map(u => u.id);
      const unitNames = {};
      s.units.forEach(u => { unitNames[u.id] = u.name; });
      renderSubject(s.key, s.label, s.href, blob[s.key] || {}, unitIds, unitNames);
    });

    if (unassessed.length) {
      const byCategory = {};
      unassessed.forEach(s => {
        const cat = SUBJECT_CATEGORY[s.key] || 'electives';
        (byCategory[cat] = byCategory[cat] || []).push(s);
      });
      const heading = document.createElement('div');
      heading.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0 -2px;';
      const headingLabel = document.createElement('span');
      headingLabel.style.cssText = 'font-weight:800;font-size:14px;color:var(--text-muted);';
      headingLabel.textContent = 'Not yet assessed (' + unassessed.length + ')';
      heading.appendChild(headingLabel);
      if (unassessed.length > 1) {
        const batchBtn = document.createElement('button');
        batchBtn.type = 'button';
        batchBtn.style.cssText = 'background:none;border:1px solid var(--border);border-radius:999px;color:var(--accent);font-weight:700;font-size:12.5px;padding:6px 14px;cursor:pointer;';
        batchBtn.textContent = 'Start diagnostics for all ' + unassessed.length + ' →';
        batchBtn.addEventListener('click', function () { sbStartDiagBatch(unassessed); });
        heading.appendChild(batchBtn);
      }
      unassessedEl.appendChild(heading);

      CATEGORY_ORDER.filter(cat => byCategory[cat]).forEach(cat => {
        const group = byCategory[cat];
        const details = document.createElement('details');
        details.className = 'ss-card';
        details.style.cssText = 'padding:0;overflow:hidden;';
        const summary = document.createElement('summary');
        summary.style.cssText = 'cursor:pointer;padding:14px 18px;font-weight:700;font-size:14.5px;color:var(--text);list-style:none;display:flex;justify-content:space-between;align-items:center;';
        summary.innerHTML = '<span>' + ssEscapeHtml(CATEGORY_LABELS[cat] || cat) + '</span>'
          + '<span style="color:var(--text-muted);font-weight:600;font-size:13px;">' + group.length + '</span>';
        details.appendChild(summary);
        const body = document.createElement('div');
        body.style.cssText = 'border-top:1px solid var(--border);padding:6px 8px;';
        group.forEach(s => {
          const row = document.createElement('a');
          row.href = s.href;
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border-radius:10px;text-decoration:none;color:var(--text);font-size:14px;font-weight:600;';
          row.onmouseenter = () => { row.style.background = 'var(--bg)'; };
          row.onmouseleave = () => { row.style.background = 'transparent'; };
          // 2 questions per unit in the diagnostic (see homepage "Diagnose"
          // copy) at roughly 30s each -- a real estimate from real unit
          // counts, not a fixed marketing number every subject shares.
          const estMin = Math.max(2, Math.round(s.units.length));
          row.innerHTML = '<span>' + ssEscapeHtml(s.label) + '</span>'
            + '<span style="color:var(--accent);font-weight:700;font-size:12.5px;">Take diagnostic (~' + estMin + ' min) →</span>';
          body.appendChild(row);
        });
        details.appendChild(body);
        unassessedEl.appendChild(details);
      });
    }
  }
  renderDashSubjects();
  if (filterInputEl) filterInputEl.addEventListener('input', renderDashSubjects);
  const filterClearBtnEl = document.getElementById('dash-subject-filter-clear');
  if (filterClearBtnEl) filterClearBtnEl.addEventListener('click', () => {
    if (filterInputEl) filterInputEl.value = '';
    renderDashSubjects();
    if (filterInputEl) filterInputEl.focus();
  });
  renderResumeBanner(SUBJECTS_FOR_SCHEDULE);

  renderTodayPlan(SUBJECTS_FOR_SCHEDULE, blob);

  const streakEl = document.getElementById('dash-streak');
  if (blob.streak && blob.streak.current > 0) {
    streakEl.style.display = 'inline-flex';
    streakEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:7px;background:var(--chip-bg);color:var(--chip-text);font-weight:800;font-size:15px;padding:9px 18px;border-radius:999px;">'
      + '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f2a93b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9Z"/></svg>' + blob.streak.current + '-day streak'
      + (blob.streak.longest > blob.streak.current ? '<span style="font-weight:600;opacity:.7;font-size:13px;margin-left:2px;">· best ' + blob.streak.longest + '</span>' : '')
      + '</span>';
  }
  renderDashLevel(blob);
  // Hand the data Sage's dashboard card needs (streak, per-class readiness) to /shared/sage-dashboard.js.
  window.__ssDashData = {
    blob: blob,
    labels: Object.fromEntries(SUBJECTS_CONFIG.map(function (s) { return [s.key, s.label]; })),
    readiness: Object.fromEntries(SUBJECTS_CONFIG.map(function (s) {
      const subj = blob[s.key];
      const r = subj ? computeReadiness(subj.mastery || {}, s.units.map(function (u) { return u.id; })) : null;
      return [s.key, r ? r.pct : null];
    }))
  };
  window.dispatchEvent(new Event('ss-dash-ready'));
  renderDashBadges(blob);
  renderDashAnalytics(blob);
  renderDashHeatmap(blob);
  renderDashForecasts(blob);
  const printReportBtn = document.getElementById('dash-print-report-btn');
  if (printReportBtn) printReportBtn.addEventListener('click', function () { printProgressReport(blob); });

  sbBlob = blob;
  const hadSavedConfig = sbRestoreSavedConfig();
  sbPopulateDaySelect();
  sbRenderBlocks();
  sbRenderSubjects();
  sbSeedGridFromBlocks();
  sbRenderGrid();
  const sbBuildBtn = document.getElementById('sb-build-btn');
  const sbAddBlockBtn = document.getElementById('sb-block-add-btn');
  const sbGridClearBtn = document.getElementById('sb-grid-clear-btn');
  if (sbAddBlockBtn) sbAddBlockBtn.addEventListener('click', sbAddBlock);
  if (sbBuildBtn) sbBuildBtn.addEventListener('click', sbBuildSchedule);
  if (sbGridClearBtn) sbGridClearBtn.addEventListener('click', function () {
    sbGridCells = new Set();
    sbRenderGrid();
    sbApplyGridToBlocks();
  });
  document.querySelectorAll('.sb-preset-btn[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () { sbApplyPreset(btn.dataset.preset); });
  });
  if (hadSavedConfig && sbFreeBlocks.length && sbSelectedSubjects.length) sbBuildSchedule();
}

loadDashboard();

// Same 'ss-density' localStorage key as /settings, so a preference set on
// either page carries over to the other. Grid gap is set via JS (not CSS)
// since #dash-subjects carries an inline style attribute that a class
// selector alone can't override without !important.
(function () {
  const KEY = 'ss-density';
  const grid = document.getElementById('dash-subjects');
  const btns = document.querySelectorAll('#dash-density-row .ss-density-btn');
  if (!grid || !btns.length) return;
  const GAPS = { compact: '10px', comfortable: '20px', spacious: '28px' };
  function apply(mode) {
    grid.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    grid.classList.add('density-' + mode);
    grid.style.gap = GAPS[mode] || GAPS.comfortable;
    btns.forEach(function (b) { b.classList.toggle('active', b.dataset.density === mode); });
  }
  let saved; try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  apply(saved === 'compact' || saved === 'spacious' ? saved : 'comfortable');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      const mode = b.dataset.density;
      apply(mode);
      try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
    });
  });
})();
