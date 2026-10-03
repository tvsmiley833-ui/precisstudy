// Tests for client-side features in client/guide-app.js (built into public/shared/guide-app.js). The real functions are cut
// out of the shipped file (see helpers/guide-fns.mjs) and run with stubbed browser globals.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGuide, extract } from "./helpers/guide-fns.mjs";

// ───────────────────────────── study plan (.ics) ─────────────────────────────
describe("study plan calendar export", () => {
  const { ssIcsText, ssIcsFold, ssBuildPlanIcs } = loadGuide(["ssIcsText", "ssIcsFold", "ssP2", "ssYmd", "ssBuildPlanIcs"]);
  const units = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Topic ${i + 1}` }));
  const MORNING = new Date(2026, 8, 29, 10, 0, 0); // before a 16:00 reminder
  const NIGHT = new Date(2026, 8, 29, 22, 0, 0); // after it
  const plan = (over = {}) => ssBuildPlanIcs({
    days: 14, mins: 30, perDayQ: 20, timeStr: "16:00", now: MORNING, covered: 6,
    title: "Algebra II", slug: "algebra2", origin: "https://precisstudy.com", units, ...over
  });
  const unfold = t => t.replace(/\r\n /g, "");
  const eventCount = t => t.split("BEGIN:VEVENT").length - 1;
  const lines = t => unfold(t).split("\r\n");

  test("is a well-formed calendar with CRLF line endings", () => {
    const t = plan();
    assert.ok(t.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    assert.ok(t.endsWith("END:VCALENDAR\r\n"));
    assert.ok(!/[^\r]\n/.test(t), "no bare LF line endings");
    assert.equal((t.match(/BEGIN:VEVENT/g) || []).length, (t.match(/END:VEVENT/g) || []).length);
    assert.equal((t.match(/BEGIN:VALARM/g) || []).length, (t.match(/END:VALARM/g) || []).length);
  });

  test("starts today when the reminder time is still ahead: one event per day plus exam day", () => {
    const t = plan();
    assert.equal(eventCount(t), 15); // 14 study days (Sep 29 - Oct 12) + exam day
    assert.ok(t.includes("DTSTART:20260929T160000"));
    assert.ok(t.includes("DTSTART;VALUE=DATE:20261013"));
    assert.ok(t.includes("DTEND;VALUE=DATE:20261014"));
  });

  test("starts tomorrow when today's reminder time has already passed", () => {
    const t = plan({ now: NIGHT });
    assert.ok(!t.includes("DTSTART:20260929T"));
    assert.ok(t.includes("DTSTART:20260930T160000"));
    assert.equal(eventCount(t), 14); // 13 study days + exam day
  });

  test("a reminder exactly at the current time counts as passed", () => {
    const t = plan({ now: new Date(2026, 8, 29, 16, 0, 0) });
    assert.ok(!t.includes("DTSTART:20260929T"));
  });

  test("event length follows the minutes-per-day setting, including across the hour", () => {
    assert.ok(plan({ mins: 30 }).includes("DTEND:20260929T163000"));
    assert.ok(plan({ mins: 90 }).includes("DTEND:20260929T173000"));
    assert.ok(plan({ mins: 45, timeStr: "16:30" }).includes("DTEND:20260929T171500"));
  });

  test("an invalid time falls back to 16:00", () => {
    assert.ok(plan({ timeStr: "soon" }).includes("DTSTART:20260929T160000"));
    assert.ok(plan({ timeStr: "" }).includes("DTSTART:20260929T160000"));
  });

  test("spreads covered units across the days and ends with a final review", () => {
    const sums = lines(plan()).filter(l => l.startsWith("SUMMARY:Study"));
    assert.equal(sums.length, 14);
    assert.equal(sums[0], "SUMMARY:Study Algebra II: Unit 1");
    assert.equal(sums[13], "SUMMARY:Study Algebra II: Final review + mixed quiz");
    const seen = new Set(sums.slice(0, 13).map(s => s.match(/Unit (\d+)/)?.[1]));
    for (let u = 1; u <= 6; u++) assert.ok(seen.has(String(u)), `unit ${u} is scheduled`);
    assert.ok(![...seen].some(n => Number(n) > 6), "no unit beyond what the plan covers");
  });

  test("when there are more units than days, a day covers a range of units", () => {
    const t = plan({ days: 3, covered: 12 });
    const sums = lines(t).filter(l => l.startsWith("SUMMARY:Study"));
    assert.equal(sums.length, 3);
    assert.match(sums[0], /Units 1–6$/);
    assert.match(sums[1], /Units 7–12$/);
    assert.ok(sums[2].includes("Final review"));
  });

  test("every covered unit gets scheduled at least once, whatever the days and unit count", () => {
    for (let days = 1; days <= 60; days++) {
      for (let covered = 1; covered <= 12; covered++) {
        const sums = lines(plan({ days, covered, now: MORNING })).filter(l => l.startsWith("SUMMARY:Study"));
        const seen = new Set();
        for (const l of sums) {
          const range = l.match(/Units (\d+)–(\d+)$/);
          if (range) for (let u = +range[1]; u <= +range[2]; u++) seen.add(u);
          else { const one = l.match(/: Unit (\d+)$/); if (one) seen.add(+one[1]); }
        }
        for (let u = 1; u <= covered; u++) assert.ok(seen.has(u), `days=${days} covered=${covered}: unit ${u} missing`);
        assert.ok(![...seen].some(u => u > covered), `days=${days} covered=${covered}: scheduled a unit it shouldn't`);
      }
    }
  });

  test("a one-day plan has a single study day that isn't a 'final review'", () => {
    const sums = lines(plan({ days: 1 })).filter(l => l.startsWith("SUMMARY:Study"));
    assert.equal(sums.length, 1);
    assert.ok(!sums[0].includes("Final review"));
  });

  test("gives every event a unique, stable UID", () => {
    const uids = lines(plan()).filter(l => l.startsWith("UID:"));
    assert.equal(new Set(uids).size, uids.length);
    assert.deepEqual(uids, lines(plan()).filter(l => l.startsWith("UID:")), "same inputs give the same UIDs");
    assert.ok(uids[0].startsWith("UID:algebra2-plan-20260929@"));
  });

  test("includes the question goal, guide link, and a 10 minute alert", () => {
    const t = unfold(plan());
    assert.ok(t.includes("Goal: about 20 questions in 30 minutes."));
    assert.ok(t.includes("Open the guide: https://precisstudy.com/algebra2/"));
    assert.ok(t.includes("TRIGGER:-PT10M"));
  });

  test("escapes special characters and folds long lines to 75 bytes without losing text", () => {
    const odd = [{ id: 1, name: "Real Numbers, Inequalities; and a \\ backslash é中" }, { id: 2, name: "x".repeat(200) }];
    const t = plan({ units: odd, covered: 2, days: 3 });
    for (const physical of t.split("\r\n")) assert.ok(new TextEncoder().encode(physical).length <= 75, `too long: ${physical.length}`);
    const flat = unfold(t);
    assert.ok(flat.includes("Real Numbers\\, Inequalities\\; and a \\\\ backslash é中"));
    assert.ok(flat.includes("x".repeat(200)), "folded text rejoins exactly");
  });

  test("ssIcsText escapes backslash, semicolon, comma, and newlines", () => {
    assert.equal(ssIcsText("a,b;c\\d\r\ne\nf"), "a\\,b\\;c\\\\d\\ne\\nf");
    assert.equal(ssIcsText(42), "42");
  });

  test("ssIcsFold never splits a multi-byte character and continues lines with a space", () => {
    const folded = ssIcsFold("A".repeat(74) + "\u{1F4DA}" + "B".repeat(10));
    const parts = folded.split("\r\n");
    assert.ok(parts.length >= 2);
    assert.ok(parts.slice(1).every(p => p.startsWith(" ")));
    assert.equal(folded.replace(/\r\n /g, ""), "A".repeat(74) + "\u{1F4DA}" + "B".repeat(10));
    for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= 75);
    assert.equal(ssIcsFold("short"), "short");
  });
});

