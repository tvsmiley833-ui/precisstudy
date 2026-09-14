// Site-wide high-contrast mode toggle, loaded on every page (homepage,
// dashboard, settings, all subject guides) via one
// <script src="/shared/high-contrast.js" defer> tag -- same rollout pattern
// as command-palette.js. Overrides the CSS custom properties both page
// families use (--bg-card/--text/--border on the homepage/dashboard/
// settings, --surface/--ink/--border on guide pages) so near-black-on-white
// / near-white-on-black contrast applies everywhere those tokens are used,
// without needing per-selector overrides on every page's own stylesheet.
(function () {
  var KEY = 'ss-contrast';

  var style = document.createElement('style');
  style.textContent =
    '[data-contrast="high"]{' +
    '--bg:#fff!important;--bg-card:#fff!important;--bg-header:#fff!important;' +
    '--surface:#fff!important;--surface-2:#fff!important;--surface-hover:#eee!important;' +
    '--border:#000!important;--border-strong:#000!important;' +
    '--text:#000!important;--text-muted:#000!important;--nav-text:#000!important;' +
    '--ink:#000!important;--ink-muted:#000!important;--ink-dim:#000!important;' +
    '--accent:#0000ee!important;--accent-bright:#0000ee!important;--accent-hover:#000099!important;' +
    '--accent-solid:#0000ee!important;--accent-solid-hover:#000099!important;' +
    '--accent-ink:#0000ee!important;--accent-soft:#fff!important;' +
    '--status-badge-text:#fff!important;--done-badge-bg:#006400!important;' +
    '--card-shadow:none!important;--shadow-sm:none!important;--shadow-md:none!important;--shadow-lg:none!important;' +
    '--hero-glow:none!important' +
    '}' +
    '[data-contrast="high"][data-theme="dark"]{' +
    '--bg:#000!important;--bg-card:#000!important;--bg-header:#000!important;' +
    '--surface:#000!important;--surface-2:#000!important;--surface-hover:#1a1a1a!important;' +
    '--border:#fff!important;--border-strong:#fff!important;' +
    '--text:#fff!important;--text-muted:#fff!important;--nav-text:#fff!important;' +
    '--ink:#fff!important;--ink-muted:#fff!important;--ink-dim:#fff!important;' +
    '--accent:#6cb6ff!important;--accent-bright:#6cb6ff!important;--accent-hover:#a8d4ff!important;' +
    '--accent-solid:#3399ff!important;--accent-solid-hover:#6cb6ff!important;' +
    '--accent-ink:#6cb6ff!important;--accent-soft:#000!important;' +
    '--status-badge-text:#000!important;--done-badge-bg:#00ff00!important' +
    '}' +
    '[data-contrast="high"] *{box-shadow:none!important;text-shadow:none!important}' +
    '#contrast-toggle{background:none;border:1px solid var(--border,#ccc);color:var(--text-muted,var(--ink-muted,#666));' +
    'border-radius:999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;' +
    'cursor:pointer;flex-shrink:0;font-weight:800;font-size:13px;font-family:inherit;margin-left:6px}' +
    '#contrast-toggle:hover{border-color:var(--accent-bright,var(--accent,#6cb6ff));color:var(--accent,#3399ff)}' +
    '#contrast-toggle.on{background:var(--accent-bright,var(--accent,#3399ff));border-color:var(--accent-bright,var(--accent,#3399ff));color:#fff}';
  document.head.appendChild(style);

  function apply(on) {
    if (on) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
    var btn = document.getElementById('contrast-toggle');
    if (btn) {
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  var saved;
  try { saved = localStorage.getItem(KEY) === 'high'; } catch (e) { saved = false; }
  apply(saved);

  function injectButton() {
    if (document.getElementById('contrast-toggle')) return;
    var themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle || !themeToggle.parentNode) return;
    var btn = document.createElement('button');
    btn.id = 'contrast-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle high-contrast mode');
    btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    btn.title = 'Toggle high-contrast mode';
    btn.textContent = 'AA';
    btn.className = saved ? 'on' : '';
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-contrast') !== 'high';
      apply(next);
      try { localStorage.setItem(KEY, next ? 'high' : 'normal'); } catch (e) { /* ignore */ }
    });
    themeToggle.parentNode.insertBefore(btn, themeToggle.nextSibling);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
})();
