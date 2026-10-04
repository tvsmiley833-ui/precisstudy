import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8") + (p.endsWith("dashboard/index.html") ? readFileSync(new URL("../public/shared/dashboard-app.js", import.meta.url), "utf8") : p.endsWith("settings/index.html") ? readFileSync(new URL("../public/shared/settings-app.js", import.meta.url), "utf8") : "");

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

test("MathJax is pinned and only sent to guides that contain $...$ math", () => {
  assert.match(read("../public/algebra2/index.html"), /mathjax@3\.2\.2\/es5\/tex-mml-chtml\.js/);
  for (const g of ["spanish-1", "ap-biology", "us-history"]) assert.ok(!/mathjax/i.test(read(`../public/${g}/index.html`)), g);
});

test("floating panels drag with pointer events on the handle, with no document-level touchmove listener", () => {
  const js = read("../client/guide-app.js");
  assert.ok(!/addEventListener\('touchmove'/.test(js));
  assert.match(js, /handle\.addEventListener\('pointerdown',down\)/);
  assert.match(js, /setPointerCapture/);
});

test("internal links to site sections carry the trailing slash, so they skip the slash redirect", async () => {
  const { existsSync } = await import("node:fs");
  for (const f of ["../public/index.html", "../public/dashboard/index.html", "../public/settings/index.html"]) {
    const bad = [...read(f).matchAll(/href="\/([a-z0-9-]+)"/g)].map(m => m[1]).filter(d => existsSync(new URL(`../public/${d}/index.html`, import.meta.url)));
    assert.deepEqual(bad, [], f);
  }
});

test("the dashboard activity heatmap has a text alternative", () => {
  const d = read("../public/dashboard/index.html");
  assert.match(d, /role="img" aria-label="' \+ ssEscapeHtml\('Activity grid\. '/);
  assert.match(d, /Busiest day: /);
});

test("secondary-page header styles are a static stylesheet, not injected by script", () => {
  const css = read("../public/shared/site-header.css");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(css, /@media\(min-width:961px\)\{#ss-mobile-menu\{display:none!important\}\s*\}/);
  assert.ok(!/createElement\("style"\)/.test(read("../public/shared/site-header.js")));
  assert.match(read("../public/about/index.html"), /href="\/shared\/site-header\.css"/);
});

test("dashboard skeletons are sized to the student's classes, not one per guide", () => {
  const d = read("../public/dashboard/index.html");
  assert.match(d, /Math\.min\(6, Math\.max\(2, ssLocalProgressCount\(\)\)\)/);
  assert.ok(!/SUBJECTS_CONFIG\.map\(function\(\)\{\s*return '<div class="ss-card" aria-hidden/.test(d));
});

test("worked examples keep revealed steps across a rebuild and need a step before Got it", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /const kept=Object\.assign\(\{\},ex2shown\);ex2shown=\{\};/);
  assert.match(js, /Reveal at least one step, then mark Got it\./);
});

test("free-response parts ask for an answer first, keep the draft, and offer a self-score", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /class="ex-fr-answer"/);
  assert.match(js, /\.trim\(\)\.length>=20\?'':'disabled'/);
  assert.match(js, /function ssFrScore\(/);
  assert.match(js, /sessionStorage\.setItem\(ssFrKey/);
});

test("concept map draws from local progress for signed-out students", () => {
  const c = read("../public/concepts/index.html");
  assert.match(c, /Showing progress saved on this device/);
  assert.match(c, /ssMastery_/);
});

test("study timer survives a reload and mirrors the clock in the tab title while hidden", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /var SKEY='ss-timer-state'/);
  assert.match(js, /sessionStorage\.setItem\(SKEY/);
  assert.match(js, /function mirrorTitle\(\)/);
  assert.match(js, /document\.addEventListener\('visibilitychange',mirrorTitle\)/);
});

test("touch screens get 44px targets on the small guide controls", () => {
  assert.match(read("../public/shared/guide-polish.css"), /@media \(pointer: coarse\) \{\s*\.chip, \.btn, \.sgt-b/);
});

test("bookmarked questions can be practised from the quiz picker", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /function ssBookmarkedQuestions\(\)/);
  assert.match(js, /raw==='bookmarks'\)src=ssBookmarkedQuestions\(\)/);
  assert.match(js, /ssRefreshBookmarkOption\(\)/);
});

test("phone quiz tab tucks rarely used controls behind More options", () => {
  const html = read("../public/spanish-1/index.html");
  assert.match(html, /id="q-more-btn" aria-expanded="false" aria-controls="q-bar"/);
  assert.match(read("../public/shared/guide-polish.css"), /\.q-bar:not\(\.q-more-open\) \.diff-chips/);
});

test("guide pages link one shared base stylesheet instead of inlining it", () => {
  const html = read("../public/spanish-1/index.html");
  assert.match(html, /<link rel="stylesheet" href="\/shared\/guide-base\.css"\/>/);
  assert.ok(html.length < 230000, "page should no longer carry the 54 KB base stylesheet");
  assert.ok(read("../public/shared/guide-base.css").includes(".unit-hd{display:flex"));
});

test("install hint: second day only, never when installed or dismissed, iOS instructions and Android install button", () => {
  const js = read("../public/shared/install-hint.js");
  assert.match(js, /days\.length < 2\) return/);
  assert.match(js, /display-mode: standalone/);
  assert.match(js, /ss-install-hint-dismissed/);
  assert.match(js, /Add to Home Screen/);
  assert.match(js, /beforeinstallprompt/);
  assert.match(read("../src/worker.ts"), /install-hint\.js/);
});

test("accessibility themes apply before first paint: static stylesheet plus a head bootstrap from the Worker", () => {
  const src = read("../src/worker.ts");
  assert.ok(src.includes('href="/shared/high-contrast.css"'));
  assert.ok(src.includes("prefers-contrast: more") && src.includes("ss-amoled"));
  assert.ok(!/createElement\('style'\)/.test(read("../public/shared/high-contrast.js")));
  assert.match(read("../public/shared/high-contrast.css"), /\[data-amoled="on"\]/);
});

test("guide pages: every <script> opens and closes once, so no content can end a script early", async () => {
  const { readdirSync } = await import("node:fs");
  const guides = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
  for (const g of guides) {
    const html = read(`../public/${g}/index.html`);
    assert.equal((html.match(/<script\b/g) || []).length, (html.match(/<\/script>/g) || []).length, g);
    assert.ok(!/<!--\s*<script/i.test(html), g);
  }
});

test("source and test files contain no raw control bytes (git would treat them as binary)", async () => {
  const { readdirSync } = await import("node:fs");
  for (const dir of ["../src/", "../test/"]) {
    for (const f of readdirSync(new URL(dir, import.meta.url)).filter(n => /\.(ts|js|mjs)$/.test(n))) {
      const bytes = readFileSync(new URL(dir + f, import.meta.url));
      assert.ok(!bytes.some(b => b < 9 || (b > 13 && b < 32)), `${dir}${f} has a raw control byte`);
    }
  }
});

test("signing out clears this site's saved progress and caches on every page that offers it", () => {
  assert.match(read("../public/shared/local-data.js"), /ssMastery_/);
  for (const f of ["../public/index.html", "../public/dashboard/index.html", "../public/about/index.html"]) assert.match(read(f), /ssClearLocalData\(\)/);
  assert.match(read("../src/worker.ts"), /local-data\.js/);
});

test("flashcard and syllabus uploads check size and legacy .doc before sending, and let iPhones pick photos", () => {
  for (const f of ["../public/flashcards/index.html", "../public/syllabus/index.html"]) {
    const h = read(f);
    assert.match(h, /function ssUploadProblem\(file\)/);
    assert.match(h, /accept="image\/\*,\.pdf,\.docx,\.txt"/);
    assert.ok(!/accept="[^"]*\.doc,/.test(h));
  }
});

