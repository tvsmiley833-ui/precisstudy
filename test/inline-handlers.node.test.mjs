// Guards against buttons and forms wired to functions that don't exist. A syntax check can't catch
// this (onclick="ssSaveExam(event)" parses fine even if ssSaveExam was deleted), and the failure only
// shows up when a student clicks: the page silently does nothing, or a form submits natively.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const pub = new URL("../public/", import.meta.url);
const read = rel => readFileSync(new URL(rel, pub), "utf8");
const shared = readdirSync(new URL("shared/", pub)).filter(f => f.endsWith(".js")).map(f => read("shared/" + f)).join("\n");

// Names a handler may call without us defining them: the event, the element, and browser built-ins.
const BUILTINS = new Set(["event", "this", "window", "document", "location", "history", "navigator", "localStorage", "sessionStorage", "console",
  "alert", "confirm", "prompt", "Math", "JSON", "Date", "Number", "String", "Array", "Object", "parseInt", "parseFloat", "setTimeout", "setInterval",
  "if", "return", "function", "typeof", "new", "stopPropagation", "preventDefault", "scrollTo", "focus", "click", "close", "submit", "reset", "open",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI", "isNaN", "Boolean", "RegExp", "Set", "Map", "Promise", "fetch", "requestAnimationFrame",
  "toggle", "add", "remove", "select", "blur", "print", "back", "forward", "reload", "getElementById", "querySelector", "classList", "closest"]);

function definedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for (const m of source.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of source.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of source.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/gm)) names.add(m[1]);
  return names;
}

// Every page that has an index.html under public/.
const pages = readdirSync(pub, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(new URL(`${d.name}/index.html`, pub)))
  .map(d => `${d.name}/index.html`)
  .concat(["index.html"]);

for (const page of pages) {
  test(`${page}: every inline handler calls a function that exists`, () => {
    const html = read(page);
    const defined = definedNames(html + "\n" + shared);
    const missing = new Set();
    // on<event>="..." attributes (double or single quoted)
    for (const attr of html.matchAll(/\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const code = attr[1] ?? attr[2];
      for (const call of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        const name = call[1];
        if (!BUILTINS.has(name) && !defined.has(name)) missing.add(name);
      }
    }
    assert.equal(missing.size, 0, `${page} wires handlers to undefined functions: ${[...missing].join(", ")}`);
  });
}
