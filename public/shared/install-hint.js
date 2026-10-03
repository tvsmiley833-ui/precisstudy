// "Add to Home Screen" hint (MOB-4). After a student's second day on the site, on a phone where the site isn't installed
// yet, show one small dismissible card: the native install button where the browser offers it (Android/Chrome), or the
// Share-menu instructions on iPhone/iPad Safari, where there is no install prompt. Home-screen web apps are also the only
// way iOS delivers push reminders. Shown at most once per dismissal; never inside the installed app.
(function () {
  var VISITS = "ss-visit-days", DISMISSED = "ss-install-hint-dismissed";
  function standalone() {
    return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }
  if (standalone()) return;
  try { if (localStorage.getItem(DISMISSED) === "1") return; } catch (e) { return; }

  // Count distinct days with a visit (capped), so "second session" means a real return, not two reloads.
  var days = [];
  try {
    days = JSON.parse(localStorage.getItem(VISITS) || "[]");
    var today = new Date().toISOString().slice(0, 10);
    if (days.indexOf(today) < 0) { days.push(today); localStorage.setItem(VISITS, JSON.stringify(days.slice(-10))); }
  } catch (e) { return; }
  if (days.length < 2) return;

  var ua = navigator.userAgent || "";
  var isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; show(); });
  if (isIos) show();

  var shown = false;
  function show() {
    if (shown || (!isIos && !deferred)) return;
    shown = true;
    var card = document.createElement("div");
    card.id = "ss-install-hint";
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", "Install PrecisStudy");
    card.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:420px;margin:0 auto;z-index:9996;" +
      "padding:14px 16px;border-radius:14px;background:var(--bg-card,var(--surface,#fff));color:var(--text,var(--ink,#111));" +
      "border:1px solid var(--border-strong,var(--border,#888));box-shadow:0 10px 30px rgba(0,0,0,.28);font:14px/1.45 system-ui,sans-serif";
    var msg = document.createElement("p");
    msg.style.cssText = "margin:0 0 10px";
    msg.textContent = isIos
      ? "Add PrecisStudy to your Home Screen: tap the Share button, then “Add to Home Screen”. It opens like an app and can send study reminders."
      : "Install PrecisStudy for one-tap access, even offline.";
    card.appendChild(msg);
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
    function close() { card.remove(); try { localStorage.setItem(DISMISSED, "1"); } catch (e) {} }
    var no = document.createElement("button");
    no.type = "button"; no.textContent = "Not now";
    no.style.cssText = "min-height:44px;padding:0 14px;border:1px solid var(--border,#888);border-radius:10px;background:none;color:inherit;font:inherit;cursor:pointer";
    no.onclick = close;
    row.appendChild(no);
    if (!isIos && deferred) {
      var yes = document.createElement("button");
      yes.type = "button"; yes.textContent = "Install";
      yes.style.cssText = "min-height:44px;padding:0 16px;border:0;border-radius:10px;background:var(--accent-solid,#1f6e46);color:#fff;font:inherit;font-weight:700;cursor:pointer";
      yes.onclick = function () { deferred.prompt(); deferred.userChoice.finally(close); };
      row.appendChild(yes);
    }
    card.appendChild(row);
    document.body.appendChild(card);
  }
})();
