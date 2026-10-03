// @ts-check
// Sage, PrecisStudy's owl mascot. Pure SVG built from the site palette so it
// themes with the brand (deep green body, mint belly, cream eyes, amber beak)
// and needs no image request. Moods: "idle" (open eyes, blinks), "happy"
// (smiling closed eyes), "cheer" (wings up), "think" (eyes glance up).
// `cap: true` adds the graduation cap earned at the end of setup; `acc` picks
// another earnable accessory (goggles, beret, glasses, explorer, pencil, headphones).

const C = {
  body: "#2f8f5c",
  bodyLight: "#4fae7b",
  bodyDeep: "#237549",
  bodyDark: "#1f6e46",
  belly: "#9fdcb8",
  bellyLight: "#c9efdb",
  bellyLine: "#4fbf85",
  face: "#eef2ea",
  eye: "#0e231e",
  beak: "#e0a54a",
  feet: "#e0a54a",
  blush: "#f2a58e",
  cap: "#0e231e",
  tassel: "#e0a54a",
  chalk: "#eef2ea",
};
let uid = 0;

/** @param {string} mood */
function eyes(mood) {
  if (mood === "sleepy") {
    return `<path d="M42 60h16M70 60h16" stroke="${C.eye}" stroke-width="4" stroke-linecap="round"/>
      <text x="100" y="30" font-size="14" font-weight="700" fill="${C.face}" font-family="Kalam,cursive">z</text>
      <text x="110" y="16" font-size="10" font-weight="700" fill="${C.face}" font-family="Kalam,cursive">z</text>`;
  }
  if (mood === "happy" || mood === "cheer") {
    return `<path d="M41 58q8-9 16 0" fill="none" stroke="${C.eye}" stroke-width="4" stroke-linecap="round"/>
      <path d="M71 58q8-9 16 0" fill="none" stroke="${C.eye}" stroke-width="4" stroke-linecap="round"/>`;
  }
  // Thinking: eyes glance up and to the side, with small chalk thought bubbles.
  const bubbles = mood === "think" ? `<g fill="none" stroke="${C.chalk}" stroke-width="2"><circle cx="104" cy="30" r="3"/><circle cx="113" cy="19" r="4.5"/><circle cx="123" cy="5" r="6"/></g>` : "";
  const dy = mood === "think" ? -4 : 0;
  const dx = mood === "think" ? 3 : 0;
  return `<g class="sage-eyes">
      <circle cx="${49 + dx}" cy="${58 + dy}" r="8.6" fill="${C.eye}"/><circle cx="${52 + dx}" cy="${55 + dy}" r="2.7" fill="#fff"/><circle cx="${46.5 + dx}" cy="${61.5 + dy}" r="1.3" fill="#fff" opacity=".85"/>
      <circle cx="${79 + dx}" cy="${58 + dy}" r="8.6" fill="${C.eye}"/><circle cx="${82 + dx}" cy="${55 + dy}" r="2.7" fill="#fff"/><circle cx="${76.5 + dx}" cy="${61.5 + dy}" r="1.3" fill="#fff" opacity=".85"/>
    </g>${bubbles}`;
}

/** Neat rows of scalloped feathers on the belly, clipped to the ellipse width. */
function bellyFeathers() {
  let d = "";
  for (let r = 0, y = 80; y <= 120; r++, y += 9) {
    const half = 27 * Math.sqrt(Math.max(0, 1 - ((y - 96) / 31) ** 2)) - 4;
    for (let x = 64 - half + (r % 2 ? 4.5 : 0); x + 9 <= 64 + half; x += 9) d += `M${x.toFixed(1)} ${y}q4.5 5.5 9 0`;
  }
  return `<path d="${d}" fill="none" stroke="${C.bellyLine}" stroke-width="1.8" opacity=".9"/>`;
}

/** @param {string} mood */
function wings(mood) {
  if (mood === "cheer") {
    return `<path d="M24 78c-14-6-20-22-14-34 8 6 14 18 18 30z" fill="${C.bodyDark}" stroke="${C.chalk}" stroke-width="2.2"/>
      <path d="M104 78c14-6 20-22 14-34-8 6-14 18-18 30z" fill="${C.bodyDark}" stroke="${C.chalk}" stroke-width="2.2"/>`;
  }
  return `<path d="M26 68C10 82 12 108 32 120c8-14 8-36 4-52z" fill="${C.bodyDark}" stroke="${C.chalk}" stroke-width="2.2"/>
    <path d="M102 68c16 14 14 40-6 52-8-14-8-36-4-52z" fill="${C.bodyDark}" stroke="${C.chalk}" stroke-width="2.2"/>
    <path d="M20 88c0 9 3 17 9 24M26 80c-1 11 2 22 8 32M108 88c0 9-3 17-9 24M102 80c1 11-2 22-8 32" fill="none" stroke="${C.chalk}" stroke-width="1.2" opacity=".45"/>`;
}

