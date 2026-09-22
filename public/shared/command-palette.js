// Global command palette (Cmd/Ctrl+K): a single quick-nav modal loaded on
// every page type (homepage, dashboard, settings, and all subject guides)
// via one <script src="/shared/command-palette.js" defer> tag. Self-contained
// (injects its own CSS and DOM) so it works the same everywhere regardless
// of each page's own stylesheet or JS module setup -- the different page
// families use different CSS variable names (--bg-card/--text on the
// homepage & dashboard vs --surface/--ink on guide pages), so every rule
// below falls back across both.
(function () {
  var DESTINATIONS = [
    { l: 'Dashboard', h: '/dashboard' },
    { l: 'Settings', h: '/settings' },
    { l: 'Account Setup', h: '/onboarding' },
    { l: 'Browse Subjects', h: '/#classes-section' },
    { l: 'Request a Guide', h: '/request' },
    { l: 'Upload Syllabus', h: '/syllabus' },
    { l: 'Concept Dependency Map', h: '/concepts' },
    { l: 'Quests', h: '/quest' },
    { l: 'Weekly Leaderboards', h: '/leaderboards' },
    { l: 'Study Group Hub', h: '/study-group' },
    { l: 'Peer Challenge', h: '/challenge' },
    { l: 'Educator Resource Hub', h: '/educators' },
    { l: 'Changelog', h: '/changelog' },
    { l: 'Geometry', h: '/geometry' }, { l: 'Chemistry', h: '/chemistry' }, { l: 'Algebra I', h: '/algebra1' },
    { l: 'Algebra II', h: '/algebra2' }, { l: 'AP English Lang & Comp', h: '/ap-lang' }, { l: 'Global History', h: '/global-history' },
    { l: 'AP Biology', h: '/ap-biology' }, { l: 'APUSH', h: '/apush' }, { l: 'US History', h: '/us-history' },
    { l: 'Physics', h: '/physics' }, { l: 'Biology', h: '/biology' }, { l: 'PreCalculus', h: '/precalc' },
    { l: 'ACT Prep', h: '/act-prep' }, { l: 'Anatomy & Physiology', h: '/anatomy' }, { l: 'AP Chemistry', h: '/ap-chemistry' },
    { l: 'AP Computer Science A', h: '/ap-csa' }, { l: 'AP European History', h: '/ap-euro' }, { l: 'AP Macroeconomics', h: '/ap-macro' },
    { l: 'AP Microeconomics', h: '/ap-micro' }, { l: 'AP Physics 1', h: '/ap-physics' }, { l: 'AP Psychology', h: '/ap-psych' },
    { l: 'AP Statistics', h: '/ap-stats' }, { l: 'AP US Government', h: '/ap-usgov' }, { l: 'AP World History', h: '/ap-world' },
    { l: 'AP Human Geography', h: '/ap-human-geography' }, { l: 'Art History', h: '/art-history' }, { l: 'Astronomy', h: '/astronomy' },
    { l: 'Computer Science', h: '/computer-science' }, { l: 'Creative Writing', h: '/creative-writing' }, { l: 'Earth Science', h: '/earth-science' },
    { l: 'Economics', h: '/economics' }, { l: 'English 10', h: '/english-10' }, { l: 'English 9', h: '/english-9' },
    { l: 'Environmental Science', h: '/environmental-science' }, { l: 'French 1', h: '/french-1' }, { l: 'Geography', h: '/geography' },
    { l: 'German 1', h: '/german-1' }, { l: 'Health', h: '/health' }, { l: 'Journalism', h: '/journalism' },
    { l: 'Music Theory', h: '/music-theory' }, { l: 'Psychology', h: '/psychology' }, { l: 'SAT Math Prep', h: '/sat-math' },
    { l: 'SAT Reading & Writing', h: '/sat-reading' }, { l: 'Sociology', h: '/sociology' }, { l: 'Spanish 1', h: '/spanish-1' },
    { l: 'Spanish 2', h: '/spanish-2' }, { l: 'Spanish 3', h: '/spanish-3' }, { l: 'Speech & Debate', h: '/speech-debate' },
    { l: 'Statistics', h: '/statistics' }, { l: 'Study Skills', h: '/study-skills' }, { l: 'US Government', h: '/us-government' },
    { l: 'World History', h: '/world-history' }, { l: 'Calculus', h: '/calculus' }, { l: 'AP Calculus AB', h: '/calc-ab' },
    { l: 'AP Calculus BC', h: '/calc-bc' }
  ];

  var style = document.createElement('style');
  style.textContent =
    '#cp-backdrop{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-start;justify-content:center;' +
    'padding-top:12vh;background:rgba(0,0,0,.45)}' +
    '#cp-backdrop.open{display:flex}' +
    '#cp-modal{width:min(560px,92vw);max-height:60vh;display:flex;flex-direction:column;overflow:hidden;' +
    'background:var(--bg-card, var(--surface, #fff));border:1px solid var(--border-strong, var(--border, #ccc));' +
    'border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.35)}' +
    '#cp-input{border:none;border-bottom:1px solid var(--border, #ddd);padding:16px 18px;font-size:16px;' +
    'font-family:inherit;background:transparent;color:var(--text, var(--ink, #111));outline:none}' +
    '#cp-list{overflow-y:auto;padding:6px}' +
    '.cp-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;' +
    'border-radius:8px;cursor:pointer;font-size:14.5px;color:var(--text, var(--ink, #111))}' +
    '.cp-item.active{background:var(--bg, var(--surface-2, #eee))}' +
    '.cp-item small{color:var(--text-muted, var(--ink-muted, #777));font-size:12px}' +
    '#cp-empty{padding:16px 18px;font-size:14px;color:var(--text-muted, var(--ink-muted, #777))}' +
    '#cp-hint{padding:8px 14px;border-top:1px solid var(--border, #ddd);font-size:11.5px;' +
    'color:var(--text-muted, var(--ink-muted, #777))}';
  document.head.appendChild(style);

  var backdrop = document.createElement('div');
  backdrop.id = 'cp-backdrop';
  backdrop.innerHTML =
    '<div id="cp-modal" role="dialog" aria-modal="true" aria-label="Quick navigation">' +
    '<input id="cp-input" type="text" placeholder="Jump to a subject or page..." autocomplete="off"/>' +
    '<div id="cp-list"></div>' +
    '<div id="cp-hint">↑↓ to navigate · Enter to open · Esc to close</div>' +
    '</div>';
  document.body.appendChild(backdrop);

  var input = backdrop.querySelector('#cp-input');
  var list = backdrop.querySelector('#cp-list');
  var activeIdx = 0;
  var filtered = DESTINATIONS;

  function render() {
    if (!filtered.length) {
      list.innerHTML = '<div id="cp-empty">No matches.</div>';
      return;
    }
    list.innerHTML = filtered.map(function (d, i) {
      return '<div class="cp-item' + (i === activeIdx ? ' active' : '') + '" data-idx="' + i + '">' +
        '<span>' + d.l + '</span><small>' + d.h + '</small></div>';
    }).join('');
    var activeEl = list.querySelector('.cp-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function filterList() {
    var q = input.value.trim().toLowerCase();
    filtered = !q ? DESTINATIONS : DESTINATIONS.filter(function (d) { return d.l.toLowerCase().indexOf(q) !== -1; });
    activeIdx = 0;
    render();
  }

  function open() {
    backdrop.classList.add('open');
    input.value = '';
    filterList();
    setTimeout(function () { input.focus(); }, 0);
  }
  function close() {
    backdrop.classList.remove('open');
  }
  function go(item) {
    if (item) location.href = item.h;
  }

  document.addEventListener('keydown', function (e) {
    var isOpenShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (isOpenShortcut) {
      e.preventDefault();
      backdrop.classList.contains('open') ? close() : open();
      return;
    }
    if (!backdrop.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, filtered.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(filtered[activeIdx]); }
  });
  input.addEventListener('input', filterList);
  list.addEventListener('click', function (e) {
    var el = e.target.closest('.cp-item');
    if (el) go(filtered[parseInt(el.dataset.idx, 10)]);
  });
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
})();
