// Site-wide accessible tooltips. Loaded on every page by the Worker (see
// injectSiteWidgets in src/worker.ts), self-contained like feedback-widget.js:
// injects its own CSS and falls back across both CSS-variable families
// (--bg-card/--text on hand-authored pages, --surface/--ink on guide pages).
//
// It upgrades every existing title="..." and any data-tip="..." into one
// shared role="tooltip" element. The title text moves into data-tip at init so
// the browser's native tooltip never doubles up, and an aria-label is kept on
// icon-only / unlabeled controls so they do not lose their accessible name.
//
//  - hover: shows after 250ms. Keyboard focus (:focus-visible): immediately.
//  - hides on blur, mouseleave, Escape, pointerdown and scroll.
//  - pointer-events:none, so it can never block a click.
//  - coarse pointers (touch): only elements marked data-tip-tap show a tip,
//    toggled on tap. Everything else is left to behave exactly as before.
//  - data-tip-native on an element opts it out of the upgrade.
// Loaded as a real ES module (see the "type=module" script tag injected by
// injectSiteWidgets in src/worker.ts) so the pure positioning math below can
// be unit-tested with a plain `import`, the same way test/mastery.test.js
// tests public/shared/mastery.js.
var MARGIN = 8;
var GAP = 8;

// Pure positioning math (unit-tested). Rects are {left, top, width, height}
// in viewport coordinates. Prefers above the trigger; flips below when there
// is no room above; clamps horizontally inside the viewport.
export function computePosition(trigger, tip, viewport) {
  var vw = viewport.width, vh = viewport.height;
  var spaceAbove = trigger.top - GAP - MARGIN;
  var spaceBelow = vh - (trigger.top + trigger.height) - GAP - MARGIN;
  var placement = "top";
  if (tip.height > spaceAbove && spaceBelow > spaceAbove) placement = "bottom";
  var top = placement === "top"
    ? trigger.top - GAP - tip.height
    : trigger.top + trigger.height + GAP;
  top = Math.max(MARGIN, Math.min(top, vh - tip.height - MARGIN));
  var left = trigger.left + trigger.width / 2 - tip.width / 2;
  left = Math.max(MARGIN, Math.min(left, vw - tip.width - MARGIN));
  return { left: Math.round(left), top: Math.round(top), placement: placement };
}