function cap() {
  return `<g>
      <path d="M50 28v8c0 3 6 6 14 6s14-3 14-6v-8l-14 6z" fill="${C.cap}" stroke="${C.chalk}" stroke-width="1.8"/>
      <path d="M40 24l24-10 24 10-24 10z" fill="${C.cap}" stroke="${C.chalk}" stroke-width="1.8"/>
      <path d="M88 24v14" stroke="${C.tassel}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="88" cy="40" r="3" fill="${C.tassel}"/>
    </g>`;
}

// Earnable accessories (see ACCESSORIES for how each is unlocked).
/** @param {string} acc */
function accessory(acc) {
  switch (acc) {
    case "goggles": return `<g><path d="M28 44q36-10 72 0" fill="none" stroke="#e0a54a" stroke-width="4"/>
      <circle cx="50" cy="40" r="9" fill="#bfe9f5" stroke="#0e231e" stroke-width="2.5"/><circle cx="78" cy="40" r="9" fill="#bfe9f5" stroke="#0e231e" stroke-width="2.5"/>
      <path d="M59 40h10" stroke="#0e231e" stroke-width="2.5"/></g>`;
    case "beret": return `<g><path d="M30 34q30-26 70-4q-4 10-36 10t-34-6z" fill="#c2413a"/><circle cx="66" cy="16" r="3" fill="#c2413a"/></g>`;
    case "glasses": return `<g fill="none" stroke="#0e231e" stroke-width="3"><circle cx="50" cy="58" r="13"/><circle cx="78" cy="58" r="13"/><path d="M63 57h2M37 55l-8-3M91 55l8-3"/></g>`;
    case "explorer": return `<g><path d="M20 36q44-14 88 0q-10 6-44 6t-44-6z" fill="#b8905a"/><path d="M40 34q2-20 24-22q22 2 24 22z" fill="#d9b178"/><path d="M40 30h48" stroke="#8a5a2b" stroke-width="4"/></g>`;
    case "pencil": return `<g transform="rotate(-35 100 30)"><rect x="88" y="26" width="34" height="7" rx="1.5" fill="#e0a54a"/><path d="M122 26l8 3.5-8 3.5z" fill="#f3d9b1"/><path d="M127 28.5l3 1-3 1z" fill="#0e231e"/><rect x="84" y="26" width="5" height="7" fill="#f2a58e"/></g>`;
    case "headphones": return `<g><path d="M26 62q0-46 38-46t38 46" fill="none" stroke="#e0a54a" stroke-width="5"/><rect x="18" y="56" width="12" height="20" rx="5" fill="#0e231e"/><rect x="98" y="56" width="12" height="20" rx="5" fill="#0e231e"/></g>`;
    default: return "";
  }
}

/** Unlock rules, shared by the dashboard closet. `groups` are guide/subject keys. */
export const ACCESSORIES = [
  { id: "cap", label: "Graduation cap", how: "Finish setup with Sage" },
  { id: "pencil", label: "Pencil", how: "Reach 80% in a math class", groups: ["geometry", "algebra1", "algebra2", "precalc", "calculus", "calc-ab", "calc-bc", "statistics", "ap-stats", "sat-math", "act-prep"] },
  { id: "goggles", label: "Lab goggles", how: "Reach 80% in a science class", groups: ["chemistry", "ap-chemistry", "biology", "apbiology", "ap-biology", "physics", "ap-physics", "earth-science", "environmental-science", "anatomy", "astronomy"] },
  { id: "explorer", label: "Explorer hat", how: "Reach 80% in a history class", groups: ["globalhistory", "global-history", "apush", "us-history", "world-history", "ap-world", "ap-euro", "us-government", "ap-usgov", "geography", "ap-human-geography", "art-history"] },
  { id: "glasses", label: "Reading glasses", how: "Reach 80% in an English class", groups: ["english-9", "english-10", "aplang", "ap-lang", "creative-writing", "journalism", "sat-reading", "speech-debate"] },
  { id: "beret", label: "Beret", how: "Reach 80% in a language class", groups: ["spanish-1", "spanish-2", "spanish-3", "french-1", "french-2", "french-3", "german-1"] },
  { id: "headphones", label: "Headphones", how: "Reach 80% in Music Theory", groups: ["music-theory"] },
];

/** The accessory the student chose in their dashboard closet (or none). */
export function wornAccessory() {
  try { return localStorage.getItem("sage-acc") || ""; } catch (e) { return ""; }
}

