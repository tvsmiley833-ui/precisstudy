// @ts-check
// Personality layer for the subject guides, injected on every page by the
// Worker (see injectSiteWidgets) and a no-op anywhere that isn't a guide:
//   - a chalk strip of the subject's own symbols in the guide header
//   - Sage cheers (in a graduation cap) the first time a unit reaches mastery
//   - a thinking Sage on the quiz hint button
//   - a "Sharpening pencils…" Sage while the quiz box is empty
//   - a "Did you know?" chalk card at the end of every unit
//   - a Continue button back to the last unit opened, and a unit path
//   - a streak / XP pill in the header for signed-in students
//   - Sage beside the "why" card after each quiz answer
//   - a loading state and swipe gestures on flashcards
import { owlSvg, OWL_CSS } from "/shared/owl.js";
import { chalkIcon } from "/shared/chalk-icons.js";

const hero = document.querySelector(".hero");
const units = document.getElementById("units");
const SLUG = location.pathname.split("/").filter(Boolean)[0] || "";


function init() {
  const style = document.createElement("style");
  style.textContent = OWL_CSS + CSS;
  document.head.appendChild(style);
  chalkStrip();
  funFacts();
  watchMastery();
  watchQuiz();
  continueButton();
  unitPath();
  statsPill();
  flashcardPolish();
  textbookCard();
}

