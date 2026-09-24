// Open-access mission banner: a thin, dismissible bar reinforcing that
// PrecisStudy is free and always will be -- no paywall, no sign-up wall.
// Loaded on every page via one <script src="/shared/mission-banner.js" defer>
// tag prepended by the Worker itself (see injectSiteWidgets in
// src/worker.ts), same mechanism as feedback-widget.js. Self-contained like
// command-palette.js -- injects its own CSS/DOM and falls back across both
// page families' CSS variable names. Dismissal is remembered per-browser via
// localStorage so it doesn't nag a returning visitor.
(function () {
  var DISMISS_KEY = "ss-mission-banner-dismissed";

  var dismissed = false;
  try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch (e) { /* private mode etc -- just show it */ }
  if (dismissed) return;

  var style = document.createElement("style");
  style.textContent =
    "#mb-bar{position:relative;z-index:9997;display:flex;align-items:center;justify-content:center;gap:10px;" +
    "flex-wrap:wrap;padding:9px 40px 9px 16px;font-family:inherit;font-size:13px;font-weight:600;text-align:center;" +
    "background:var(--accent-solid, #1f7a4d);color:#fff}" +
    "#mb-bar a{color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap}" +
    "#mb-close{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;" +
    "color:#fff;opacity:.8;cursor:pointer;padding:6px;line-height:0;border-radius:6px}" +
    "#mb-close:hover{opacity:1}" +
    "#mb-close svg{width:14px;height:14px;display:block}" +
    "@media(max-width:520px){#mb-bar{font-size:12.5px;padding:8px 36px 8px 12px}}";
  document.head.appendChild(style);

  var bar = document.createElement("div");
  bar.id = "mb-bar";
  bar.setAttribute("role", "note");
  bar.innerHTML =
    "<span>PrecisStudy is 100% free, always — no paywalls, no sign-up required. <a href=\"/about\">Our mission</a></span>" +
    '<button id="mb-close" type="button" aria-label="Dismiss">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    "</button>";

  document.body.insertBefore(bar, document.body.firstChild);

  bar.querySelector("#mb-close").addEventListener("click", function () {
    bar.remove();
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch (e) { /* ignore -- just won't persist this session */ }
  });
})();
