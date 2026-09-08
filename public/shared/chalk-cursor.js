// @ts-check
// Chalk cursor + chalk-stroke trail. Inspired by the react-bits "glow cursor",
// retuned for PrecisStudy's chalkboard look: the pointer is a chalk-drawn arrow,
// and moving it lays down a grainy chalk line that stays where it was drawn and
// fades in place (like writing on a board), not falling dust.
//
// Self-initialising: importing this module runs setup() once. It never runs on
// touch / coarse pointers or under prefers-reduced-motion, and the rAF loop
// parks itself when the board is clean and the pointer is still.

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
const FINE = matchMedia("(pointer: fine)");

function shouldRun() {
  return FINE.matches
    && !REDUCED.matches
    && document.documentElement.dataset.chalkCursor !== "off";
}

const TIP_LERP = 0.5;         // how tightly the arrow tracks the pointer
const FADE_PER_FRAME = 0.032; // per-frame passive decay of laid-down chalk (0..1)
const CLEAR_AFTER = 170;      // frames of pure fading before the board is wiped
const MAX_SEG = 90;           // px of a single move processed per frame
const STEP = 1.5;             // px between brush stamps along the stroke

function setup() {
  if (!window.matchMedia || !document.body) return;

  const NS = "http://www.w3.org/2000/svg";
  const style = document.createElement("style");
  style.textContent =
    "html.chalk-cursor-on,html.chalk-cursor-on *{cursor:none!important}" +
    "html.chalk-cursor-on input,html.chalk-cursor-on textarea,html.chalk-cursor-on [contenteditable=\"true\"]{cursor:text!important}" +
    ".chalk-arrow{position:fixed;left:0;top:0;width:28px;height:30px;pointer-events:none;" +
      "z-index:2147483000;will-change:transform;opacity:0;transition:opacity .16s ease;" +
      "filter:drop-shadow(0 0 3px color-mix(in srgb,var(--chalk-cursor-color,#f3efe2) 40%,transparent))}" +
    ".chalk-trail{position:fixed;inset:0;pointer-events:none;z-index:2147482999}";
  document.head.appendChild(style);

  // Chalk-drawn pointer matching the reference: an outlined arrow with a sparse,
  // thick diagonal hatch fill. Every stroke shares ONE fractal-noise
  // displacement field, so the hatch lines wobble together like one hand-drawn
  // swoop rather than a printed screen. Uneven per-line opacity + round caps
  // read as chalk-stick pressure. Hotspot is the tip at (3,3).
  const ARROW = "M3 3 L3 25 L9 19.5 L13 29 L17 27.2 L13 17.6 L23 17.6 Z";
  let hatch = "";
  for (let i = -2; i <= 6; i++) {
    const x = i * 7;                     // ~7px gap: few lines, wide spacing
    hatch += '<line x1="' + (x - 7) + '" y1="33" x2="' + (x + 27) + '" y2="-5" ' +
             'stroke-width="2.6" opacity="' + (i % 2 ? "0.72" : "0.95") + '"/>';
  }
  const arrow = document.createElementNS(NS, "svg");
  arrow.setAttribute("class", "chalk-arrow");
  arrow.setAttribute("viewBox", "0 0 28 30");
  arrow.innerHTML =
    '<defs>' +
      '<filter id="ccRough" x="-45%" y="-45%" width="190%" height="190%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="7" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/>' +
      '</filter>' +
      '<clipPath id="ccClip"><path d="' + ARROW + '"/></clipPath>' +
    '</defs>' +
    '<g stroke="var(--chalk-cursor-color,#f3efe2)" fill="none" ' +
        'stroke-linecap="round" stroke-linejoin="round" filter="url(#ccRough)">' +
      '<g clip-path="url(#ccClip)">' + hatch + '</g>' +
      '<path d="' + ARROW + '" stroke-width="1.9"/>' +
      '<circle cx="3.6" cy="3.6" r="0.7" fill="var(--chalk-cursor-color,#f3efe2)" stroke="none" opacity="0.85"/>' +
      '<circle cx="6.2" cy="5.6" r="0.5" fill="var(--chalk-cursor-color,#f3efe2)" stroke="none" opacity="0.6"/>' +
      '<circle cx="2.2" cy="6.8" r="0.5" fill="var(--chalk-cursor-color,#f3efe2)" stroke="none" opacity="0.5"/>' +
    '</g>';

  const canvas = document.createElement("canvas");
  canvas.className = "chalk-trail";
  const ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);
  document.body.appendChild(arrow);
  document.documentElement.classList.add("chalk-cursor-on");

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize, { passive: true });

  const chalkColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--chalk-cursor-color").trim() || "#f3efe2";

  let pointerX = innerWidth / 2, pointerY = innerHeight / 2;
  let tipX = pointerX, tipY = pointerY;
  let drawX = pointerX, drawY = pointerY;   // where the last chalk stamp landed
  let lastSpeed = 0;
  let pendingInk = false;                    // is there a fresh segment to stroke
  let dirty = false;                         // is there chalk on the canvas to fade
  let visible = false;
  let running = false;
  let fadeFrames = 0;                        // consecutive frames with no new ink

  // One chalk stamp: a small scatter of faint specks, denser in the middle,
  // sparser and lighter at the edges — the grain of a chalk stroke.
  /** @param {number} x @param {number} y @param {number} radius @param {number} density */
  function stamp(x, y, radius, density) {
    if (!ctx) return;
    for (let i = 0; i < density; i++) {
      const t = Math.random();
      const rr = Math.pow(t, 0.6) * radius;          // bias toward centre
      const a = Math.random() * Math.PI * 2;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      const s = 0.6 + Math.random() * 1.1;
      ctx.globalAlpha = (1 - t) * 0.28 + 0.04;
      ctx.fillRect(px, py, s, s);
    }
  }

  function frame() {
    const now = performance.now();
    if (!ctx) return;

    // ease the arrow toward the pointer
    tipX += (pointerX - tipX) * TIP_LERP;
    tipY += (pointerY - tipY) * TIP_LERP;
    arrow.style.transform = "translate(" + (tipX - 3) + "px," + (tipY - 3) + "px)";

    // fade what's already on the board, in place
    if (dirty) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = FADE_PER_FRAME;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.globalCompositeOperation = "source-over";
    }

    // lay down the new stroke segment as chalk grain
    if (pendingInk) {
      pendingInk = false;
      let dx = pointerX - drawX, dy = pointerY - drawY;
      let dist = Math.hypot(dx, dy);
      if (dist > MAX_SEG) {                 // don't ink a giant jump
        const k = MAX_SEG / dist;
        dx *= k; dy *= k; dist = MAX_SEG;
      }
      const steps = Math.max(1, Math.floor(dist / STEP));
      // faster movement -> a little thinner/lighter, like a real chalk stroke
      const width = Math.max(3.4, 10 - lastSpeed * 0.3);
      const density = lastSpeed > 7 ? 8 : 13;
      ctx.fillStyle = chalkColor();
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        stamp(drawX + dx * f, drawY + dy * f, width * (0.78 + Math.random() * 0.44), density);
      }
      ctx.globalAlpha = 1;
      drawX += dx; drawY += dy;
      dirty = true;
      fadeFrames = 0;
    } else if (dirty) {
      fadeFrames++;
    }

    // Passive decay: keep fading every frame until the board has quietly gone
    // to nothing, then wipe the last invisible residue and park.
    if (document.hidden || (dirty && fadeFrames > CLEAR_AFTER)) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      dirty = false;
      running = false;
      return;
    }
    if (!dirty) { running = false; return; }
    requestAnimationFrame(frame);
  }

  function kick() {
    if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); }
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const ndx = e.clientX - pointerX, ndy = e.clientY - pointerY;
    lastSpeed = Math.hypot(ndx, ndy);
    pointerX = e.clientX;
    pointerY = e.clientY;
    pendingInk = true;
    if (!visible) { visible = true; arrow.style.opacity = "1"; }
    kick();
  }, { passive: true });

  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || !ctx) return;
    // a little chalk tap
    ctx.fillStyle = chalkColor();
    stamp(e.clientX, e.clientY, 9, 34);
    ctx.globalAlpha = 1;
    dirty = true;
    fadeFrames = 0;
    kick();
  }, { passive: true });

  addEventListener("pointerleave", () => { visible = false; arrow.style.opacity = "0"; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });

  REDUCED.addEventListener("change", (e) => {
    if (e.matches) {
      running = false;
      canvas.remove();
      arrow.remove();
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