test("a new device doesn't bounce an already-onboarded student back into the wizard", () => {
  assert.match(read("../public/index.html"), /if \(blob\.goal \|\| \(blob\.quest && blob\.quest\.setupClaimed\)\) alreadyOnboarded = true;/);
});

test("a syllabus-learned unit order is applied to the page when the student hasn't dragged their own", () => {
  assert.match(read("../client/guide-app.js"), /localStorage\.getItem\('ssUnitOrder_'\+SS_GUIDE\.key\)/);
});

test("onboarding reminders actually ask for notification permission and subscribe, and fall back to off if refused", () => {
  const h = read("../public/onboarding/index.html");
  assert.match(h, /async function obEnablePush\(\)/);
  assert.match(h, /Notification\.requestPermission\(\)/);
  assert.match(h, /\/api\/push\/subscribe/);
  assert.match(h, /reminders are off/);
});

test("marketing pages quote real totals (subject count and question count)", async () => {
  const { readdirSync } = await import("node:fs");
  const guides = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json"));
  let questions = 0;
  for (const g of guides) { const j = JSON.parse(read(`../guides/${g}`)); questions += (j.quiz || []).length + (j.hardQuiz || []).length; }
  assert.match(read("../public/educators/index.html"), new RegExp(`any of ${guides.length} subjects`));
  const m = read("../public/about/index.html").match(/over ([\d,]+) questions across (\d+) subjects/);
  assert.ok(m, "About should quote totals");
  assert.equal(Number(m[2]), guides.length);
  assert.ok(Number(m[1].replace(/,/g, "")) <= questions && Number(m[1].replace(/,/g, "")) > questions * 0.9, "About's question count should be a true round-down");
});

