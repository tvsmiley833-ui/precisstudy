// Site-wide high-contrast mode (and the pure-black AMOLED dark theme), loaded on every page (homepage, dashboard,
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


  var AMOLED_KEY = 'ss-amoled';
  function applyAmoled(on) {
    if (on) document.documentElement.setAttribute('data-amoled', 'on');
    else document.documentElement.removeAttribute('data-amoled');
  }
  var amoled;
  try { amoled = localStorage.getItem(AMOLED_KEY) === 'on'; } catch (e) { amoled = false; }
  applyAmoled(amoled);
  window.ssIsAmoled = function () { return document.documentElement.getAttribute('data-amoled') === 'on'; };
  window.ssSetAmoled = function (on) {
    applyAmoled(on);
    try { localStorage.setItem(AMOLED_KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  };

  function apply(on) {
    if (on) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }

  // An explicit choice (high or normal) wins; with none saved, follow the device's "more contrast" setting.
  var saved;
  try {
    var stored = localStorage.getItem(KEY);
    saved = stored === 'high' || (stored === null && !!(window.matchMedia && matchMedia('(prefers-contrast: more)').matches));
  } catch (e) { saved = false; }
  apply(saved);

  // Keep other open tabs in step when the setting changes in Settings.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(e.newValue === 'high');
    else if (e.key === AMOLED_KEY) applyAmoled(e.newValue === 'on');
  });

  window.ssIsHighContrast = function () {
    return document.documentElement.getAttribute('data-contrast') === 'high';
  };

  window.ssSetHighContrast = function (on) {
    apply(on);
    try { localStorage.setItem(KEY, on ? 'high' : 'normal'); } catch (e) { /* ignore */ }
  };
})();