// ───────────────────────────── read-aloud text ─────────────────────────────
describe("read-aloud text conversion", () => {
  const { ssMathToSpeech, ssSpeechClean, ssUnitSpeechSegments } = loadGuide(
    ["SS_TTS_MATH_WORDS", "ssMathToSpeech", "ssSpeechClean", "ssUnitSpeechSegments"],
    { globals: { document: { querySelector: () => null } } }
  );
  const noLeftovers = s => assert.ok(!/[\\{}^_$|]/.test(s), `leftover symbols in: ${s}`);

  test("reads a fraction as 'the fraction A, over B' so the grouping is clear", () => {
    const s = ssSpeechClean("Solve $\\frac{x+3}{2}=5$ for $x$.");
    assert.equal(s, "Solve the fraction x plus 3, over 2, equals 5 for x.");
  });

  test("reads the quadratic formula without leftover markup", () => {
    const s = ssSpeechClean("$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$");
    for (const part of ["x equals the fraction", "negative b", "plus or minus", "the square root of b squared minus 4ac", "over 2a"]) assert.ok(s.includes(part), part);
    noLeftovers(s);
  });

  test("distinguishes binary minus from a leading negative", () => {
    assert.equal(ssMathToSpeech("x-5"), "x minus 5");
    assert.equal(ssMathToSpeech("-3"), "negative 3");
    assert.equal(ssMathToSpeech("a=-b"), "a equals negative b");
  });

  test("speaks exponents, subscripts, roots, and trig functions", () => {
    assert.equal(ssMathToSpeech("x^2"), "x squared");
    assert.equal(ssMathToSpeech("(a+b)^3"), "(a plus b) cubed");
    assert.equal(ssMathToSpeech("2^{n}"), "2 to the power of n");
    assert.equal(ssMathToSpeech("f^{-1}(x)"), "f inverse (x)");
    assert.equal(ssMathToSpeech("x_1+x_2"), "x sub 1 plus x sub 2");
    assert.equal(ssMathToSpeech("\\sqrt[3]{27}"), "the cube root of 27");
    assert.equal(ssMathToSpeech("\\sqrt[5]{x}"), "the fifth root of x");
    assert.equal(ssMathToSpeech("\\sin^2\\theta+\\cos^2\\theta=1"), "sine squared theta plus cosine squared theta equals 1");
    assert.equal(ssMathToSpeech("\\log_2 8 = 3"), "log sub 2 8 equals 3");
  });

  test("speaks comparison symbols", () => {
    const s = ssMathToSpeech("a \\neq 0, x \\le 5, y \\ge 2, \\pi \\approx 3.14");
    for (const part of ["is not equal to", "less than or equal to", "greater than or equal to", "pi", "is approximately"]) assert.ok(s.includes(part), part);
  });

  test("leaves dollar amounts alone but still converts a bare '$0$'", () => {
    assert.equal(ssSpeechClean("It costs $50 per month plus $3 fee"), "It costs $50 per month plus $3 fee");
    assert.equal(ssSpeechClean("set it equal to $0$."), "set it equal to 0.");
  });

  test("strips HTML and normalises symbols and abbreviations", () => {
    assert.equal(ssSpeechClean("<b>Bold</b> text with <a href=\"x\">a link</a>"), "Bold text with a link");
    assert.equal(ssSpeechClean("Save 20% & more, e.g. now, vs. later"), "Save 20 percent and more, for example, now, versus later");
    assert.equal(ssSpeechClean("see p. 12 and pp. 3"), "see page 12 and pages 3");
    assert.equal(ssSpeechClean("it is ≠ 5 ≤ 6"), "it is is not equal to 5 less than or equal to 6");
  });

  test("reads set-builder notation naturally", () => {
    const s = ssSpeechClean("The solution is {x | x > 3}.");
    assert.ok(s.includes("the set of x such that x is greater than 3"));
    noLeftovers(s);
  });

  test("never leaves LaTeX commands behind in a real-world sample", () => {
    const samples = [
      "$\\tfrac{1}{2}bh$", "$\\frac{\\sqrt{3}}{2}$", "$\\Delta x \\ne 0$", "$a \\pm b$", "$\\ln x = y$",
      "$$\\frac{a}{b}\\cdot\\frac{c}{d}$$", "$x \\in \\mathbb{R}$ roughly"
    ];
    for (const sample of samples) assert.ok(!/\\[a-zA-Z]/.test(ssSpeechClean(sample)), sample);
  });

  test("splits a unit into sentence-sized pieces that end cleanly", () => {
    const long = Array.from({ length: 9 }, (_, i) => `This is sentence number ${i + 1} of a long bullet.`).join(" ");
    const unit = { id: 1, name: "Real Numbers", concepts: [{ l: "Sets", intro: "An intro.", b: [long, "Short bullet", "<b>Bold</b> bullet"] }] };
    const segs = ssUnitSpeechSegments(unit);
    assert.equal(segs[0], "Unit 1: Real Numbers.");
    assert.equal(segs[1], "Sets.");
    assert.ok(segs.length > 5, "long bullet is split");
    for (const s of segs) {
      assert.match(s, /[.!?:]$/);
      assert.ok(s.length <= 230, `segment too long (${s.length})`);
    }
    assert.ok(segs.includes("Bold bullet."));
  });

  test("uses the title as currently shown on the page, so reordered units are read by their new number", () => {
    const { ssUnitSpeechSegments: seg } = loadGuide(["SS_TTS_MATH_WORDS", "ssMathToSpeech", "ssSpeechClean", "ssUnitSpeechSegments"], {
      globals: { document: { querySelector: () => ({ firstChild: { nodeType: 3, nodeValue: "Unit 1: Real Numbers" } }) } }
    });
    assert.equal(seg({ id: 11, name: "Real Numbers", concepts: [] })[0], "Unit 1: Real Numbers.");
  });
});