// ---------------------------------------------------------------- chalk strip
/** @type {Record<string, string[]>} */
const GROUPS = {
  math: ["a² + b² = c²", "y = mx + b", "π", "√x", "Σ", "f(x)", "∞", "x = −b ± √Δ ⁄ 2a", "∠ABC", "log₂ 8 = 3"],
  calc: ["∫ f(x) dx", "d⁄dx", "lim x→0", "f′(x)", "Σ aₙ", "e^x", "dy⁄dx", "∞", "Δx"],
  stats: ["x̄", "σ", "μ", "P(A|B)", "z = (x − μ)⁄σ", "r²", "H₀", "n = 30"],
  physics: ["F = ma", "E = mc²", "v = d⁄t", "p = mv", "KE = ½mv²", "g = 9.8 m⁄s²", "λ", "V = IR", "Δx"],
  chem: ["H₂O", "NaCl", "pH 7", "6.022 × 10²³", "CO₂", "PV = nRT", "e⁻", "O₂", "C₆H₁₂O₆"],
  bio: ["DNA", "ATP", "C₆H₁₂O₆", "Aa × Aa", "mRNA", "cell", "CO₂ + H₂O", "mitosis"],
  earth: ["4.5 bya", "igneous", "plate", "°C", "H₂O", "Richter", "CO₂", "strata"],
  space: ["☉", "AU", "light-year", "E = mc²", "λ", "Mars", "c = 3×10⁸ m⁄s"],
  cs: ["</>", "if (x) { }", "0101", "for (i = 0; i < n; i++)", "O(n)", "{ }", "true", "=="],
  history: ["1776", "1492", "1865", "1945", "1215", "1789", "1066", "1914"],
  gov: ["We the People", "1787", "Art. I", "1st Amend.", "checks & balances", "1791"],
  geo: ["N ↑", "0° lat", "Equator", "7 continents", "GDP", "map", "°E"],
  english: ["¶", "Once upon a time…", "metaphor", "“quote”", "theme", "sonnet", "ethos · pathos · logos"],
  spanish: ["¡Hola!", "¿Qué tal?", "ñ", "gracias", "ser · estar", "el · la", "¡Olé!"],
  french: ["Bonjour !", "ç", "merci", "le · la", "être", "à bientôt", "oui"],
  german: ["Guten Tag", "ß", "danke", "der · die · das", "ü", "ja", "Tschüss"],
  music: ["♪", "♫", "♩", "𝄞", "C major", "4⁄4", "f", "A = 440 Hz"],
  econ: ["S & D", "GDP", "$", "MR = MC", "%Δ", "P ↑ Q ↓", "CPI"],
  psych: ["Ψ", "neuron", "id · ego", "Pavlov", "nature ⇄ nurture", "memory"],
  health: ["♥", "8 hrs sleep", "H₂O", "BPM", "protein", "move!"],
  art: ["Mona Lisa", "Renaissance", "chiaroscuro", "1508", "perspective", "✎"],
  study: ["focus", "plan", "✓", "review", "spaced", "25 min"],
};
/** Chalk icons per group (see chalk-icons.js), mixed in with the words. */
/** @type {Record<string, string[]>} */
const GROUP_ICONS = {
  math: ["triangle", "ruler", "pencil", "sine"], calc: ["integral", "sine", "pencil", "ruler"], stats: ["bars", "magnifier", "coin", "check"],
  physics: ["atom", "rocket", "bulb", "sine"], chem: ["flask", "atom", "magnifier", "bulb"], bio: ["dna", "leaf", "heart", "magnifier"],
  earth: ["mountain", "globe", "leaf", "magnifier"], space: ["planet", "rocket", "atom", "bulb"], cs: ["code", "bulb", "check", "pencil"],
  history: ["column", "scroll", "flag", "clock"], gov: ["scroll", "column", "flag", "check"], geo: ["globe", "mountain", "flag", "plane"],
  english: ["book", "quill", "pencil", "speech"], spanish: ["speech", "globe", "book", "plane"], french: ["speech", "globe", "book", "plane"],
  german: ["speech", "globe", "book", "plane"], music: ["note", "clock", "speech", "pencil"], econ: ["coin", "bars", "scroll", "bulb"],
  psych: ["brain", "bulb", "magnifier", "heart"], health: ["heart", "apple", "clock", "leaf"], art: ["palette", "pencil", "bulb", "eraser"],
  study: ["pencil", "book", "clock", "check", "apple"],
};
/** @type {Record<string, string>} */
const SUBJECT_GROUP = {
  algebra1: "math", algebra2: "math", geometry: "math", precalc: "math", "sat-math": "math", "act-prep": "math",
  calculus: "calc", "calc-ab": "calc", "calc-bc": "calc", statistics: "stats", "ap-stats": "stats",
  physics: "physics", "ap-physics": "physics", chemistry: "chem", "ap-chemistry": "chem",
  biology: "bio", "ap-biology": "bio", anatomy: "bio", "earth-science": "earth", "environmental-science": "earth",
  astronomy: "space", "computer-science": "cs", "ap-csa": "cs",
  "global-history": "history", "world-history": "history", "ap-world": "history", "ap-euro": "history", apush: "history", "us-history": "history",
  "us-government": "gov", "ap-usgov": "gov", geography: "geo", "ap-human-geography": "geo",
  "english-9": "english", "english-10": "english", "ap-lang": "english", "sat-reading": "english", "creative-writing": "english", journalism: "english", "speech-debate": "english",
  "spanish-1": "spanish", "spanish-2": "spanish", "spanish-3": "spanish", "french-1": "french", "german-1": "german",
  "music-theory": "music", economics: "econ", "ap-macro": "econ", "ap-micro": "econ",
  psychology: "psych", "ap-psych": "psych", sociology: "psych", health: "health", "art-history": "art", "study-skills": "study",
};