(function (root) {
  root.ssTipsMath = { computePosition: computePosition };

  if (typeof document === "undefined" || root.__ssTipsLoaded) return;
  root.__ssTipsLoaded = true;

  try {
    var style = document.createElement("style");
    style.textContent =
      "#ss-tip{position:fixed;left:0;top:0;z-index:2147483000;box-sizing:border-box;" +
      "max-width:min(260px,calc(100vw - 16px));padding:6px 9px;border-radius:6px;" +
      "border:1px solid var(--border-strong,var(--border,#8a8f98));" +
      "background:var(--bg-card,var(--surface,#fff));color:var(--text,var(--ink,#111));" +
      "font-family:inherit;font-size:12.5px;font-weight:600;line-height:1.35;text-align:left;" +
      "pointer-events:none;visibility:hidden;opacity:0;transition:opacity .12s ease;overflow-wrap:anywhere}" +
      "#ss-tip.ss-tip-on{visibility:visible;opacity:1}" +
      "@media(prefers-reduced-motion:reduce){#ss-tip{transition:none}}" +
      ".ss-tip-btn{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;" +
      "margin-left:6px;padding:0;border-radius:50%;border:1px solid var(--border,#8a8f98);background:transparent;" +
      "color:var(--text-muted,var(--ink-muted,#666));font:700 11px/1 inherit;font-family:inherit;cursor:help;vertical-align:middle}" +
      ".ss-tip-btn:hover{border-color:var(--accent-bright,var(--accent,#33529e));color:var(--accent,var(--accent-ink,#33529e))}";
    document.head.appendChild(style);
  } catch (e) { /* styling is best effort */ }

  var tipEl = document.createElement("div");
  tipEl.id = "ss-tip";
  tipEl.setAttribute("role", "tooltip");
  document.body.appendChild(tipEl);

  var SKIP = /^(HTML|HEAD|BODY|META|LINK|STYLE|SCRIPT|IFRAME|EMBED|OBJECT|TITLE)$/;
  var showTimer = 0;
  var current = null;        // trigger currently described
  var prevDescribed = null;  // its original aria-describedby, restored on hide
  var tapMode = false;

  function isCoarse() {
    try { return root.matchMedia("(hover: none)").matches; } catch (e) { return false; }
  }

  function hasName(el) {
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return true;
    if (el.labels && el.labels.length) return true;
    var text = (el.textContent || "").trim();
    if (text) return true;
    return !!el.querySelector("img[alt]:not([alt=''])");
  }

  function upgrade(el) {
    try {
      if (el.nodeType !== 1 || SKIP.test(el.tagName) || el.hasAttribute("data-tip-native")) return;
      if (el.namespaceURI === "http://www.w3.org/2000/svg") return;
      var title = el.getAttribute("title");
      if (title === null || el.hasAttribute("data-tip")) {
        if (title !== null) el.removeAttribute("title");
        return;
      }
      title = title.trim();
      if (!title) return;
      if (!hasName(el)) el.setAttribute("aria-label", title);
      el.setAttribute("data-tip", title);
      el.removeAttribute("title");
    } catch (e) { /* never throw into the page */ }
  }

  function upgradeTree(node) {
    try {
      if (node.nodeType !== 1) return;
      upgrade(node);
      var list = node.querySelectorAll("[title]");
      for (var i = 0; i < list.length; i++) upgrade(list[i]);
    } catch (e) {}
  }

  function tipTarget(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    return el && el.closest ? el.closest("[data-tip]") : null;
  }

  function place() {
    if (!current) return;
    var r = current.getBoundingClientRect();
    var t = tipEl.getBoundingClientRect();
    var pos = computePosition(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      { width: t.width, height: t.height },
      { width: document.documentElement.clientWidth, height: root.innerHeight }
    );
    tipEl.style.transform = "translate(" + pos.left + "px," + pos.top + "px)";
  }

  var shownAt = 0;
  function show(el) {
    var text = el.getAttribute("data-tip");
    if (!text) return;
    if (current && current !== el) restoreDescribed();
    clearTimeout(showTimer);
    current = el;
    tipEl.textContent = text;
    var prev = el.getAttribute("aria-describedby");
    if (prev !== "ss-tip" && (!prev || prev.split(" ").indexOf("ss-tip") < 0)) {
      prevDescribed = prev;
      el.setAttribute("aria-describedby", prev ? prev + " ss-tip" : "ss-tip");
    }
    place();
    tipEl.classList.add("ss-tip-on");
    shownAt = Date.now();
  }

  function restoreDescribed() {
    if (!current) return;
    if (prevDescribed) current.setAttribute("aria-describedby", prevDescribed);
    else current.removeAttribute("aria-describedby");
    prevDescribed = null;
  }

  function hide() {
    clearTimeout(showTimer);
    tipEl.classList.remove("ss-tip-on");
    restoreDescribed();
    current = null;
  }

  function scheduleShow(el, delay) {
    clearTimeout(showTimer);
    if (delay) showTimer = setTimeout(function () { show(el); }, delay);
    else show(el);
  }

  document.addEventListener("mouseover", function (e) {
    try {
      if (isCoarse()) return;
      var el = tipTarget(e.target);
      if (!el || el === current) return;
      scheduleShow(el, current ? 0 : 250);
    } catch (err) {}
  });
  document.addEventListener("mouseout", function (e) {
    try {
      var el = tipTarget(e.target);
      if (!el) return;
      var to = tipTarget(e.relatedTarget);
      if (to === el) return;
      if (isCoarse() && current === el) return;
      hide();
    } catch (err) {}
  });
  document.addEventListener("focusin", function (e) {
    try {
      var el = tipTarget(e.target);
      if (!el) return;
      if (isCoarse() && !el.hasAttribute("data-tip-tap")) return;
      var visible = true;
      try { visible = el.matches(":focus-visible"); } catch (err) {}
      if (visible) scheduleShow(el, 0);
    } catch (err) {}
  });
  document.addEventListener("focusout", function (e) {
    try { if (tipTarget(e.target) === current) hide(); } catch (err) {}
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && current) hide();
  });
  document.addEventListener("pointerdown", function (e) {
    try {
      if (!current) return;
      if (e.pointerType === "touch" && tipTarget(e.target) === current) return; // click handler toggles
      hide();
    } catch (err) {}
  });
  document.addEventListener("click", function (e) {
    try {
      if (!isCoarse()) return;
      var el = tipTarget(e.target);
      if (!el || !el.hasAttribute("data-tip-tap")) return;
      if (current === el) hide(); else show(el);
    } catch (err) {}
  });
  root.addEventListener("scroll", function () {
    if (!current) return;
    // A browser's own "scroll focused element into view" nudge fires a
    // scroll event in the same tick as the focus that just opened this
    // tooltip -- reposition instead of hiding it right back out from under
    // the keyboard user. A real user-initiated scroll (outside that short
    // window) still dismisses it as usual.
    if (Date.now() - shownAt < 120) { place(); return; }
    hide();
  }, true);
  root.addEventListener("resize", function () { if (current) hide(); });

  upgradeTree(document.body);

  // Throttled: batch added nodes / changed titles and process at most every 150ms.
  var pending = [];
  var timer = 0;
  function flush() {
    timer = 0;
    var batch = pending;
    pending = [];
    for (var i = 0; i < batch.length; i++) upgradeTree(batch[i]);
  }
  try {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "attributes") pending.push(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) pending.push(r.addedNodes[j]);
      }
      if (!timer) timer = setTimeout(flush, 150);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["title"] });
  } catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