// ───────────────────────────── read-aloud voice choice ─────────────────────────────
describe("read-aloud voice choice", () => {
  const state = { voices: [], store: {}, throwing: false };
  const { ssVoiceScore, ssEnglishVoices, ssTtsPrefs, ssPickVoice } = loadGuide(
    ["SS_TTS_AVOID", "ssVoiceScore", "ssEnglishVoices", "ssTtsPrefs", "ssPickVoice"],
    {
      globals: {
        window: { speechSynthesis: { getVoices: () => state.voices } },
        localStorage: { getItem: k => { if (state.throwing) throw new Error("blocked"); return state.store[k] ?? null; } }
      }
    }
  );
  const v = (name, lang = "en-US", extra = {}) => ({ name, lang, voiceURI: name, localService: true, default: false, ...extra });
  const reset = () => { state.voices = []; state.store = {}; state.throwing = false; };

  test("ranks natural/neural and premium/enhanced voices above standard ones", () => {
    reset();
    state.voices = [v("Fred"), v("Samantha"), v("Google US English"), v("Microsoft Aria Online (Natural) - English (United States)"), v("Alex (Enhanced)")];
    const ranked = ssEnglishVoices().sort((a, b) => ssVoiceScore(b) - ssVoiceScore(a)).map(x => x.name);
    assert.equal(ranked[0], "Microsoft Aria Online (Natural) - English (United States)");
    assert.ok(ranked.indexOf("Alex (Enhanced)") < ranked.indexOf("Samantha"));
    assert.ok(ranked.indexOf("Google US English") < ranked.indexOf("Samantha"));
    assert.equal(ranked[ranked.length - 1], "Fred", "novelty voice last");
  });

  test("never picks a novelty voice, even when it is the browser default", () => {
    reset();
    state.voices = [v("Bubbles", "en-US", { default: true }), v("Zarvox"), v("Daniel", "en-GB")];
    assert.equal(ssPickVoice().name, "Daniel");
  });

  test("only considers English voices, and returns null when there are none", () => {
    reset();
    state.voices = [v("Monica", "es-ES"), v("Thomas", "fr-FR")];
    assert.equal(ssPickVoice(), null);
    state.voices.push(v("Karen", "en-AU"));
    assert.equal(ssPickVoice().name, "Karen");
  });

  test("prefers en-US over other English variants when otherwise equal", () => {
    reset();
    state.voices = [v("Generic", "en-GB"), v("Generic Two", "en-US")];
    assert.equal(ssPickVoice().name, "Generic Two");
  });

  test("a saved choice wins; a saved voice that no longer exists falls back to the best one", () => {
    reset();
    state.voices = [v("Samantha"), v("Daniel", "en-GB")];
    state.store["ss-tts-voice"] = "Daniel";
    assert.equal(ssPickVoice().name, "Daniel");
    state.store["ss-tts-voice"] = "Uninstalled Voice";
    assert.equal(ssPickVoice().name, "Samantha");
  });

  test("prefs default to automatic voice at 0.96x and survive bad stored values or blocked storage", () => {
    reset();
    assert.deepEqual({ ...ssTtsPrefs() }, { voice: "", rate: 0.96 });
    state.store["ss-tts-voice"] = "Daniel";
    state.store["ss-tts-rate"] = "1.1";
    assert.deepEqual({ ...ssTtsPrefs() }, { voice: "Daniel", rate: 1.1 });
    state.store["ss-tts-rate"] = "fast";
    assert.equal(ssTtsPrefs().rate, 0.96);
    state.throwing = true;
    assert.deepEqual({ ...ssTtsPrefs() }, { voice: "", rate: 0.96 });
  });
});