function chalkStrip() {
  if (!hero) return;
  const group = SUBJECT_GROUP[SLUG] || "study";
  const words = GROUPS[group];
  const icons = GROUP_ICONS[group];
  // Deterministic scatter so the strip looks hand-placed but never jumps between visits.
  let seed = [...SLUG].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const W = 1200, H = 220;
  const items = [];
  for (let i = 0; i < 16; i++) {
    const x = Math.round(30 + (i % 8) * 148 + rand() * 50);
    const y = Math.round(40 + Math.floor(i / 8) * 100 + rand() * 30);
    const r = Math.round(rand() * 20 - 10);
    if ((i + Math.floor(i / 8)) % 2 === 0) {
      items.push(chalkIcon(icons[(i >> 1) % icons.length], x, y - 20, Math.round(46 + rand() * 18), r));
    } else {
      const w = words[(i >> 1) % words.length];
      items.push(`<text x="${x}" y="${y + 20}" font-size="${Math.round(18 + rand() * 10)}" transform="rotate(${r} ${x} ${y + 20})">${esc(w)}</text>`);
    }
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "guide-chalk");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.innerHTML = `<defs><filter id="gc-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter></defs><g filter="url(#gc-rough)">${items.join("")}</g>`;
  hero.prepend(svg);
}

// ---------------------------------------------------------------- fun facts
async function funFacts() {
  if (!units) return;
  let facts;
  try { facts = (await import("/shared/fun-facts.js")).FUN_FACTS[SLUG]; } catch (e) { return; }
  if (!facts || !facts.length) return;
  units.querySelectorAll(".unit").forEach((unit, i) => {
    const body = unit.querySelector(".unit-body");
    if (!body || body.querySelector(".fun-fact")) return;
    const id = Number(unit.getAttribute("data-id")) || i + 1;
    const card = document.createElement("aside");
    card.className = "fun-fact";
    card.innerHTML = `<div class="fun-fact-owl" aria-hidden="true">${owlSvg({ mood: "think", size: 44, acc: "", label: "" })}</div>` +
      `<div><b>Did you know?</b><p>${esc(facts[(id - 1) % facts.length])}</p></div>`;
    body.appendChild(card);
  });
}

// ---------------------------------------------------------------- mastery cheer
const MASTERED = 90;
function watchMastery() {
  if (!units) return;
  const unitsEl = units;
  const key = "sage-mastered:" + SLUG;
  /** @type {Set<string>} */
  let seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch (e) { seen = new Set(); }
  const save = () => { try { localStorage.setItem(key, JSON.stringify([...seen])); } catch (e) {} };
  /** @param {boolean} celebrate */
  const scan = (celebrate) => {
    unitsEl.querySelectorAll(".unit-progress").forEach((el) => {
      const label = el.querySelector(".unit-progress-label");
      const pct = parseInt((label && label.textContent) || "", 10);
      const id = el.id.replace("unit-progress-", "");
      if (!(pct >= MASTERED) || seen.has(id)) return;
      seen.add(id); save();
      if (celebrate) {
        const t = el.closest(".unit")?.querySelector(".unit-title")?.firstChild?.textContent;
        toast(`${(t || "This unit").trim()}: mastered! Sage is proud of you.`, { mood: "cheer", cap: true });
      }
    });
  };
  // Units already mastered before this visit are recorded silently.
  setTimeout(() => {
    scan(false);
    new MutationObserver(() => scan(true)).observe(unitsEl, { subtree: true, childList: true, characterData: true });
  }, 2500);
}

// ---------------------------------------------------------------- quiz: hint owl + loading owl
function watchQuiz() {
  const qbox = document.getElementById("qbox");
  if (!qbox) return;
  const decorate = () => {
    const hint = document.getElementById("q-hint-btn");
    if (hint && !hint.querySelector(".sage-mini")) {
      hint.insertAdjacentHTML("afterbegin", `<span class="sage-mini" aria-hidden="true">${owlSvg({ mood: "think", size: 20, acc: "", label: "" })}</span>`);
    }
    const why = qbox.querySelector(".q-why-hd");
    if (why && !why.querySelector(".sage")) {
      const right = !!why.closest(".q-why-right");
      why.insertAdjacentHTML("afterbegin", owlSvg({ mood: right ? "cheer" : "think", size: 40, acc: "", label: "" }));
    }
    if (!qbox.childElementCount && qbox.offsetParent !== null) {
      qbox.innerHTML = `<div class="sage-loading">${owlSvg({ mood: "think", size: 64 })}<p>Sharpening pencils…</p></div>`;
    }
  };
  new MutationObserver(decorate).observe(qbox, { childList: true, subtree: true });
  document.addEventListener("click", () => setTimeout(decorate, 50));
  decorate();
}

