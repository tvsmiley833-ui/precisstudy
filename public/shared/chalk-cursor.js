// @ts-check
// Chalk cursor + chalk-dust trail. A vanilla port of the "glow cursor" idea
// (react-bits) retuned for PrecisStudy's chalkboard look: the pointer becomes a
// stub of chalk that scatters dust as it moves.
//
// Self-initialising: importing this module runs setup() once. Cheap when idle
// (the rAF loop parks itself when there is nothing to draw and the pointer is
// still), and it never runs on touch / coarse pointers or when the visitor has
// asked for reduced motion.

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
const FINE = matchMedia("(pointer: fine)");

function shouldRun() {
  return FINE.matches
    && !REDUCED.matches
    && document.documentElement.dataset.chalkCursor !== "off";
}

const TIP_LERP = 0.4;          // how tightly the chalk stub tracks the pointer
const MAX_PARTICLES = 130;     // hard cap on live dust motes
const EMIT_DISTANCE = 4;       // px of travel per emitted mote
const LIFE_MS = 620;           // mote lifetime

/** @typedef {{x:number,y:number,vx:number,vy:number,r:number,born:number,rot:number}} Mote */

function setup() {
  if (!window.matchMedia || !document.body) return;

  const style = document.createElement("style");
  style.textContent =
    "html.chalk-cursor-on,html.chalk-cursor-on *{cursor:none!important}" +
    // keep a real text caret where typing happens
    "html.chalk-cursor-on input,html.chalk-cursor-on textarea,html.chalk-cursor-on [contenteditable=\"true\"]{cursor:text!important}" +
    ".chalk-tip{position:fixed;left:0;top:0;width:14px;height:14px;pointer-events:none;" +
      "z-index:2147483000;will-change:transform;opacity:0;transition:opacity .18s ease}" +
    ".chalk-tip::before{content:\"\";position:absolute;inset:0;border-radius:3px;" +
      "background:var(--chalk-cursor-color,#f3efe2);" +
      "box-shadow:0 0 6px 1px color-mix(in srgb,var(--chalk-cursor-color,#f3efe2) 55%,transparent);" +
      "transform:rotate(-38deg);opacity:.95}" +
    ".chalk-trail{position:fixed;inset:0;pointer-events:none;z-index:2147482999}";
  document.head.appendChild(style);

  const canvas = document.createElement("canvas");
  canvas.className = "chalk-trail";
  const ctx = canvas.getContext("2d");
  const tip = document.createElement("div");
  tip.className = "chalk-tip";
  document.body.appendChild(canvas);
  document.body.appendChild(tip);
  document.documentElement.classList.add("chalk-cursor-on");

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  }
  resize();
  addEventListener("resize", resize, { passive: true });

  const chalkColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--chalk-cursor-color").trim() || "#f3efe2";

  /** @type {Mote[]} */
  const motes = [];
  let pointerX = innerWidth / 2, pointerY = innerHeight / 2;
  let tipX = pointerX, tipY = pointerY;
  let lastEmitX = pointerX, lastEmitY = pointerY;
  let visible = false;
  let running = false;
  let idleSince = performance.now();

  /** @param {number} x @param {number} y @param {number} strength */
  function emit(x, y, strength) {
    for (let i = 0; i < strength && motes.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 0.5;
      motes.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + 0.35,      // dust drifts downward
        r: 0.6 + Math.random() * 1.8,
        rot: Math.random() * Math.PI,
        born: performance.now()
      });
    }
  }

  function frame() {
    const now = performance.now();
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // chalk stub easing
    tipX += (pointerX - tipX) * TIP_LERP;
    tipY += (pointerY - tipY) * TIP_LERP;
    tip.style.transform = "translate(" + (tipX - 7) + "px," + (tipY - 7) + "px)";

    const col = chalkColor();
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      const age = (now - m.born) / LIFE_MS;
      if (age >= 1) { motes.splice(i, 1); continue; }
      m.x += m.vx;
      m.y += m.vy;
      m.vy += 0.012;                       // gentle gravity
      const alpha = (1 - age) * 0.5;
      // grainy square-ish speck, rotated: reads as chalk dust, not a dot
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot + age * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      const sz = m.r * (1 + age * 0.6);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }

    const idle = motes.length === 0 && (now - idleSince) > 400;
    if (idle || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
  }

  function kick() {
    if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); }
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    idleSince = performance.now();
    if (!visible) { visible = true; tip.style.opacity = "1"; }
    const dx = pointerX - lastEmitX, dy = pointerY - lastEmitY;
    const dist = Math.hypot(dx, dy);
    if (dist >= EMIT_DISTANCE) {
      emit(pointerX, pointerY, Math.min(3, Math.round(dist / EMIT_DISTANCE)));
      lastEmitX = pointerX;
      lastEmitY = pointerY;
    }
    kick();
  }, { passive: true });

  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    emit(e.clientX, e.clientY, 10);        // a puff on click
    kick();
  }, { passive: true });

  addEventListener("pointerleave", () => { visible = false; tip.style.opacity = "0"; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });

  // If the visitor switches on reduced-motion mid-session, tear everything down.
  REDUCED.addEventListener("change", (e) => {
    if (e.matches) {
      running = false;
      motes.length = 0;
      canvas.remove();
      tip.remove();
      style.remove();
      document.documentElement.classList.remove("chalk-cursor-on");
    }
  });
}

if (shouldRun()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
}