test("first-time sign-ins keep their destination through onboarding", () => {
  const a = read("../src/auth-routes.ts");
  assert.equal((a.match(/"\/onboarding" \+ \(next \? "\?next=" \+ encodeURIComponent\(next\) : ""\)/g) || []).length, 3);
  const o = read("../public/onboarding/index.html");
  assert.match(o, /Continue where you were/);
  assert.match(o, /S\.enrolled\[0\]/);
});

test("every guide links a few related guides, never itself", async () => {
  const { readdirSync, existsSync } = await import("node:fs");
  const guides = readdirSync(new URL("../guides/", import.meta.url)).filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
  for (const g of guides) {
    const html = read(`../public/${g}/index.html`);
    const links = [...(html.match(/<nav class="related-guides".*?<\/nav>/s)?.[0] || "").matchAll(/href="\/([a-z0-9-]+)\/"/g)].map(m => m[1]);
    assert.ok(links.length >= 2, `${g} should link related guides`);
    assert.ok(!links.includes(g), `${g} links itself`);
    for (const l of links) assert.ok(existsSync(new URL(`../public/${l}/index.html`, import.meta.url)), `${g} -> ${l} missing`);
  }
});

test("command palette ignores key-less/IME events and matches slugs; error monitor drops opaque 'Script error.'", () => {
  const p = read("../public/shared/command-palette.js");
  assert.match(p, /typeof e\.key !== 'string' \|\| e\.isComposing/);
  assert.match(p, /String\(d\.h\)\.toLowerCase\(\)\.indexOf\(q\)/);
  assert.match(read("../public/shared/error-monitor.js"), /script error/i);
});

test("syllabus class picker has no silent default and saves need a choice", () => {
  const h = read("../public/syllabus/index.html");
  assert.match(h, /<option value="">Choose a class…<\/option>/);
  assert.match(h, /Choose which class this is for first\./);
});

test("Settings explains what a Canvas token is and recommends an expiry", () => {
  assert.match(read("../public/settings/index.html"), /works like a password[\s\S]{0,400}expiry date/);
});

test("concept map warns only after weak assessed units and offers one Continue step", () => {
  const c = read("../public/concepts/index.html");
  assert.match(c, /statuses\[j\] === 'red' \|\| statuses\[j\] === 'amber'/);
  assert.ok(!/statuses\[j\] === 'not-assessed'\) \{ priorTrouble/.test(c));
  assert.match(c, /Continue with Unit/);
});

test("quiz results offer a native share of the score", () => {
  const js = read("../client/guide-app.js");
  assert.match(js, /function ssShareScore\(score,total\)/);
  assert.match(js, /onclick="ssShareScore\(/);
});
