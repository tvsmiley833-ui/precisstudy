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
  assert.match(js, /id="cbot-input" type="text" enterkeyhint="send" aria-label=/);
  assert.match(js, /id="cbot-settings-btn" type="button"[^>]*aria-label=/);
  assert.match(js, /function cbotKeydown\(e\)\{if\(e\.key==='Escape'\)/);
  assert.match(js, /cbotReturnFocus\.focus\(\)/);
});

test("request page file input is reachable by keyboard and remove buttons name their file", () => {
  const html = read("../public/request/index.html");
  assert.ok(!/input\[type="file"\]\{display:none\}/.test(html));
  assert.match(html, /input\[type="file"\]:focus-visible/);
  assert.match(html, /aria-label="Remove ' \+ ssEscapeHtml\(f\.name\)/);
});

test("feedback dialog: labelled fields, pressed state, focus restore, safe error parsing", () => {
  const js = read("../public/shared/feedback-widget.js");
  assert.match(js, /id="fbw-message" aria-label=/);
  assert.match(js, /id="fbw-email" type="email" aria-label=/);
  assert.match(js, /aria-pressed/);
  assert.match(js, /opener\.focus\(\)/);
  assert.match(js, /clearTimeout\(closeTimer\)/);
  assert.match(js, /res\.json\(\)\.catch\(/);
});

test("guide pages cover the notch and keep fixed controls clear of the home indicator", () => {
  assert.match(read("../public/spanish-1/index.html"), /viewport-fit=cover/);
  const css = read("../public/shared/guide-polish.css");
  assert.match(css, /\.toolkit-fab\{bottom:calc\(90px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /padding-left:env\(safe-area-inset-left\)/);
});

test("search and answer inputs ask phones for the right Enter key", () => {
  assert.match(read("../public/spanish-1/index.html"), /id="search-box" type="search" enterkeyhint="search"/);
  assert.match(read("../public/spanish-1/index.html"), /id="fc-type-input" type="text" enterkeyhint="done"/);
  assert.match(read("../public/index.html"), /id="class-search" type="text" enterkeyhint="search"/);
});
