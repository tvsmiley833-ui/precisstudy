// Site-wide high-contrast mode, loaded on every page (homepage, dashboard,
// settings, all subject guides) via one
// <script src="/shared/high-contrast.js" defer> tag -- same rollout pattern
// as command-palette.js. Overrides the CSS custom properties both page
// families use (--bg-card/--text/--border on the homepage/dashboard/
// settings, --surface/--ink/--border on guide pages) so near-black-on-white
// / near-white-on-black contrast applies everywhere those tokens are used,
// without needing per-selector overrides on every page's own stylesheet.
//
// The only control surface is the Settings page's own checkbox (see
// ssInitHighContrastToggle() in public/settings/index.html), which calls
// window.ssSetHighContrast(). This file used to also inject a small "AA"
// button into every page's header; that was removed to keep exactly one
// place to turn it on/off.
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
    '[data-contrast="high"] *{box-shadow:none!important;text-shadow:none!important}';
  document.head.appendChild(style);

  function apply(on) {
    if (on) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }

  var saved;
  try { saved = localStorage.getItem(KEY) === 'high'; } catch (e) { saved = false; }
  apply(saved);

  window.ssIsHighContrast = function () {
    return document.documentElement.getAttribute('data-contrast') === 'high';
  };

  window.ssSetHighContrast = function (on) {
    apply(on);
    try { localStorage.setItem(KEY, on ? 'high' : 'normal'); } catch (e) { /* ignore */ }
  };
})();
