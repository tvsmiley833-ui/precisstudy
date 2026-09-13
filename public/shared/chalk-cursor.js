// @ts-check
// Chalk cursor. Inspired by the react-bits "glow cursor", retuned for
// PrecisStudy's chalkboard look: the pointer is a chalk-drawn arrow that
// eases toward the real cursor position. No trail is drawn.
//
// Self-initialising: importing this module runs setup() once. It never runs
// on touch / coarse pointers or under prefers-reduced-motion.

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
const FINE = matchMedia("(pointer: fine)");

function shouldRun() {
  return FINE.matches
    && !REDUCED.matches
    && document.documentElement.dataset.chalkCursor !== "off";
}

const TIP_LERP = 0.5; // how tightly the arrow tracks the pointer

function setup() {
  if (!window.matchMedia || !document.body) return;

  const NS = "http://www.w3.org/2000/svg";
  const style = document.createElement("style");
  style.textContent =
    "html.chalk-cursor-on,html.chalk-cursor-on *{cursor:none!important}" +
    "html.chalk-cursor-on input,html.chalk-cursor-on textarea,html.chalk-cursor-on [contenteditable=\"true\"]{cursor:text!important}" +
    ".chalk-arrow{position:fixed;left:0;top:0;width:28px;height:30px;pointer-events:none;" +
      "z-index:2147483000;will-change:transform;opacity:0;transition:opacity .16s ease;" +
      "filter:drop-shadow(0 0 3px color-mix(in srgb,var(--chalk-cursor-color,#f3efe2) 40%,transparent))}";
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

  document.body.appendChild(arrow);
  document.documentElement.classList.add("chalk-cursor-on");

  let pointerX = innerWidth / 2, pointerY = innerHeight / 2;
  let tipX = pointerX, tipY = pointerY;
  let visible = false;
  let running = false;

  function frame() {
    // ease the arrow toward the pointer
    tipX += (pointerX - tipX) * TIP_LERP;
    tipY += (pointerY - tipY) * TIP_LERP;
    arrow.style.transform = "translate(" + (tipX - 3) + "px," + (tipY - 3) + "px)";

    // keep easing until the arrow has effectively caught up, then park
    if (Math.abs(pointerX - tipX) > 0.05 || Math.abs(pointerY - tipY) > 0.05) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function kick() {
    if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); }
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (!visible) { visible = true; arrow.style.opacity = "1"; }
    kick();
  }, { passive: true });

  addEventListener("pointerleave", () => { visible = false; arrow.style.opacity = "0"; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });

  REDUCED.addEventListener("change", (e) => {
    if (e.matches) {
      running = false;
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
