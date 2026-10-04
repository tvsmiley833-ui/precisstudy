// Phone-only bottom navigation (Home, Classes, Flashcards, Dashboard) on the secondary pages. The Worker adds this script
// to every page except guides (which have their own Tools button and sticky bars), the homepage (which has the same nav
// inline, with a Search button), and admin/sign-in flows. Hidden above 640px.
(function () {
  if (document.querySelector(".ss-bnav")) return;
  var css = ".ss-bnav{display:none}@media(max-width:640px){"
    + ".ss-bnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9990;background:var(--bg-header,#12291f);border-top:1px solid var(--border,#2f5346);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));justify-content:space-around}"
    + ".ss-bnav a{flex:1;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--text-muted,#b7c9bc);font:inherit;font-size:11px;font-weight:700;text-decoration:none;border-radius:10px}"
    + ".ss-bnav svg{width:22px;height:22px}.ss-bnav a:active{background:var(--chip-bg,rgba(255,255,255,.08));color:var(--accent,#4fbf85)}.ss-bnav a[aria-current=page]{color:var(--accent,#4fbf85)}"
    + "body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))!important}#fbw-btn{bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}"
    + "#ss-unsaved-bar,#ss-toast,#sb-toast{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var I = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  var items = [
    ["/", "Home", I('<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>')],
    ["/#classes-section", "Classes", I('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>')],
    ["/flashcards/", "Flashcards", I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 3h10"/>')],
    ["/dashboard/", "Dashboard", I('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>')]
  ];
  var here = location.pathname.replace(/\/?$/, "/");
  var nav = document.createElement("nav");
  nav.className = "ss-bnav"; nav.setAttribute("aria-label", "Quick navigation");
  nav.innerHTML = items.map(function (it) {
    var current = it[0] !== "/" && it[0].charAt(1) !== "#" && here.indexOf(it[0]) === 0;
    return '<a href="' + it[0] + '"' + (current ? ' aria-current="page"' : "") + ">" + it[2] + it[1] + "</a>";
  }).join("");
  document.body.appendChild(nav);
})();