// ───────────────────────────── spaced repetition ─────────────────────────────
describe("flashcard spaced repetition", () => {
  const DAY = 864e5;
  const clock = { t: 1_800_000_000_000 };
  const FLASHCARDS = [{ t: "alpha", u: 1 }, { t: "beta", u: 1 }, { t: "gamma", u: 1 }];
  const ls = { data: {}, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, x) { this.data[k] = String(x); }, removeItem(k) { delete this.data[k]; } };

  function setup(known = [], srs = {}, withMastery = true) {
    const st = { cardsKnown: [...known], srs: { ...srs } };
    const SS_MASTERY = withMastery ? {
      getSnapshot: () => st,
      setSrs: (t, r) => { st.srs[t] = r; },
      mergeSrs: o => { for (const [k, x] of Object.entries(o)) if (!st.srs[k]) st.srs[k] = x; }
    } : null;
    ls.data = {};
    const api = loadGuide(
      ["SRS_DAYS", "ssSrsLoad", "ssSrsSeed", "ssSrsRecord", "ssSrsIsDue", "ssSrsDueCount", "ssSrsNextDue", "ssSrsNextLabel", "ssSrsRefresh"],
      { globals: { SS_MASTERY, SS_GUIDE: { slug: "algebra2" }, FLASHCARDS, localStorage: ls, Date: { now: () => clock.t }, document: { getElementById: () => null } }, extra: "let fcFilterMode='all';" }
    );
    return { st, api };
  }

  test("a correct answer moves the card up one box and pushes the due date out", () => {
    const { st, api } = setup();
    api.ssSrsRecord("alpha", true);
    assert.deepEqual([...st.srs.alpha], [1, clock.t + 1 * DAY, clock.t]);
    clock.t += 1 * DAY;
    api.ssSrsRecord("alpha", true);
    assert.deepEqual([...st.srs.alpha], [2, clock.t + 3 * DAY, clock.t]);
  });

  test("a right answer on a card that isn't due yet doesn't move it (no cramming)", () => {
    const { st, api } = setup();
    api.ssSrsRecord("alpha", true);
    const due = st.srs.alpha[1];
    api.ssSrsRecord("alpha", true);
    assert.deepEqual([...st.srs.alpha], [1, due, clock.t]);
  });

  test("a miss drops two boxes, never below 1, and is due now", () => {
    const { st, api } = setup();
    for (let i = 0; i < 4; i++) { api.ssSrsRecord("alpha", true); clock.t = st.srs.alpha[1]; }
    assert.equal(st.srs.alpha[0], 4);
    api.ssSrsRecord("alpha", false);
    assert.deepEqual([...st.srs.alpha], [2, clock.t, clock.t]);
    api.ssSrsRecord("alpha", false);
    assert.equal(st.srs.alpha[0], 1);
  });

  test("boxes climb 1 to 5 on the 1, 3, 7, 14, 30 day schedule and stop at 5", () => {
    const { st, api } = setup();
    const boxes = [], gaps = [];
    for (let i = 0; i < 7; i++) { api.ssSrsRecord("alpha", true); boxes.push(st.srs.alpha[0]); gaps.push((st.srs.alpha[1] - clock.t) / DAY); clock.t = st.srs.alpha[1]; }
    assert.deepEqual(boxes, [1, 2, 3, 4, 5, 5, 5]);
    assert.deepEqual(gaps, [1, 3, 7, 14, 30, 30, 30]);
  });

  test("a wrong answer drops the card two boxes and makes it due immediately", () => {
    const { st, api } = setup([], { alpha: [4, clock.t + 14 * DAY, 1] });
    api.ssSrsRecord("alpha", false);
    assert.deepEqual([...st.srs.alpha], [2, clock.t, clock.t]);
    assert.equal(api.ssSrsIsDue("alpha"), true);
  });

  test("counts only scheduled cards that are due now", () => {
    const { api } = setup([], { alpha: [1, clock.t - 1, 1], beta: [2, clock.t + DAY, 1] }); // gamma never rated
    assert.equal(api.ssSrsDueCount(), 1);
    assert.equal(api.ssSrsIsDue("alpha"), true);
    assert.equal(api.ssSrsIsDue("beta"), false);
    assert.equal(api.ssSrsIsDue("gamma"), false);
    assert.equal(api.ssSrsIsDue("not a card"), false);
  });

  test("finds the next review time and words it for humans", () => {
    const { api } = setup([], { alpha: [1, clock.t + 3 * DAY, 1], beta: [1, clock.t + DAY / 2, 1] });
    assert.equal(api.ssSrsNextDue(), clock.t + DAY / 2);
    assert.equal(api.ssSrsNextLabel(clock.t + DAY / 2), "tomorrow");
    assert.equal(api.ssSrsNextLabel(clock.t + DAY), "tomorrow");
    assert.equal(api.ssSrsNextLabel(clock.t + 3 * DAY), "in 3 days");
    assert.equal(setup().api.ssSrsNextDue(), null);
  });

  test("without a mastery object there is no schedule and nothing is due", () => {
    const { api } = setup([], {}, false);
    assert.deepEqual({ ...api.ssSrsLoad() }, {});
    assert.equal(api.ssSrsDueCount(), 0);
    assert.doesNotThrow(() => api.ssSrsSeed());
  });

  test("cards marked known before the feature get a first review spread over the next five days", () => {
    const { st, api } = setup(["alpha", "beta", "gamma"], { alpha: [4, clock.t + 14 * DAY, 99] });
    api.ssSrsSeed();
    assert.deepEqual([...st.srs.alpha], [4, clock.t + 14 * DAY, 99], "an existing schedule is never overwritten");
    assert.deepEqual([...st.srs.beta], [2, clock.t + 1 * DAY, 0]);
    assert.deepEqual([...st.srs.gamma], [2, clock.t + 2 * DAY, 0]);
    api.ssSrsSeed();
    assert.deepEqual([...st.srs.beta], [2, clock.t + 1 * DAY, 0], "seeding twice changes nothing");
  });

  test("a schedule saved by the first version of the feature is moved into the account state and removed", () => {
    const { st, api } = setup();
    ls.data["ss-srs-algebra2"] = JSON.stringify({ alpha: [3, clock.t + DAY, 5] });
    api.ssSrsSeed();
    assert.deepEqual([...st.srs.alpha], [3, clock.t + DAY, 5]);
    assert.equal(ls.getItem("ss-srs-algebra2"), null);
  });

  test("unreadable legacy data is ignored without throwing", () => {
    const { st, api } = setup();
    ls.data["ss-srs-algebra2"] = "{not json";
    assert.doesNotThrow(() => api.ssSrsSeed());
    assert.deepEqual({ ...st.srs }, {});
  });
});

