// Global feedback widget: a small floating button (bottom-right) that opens
// a short form posting to /api/feedback. Loaded on every page via one
// <script src="/shared/feedback-widget.js" defer> tag appended by the Worker
// itself (see injectFeedbackWidget in src/worker.ts) rather than edited into
// every page, so it can't drift. Self-contained like command-palette.js --
// injects its own CSS/DOM and falls back across both page families' CSS
// variable names (--bg-card/--text on the homepage & dashboard vs
// --surface/--ink on guide pages).
(function () {
  var CATEGORIES = [
    { v: "idea", l: "Idea" },
    { v: "bug", l: "Something's broken" },
    { v: "praise", l: "Just saying thanks" },
    { v: "other", l: "Other" }
  ];

  var style = document.createElement("style");
  style.textContent =
    '#fbw-btn{position:fixed;right:20px;bottom:20px;z-index:9998;display:flex;align-items:center;gap:8px;' +
    'padding:11px 16px;border-radius:999px;border:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;' +
    'background:var(--accent-solid, var(--accent, #33529e));color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.22);' +
    'transition:transform .15s ease}' +
    '#fbw-btn:hover{transform:translateY(-1px)}' +
    '#fbw-btn svg{width:16px;height:16px;flex-shrink:0}' +
    '@media(max-width:640px){#fbw-btn span{display:none}#fbw-btn{padding:12px;right:16px;bottom:16px}}' +
    '#fbw-backdrop{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;' +
    'padding:16px;background:rgba(0,0,0,.45)}' +
    '#fbw-backdrop.open{display:flex}' +
    '#fbw-modal{width:min(420px,100%);background:var(--bg-card, var(--surface, #fff));' +
    'border:1px solid var(--border-strong, var(--border, #ccc));border-radius:16px;padding:22px;' +
    'box-shadow:0 24px 64px rgba(0,0,0,.35)}' +
    '#fbw-modal h2{margin:0 0 4px;font-size:17px;font-weight:800;color:var(--text, var(--ink, #111))}' +
    '#fbw-modal p.fbw-sub{margin:0 0 16px;font-size:13px;color:var(--text-muted, var(--ink-muted, #777))}' +
    '#fbw-cats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}' +
    '.fbw-cat{border:1px solid var(--border, #ccc);background:transparent;color:var(--text, var(--ink, #111));' +
    'border-radius:999px;padding:6px 12px;font-size:12.5px;font-family:inherit;cursor:pointer}' +
    '.fbw-cat.active{background:var(--accent-solid, var(--accent, #33529e));border-color:transparent;color:#fff}' +
    '#fbw-message{width:100%;box-sizing:border-box;min-height:90px;resize:vertical;padding:10px 12px;' +
    'border-radius:10px;border:1px solid var(--border, #ccc);background:transparent;color:var(--text, var(--ink, #111));' +
    'font-family:inherit;font-size:14px;margin-bottom:10px}' +
    '#fbw-email{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;' +
    'border:1px solid var(--border, #ccc);background:transparent;color:var(--text, var(--ink, #111));' +
    'font-family:inherit;font-size:13.5px;margin-bottom:14px}' +
    '#fbw-actions{display:flex;justify-content:flex-end;gap:8px}' +
    '#fbw-cancel{background:none;border:none;color:var(--text-muted, var(--ink-muted, #777));' +
    'font-family:inherit;font-size:13.5px;cursor:pointer;padding:9px 12px}' +
    '#fbw-submit{background:var(--accent-solid, var(--accent, #33529e));color:#fff;border:none;' +
    'border-radius:999px;padding:9px 18px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer}' +
    '#fbw-submit:disabled{opacity:.6;cursor:default}' +
    '#fbw-status{font-size:12.5px;margin-top:10px;min-height:16px;color:var(--text-muted, var(--ink-muted, #777))}' +
    '#fbw-status.fbw-error{color:#c0392b}' +
    '#fbw-status.fbw-ok{color:var(--accent-bright, var(--accent, #268a58))}';
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "fbw-btn";
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    "<span>Feedback</span>";
  document.body.appendChild(btn);

  var backdrop = document.createElement("div");
  backdrop.id = "fbw-backdrop";
  var catButtonsHtml = CATEGORIES.map(function (c, i) {
    return '<button type="button" class="fbw-cat' + (i === 0 ? " active" : "") + '" data-v="' + c.v + '">' + c.l + "</button>";
  }).join("");
  backdrop.innerHTML =
    '<div id="fbw-modal" role="dialog" aria-modal="true" aria-labelledby="fbw-title">' +
    '<h2 id="fbw-title">Send feedback</h2>' +
    '<p class="fbw-sub">Bugs, ideas, anything — it goes straight to the people building this.</p>' +
    '<div id="fbw-cats">' + catButtonsHtml + "</div>" +
    '<textarea id="fbw-message" placeholder="What\'s on your mind?" maxlength="2000"></textarea>' +
    '<input id="fbw-email" type="email" placeholder="Email (optional, if you want a reply)"/>' +
    '<div id="fbw-actions"><button id="fbw-cancel" type="button">Cancel</button><button id="fbw-submit" type="button">Send</button></div>' +
    '<div id="fbw-status" role="status"></div>' +
    "</div>";
  document.body.appendChild(backdrop);

  var category = CATEGORIES[0].v;
  var messageEl = backdrop.querySelector("#fbw-message");
  var emailEl = backdrop.querySelector("#fbw-email");
  var submitEl = backdrop.querySelector("#fbw-submit");
  var statusEl = backdrop.querySelector("#fbw-status");

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = kind ? "fbw-" + kind : "";
  }

  function open() {
    backdrop.classList.add("open");
    setStatus("");
    setTimeout(function () { messageEl.focus(); }, 0);
  }
  function close() {
    backdrop.classList.remove("open");
  }

  btn.addEventListener("click", open);
  backdrop.querySelector("#fbw-cancel").addEventListener("click", close);
  backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && backdrop.classList.contains("open")) close();
  });

  backdrop.querySelectorAll(".fbw-cat").forEach(function (el) {
    el.addEventListener("click", function () {
      category = el.dataset.v;
      backdrop.querySelectorAll(".fbw-cat").forEach(function (o) { o.classList.toggle("active", o === el); });
    });
  });

  submitEl.addEventListener("click", function () {
    var message = messageEl.value.trim();
    if (!message) {
      setStatus("Enter your feedback first.", "error");
      messageEl.focus();
      return;
    }
    submitEl.disabled = true;
    setStatus("Sending...");
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, email: emailEl.value.trim(), category: category, page: location.pathname })
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error((d && d.error) || "Something went wrong"); });
      setStatus("Thanks — got it!", "ok");
      messageEl.value = "";
      emailEl.value = "";
      setTimeout(close, 1200);
    }).catch(function (e) {
      setStatus(e.message || "Couldn't send — try again.", "error");
    }).finally(function () {
      submitEl.disabled = false;
    });
  });
})();
