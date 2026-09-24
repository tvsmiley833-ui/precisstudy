// @ts-check
import { owlSvg, OWL_CSS } from "/shared/owl.js";

let comboCount = 0;

const MILESTONES = { 3: "3 in a row!", 5: "5 in a row!", 10: "10 in a row! Perfect streak!", 15: "15 in a row!", 20: "20 in a row! Legendary!" };
// Chalk dust: cream and brand greens instead of rainbow confetti.
const CONFETTI_COLORS = ["#eef2ea", "#f7f3e6", "#9fdcb8", "#4fbf85", "#e0a54a", "#d6ddd4"];

// Optional chalk-tap sound on a correct answer. Off unless the student turns
// it on in Settings (localStorage "ss-sound" = "on").
/** @type {AudioContext | null} */
let audioCtx = null;
function chalkTap() {
  try { if (localStorage.getItem("ss-sound") !== "on") return; } catch (e) { return; }
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return;
  audioCtx = audioCtx || new AC();
  const ctx = /** @type {AudioContext} */ (audioCtx);
  const dur = 0.05;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.8;
  const gain = ctx.createGain(); gain.gain.value = 0.25;
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start();
}

// Sage pops up and claps (wings up, bouncing) for streak milestones.
function sageClap(/** @type {string} */ text) {
  if (!document.getElementById("sage-clap-css")) {
    const st = document.createElement("style");
    st.id = "sage-clap-css";
    st.textContent = OWL_CSS + ".sage-clap{position:fixed;right:18px;bottom:90px;z-index:10002;display:flex;align-items:center;gap:8px;padding:8px 14px 8px 8px;border-radius:16px;background:var(--surface,#14281f);border:1px solid var(--accent,#4fbf85);box-shadow:0 10px 26px rgb(0 0 0 / .3);font-weight:800;color:var(--ink,#eef2ea);transform:translateY(16px);opacity:0;transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .3s}.sage-clap.in{transform:none;opacity:1}.sage-clap .sage{animation:sageClap .35s ease-in-out 4 alternate}@keyframes sageClap{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-6px) rotate(4deg)}}@media (prefers-reduced-motion:reduce){.sage-clap .sage{animation:none}.sage-clap{transition:none}}";
    document.head.appendChild(st);
  }
  const el = document.createElement("div");
  el.className = "sage-clap";
  el.setAttribute("role", "status");
  el.innerHTML = owlSvg({ mood: "cheer", size: 52 }) + "<span></span>";
  /** @type {HTMLElement} */ (el.lastChild).textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 350); }, 2200);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** @param {number} x @param {number} y */
function launchConfetti(x, y) {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 70;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30;
    const size = 5 + Math.random() * 5;
    el.style.cssText = "position:fixed;left:" + x + "px;top:" + y + "px;width:" + size + "px;height:" + size + "px;"
      + "background:" + CONFETTI_COLORS[i % CONFETTI_COLORS.length] + ";border-radius:" + (Math.random() > 0.5 ? "50%" : "2px") + ";"
      + "pointer-events:none;z-index:9999;opacity:1;transform:translate(0,0) rotate(0deg);"
      + "transition:transform .7s cubic-bezier(.2,.8,.2,1), opacity .7s ease;";
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "translate(" + dx + "px, " + dy + "px) rotate(" + Math.round(Math.random() * 360) + "deg)";
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 750);
  }
}

// Call on a correct quiz answer, passing the DOM element to burst from
// (typically the correct option button). Returns the new combo count.
/** @param {Element | null} [anchorEl] */
export function celebrateCorrect(anchorEl) {
  comboCount++;
  chalkTap();
  if (!prefersReducedMotion() && typeof document !== "undefined") {
    const rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top : window.innerHeight / 2;
    launchConfetti(x, y);
    /** @type {Record<string, string>} */
    const milestones = MILESTONES;
    const msg = milestones[String(comboCount)] || (comboCount > 20 && comboCount % 10 === 0 ? comboCount + " in a row!" : null);
    if (msg) sageClap(msg);
  }
  return comboCount;
}

export function resetCombo() {
  comboCount = 0;
}

export function getCombo() {
  return comboCount;
}
