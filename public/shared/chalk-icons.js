// @ts-check
// Hand-drawn chalk icon library (original drawings, 64×64 viewBox, strokes
// only). Rendered with currentColor + a roughness filter so they read as
// chalk. Used by the homepage chalkboard and each guide's header strip.

/** @type {Record<string, string>} */
export const CHALK_ICONS = {
  bulb: "M32 8c-11 0-19 8-19 18 0 7 4 11 7 15 2 3 3 5 3 8h18c0-3 1-5 3-8 3-4 7-8 7-15 0-10-8-18-19-18zM24 53h16M25 58h14M27 31c2-4 8-4 10 0M29 49V36M35 49V36M6 20l4 2M58 20l-4 2M32 1v3M14 5l3 4M50 5l-3 4",
  magnifier: "M26 6a18 18 0 1 0 0.1 0zM39 39l17 17M44 44l-4 4M52 52l-4 4M18 16c3-3 7-4 10-3",
  scissors: "M14 44a8 8 0 1 0 0.1 0zM26 54a8 8 0 1 0 0.1 0zM20 44L58 8M30 50L60 22M34 34l-6-8",
  flask: "M24 6h16M27 6v16L12 52c-2 5 1 8 6 8h28c5 0 8-3 6-8L37 22V6M18 44h28M22 50l4-4M30 52l6-6M38 50l4-4",
  atom: "M32 32m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 32c0-6 12-11 28-11s28 5 28 11-12 11-28 11S4 38 4 32zM18 8c5-3 16 6 24 20s10 27 4 30-16-6-24-20S13 11 18 8zM46 8c5 3 2 17-6 30s-19 23-24 20-2-17 6-30 19-23 24-20z",
  globe: "M30 30m-20 0a20 20 0 1 0 40 0a20 20 0 1 0-40 0M10 30h40M30 10c7 6 7 34 0 40M30 10c-7 6-7 34 0 40M14 18h32M14 42h32M52 16c6 10 5 24-4 32M30 52v6M20 60h20",
  book: "M4 14c10-4 20-4 28 2v40c-8-6-18-6-28-2zM60 14c-10-4-20-4-28 2v40c8-6 18-6 28-2zM10 24h14M10 30h16M10 36h12M40 24h14M38 30h16M40 36h12",
  pencil: "M14 50L46 18l8 8-32 32-11 3zM42 22l8 8M14 50l8 8M11 61l3-11M46 18l4-4c2-2 5-2 7 0l1 1c2 2 2 5 0 7l-4 4",
  apple: "M32 18c-6-4-18-4-22 8-3 10 2 24 10 30 4 3 8 2 12 0 4 2 8 3 12 0 8-6 13-20 10-30-4-12-16-12-22-8zM32 18c0-6 2-10 6-12M34 12c4-4 10-4 12-2-2 4-8 6-12 2M18 30c1-4 3-6 6-7",
  plane: "M4 30L60 8 44 56 30 38zM60 8L30 38M30 38l-4 16 10-10M12 32l16 4",
  ruler: "M4 24h56v14H4zM10 24v6M16 24v4M22 24v6M28 24v4M34 24v6M40 24v4M46 24v6M52 24v4",
  eraser: "M12 40L36 16l18 18-24 24H18zM24 28l18 18M18 58h36",
  triangle: "M8 54h48L8 10zM8 46h8v8M20 56l2-4M40 34l4 2",
  sine: "M4 32h56M8 32c4-18 12-18 16 0s12 18 16 0 12-18 16 0M32 6v52",
  integral: "M40 8c-6-4-12 0-12 8v32c0 8-6 12-12 8M20 24h20M44 38h8",
  bars: "M8 56h50M12 56V36h8v20M26 56V24h8v32M40 56V14h8v42M10 32l12-10 14 4 16-16",
  dna: "M20 4c0 14 24 18 24 28S20 46 20 60M44 4c0 14-24 18-24 28s24 14 24 28M24 14h16M22 22h20M24 42h16M22 50h20",
  heart: "M32 56C14 44 6 32 8 22 10 12 22 8 32 18 42 8 54 12 56 22c2 10-6 22-24 34zM20 20c-4 1-6 4-6 8",
  rocket: "M32 4c10 8 12 22 8 36H24c-4-14-2-28 8-36zM32 20m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M24 40l-8 10 10-2M40 40l8 10-10-2M28 48l4 10 4-10",
  planet: "M32 32m-14 0a14 14 0 1 0 28 0a14 14 0 1 0-28 0M4 40c8 4 44-12 56-24M52 10l2 2M10 14l1 1M50 50l2 2",
  code: "M22 18L8 32l14 14M42 18l14 14-14 14M36 12L28 52",
  column: "M8 20L32 6l24 14zM12 24v28M22 24v28M32 24v28M42 24v28M52 24v28M6 54h52M6 60h52",
  scroll: "M12 10h36c4 0 6 3 6 6v38c0 4-3 6-6 6H18M12 10c-4 0-6 3-6 6s2 6 6 6h6M18 16v44c-4 0-6-3-6-6M26 22h20M26 30h20M26 38h14",
  quill: "M54 6C38 10 22 26 16 48l4 4C42 46 52 26 54 6zM16 48l-8 12M24 36l10 4M30 24l10 4",
  speech: "M8 12h48v30H28l-12 12V42H8zM16 22h32M16 30h22",
  note: "M22 48V12l28-6v36M22 48a7 5 0 1 1-0.1 0M50 42a7 5 0 1 1-0.1 0M22 22l28-6",
  coin: "M32 32m-22 0a22 22 0 1 0 44 0a22 22 0 1 0-44 0M38 22c-2-3-10-3-12 1s4 6 7 7 8 4 5 9-11 4-13 0M32 14v6M32 44v6",
  brain: "M30 10c-8-4-18 2-18 10-6 2-8 10-4 16-2 8 4 14 12 14 2 6 10 6 12 0V10zM34 10c8-4 18 2 18 10 6 2 8 10 4 16 2 8-4 14-12 14-2 6-10 6-12 0M20 24c4 0 6 2 6 6M44 24c-4 0-6 2-6 6",
  palette: "M32 6C16 6 4 18 4 32s10 26 24 26c6 0 8-4 6-8s0-8 6-8h8c8 0 12-6 12-12C60 16 48 6 32 6zM18 28m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M26 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M40 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M48 28m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  mountain: "M4 54L24 18l12 20 8-12 16 28zM20 26l4 4 4-6M4 58h56",
  leaf: "M10 54C10 26 30 8 56 8c0 26-18 46-46 46zM10 54L40 24M24 40h10M32 32V22",
  flag: "M12 60V6M12 8h36l-8 10 8 10H12",
  clock: "M32 34m-24 0a24 24 0 1 0 48 0a24 24 0 1 0-48 0M32 18v16l10 8M24 4h16",
  check: "M8 12h48v40H8zM16 32l8 8 16-16",
};

/**
 * One icon as an SVG <g>, positioned in the parent's coordinate space.
 * @param {string} name @param {number} x @param {number} y @param {number} [size] @param {number} [rot]
 */
export function chalkIcon(name, x, y, size = 64, rot = 0) {
  const d = CHALK_ICONS[name];
  if (!d) return "";
  const s = size / 64;
  return `<g class="chalk-ic" transform="translate(${x} ${y}) rotate(${rot} ${size / 2} ${size / 2}) scale(${s})"><path d="${d}" vector-effect="non-scaling-stroke"/></g>`;
}