// ---------------------------------------------------------------- continue + unit path
const LAST_UNIT_KEY = "ss-last-unit:" + SLUG;

/** @returns {HTMLElement[]} */
const unitEls = () => units ? /** @type {HTMLElement[]} */ ([...units.querySelectorAll(":scope > .unit")]) : [];

/** @param {HTMLElement} unit */
const unitName = (unit) => (unit.querySelector(".unit-title")?.firstChild?.textContent || "").trim();

function continueButton() {
  if (!units) return;
  // Remember whichever unit the student opens.
  units.addEventListener("click", (e) => {
    const hd = /** @type {HTMLElement} */ (e.target).closest?.(".unit-hd");
    const unit = hd?.closest(".unit");
    if (!unit || !unit.classList.contains("open")) return;
    try { localStorage.setItem(LAST_UNIT_KEY, String(unitEls().indexOf(/** @type {HTMLElement} */ (unit)))); } catch (err) {}
  });
  let idx = -1;
  try { idx = Number(localStorage.getItem(LAST_UNIT_KEY) ?? -1); } catch (err) {}
  const unit = unitEls()[idx];
  if (!unit) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ss-continue";
  btn.innerHTML = `<span>Continue where you left off</span><b></b><span aria-hidden="true">→</span>`;
  /** @type {HTMLElement} */ (btn.querySelector("b")).textContent = unitName(unit);
  btn.onclick = () => {
    if (!unit.classList.contains("open")) /** @type {HTMLElement | null} */ (unit.querySelector(".unit-hd"))?.click();
    unit.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    /** @type {HTMLElement | null} */ (unit.querySelector(".unit-hd"))?.focus?.();
  };
  units.before(btn);
}

// Numbered markers down the left of the unit list, filled as units are
// mastered (80%+, same threshold as the dashboard).
function unitPath() {
  if (!units) return;
  const unitsEl = units;
  unitsEl.classList.add("ss-path");
  const paint = () => unitEls().forEach((unit, i) => {
    unit.style.setProperty("--n", `"${i + 1}"`);
    const pct = parseInt(unit.querySelector(".unit-progress-label")?.textContent || "", 10);
    unit.dataset.path = pct >= 80 ? "done" : pct > 0 ? "started" : "new";
  });
  paint();
  new MutationObserver(paint).observe(unitsEl, { subtree: true, characterData: true, childList: true });
}

