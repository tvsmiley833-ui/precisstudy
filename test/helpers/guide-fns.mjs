// Loads named top-level functions/constants straight out of public/shared/guide-app.js so
// tests exercise the code that actually ships. guide-app.js is a classic browser script
// (not a module), so each requested binding is cut out by name and evaluated with stubbed
// browser globals instead of importing the file.
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../public/shared/guide-app.js", import.meta.url), "utf8");
const LINES = SRC.split("\n");

/** Source text of one column-0 `function name(` or `const|let|var name` declaration. */
export function extract(name) {
  const re = new RegExp(`^(async )?function ${name}\\(|^(const|let|var) ${name}\\b`);
  const start = LINES.findIndex(l => re.test(l));
  if (start < 0) throw new Error(`guide-app.js: no top-level "${name}"`);
  const isFn = /^(async )?function /.test(LINES[start]);
  for (let i = start; i < LINES.length; i++) {
    // Functions here end at a lone "}" in column 0; consts/lets end at the first line ending in ";".
    if (isFn ? LINES[i] === "}" : /;\s*(\/\/.*)?$/.test(LINES[i])) return LINES.slice(start, i + 1).join("\n");
  }
  throw new Error(`guide-app.js: could not find the end of "${name}"`);
}

/**
 * @param {string[]} names bindings to extract (their dependencies must be listed too)
 * @param {{ globals?: Record<string, unknown>, extra?: string, returns?: string[] }} [opts]
 *   globals: stubs for browser globals the code touches; extra: helper code appended
 *   after the extracted source (e.g. setters for module-level `let` state); returns:
 *   extra names to return alongside `names`.
 */
export function loadGuide(names, opts = {}) {
  const { globals = {}, extra = "", returns = [] } = opts;
  const keys = Object.keys(globals);
  const all = [...new Set([...names, ...returns])];
  const body = names.map(extract).join("\n") + "\n" + extra + `\nreturn { ${all.join(", ")} };`;
  // eslint-disable-next-line no-new-func
  return new Function(...keys, "TextEncoder", body)(...keys.map(k => globals[k]), TextEncoder);
}
