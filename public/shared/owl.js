// @ts-check
// Sage, PrecisStudy's owl mascot. Pure SVG built from the site palette so it
// themes with the brand (deep green body, mint belly, cream eyes, amber beak)
// and needs no image request. Moods: "idle" (open eyes, blinks), "happy"
// (smiling closed eyes), "cheer" (wings up), "think" (eyes glance up).
// `cap: true` adds the graduation cap earned at the end of setup.

const C = {
  body: "#2f8f5c",
  bodyDark: "#1f6e46",
  belly: "#9fdcb8",
  bellyLine: "#4fbf85",
  face: "#eef2ea",
  eye: "#0e231e",
  beak: "#e0a54a",
  feet: "#e0a54a",
  blush: "#f2a58e",
  cap: "#0e231e",
  tassel: "#e0a54a",
};

/** @param {string} mood */
function eyes(mood) {
  if (mood === "happy" || mood === "cheer") {
    return `<path d="M42 58q8-9 16 0" fill="none" stroke="${C.eye}" stroke-width="4" stroke-linecap="round"/>
      <path d="M70 58q8-9 16 0" fill="none" stroke="${C.eye}" stroke-width="4" stroke-linecap="round"/>`;
  }
  const dy = mood === "think" ? -4 : 0;
  const dx = mood === "think" ? 3 : 0;
  return `<g class="sage-eyes">
      <circle cx="${50 + dx}" cy="${58 + dy}" r="7" fill="${C.eye}"/><circle cx="${52.5 + dx}" cy="${55.5 + dy}" r="2.2" fill="#fff"/>
      <circle cx="${78 + dx}" cy="${58 + dy}" r="7" fill="${C.eye}"/><circle cx="${80.5 + dx}" cy="${55.5 + dy}" r="2.2" fill="#fff"/>
    </g>`;
}

/** @param {string} mood */
function wings(mood) {
  if (mood === "cheer") {
    return `<path d="M24 78c-14-6-20-22-14-34 8 6 14 18 18 30z" fill="${C.bodyDark}"/>
      <path d="M104 78c14-6 20-22 14-34-8 6-14 18-18 30z" fill="${C.bodyDark}"/>`;
  }
  return `<path d="M22 70c-6 14-4 30 6 40 4-12 6-26 4-40z" fill="${C.bodyDark}"/>
    <path d="M106 70c6 14 4 30-6 40-4-12-6-26-4-40z" fill="${C.bodyDark}"/>`;
}

function cap() {
  return `<g>
      <path d="M40 24l24-10 24 10-24 10z" fill="${C.cap}"/>
      <path d="M50 28v8c0 3 6 6 14 6s14-3 14-6v-8l-14 6z" fill="${C.cap}"/>
      <path d="M88 24v14" stroke="${C.tassel}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="88" cy="40" r="3" fill="${C.tassel}"/>
    </g>`;
}

/**
 * @param {{ mood?: "idle"|"happy"|"cheer"|"think", cap?: boolean, size?: number, label?: string }} [opts]
 * @returns {string} an <svg> string
 */
export function owlSvg(opts = {}) {
  const mood = opts.mood || "idle";
  const size = opts.size || 120;
  const label = opts.label || "Sage the owl";
  return `<svg class="sage sage-${mood}" viewBox="0 0 128 140" width="${size}" height="${Math.round(size * 140 / 128)}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
  ${wings(mood)}
  <path d="M30 18l16 20-18 4z" fill="${C.body}"/><path d="M98 18l-16 20 18 4z" fill="${C.body}"/>
  <ellipse cx="64" cy="80" rx="42" ry="50" fill="${C.body}"/>
  <ellipse cx="64" cy="96" rx="27" ry="31" fill="${C.belly}"/>
  <path d="M52 92q4 4 8 0M68 92q4 4 8 0M58 104q4 4 8 0M60 116q4 4 8 0" fill="none" stroke="${C.bellyLine}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="50" cy="58" r="16" fill="${C.face}" stroke="${C.bodyDark}" stroke-width="2"/><circle cx="78" cy="58" r="16" fill="${C.face}" stroke="${C.bodyDark}" stroke-width="2"/>
  ${eyes(mood)}
  <ellipse cx="38" cy="72" rx="5" ry="3" fill="${C.blush}" opacity=".55"/><ellipse cx="90" cy="72" rx="5" ry="3" fill="${C.blush}" opacity=".55"/>
  <path d="M59 68h10l-5 9z" fill="${C.beak}" stroke="#c98a30" stroke-width="1" stroke-linejoin="round"/>
  <path d="M50 128l-4 7M54 128v8M58 128l4 7M70 128l-4 7M74 128v8M78 128l4 7" stroke="${C.feet}" stroke-width="3" stroke-linecap="round"/>
  ${opts.cap ? cap() : ""}
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
