// Cloudflare Turnstile for the public forms. Inert until the owner sets TURNSTILE_SITE_KEY (served by /api/config): with no
// key nothing loads and forms behave exactly as before. window.ssTurnstile(container) renders the widget into `container`
// and returns { token() } so a form can send the current token with its submission.
(function () {
  var cfg = null;
  function config() {
    if (!cfg) cfg = fetch('/api/config').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    return cfg;
  }
  var loading = null;
  function loadScript() {
    if (window.turnstile) return Promise.resolve();
    if (!loading) loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return loading;
  }
  window.ssTurnstile = function (container) {
    var state = { value: '', widget: null };
    var api = { token: function () { return state.value; }, reset: function () { try { if (window.turnstile && state.widget !== null) { state.value = ''; window.turnstile.reset(state.widget); } } catch (e) {} } };
    config().then(function (c) {
      if (!c || !c.turnstileSiteKey || !container) return;
      return loadScript().then(function () {
        state.widget = window.turnstile.render(container, {
          sitekey: c.turnstileSiteKey,
          callback: function (t) { state.value = t; },
          'expired-callback': function () { state.value = ''; },
          'error-callback': function () { state.value = ''; }
        });
      });
    }).catch(function () { /* the form still works; the server decides whether a token is required */ });
    return api;
  };
})();
