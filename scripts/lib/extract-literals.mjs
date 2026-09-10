// Shared bracket-depth scanners for pulling `const NAME=[ ... ];` array
// literals out of a hand-authored guide page's inline <script>, including the
// `NAME.push.apply(NAME, OTHER)` merge pattern used throughout this codebase.
// Used by prerender-practice.mjs and extract-legacy-guide.mjs.

// Extracts the source text of `const NAME=[ ... ];` by counting bracket depth
// (skipping string contents) rather than assuming a shape, since these arrays
// contain nested objects/arrays and quoted braces/brackets. Also works for a
// `const NAME={ ... };` object literal.
export function extractArrayLiteral(source, varName) {
  const marker = `const ${varName}=`;
  const start = source.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length; // at the opening '[' or '{'
  if (source[i] !== "[" && source[i] !== "{") return null;
  let depth = 0;
  let inStr = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    // Skip comments — the hand-authored pages put `// ===== UNIT N =====`
    // section markers (some containing apostrophes) inside these literals.
    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      if (nl === -1) break;
      i = nl;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return source.slice(start, i);
}

// Returns the inner HTML of the first element whose opening tag contains
// `marker` (e.g. `id="view-qref"`), balance-matching nested <div>s to find its
// close. Used to lift hand-authored Quick Reference / Memory Tricks markup off
// the legacy pages into guides/<slug>.json verbatim.
export function extractElementInner(source, marker) {
  const t = source.indexOf(marker);
  if (t === -1) return null;
  const gt = source.indexOf(">", t);
  if (gt === -1) return null;
  let i = gt + 1;
  const start = i;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const nd = source.indexOf("<div", i);
    const cd = source.indexOf("</div>", i);
    if (cd === -1) return null;
    if (nd !== -1 && nd < cd) { depth++; i = nd + 4; }
    else { depth--; if (depth === 0) return source.slice(start, cd); i = cd + 6; }
  }
  return null;
}

// Reproduces the runtime value of a top-level array that may be mutated via
// `NAME.push.apply(NAME, OTHER_ARRAY)` elsewhere in the file. Finds every such
// merge call for NAME, in source order, and replays it.
export function extractMergedArray(source, varName) {
  const decl = extractArrayLiteral(source, varName);
  if (!decl) return null;
  let code = decl + ";";
  const mergeRe = new RegExp(`${varName}\\.push\\.apply\\(${varName},([A-Za-z0-9_]+)\\)`, "g");
  let m;
  while ((m = mergeRe.exec(source))) {
    const mergeVar = m[1];
    const mergeDecl = extractArrayLiteral(source, mergeVar);
    if (!mergeDecl) throw new Error(`${varName}.push.apply references ${mergeVar}, but no "const ${mergeVar}=[" declaration was found`);
    code += mergeDecl + `;${varName}.push.apply(${varName},${mergeVar});`;
  }
  const fn = new Function(code + `\nreturn ${varName};`);
  return fn();
}