// ───────────────────────────── drag-to-reorder helpers ─────────────────────────────
describe("unit drag and reorder", () => {
  const scrolls = [];
  const { ssDragScrollTick, setY } = loadGuide(["ssDragScrollRaf", "ssDragScrollTick"], {
    globals: {
      window: { scrollBy: o => scrolls.push(o) },
      innerHeight: 800,
      requestAnimationFrame: () => 7
    },
    extra: "const setY=v=>{ssDragY=v};",
    returns: ["setY"]
  });
  const tick = y => { scrolls.length = 0; setY(y); ssDragScrollTick(); return scrolls.length ? scrolls[0] : null; };

  test("scrolls up near the top edge, faster the closer to the edge", () => {
    const edge = tick(0), mid = tick(45), far = tick(80);
    assert.ok(edge.top < 0 && mid.top < 0 && far.top < 0);
    assert.ok(Math.abs(edge.top) > Math.abs(mid.top) && Math.abs(mid.top) > Math.abs(far.top));
    assert.equal(edge.top, -22);
    assert.equal(edge.behavior, "instant");
  });

  test("scrolls down near the bottom edge", () => {
    const d = tick(799);
    assert.ok(d.top > 0 && d.top <= 22);
  });

  test("does not scroll in the middle of the window", () => {
    assert.equal(tick(400), null);
    assert.equal(tick(90), null); // exactly at the edge band's inner boundary
  });

  test("a pointer above the window is treated as the top edge, not an extra-fast scroll", () => {
    assert.equal(tick(-300).top, -22);
  });

  test("renumbers the visible unit titles to match their position", () => {
    const mk = text => { const title = { firstChild: { nodeType: 3, nodeValue: text } }; return { querySelector: () => title }; };
    const noText = { querySelector: () => ({ firstChild: { nodeType: 1 } }) };
    const children = [mk("Unit 11: GrAmSS"), mk("Unit 1: Rhetoric"), noText, mk("Unit 10: Grammar")];
    const { ssRenumberUnitTitles } = loadGuide(["ssRenumberUnitTitles"], { globals: { document: { getElementById: () => ({ children }) } } });
    ssRenumberUnitTitles();
    assert.equal(children[0].querySelector().firstChild.nodeValue, "Unit 1: GrAmSS");
    assert.equal(children[1].querySelector().firstChild.nodeValue, "Unit 2: Rhetoric");
    assert.equal(children[3].querySelector().firstChild.nodeValue, "Unit 4: Grammar");
  });
});

// ───────────────────────────── flashcard typing check ─────────────────────────────
describe("typed flashcard answers", () => {
  const { ssLevenshtein, FUZZY_THRESHOLD, ssFuzzyMatch } = loadGuide(["ssLevenshtein", "FUZZY_THRESHOLD", "ssFuzzyMatch", "ssNormTyped", "ssTypedCandidates"]);

  test("edit distance", () => {
    assert.equal(ssLevenshtein("kitten", "sitting"), 3);
    assert.equal(ssLevenshtein("", "abc"), 3);
    assert.equal(ssLevenshtein("same", "same"), 0);
  });

  test("ignores case and extra spaces and reports an exact match", () => {
    const r = ssFuzzyMatch("  Mitochondria   ", "mitochondria");
    assert.equal(r.match, true);
    assert.equal(r.exact, true);
  });

  test("accepts a small typo in a long term but not in a short one", () => {
    assert.equal(ssFuzzyMatch("photosynthesys", "photosynthesis").match, true);
    assert.equal(ssFuzzyMatch("photosynthesys", "photosynthesis").exact, false);
    assert.equal(ssFuzzyMatch("cut", "cat").match, false);
  });

  test("accents, punctuation and parentheticals don't matter; an accent-only answer is flagged", () => {
    assert.equal(ssFuzzyMatch("bacons rebellion", "Bacon\u2019s Rebellion").exact, true);
    assert.equal(ssFuzzyMatch("esta", "est\u00e1").match, true);
    assert.equal(ssFuzzyMatch("esta", "est\u00e1").accentOnly, true);
    assert.equal(ssFuzzyMatch("est\u00e1", "est\u00e1").accentOnly, false);
    assert.equal(ssFuzzyMatch("mitosis", "Mitosis (cell division)").exact, true);
    assert.equal(ssFuzzyMatch("la casa", "la casa / el hogar").match, true);
    assert.equal(ssFuzzyMatch("el hogar", "la casa / el hogar").match, true);
  });

  test("rejects wrong and empty answers", () => {
    assert.equal(ssFuzzyMatch("", "anything").match, false);
    assert.equal(ssFuzzyMatch("   ", "anything").match, false);
    assert.equal(ssFuzzyMatch("osmosis", "diffusion").match, false);
    assert.ok(FUZZY_THRESHOLD > 0.5 && FUZZY_THRESHOLD < 1);
  });
});

// ───────────────────────────── Pomodoro timer ─────────────────────────────
describe("Pomodoro timer phases", () => {
  const { SS_POMO, ssPomoNext, ssFmtClock } = loadGuide(["SS_POMO", "ssPomoNext", "ssFmtClock"]);

  test("a focus session is followed by a 5 minute break, and a break by a fresh 25 minute focus", () => {
    assert.deepEqual({ ...ssPomoNext("focus", 0) }, { phase: "break", done: 1, secs: 5 * 60 });
    assert.deepEqual({ ...ssPomoNext("break", 1) }, { phase: "focus", done: 1, secs: 25 * 60 });
    assert.equal(SS_POMO.focus, 25 * 60);
  });

  test("every fourth focus session earns the long 15 minute break", () => {
    const breaks = [];
    let phase = "focus", done = 0;
    for (let i = 0; i < 8; i++) {
      const next = ssPomoNext(phase, done);
      if (next.phase === "break") breaks.push(next.secs / 60);
      phase = next.phase; done = next.done;
    }
    assert.deepEqual(breaks, [5, 5, 5, 15]);
    assert.equal(done, 4);
  });

  test("the clock shows minutes:seconds, with hours only when needed", () => {
    assert.equal(ssFmtClock(0), "00:00");
    assert.equal(ssFmtClock(65), "01:05");
    assert.equal(ssFmtClock(25 * 60), "25:00");
    assert.equal(ssFmtClock(3600), "1:00:00");
    assert.equal(ssFmtClock(3 * 3600 + 7 * 60 + 9), "3:07:09");
  });
});

