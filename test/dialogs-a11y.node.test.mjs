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
  assert.ok(!/OmniRoute|OMNIROUTE|cbot-settings|cbot-key/.test(js), "the local-dev API-key form must not ship");
  assert.ok(!/activation energy|limiting reagent/.test(js), "examples come from this guide's own flashcards");
  assert.match(js, /function cbotExamples\(\)/);
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

test("quiz clock starts when the first question shows, and Quick 10 is rebuilt when the quiz tab first opens", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /qSessionStart=null;showQ\(\);/);
  assert.match(js, /qSessionStart===null\)qSessionStart=Date\.now\(\)/);
  assert.match(js, /id==='quiz'&&!ssQuickRebuilt/);
});

test("high contrast follows prefers-contrast when nothing is saved and syncs across tabs", () => {
  const js = read("../public/shared/high-contrast.js");
  assert.match(js, /stored === null && !!\(window\.matchMedia && matchMedia\('\(prefers-contrast: more\)'\)/);
  assert.match(js, /addEventListener\('storage'/);
});

test("owl: decorative owls are hidden from screen readers, locked closet items are aria-disabled with visible hints", () => {
  assert.match(read("../public/shared/owl.js"), /opts\.label \?\? "Sage the owl"/);
  const d = read("../public/shared/sage-dashboard.js");
  assert.match(d, /aria-disabled="true"/);
  assert.match(d, /sage-acc-how/);
  assert.match(d, /again\.focus\(\)/);
});

test("homepage animations and the streak message respect reduced motion correctly", () => {
  assert.match(read("../public/index.html"), /prefers-reduced-motion:reduce\)\{\.ss-hero-anim\{opacity:1;animation:none\}/);
  const c = read("../public/shared/celebrate.js");
  assert.ok(c.indexOf("sageClap(msg)") > c.indexOf("launchConfetti(x, y)") && /if \(!prefersReducedMotion\(\)\) \{\s*const rect/.test(c));
});

test("quiz copy matches reality: no sign-in gate, picker always shown, worksheet limited to the chosen unit", () => {
  const html = read("../public/spanish-1/index.html");
  assert.ok(!html.includes('id="quiz-gate"'));
  assert.ok(!/free diagnostic/.test(html));
  assert.match(html, /Everything here is open without an account/);
  const js = read("../client/guide-app.js");
  assert.match(js, /if\(sel\) sel\.style\.display = ''/);
  assert.match(js, /if\(only&&q\.u!==only\)return;/);
});

test("tooltips stay open when hovered, close if their trigger disappears, don't double-announce or strip validation titles", () => {
  const js = read("../public/shared/tooltips.js");
  assert.match(js, /pointer-events:auto/);
  assert.match(js, /tipEl\.contains\(e\.relatedTarget\)/);
  assert.match(js, /isConnected\) hide\(\)/);
  assert.match(js, /sameAsName/);
  assert.match(js, /hasAttribute\("pattern"\)/);
});

test("signed-out students: dashboard shows saved local progress with a sync strip; settings open Appearance", () => {
  const dash = read("../public/dashboard/index.html");
  assert.match(dash, /function ssHasLocalProgress\(\)/);
  assert.match(dash, /anon && !ssHasLocalProgress\(\)/);
  assert.match(dash, /if \(anon\) throw new Error\('local only'\)/);
  assert.match(dash, /Sign in to sync it across devices/);
  const set = read("../public/settings/index.html");
  assert.match(set, /Appearance \(theme, contrast, sound\) is stored on this device/);
  assert.match(set, /getAttribute\('data-tab'\) === 'appearance'/);
});

test("the graphing calculator is only offered on math and science guides; --accent-bright always resolves", () => {
  assert.match(read("../public/algebra2/index.html"), /"calc":true/);
  assert.ok(!/"calc":true/.test(read("../public/spanish-1/index.html")));
  assert.match(read("../client/guide-app.js"), /DESMOS_API_KEY&&SS_GUIDE\.calc/);
  assert.match(read("../public/shared/guide-polish.css"), /:root\{--accent-bright:var\(--accent\)\}/);
});

test("tab titles come from SS_GUIDE.title in the Worker's form, never parsed from the live title", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /var SUBJECT_NAME=SS_GUIDE\.title;/);
  assert.match(js, /SUBJECT_NAME\+' '\+TAB_TITLES\[id\]\+' \\u2014 PrecisStudy'/);
  assert.ok(!/BASE_TITLE\.replace/.test(js));
  assert.ok(!/document\.title\.replace\(/.test(js));
});

test("no native alert/prompt/confirm in the guide client; deletes need a second click and check the response", () => {
  const js = read("../client/guide-app.js");
  assert.ok(!/[^a-zA-Z.]((alert|prompt|confirm)\()/.test(js.replace(/\/\/[^\n]*/g, "")));
  assert.match(js, /function ssShareLink\(/);
  for (const f of ["../public/admin/index.html", "../public/flashcards/index.html"]) assert.match(read(f), /function ssConfirmTwice\(/);
  assert.match(read("../public/admin/index.html"), /if\(!r1\.ok\) throw/);
  assert.match(read("../public/flashcards/index.html"), /failed = !res\.ok/);
});