// ---------------------------------------------------------------- streak / XP pill
async function statsPill() {
  const inner = hero?.querySelector(".hero-inner");
  if (!inner) return;
  const w = /** @type {Window & { __ssMe?: Promise<any> }} */ (window);
  w.__ssMe = w.__ssMe || fetch("/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null);
  const me = await w.__ssMe;
  if (!me || !me.loggedIn) return;
  // /api/quest writes on every GET, so fetch it once per browser session.
  /** @type {{ streak: number, xp: number, level: number } | null} */
  let stats = null;
  try { stats = JSON.parse(sessionStorage.getItem("ss-stats") || "null"); } catch (e) {}
  if (!stats) {
    try {
      const [p, q] = await Promise.all([fetch("/api/progress").then(r => r.json()), fetch("/api/quest").then(r => r.json())]);
      stats = { streak: p?.streak?.current || 0, xp: q?.quest?.xp || 0, level: q?.quest?.level?.level || 1 };
      try { sessionStorage.setItem("ss-stats", JSON.stringify(stats)); } catch (e) {}
    } catch (e) { return; }
  }
  const pill = document.createElement("a");
  pill.href = "/dashboard/";
  pill.className = "ss-stats-pill";
  pill.setAttribute("aria-label", `${stats.streak}-day streak, level ${stats.level}, ${stats.xp} XP. Open dashboard`);
  pill.innerHTML = `<span aria-hidden="true">🔥 ${stats.streak}</span><span aria-hidden="true">Lv ${stats.level} · ${stats.xp.toLocaleString()} XP</span>`;
  inner.appendChild(pill);
}

// ---------------------------------------------------------------- flashcards
function flashcardPolish() {
  const scene = document.getElementById("scene");
  const term = document.getElementById("fc-term");
  if (!scene || !term) return;
  // Loading state until the first card is filled in.
  const setLoading = () => scene.classList.toggle("ss-loading", !term.textContent?.trim());
  setLoading();
  new MutationObserver(setLoading).observe(term, { childList: true, characterData: true, subtree: true });
  // Swipe left/right for next/previous. A tap still flips (the page's click
  // handler); a swipe swallows the click that follows it.
  const g = /** @type {any} */ (window);
  let x0 = 0, y0 = 0, swiped = false;
  scene.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (!t) return; x0 = t.clientX; y0 = t.clientY; swiped = false; }, { passive: true });
  scene.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || typeof g.fcNav !== "function") return;
    swiped = true;
    g.fcNav(dx < 0 ? 1 : -1);
  }, { passive: true });
  scene.addEventListener("click", (e) => { if (swiped) { e.stopImmediatePropagation(); e.preventDefault(); swiped = false; } }, true);
}

// ---------------------------------------------------------------- free textbook
// Free, peer-reviewed OpenStax textbooks matching each course (every URL was
// confirmed against openstax.org search results, 2026-09).
const OS = "https://openstax.org/books/";
/** @type {Record<string, [string, string]>} */
const TEXTBOOKS = {
  physics: ["Physics (high school)", OS + "physics/pages/preface"],
  "ap-physics": ["College Physics 2e", OS + "college-physics-2e/pages/1-introduction-to-science-and-the-realm-of-physics-physical-quantities-and-units"],
  biology: ["Biology 2e", OS + "biology-2e/pages/preface"],
  "ap-biology": ["Biology for AP® Courses", OS + "biology-ap-courses/pages/preface"],
  anatomy: ["Anatomy and Physiology 2e", OS + "anatomy-and-physiology-2e/pages/preface"],
  chemistry: ["Chemistry 2e", "https://openstax.org/details/books/chemistry-2e"],
  "ap-chemistry": ["Chemistry 2e", "https://openstax.org/details/books/chemistry-2e"],
  astronomy: ["Astronomy 2e", OS + "astronomy-2e/pages/preface"],
  algebra2: ["Algebra and Trigonometry 2e", OS + "algebra-and-trigonometry-2e/pages/index"],
  precalc: ["Precalculus 2e", OS + "precalculus-2e/pages/preface"],
  calculus: ["Calculus Volume 1", OS + "calculus-volume-1/pages/preface"],
  "calc-ab": ["Calculus Volume 1", OS + "calculus-volume-1/pages/preface"],
  "calc-bc": ["Calculus Volume 2", OS + "calculus-volume-2/pages/preface"],
  statistics: ["Introductory Statistics 2e", OS + "introductory-statistics-2e/pages/preface"],
  "ap-stats": ["Introductory Statistics 2e", OS + "introductory-statistics-2e/pages/preface"],
  psychology: ["Psychology 2e", OS + "psychology-2e/pages/preface"],
  "ap-psych": ["Psychology 2e", OS + "psychology-2e/pages/preface"],
  sociology: ["Introduction to Sociology", "https://openstax.org/details/books/introduction-sociology/"],
  economics: ["Principles of Economics 2e", OS + "principles-economics-2e/pages/preface"],
  "ap-micro": ["Principles of Microeconomics for AP® Courses 2e", OS + "principles-microeconomics-ap-courses-2e/pages/preface"],
  "ap-macro": ["Principles of Macroeconomics for AP® Courses", OS + "principles-macroeconomics-ap-courses/pages/1-introduction"],
  "us-history": ["U.S. History", "https://openstax.org/details/books/us-history"],
  apush: ["U.S. History", "https://openstax.org/details/books/us-history"],
  "us-government": ["American Government 4e", "https://openstax.org/details/books/american-government-4e"],
  "ap-usgov": ["American Government 4e", "https://openstax.org/details/books/american-government-4e"],
  "world-history": ["World History Volume 1, to 1500", "https://openstax.org/details/books/world-history-volume-1"],
  "ap-world": ["World History Volume 1, to 1500", "https://openstax.org/details/books/world-history-volume-1"],
  "global-history": ["World History Volume 1, to 1500", "https://openstax.org/details/books/world-history-volume-1"],
};