// ───────────────────────────── accessibility helpers ─────────────────────────────
describe("accessibility helpers", () => {
  const { ssLabelSvg } = loadGuide(["ssLabelSvg"]);

  test("a diagram gets a screen-reader label made from its caption, with markup stripped and quotes escaped", () => {
    const out = ssLabelSvg('<svg viewBox="0 0 10 10"><circle/></svg>', 'A <b>circle</b> with "radius" 5 &amp; a line, where a &gt; 0');
    assert.ok(out.startsWith('<svg role="img" aria-label="A circle with &quot;radius&quot; 5 &amp; a line, where a > 0"'), out.slice(0, 160));
    assert.ok(out.includes('viewBox="0 0 10 10"'), "original attributes kept");
  });

  test("an svg that already has its own role is left exactly as it was", () => {
    const own = '<svg class="vec" role="img" aria-label="An arrow" viewBox="0 0 5 5"></svg>';
    assert.equal(ssLabelSvg(own, "some caption"), own);
  });

  test("a missing caption still produces a label, and leading whitespace is preserved", () => {
    assert.ok(ssLabelSvg("\n<svg></svg>", "").startsWith('\n<svg role="img" aria-label="Diagram"'));
  });

  test("scripted scrolling is smooth unless the device asks for reduced motion", () => {
    const smooth = loadGuide(["ssScrollBehavior"], { globals: { window: { matchMedia: () => ({ matches: false }) } } }).ssScrollBehavior;
    const reduced = loadGuide(["ssScrollBehavior"], { globals: { window: { matchMedia: () => ({ matches: true }) } } }).ssScrollBehavior;
    const broken = loadGuide(["ssScrollBehavior"], { globals: { window: {} } }).ssScrollBehavior;
    assert.equal(smooth(), "smooth");
    assert.equal(reduced(), "auto");
    assert.equal(broken(), "smooth", "no matchMedia: keep the default");
  });
});

