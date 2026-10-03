import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("command palette is a combobox over a listbox, keeps focus inside and restores it", () => {
  const js = read("../public/shared/command-palette.js");
  assert.match(js, /id="cp-input" type="text" role="combobox"/);
  assert.match(js, /id="cp-list" role="listbox"/);
  assert.match(js, /role="option" aria-selected=/);
  assert.match(js, /aria-activedescendant/);
  assert.match(js, /e\.key === 'Tab'/);
  assert.match(js, /opener\.focus\(\)/);
});

test("study helper is a labelled dialog with a live log, a labelled input, Esc and focus return", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /setAttribute\('role','dialog'\);panel\.setAttribute\('aria-label','Study helper'\)/);
  assert.match(js, /id="cbot-msgs" role="log"/);
  assert.match(js, /id="cbot-input" type="text" aria-label=/);
  assert.match(js, /id="cbot-settings-btn" type="button"[^>]*aria-label=/);
  assert.match(js, /function cbotKeydown\(e\)\{if\(e\.key==='Escape'\)/);
  assert.match(js, /cbotReturnFocus\.focus\(\)/);
});