/**
 * @param {{ mood?: "idle"|"happy"|"cheer"|"think"|"sleepy", cap?: boolean, acc?: string, size?: number, label?: string }} [opts]
 * `acc` defaults to the accessory the student is wearing; pass "" for none.
 * @returns {string} an <svg> string
 */
export function owlSvg(opts = {}) {
  const mood = opts.mood || "idle";
  const size = opts.size || 120;
  const label = opts.label ?? "Sage the owl"; // "" marks a purely decorative owl
  const fid = "sage-chalk-" + (++uid);
  // Chalkboard look: brand-green fills, a cream chalk outline, chalk hatching
  // on the belly, all roughened slightly so edges read as drawn in chalk.
  return `<svg class="sage sage-${mood}" viewBox="0 0 128 140" width="${size}" height="${Math.round(size * 140 / 128)}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${fid}b" cx=".5" cy=".28" r=".85"><stop offset="0" stop-color="${C.bodyLight}"/><stop offset=".65" stop-color="${C.body}"/><stop offset="1" stop-color="${C.bodyDeep}"/></radialGradient>
    <linearGradient id="${fid}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bellyLight}"/><stop offset="1" stop-color="${C.belly}"/></linearGradient>
    <filter id="${fid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4"/></filter>
  </defs>
  <ellipse cx="64" cy="137" rx="30" ry="3" fill="#000" opacity=".2"/>
  <g ${size >= 64 ? `filter="url(#${fid})"` : ""} stroke-linecap="round" stroke-linejoin="round">
  <path d="M26 56C24 40 26 24 30 12c10 4 20 12 28 24z" fill="${C.bodyDark}" stroke="${C.chalk}" stroke-width="2.4"/><path d="M102 56c2-16 0-32-4-44-10 4-20 12-28 24z" fill="${C.bodyDark}" stroke="${C.chalk}" stroke-width="2.4"/>
  <path d="M31 40C30 31 31 23 33 18c5 3 10 8 14 14z" fill="${C.bodyLight}" opacity=".55"/><path d="M97 40c1-9 0-17-2-22-5 3-10 8-14 14z" fill="${C.bodyLight}" opacity=".55"/>
  <ellipse cx="64" cy="80" rx="42" ry="50" fill="url(#${fid}b)" stroke="${C.chalk}" stroke-width="2.6"/>
  <ellipse cx="64" cy="34" rx="22" ry="7" fill="#fff" opacity=".1"/>
  ${wings(mood)}
  <ellipse cx="64" cy="96" rx="27" ry="31" fill="url(#${fid}l)"/>
  ${bellyFeathers()}
  <circle cx="49" cy="58" r="14.5" fill="${C.face}" stroke="${C.bodyDark}" stroke-width="2"/><circle cx="79" cy="58" r="14.5" fill="${C.face}" stroke="${C.bodyDark}" stroke-width="2"/>
  <path d="M38 43q11-7 21-1M69 42q10-6 21 1" fill="none" stroke="${C.bodyDark}" stroke-width="2.8"/>
  ${eyes(mood)}
  <ellipse cx="38" cy="72" rx="5" ry="3" fill="${C.blush}" opacity=".55"/><ellipse cx="90" cy="72" rx="5" ry="3" fill="${C.blush}" opacity=".55"/>
  <path d="M57.5 67h13l-6.5 12z" fill="${C.beak}" stroke="#c98a30" stroke-width="1.2"/><path d="M61 69.2h6" stroke="#f6d38d" stroke-width="1.6"/>
  <path d="M50 128l-4.5 7M54 128v8M58 128l4.5 7M70 128l-4.5 7M74 128v8M78 128l4.5 7" stroke="${C.feet}" stroke-width="3.6"/>
  ${(() => { const a = opts.acc === undefined ? wornAccessory() : opts.acc; return opts.cap || a === "cap" ? cap() : accessory(a); })()}
  </g>
</svg>`;
}

/** CSS for the idle blink and a gentle bob; respects reduced motion. */
export const OWL_CSS = `
.sage{overflow:visible}
.sage-idle .sage-eyes{transform-box:fill-box;transform-origin:center;animation:sageBlink 4.5s infinite}
.sage-bob{animation:sageBob 3.2s ease-in-out infinite}
.sage-hop{animation:sageHop .5s cubic-bezier(.3,1.6,.5,1)}
@keyframes sageBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes sageBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes sageHop{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-10px) scale(1.04)}100%{transform:translateY(0) scale(1)}}
@media (prefers-reduced-motion: reduce){.sage-idle .sage-eyes,.sage-bob,.sage-hop{animation:none}}
`;
