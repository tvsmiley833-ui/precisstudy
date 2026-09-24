// Phone menu for the shared site header on secondary pages (About, Dashboard,
// Settings, …). The header markup itself is static in each page; this only
// adds the small-screen styles and opens/closes #ss-mobile-menu from
// #ss-menu-btn (Escape, outside click and link clicks close it).
(function () {
  var btn = document.getElementById("ss-menu-btn");
  var menu = document.getElementById("ss-mobile-menu");
  if (!btn || !menu) return;

  var style = document.createElement("style");
  style.textContent =
    ".header-bar{gap:24px}" +
    ".ss-menu-btn{display:none;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;border:1px solid var(--border);background:none;color:var(--nav-text);cursor:pointer}" +
    "#ss-mobile-menu{display:none;position:absolute;top:100%;right:16px;margin-top:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 32px -12px rgba(0,0,0,.35);padding:8px;min-width:210px;z-index:60;flex-direction:column}" +
    "#ss-mobile-menu.open{display:flex}" +
    "#ss-mobile-menu a{color:var(--nav-text);text-decoration:none;font-weight:600;font-size:15px;padding:10px 12px;border-radius:8px}" +
    "#ss-mobile-menu a:hover,#ss-mobile-menu a:focus-visible{background:var(--chip-bg,rgba(127,127,127,.12))}" +
    "#ss-mobile-menu a[aria-current=page]{color:var(--accent)}" +
    "#ss-mobile-menu .ss-menu-cta{color:var(--accent);font-weight:700}" +
    "@media(max-width:960px){.header-bar{padding:14px 16px!important}.nav-links{gap:10px!important}.nav-links .nav-hide-sm,.nav-links>.ss-cta-btn{display:none!important}.ss-menu-btn{display:inline-flex}}" +
    "@media(max-width:1100px){.nav-links>.ss-cta-btn{display:none!important}}" +
    "@media(min-width:961px){#ss-mobile-menu{display:none!important}}";
  document.head.appendChild(style);

  function setOpen(open) {
    menu.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!menu.classList.contains("open"));
  });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", function (e) {
    if (menu.classList.contains("open") && !menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("open")) { setOpen(false); btn.focus(); }
  });
})();
