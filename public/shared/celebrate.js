let comboCount = 0;

const MILESTONES = { 3: "🔥 3 in a row!", 5: "⚡ 5 in a row!", 10: "🌟 10 in a row!", 15: "🚀 15 in a row!", 20: "👑 20 in a row!" };
const CONFETTI_COLORS = ["#ff8a4c", "#e6bb55", "#7fc98f", "#5b9ee8", "#9b8cf0", "#e0708a"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

function showComboBanner(text, x, y) {
  const banner = document.createElement("div");
  banner.textContent = text;
  banner.style.cssText = "position:fixed;left:" + x + "px;top:" + y + "px;transform:translate(-50%,-100%);"
    + "background:var(--accent-bright,#ff8a4c);color:#fff;font-weight:800;font-size:14px;padding:6px 14px;"
    + "border-radius:999px;pointer-events:none;z-index:10000;opacity:0;box-shadow:0 4px 14px rgba(0,0,0,.2);"
    + "transition:opacity .25s ease, transform .25s cubic-bezier(.2,.8,.2,1);white-space:nowrap;";
  document.body.appendChild(banner);
  requestAnimationFrame(() => {
    banner.style.opacity = "1";
    banner.style.transform = "translate(-50%,-130%)";
  });
  setTimeout(() => {
    banner.style.opacity = "0";
    setTimeout(() => banner.remove(), 300);
  }, 900);
}

// Call on a correct quiz answer, passing the DOM element to burst from
// (typically the correct option button). Returns the new combo count.
export function celebrateCorrect(anchorEl) {
  comboCount++;
  if (!prefersReducedMotion() && typeof document !== "undefined") {
    const rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top : window.innerHeight / 2;
    launchConfetti(x, y);
    const msg = MILESTONES[comboCount] || (comboCount > 20 && comboCount % 10 === 0 ? "🔥 " + comboCount + " in a row!" : null);
    if (msg) showComboBanner(msg, x, y);
  }
  return comboCount;
}

export function resetCombo() {
  comboCount = 0;
}

export function getCombo() {
  return comboCount;
}