function textbookCard() {
  const book = TEXTBOOKS[SLUG];
  if (!book || !units || document.querySelector(".ss-textbook")) return;
  const card = document.createElement("aside");
  card.className = "ss-textbook";
  card.innerHTML = `<b>Want more depth?</b> <span>The free, peer-reviewed OpenStax textbook <i></i> covers this course. Read it online or download the PDF.</span> <a target="_blank" rel="noopener">Open the free textbook ↗</a>`;
  /** @type {HTMLElement} */ (card.querySelector("i")).textContent = book[0];
  /** @type {HTMLAnchorElement} */ (card.querySelector("a")).href = book[1];
  units.after(card);
}

// ---------------------------------------------------------------- toast
/** @param {string} text @param {{mood?: any, cap?: boolean}} [o] */
export function toast(text, o = {}) {
  const el = document.createElement("div");
  el.className = "sage-toast";
  el.setAttribute("role", "status");
  el.innerHTML = owlSvg({ mood: o.mood || "happy", cap: o.cap, size: 56 }) + `<p>${esc(text)}</p>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 400); }, 4200);
}

/** @param {string} s */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `
@font-face{font-family:'Kalam';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/kalam-700-latin.woff2') format('woff2')}
.hero{position:relative}
.guide-chalk{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.12}
.guide-chalk text{fill:#eef2ea;font-family:'Kalam','Segoe Print',cursive;font-weight:700}
.guide-chalk .chalk-ic path{fill:none;stroke:#eef2ea;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.hero-inner{position:relative;z-index:1}
.fun-fact{display:flex;gap:12px;align-items:center;margin-top:16px;padding:14px 16px;border-radius:12px;border:1px dashed var(--border-strong,var(--border));background:var(--surface-2)}
.fun-fact b{display:block;font-family:'Kalam',cursive;font-size:17px;color:var(--accent);margin-bottom:2px}
.fun-fact p{margin:0;font-size:15px;line-height:1.5;color:var(--ink-muted)}
.fun-fact-owl{flex-shrink:0}
.sage-mini{display:inline-flex;vertical-align:-5px;margin-right:6px}
.sage-loading{display:flex;flex-direction:column;align-items:center;gap:6px;padding:32px 0;color:var(--ink-muted);font-weight:600}
.sage-loading .sage{animation:sageBob 1.6s ease-in-out infinite}
.sage-toast{position:fixed;left:16px;bottom:16px;z-index:10001;display:flex;align-items:center;gap:10px;max-width:340px;padding:10px 16px 10px 10px;border-radius:16px;
  background:var(--surface);border:1px solid var(--accent);box-shadow:0 12px 30px rgb(0 0 0 / .3);transform:translateY(20px);opacity:0;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .35s}
.sage-toast.in{transform:none;opacity:1}
.sage-toast p{margin:0;font-weight:700;font-size:14.5px;color:var(--ink)}
@media (prefers-reduced-motion: reduce){.sage-toast{transition:none}.sage-loading .sage{animation:none}}
`;

// Last, so every const above (GROUPS, CSS, …) is initialized first.
if (hero && units && SLUG) init();
