// Signed-in avatar + dropdown (Dashboard, Settings, Sign out) on every page.
// Pages with a header account area (#ss-account-area) get their name/Sign out
// pair upgraded in place; pages without one (study guides) get a small
// floating avatar. Signed-out visitors see nothing extra here.
(function () {
  if (document.querySelector(".ss-avatar-btn")) return; // homepage renders its own
  var css = ".ss-avatar{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#1f6e46;color:#fff;font-weight:800;font-size:13px;font-family:inherit}"
    + ".ss-avatar-btn{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border:1px solid var(--border,#d6dccf);border-radius:999px;background:var(--bg-card,#fff);color:var(--text,#1c2a24);font:inherit;font-size:14px;font-weight:700;cursor:pointer}"
    + ".ss-avatar-btn:hover{border-color:var(--accent-bright,#268a58)}"
    + ".ss-acct-wrap{position:relative}.ss-acct-float{position:fixed;top:10px;right:12px;z-index:70}.ss-acct-float .ss-avatar-btn{padding:3px;gap:0}.ss-acct-float .ss-acct-name,.ss-acct-float .ss-acct-caret{display:none}"
    + "@media(max-width:640px){.ss-acct-name{display:none}}"
    + ".ss-acct-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:170px;background:var(--bg-card,#fff);border:1px solid var(--border,#d6dccf);border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.2);padding:6px;z-index:80;flex-direction:column;display:flex}"
    + ".ss-acct-menu[hidden]{display:none}"
    + ".ss-acct-menu a,.ss-acct-menu button{display:block;text-align:left;padding:9px 12px;border:0;border-radius:8px;background:none;color:var(--text,#1c2a24);font:inherit;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;width:100%}"
    + ".ss-acct-menu a:hover,.ss-acct-menu button:hover,.ss-acct-menu a:focus-visible,.ss-acct-menu button:focus-visible{background:var(--chip-bg,#e6efe8);color:var(--accent,#1f6e46)}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var user = null, building = false;

  function html(name, floating) {
    return '<button type="button" class="ss-avatar-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">'
      + '<span class="ss-avatar" aria-hidden="true">' + esc(name.trim().charAt(0).toUpperCase()) + '</span>'
      + '<span class="ss-acct-name">' + esc(name) + '</span><span class="ss-acct-caret" aria-hidden="true" style="font-size:10px">&#9662;</span></button>'
      + '<div class="ss-acct-menu" role="menu" hidden><a role="menuitem" href="/dashboard/">Dashboard</a><a role="menuitem" href="/settings/">Settings</a>'
      + '<button type="button" role="menuitem" data-signout>Sign out</button></div>';
  }
  function wire(root) {
    var b = root.querySelector(".ss-avatar-btn"), m = root.querySelector(".ss-acct-menu");
    function set(open) { m.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false"); if (open) { var f = m.querySelector("a"); if (f) f.focus(); } }
    b.addEventListener("click", function (e) { e.stopPropagation(); set(m.hidden); });
    document.addEventListener("click", function (e) { if (!root.contains(e.target)) set(false); });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape" && !m.hidden) { set(false); b.focus(); } });
    root.querySelector("[data-signout]").addEventListener("click", async function () {
      try { await fetch("/auth/logout", { method: "POST" }); } catch (e) { /* ignore */ }
      if (window.ssClearLocalData) window.ssClearLocalData();
      location.reload();
    });
  }
  function build() {
    if (!user || building) return;
    var area = document.getElementById("ss-account-area");
    if (area) {
      var acct = area.querySelector(".ss-account");
      if (acct && !acct.querySelector(".ss-avatar-btn")) {
        building = true;
        acct.className = "ss-account ss-acct-wrap"; acct.innerHTML = html(user, false); wire(acct);
        building = false;
      }
    } else if (!document.querySelector(".ss-acct-float")) {
      var d = document.createElement("div"); d.className = "ss-acct-wrap ss-acct-float"; d.innerHTML = html(user, true);
      document.body.appendChild(d); wire(d);
    }
  }
  var me = window.__ssMe || fetch("/auth/me").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  window.__ssMe = me;
  me.then(function (d) {
    if (!d || !d.loggedIn) return;
    user = d.name || d.email || "Account";
    build();
    var area = document.getElementById("ss-account-area");
    if (area) new MutationObserver(build).observe(area, { childList: true, subtree: true });
  });
})();
