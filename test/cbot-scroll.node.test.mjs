// The AI Study Helper's message list must be a scroll container. In October an orphaned pair of declarations in the guide
// stylesheet swallowed the #cbot-msgs rule, so long explanations could not be scrolled.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Selector text (what sits before each "{") must never contain a ";" -- that is a declaration that lost its selector.
function swallowedSelectors(css) {
  const bad = [];
  let depth = 0, head = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") { if (depth === 0 && head.includes(";")) bad.push(head.trim().slice(0, 60)); depth++; head = ""; }
    else if (ch === "}") { depth--; head = ""; }
    else if (depth === 0) head += ch;
  }
  return bad;
}

test("guide-base.css gives #cbot-msgs overflow-y:auto and swallows no selectors", () => {
  const css = readFileSync(new URL("../public/shared/guide-base.css", import.meta.url), "utf8");
  assert.match(css, /^#cbot-msgs\{[^}]*overflow-y:auto/m);
  assert.deepEqual(swallowedSelectors(css), []);
});