// Math (LaTeX in $...$) appears in quiz options/explanations, flashcards, worked steps and the exam. MathJax only
// typesets what is in the page at startup, so every function that writes content later must re-typeset it.
describe("math typesetting of content written after page load", () => {
  test("ssTypeset hands the element to MathJax and is a no-op without it", () => {
    const calls = [];
    const el = { id: "x" };
    const withMj = loadGuide(["ssTypeset"], { globals: { window: { MathJax: { typesetPromise: (a) => { calls.push(a); return Promise.resolve(); } } } } }).ssTypeset;
    withMj(el);
    assert.deepEqual(calls, [[el]]);
    const without = loadGuide(["ssTypeset"], { globals: { window: {} } }).ssTypeset;
    assert.doesNotThrow(() => without(el));
  });

  for (const fn of ["buildExam", "showFC", "revealStep", "ansQ", "buildExamples", "ssRunPrintJob"]) {
    test(`${fn}() re-typesets the content it writes`, () => {
      assert.match(extract(fn), /ssTypeset\(|typesetPromise/, `${fn} writes math-bearing content but never typesets it`);
    });
  }
});

// The Easy/Medium/Hard chips only make sense where questions carry a difficulty; elsewhere they emptied the quiz to "0/0 NaN%".
describe("difficulty chips", () => {
  // ssHardQ is a one-line function, so extracting it also takes the helpers that follow it up to the end of ssDifficultyLevels.
  const mk = (QUIZ, HARD_Q) => loadGuide(["ssHardQ"], { globals: { QUIZ, HARD_Q }, returns: ["ssDiffOf", "ssDifficultyLevels"] });
  const qs = (n, d) => Array.from({ length: n }, (_, i) => ({ q: `${d}${i}`, d }));

  test("a question's difficulty is its own d, or 'hard' when it comes from the hard bank", () => {
    const hard = { q: "h" };
    const { ssDiffOf } = mk([], [hard]);
    assert.equal(ssDiffOf({ q: "x", d: "easy" }), "easy");
    assert.equal(ssDiffOf(hard), "hard");
    assert.equal(ssDiffOf({ q: "plain" }), null);
  });

  test("levels are counted across the quiz and the hard bank", () => {
    const hardBank = qs(4, undefined).map(q => ({ q: q.q }));
    const { ssDifficultyLevels } = mk([...qs(12, "easy"), ...qs(3, "medium"), { q: "none" }], hardBank);
    assert.deepEqual(ssDifficultyLevels(), { easy: 12, medium: 3, hard: 4 });
  });

  test("a guide with no difficulty tags and no hard bank has zero at every level (so no chips are shown)", () => {
    const { ssDifficultyLevels } = mk([{ q: "a" }, { q: "b" }], undefined);
    assert.deepEqual(ssDifficultyLevels(), { easy: 0, medium: 0, hard: 0 });
  });
});

describe("what a quiz answer is worth (mastery credit)", () => {
  const { ssAnswerCredit } = loadGuide(["ssAnswerCredit"]);

  test("a first, unaided correct answer earns credit", () => {
    assert.deepEqual(ssAnswerCredit(true, false, 0, 0), { record: true, credited: true });
    assert.deepEqual(ssAnswerCredit(true, false, 1, 0), { record: true, credited: true }, "tier 1 only names the unit");
  });

  test("a wrong answer is recorded as a miss, assisted or not", () => {
    assert.deepEqual(ssAnswerCredit(false, false, 0, 0), { record: true, credited: false });
    assert.deepEqual(ssAnswerCredit(false, true, 3, 0), { record: true, credited: false });
  });

  test("a correct answer after a guess, the 50/50 hint or the answer preview earns no credit", () => {
    assert.deepEqual(ssAnswerCredit(true, true, 0, 0), { record: true, credited: false });
    assert.deepEqual(ssAnswerCredit(true, false, 2, 0), { record: true, credited: false });
    assert.deepEqual(ssAnswerCredit(true, false, 3, 0), { record: true, credited: false });
  });

  test("a repeat of a question already answered records nothing, right or wrong", () => {
    assert.deepEqual(ssAnswerCredit(true, false, 0, 1), { record: false, credited: false });
    assert.deepEqual(ssAnswerCredit(false, false, 0, 2), { record: false, credited: false });
  });
});

describe("diagnostic bookkeeping", () => {
  test("'Just Start' no longer fabricates wrong answers", () => {
    const src = extract("justStartUnit1");
    assert.ok(!/recordAnswer/.test(src), "justStartUnit1 must not record answers");
    assert.match(extract("ssEnrollInThisSubject"), /enrolled-subjects/);
  });

  test("the diagnostic summary is scored from this run's tally, not lifetime mastery", () => {
    const src = extract("showDiagSummary");
    assert.match(src, /diagTally/);
    assert.ok(!/getSnapshot\(\)\.mastery/.test(src), "showDiagSummary must not read lifetime mastery");
  });
});

describe("flashcard order after rating (no skipped cards, working requeue)", () => {
  const { ssNextCardAfterRating, ssRequeueCard } = loadGuide(["ssNextCardAfterRating", "ssRequeueCard"]);
  const names = (deck) => deck.map(c => c.t).join("");
  const mk = (s) => s.split("").map(t => ({ t }));

  test("a card that leaves a filtered deck does not make the next card get skipped", () => {
    const [a, b, c, d] = mk("ABCD");
    const before = [a, b, c, d];
    const after = [a, c, d]; // B was just rated into 'known' and left the 'still learning' view
    assert.equal(ssNextCardAfterRating(before, 1, after), 1, "C is next, and it now sits at B's old index");
  });

  test("a card that stays in the deck advances normally", () => {
    const [a, b, c] = mk("ABC");
    assert.equal(ssNextCardAfterRating([a, b, c], 0, [a, b, c]), 1);
  });

  test("wraps to the start when the last card leaves, and handles an emptied or single-card deck", () => {
    const [a, b] = mk("AB");
    assert.equal(ssNextCardAfterRating([a, b], 1, [a]), 0);
    assert.equal(ssNextCardAfterRating([a], 0, []), 0);
    assert.equal(ssNextCardAfterRating([a], 0, [a]), 0);
  });

  test("a card rated 'still learning' comes back a few cards later", () => {
    const deck = mk("ABCDEF");
    ssRequeueCard(deck, deck[0], 4);
    assert.equal(names(deck), "BCDEAF");
  });

  test("requeueing near the end clamps to the end of the deck, and an unknown card is ignored", () => {
    const deck = mk("ABCD");
    ssRequeueCard(deck, deck[2], 4);
    assert.equal(names(deck), "ABDC");
    ssRequeueCard(deck, { t: "Z" }, 4);
    assert.equal(names(deck), "ABDC");
  });

  test("in the unfiltered view the next card is still found after the rated card is moved", () => {
    const deck = mk("ABCDEF");
    const before = deck.slice(); // rateFC snapshots, because the active deck and fcDeck are the same array here
    ssRequeueCard(deck, deck[0], 4);
    assert.equal(ssNextCardAfterRating(before, 0, deck), 0, "B is next and is now first");
  });

  test("shuffle works on the underlying deck so it also works in filtered views", () => {
    const src = extract("fcShuffle");
    assert.match(src, /const deck=fcDeck/);
    assert.ok(!/getActiveDeck/.test(src.split("\n").slice(0, 3).join("\n")), "must not shuffle the throwaway filtered copy");
  });
});

describe("quiz keyboard shortcuts are scoped to the question area", () => {
  function setup({ active, quizActive = true, optionDisabled = false, nextVisible = true }) {
    const clicked = [];
    const inQbox = new Set();
    const mk = (tag, extra = {}) => ({ tagName: tag, isContentEditable: false, closest: () => null, ...extra });
    const qbox = { contains: (n) => inQbox.has(n) };
    const opt = [0, 1, 2, 3].map(i => ({ disabled: optionDisabled, click: () => clicked.push("opt" + i) }));
    const next = { style: { display: nextVisible ? "inline-block" : "none" }, click: () => clicked.push("next") };
    const els = { "view-quiz": { classList: { contains: () => quizActive } }, qbox, "q-next": next };
    const nodes = { button: mk("BUTTON"), link: mk("A"), text: mk("DIV"), input: mk("INPUT"), outside: mk("A") };
    for (const n of ["button", "text", "input"]) inQbox.add(nodes[n]);
    const doc = { activeElement: nodes[active], getElementById: (id) => els[id] || null, querySelectorAll: () => opt };
    const { ssQuizKeyboardShortcuts } = loadGuide(["ssQuizKeyboardShortcuts"], { globals: { document: doc } });
    const press = (key, extra = {}) => { let prevented = false; ssQuizKeyboardShortcuts({ key, preventDefault: () => { prevented = true; }, ...extra }); return prevented; };
    return { press, clicked };
  }

  test("1-4 answer only while focus is inside the question area", () => {
    const inside = setup({ active: "text" });
    assert.equal(inside.press("2"), true);
    assert.deepEqual(inside.clicked, ["opt1"]);
    const outside = setup({ active: "outside" });
    assert.equal(outside.press("2"), false);
    assert.deepEqual(outside.clicked, []);
  });

  test("Enter on a focused button or link is left to that control, not turned into Next", () => {
    const onButton = setup({ active: "button" });
    assert.equal(onButton.press("Enter"), false);
    assert.deepEqual(onButton.clicked, []);
    const onText = setup({ active: "text" });
    assert.equal(onText.press("Enter"), true);
    assert.deepEqual(onText.clicked, ["next"]);
  });

  test("modifier keys, typing fields and other tabs are ignored", () => {
    assert.deepEqual(setup({ active: "text" }).press("1", { ctrlKey: true }), false);
    assert.deepEqual(setup({ active: "input" }).clicked, []);
    const typing = setup({ active: "input" }); typing.press("1");
    assert.deepEqual(typing.clicked, []);
    const otherTab = setup({ active: "text", quizActive: false }); otherTab.press("1");
    assert.deepEqual(otherTab.clicked, []);
  });
});

describe("flashcards for screen readers", () => {
  function scene(flipped) {
    const attrs = { front: {}, back: {} };
    const face = (k) => ({ setAttribute: (n, v) => { attrs[k][n] = v; } });
    const faces = { ".face.front": face("front"), ".face.back": face("back") };
    const live = { textContent: "" };
    const els = { scene: { classList: { contains: () => flipped }, querySelector: (q) => faces[q] }, "fc-live": live, "fc-def": { textContent: "the answer" }, "fc-term": { textContent: "the term" } };
    const { ssFcSyncFaces } = loadGuide(["ssFcSyncFaces"], { globals: { document: { getElementById: (id) => els[id] || null } } });
    return { ssFcSyncFaces, attrs, live };
  }

  test("only the face that is showing is exposed, so the answer isn't read out with the question", () => {
    const front = scene(false); front.ssFcSyncFaces(false);
    assert.deepEqual([front.attrs.front["aria-hidden"], front.attrs.back["aria-hidden"]], ["false", "true"]);
    const back = scene(true); back.ssFcSyncFaces(false);
    assert.deepEqual([back.attrs.front["aria-hidden"], back.attrs.back["aria-hidden"]], ["true", "false"]);
  });

  test("flipping announces the face that is now showing", () => {
    const a = scene(true); a.ssFcSyncFaces(true);
    assert.equal(a.live.textContent, "Definition: the answer");
    const b = scene(false); b.ssFcSyncFaces(true);
    assert.equal(b.live.textContent, "Term: the term");
  });

  test("the template no longer hides the card behind a fixed aria-label", () => {
    const html = readFileSync(new URL("../scripts/guide-template/page-views.template.html", import.meta.url), "utf8");
    const sceneTag = html.match(/<div class="scene"[^>]*>/)[0];
    assert.ok(!/aria-label=/.test(sceneTag), sceneTag);
    assert.match(html, /id="fc-live"[^>]*aria-live="polite"/);
  });
});

describe("guide headings", () => {
  const page = readFileSync(new URL("../public/spanish-1/index.html", import.meta.url), "utf8");
  test("units are h2, concepts are h3, and no heading sits inside a role=button", () => {
    assert.match(page, /<h2 class="unit-h"><span class="unit-title">/);
    assert.match(page, /<h3 class="c-label">/);
    assert.ok(!/role="button"[^>]*>\s*<h[1-6]/.test(page));
  });
  test("exam parts put the button inside the heading", () => {
    const js = readFileSync(new URL("../client/guide-app.js", import.meta.url), "utf8");
    assert.ok(!/class="ex-part-hd"[^>]*role="button"/.test(js));
    assert.match(js, /<h3><span class="ex-part-btn"[^>]*role="button"/);
  });
});

describe("exam totals and timer announcements", () => {
  function setup() {
    const els = { "ex-score-box": { textContent: "" }, "ex-live": { textContent: "" } };
    const globals = { document: { getElementById: (id) => els[id] || null }, PART_A: [{}, {}, {}], PART_B1: [{}], examScores: { A: 2 }, examAnswered: { A: { 1: true, 2: true } }, examPartMeta: () => ({ title: "Part A" }) };
    const api = loadGuide(["ssExamUpdateTotal", "ssExamTimerSay"], { globals });
    return { els, api };
  }
  test("the running total counts answered questions, not all of them", () => {
    const { els, api } = setup();
    api.ssExamUpdateTotal();
    assert.equal(els["ex-score-box"].textContent, "Multiple choice so far: 2 of 2 answered correct (100%), 2 not yet answered.");
  });
  test("the clock is announced at 5 min, 1 min and time up only", () => {
    const { els, api } = setup();
    const say = (remaining, expired = false) => { api.ssExamTimerSay("A", { remaining, expired }); return els["ex-live"].textContent; };
    assert.equal(say(301), "");
    assert.equal(say(300), "Part A: 5 minutes left.");
    assert.equal(say(60), "Part A: 1 minute left.");
    assert.equal(say(0, true), "Part A: time is up.");
  });
});

describe("language guides", () => {
  test("every language guide declares its target language and the page carries it", () => {
    const want = { "spanish-1": "es", "spanish-2": "es", "spanish-3": "es", "french-1": "fr", "french-2": "fr", "french-3": "fr", "german-1": "de" };
    for (const [slug, lang] of Object.entries(want)) {
      assert.equal(JSON.parse(readFileSync(new URL(`../guides/${slug}.json`, import.meta.url), "utf8")).targetLang, lang);
      assert.match(readFileSync(new URL(`../public/${slug}/index.html`, import.meta.url), "utf8"), new RegExp(`"lang":"${lang}"`));
    }
  });
  test("a matching voice is chosen by language prefix, none when the device lacks one", () => {
    const voices = [{ lang: "en-US" }, { lang: "es_MX" }, { lang: "fr-FR" }];
    const { ssVoiceForLang } = loadGuide(["ssVoiceForLang"], { globals: { window: { speechSynthesis: { getVoices: () => voices } } } });
    assert.equal(ssVoiceForLang("fr").lang, "fr-FR");
    assert.equal(ssVoiceForLang("de"), null);
  });
});

describe("unit check-yourself questions", () => {
  const bank = [
    { u: 1, q: "a", o: ["x", "y"], a: 0 }, { u: 1, q: "b", o: ["x", "y"], a: 1 }, { u: 1, q: "c", o: ["x", "y"], a: 0 },
    { u: 1, q: "d", o: ["x", "y"], a: 0 }, { u: 1, q: "fig", o: ["x", "y"], a: 0, fig: "<svg/>" }, { u: 2, q: "other", o: ["x", "y"], a: 0 },
  ];
  const { ssUnitCheckPick } = loadGuide(["ssUnitCheckPick"], {});
  test("picks three questions from that unit only, never a figure question", () => {
    const got = ssUnitCheckPick(bank, 1, 3, () => 0.3);
    assert.equal(got.length, 3);
    assert.ok(got.every(q => q.u === 1 && !q.fig));
  });
  test("returns fewer when the unit has fewer, and none for an empty unit", () => {
    assert.equal(ssUnitCheckPick(bank, 2, 3, Math.random).length, 1);
    assert.equal(ssUnitCheckPick(bank, 9, 3, Math.random).length, 0);
  });
});
