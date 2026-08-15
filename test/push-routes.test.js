import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signSession, SESSION_COOKIE } from "../src/auth.js";
import { handlePushSubscribe, handlePushUnsubscribe, handlePushTest, sendDailyReminders, sendScheduledBlockReminders, sendStreakReminders } from "../src/push-routes.js";

const SECRET = "test-session-secret";
const VAPID = {
  VAPID_SUBJECT: "mailto:test@example.com",
  VAPID_PUBLIC_KEY: "BFLqJyuV9vTCmo9TTgfsX9yOgI1DhUopA1Bm7Kw-Raxt5aD9286kiIVFLPcCWuInwcNzsTIuuAX-439U_D2WH1Q",
  VAPID_PRIVATE_KEY: "Udgx8GfjcDWYn-eCHtB6tk12Rs2qOTQBGWdRF38coQ8"
};
const VALID_KEYS = {
  p256dh: "BKs6I_SyBbnr_u2AP7IIbZTCn6qFkJgb14ezLt71sAK5zLQrjGbhsHU-M-C2ve_TAp9tf_pMU37FKVjH7XF1TaA",
  auth: "o4mCrmM1qj80AZq-VLr50A"
};

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async list({ prefix, cursor } = {}) {
      const keys = [...store.keys()]
        .filter(k => !prefix || k.startsWith(prefix))
        .map(name => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    },
    _store: store
  };
}

async function sessionCookieFor(email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ email, name: email, provider: "google", iat: now, exp: now + 3600 }, SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

function req(url, cookie, method, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  return new Request(url, { method: method || "GET", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handlePushSubscribe", () => {
  it("401s with no session", async () => {
    const res = await handlePushSubscribe(req("https://example.com/api/push/subscribe", null, "POST", {}), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid subscription shape", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const res = await handlePushSubscribe(req("https://example.com/api/push/subscribe", cookie, "POST", { subscription: { endpoint: "https://push.example/x" } }), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(400);
  });

  it("saves a valid subscription and preserves existing progress", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const existing = { geometry: { mastery: { "1": { correct: 1, total: 2 } }, examples: {}, cardsKnown: [] } };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify(existing) });
    const sub = { endpoint: "https://push.example/abc", keys: VALID_KEYS, expirationTime: null };
    const res = await handlePushSubscribe(req("https://example.com/api/push/subscribe", cookie, "POST", { subscription: sub }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.geometry).toEqual(existing.geometry);
    expect(saved.pushSubscriptions).toEqual([sub]);
  });

  it("de-duplicates by endpoint when re-subscribing", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const oldSub = { endpoint: "https://push.example/abc", keys: { p256dh: "old", auth: "old" }, expirationTime: null };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ pushSubscriptions: [oldSub] }) });
    const newSub = { endpoint: "https://push.example/abc", keys: VALID_KEYS, expirationTime: null };
    await handlePushSubscribe(req("https://example.com/api/push/subscribe", cookie, "POST", { subscription: newSub }), { SESSION_SECRET: SECRET, PROGRESS: kv });

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.pushSubscriptions.length).toBe(1);
    expect(saved.pushSubscriptions[0].keys).toEqual(VALID_KEYS);
  });
});

describe("handlePushUnsubscribe", () => {
  it("401s with no session", async () => {
    const res = await handlePushUnsubscribe(req("https://example.com/api/push/unsubscribe", null, "POST", {}), { SESSION_SECRET: SECRET, PROGRESS: fakeKV() });
    expect(res.status).toBe(401);
  });

  it("removes the matching subscription by endpoint", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const subs = [
      { endpoint: "https://push.example/a", keys: VALID_KEYS, expirationTime: null },
      { endpoint: "https://push.example/b", keys: VALID_KEYS, expirationTime: null }
    ];
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ pushSubscriptions: subs }) });
    const res = await handlePushUnsubscribe(req("https://example.com/api/push/unsubscribe", cookie, "POST", { endpoint: "https://push.example/a" }), { SESSION_SECRET: SECRET, PROGRESS: kv });
    expect(res.status).toBe(200);

    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.pushSubscriptions).toEqual([subs[1]]);
  });
});

describe("handlePushTest", () => {
  it("401s with no session", async () => {
    const res = await handlePushTest(req("https://example.com/api/push/test", null, "POST"), { SESSION_SECRET: SECRET, PROGRESS: fakeKV(), ...VAPID });
    expect(res.status).toBe(401);
  });

  it("400s when the student has no saved subscription", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ pushSubscriptions: [] }) });
    const res = await handlePushTest(req("https://example.com/api/push/test", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv, ...VAPID });
    expect(res.status).toBe(400);
  });

  it("sends a real encrypted push payload to the subscription's endpoint", async () => {
    const cookie = await sessionCookieFor("student@example.com");
    const sub = { endpoint: "https://push.example/abc", keys: VALID_KEYS, expirationTime: null };
    const kv = fakeKV({ "progress:student@example.com": JSON.stringify({ pushSubscriptions: [sub] }) });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
    const res = await handlePushTest(req("https://example.com/api/push/test", cookie, "POST"), { SESSION_SECRET: SECRET, PROGRESS: kv, ...VAPID });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, sent: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://push.example/abc");
  });
});

describe("sendDailyReminders", () => {
  it("only messages students who have both a subscription and a saved goal, and drops gone (410) subscriptions", async () => {
    const goodSub = { endpoint: "https://push.example/good", keys: VALID_KEYS, expirationTime: null };
    const goneSub = { endpoint: "https://push.example/gone", keys: VALID_KEYS, expirationTime: null };
    const kv = fakeKV({
      "progress:with-goal@example.com": JSON.stringify({ goal: { days: 14, minutesPerDay: 30 }, pushSubscriptions: [goodSub] }),
      "progress:no-goal@example.com": JSON.stringify({ goal: null, pushSubscriptions: [goodSub] }),
      "progress:no-sub@example.com": JSON.stringify({ goal: { days: 14, minutesPerDay: 30 }, pushSubscriptions: [] }),
      "progress:stale-sub@example.com": JSON.stringify({ goal: { days: 7, minutesPerDay: 20 }, pushSubscriptions: [goneSub] })
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === goneSub.endpoint) return new Response(null, { status: 410 });
      return new Response(null, { status: 201 });
    });

    const result = await sendDailyReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // good sub + gone sub, not the two without goal/subscription

    const staleSaved = JSON.parse(kv._store.get("progress:stale-sub@example.com"));
    expect(staleSaved.pushSubscriptions).toEqual([]); // gone subscription pruned
  });

  it("returns zeroed counts when push isn't configured", async () => {
    const result = await sendDailyReminders({ PROGRESS: fakeKV() });
    expect(result).toEqual({ checked: 0, sent: 0 });
  });
});

describe("sendScheduledBlockReminders", () => {
  // Fixed instant: 2026-03-10T20:00:00Z is a Tuesday. America/New_York observes
  // EDT (UTC-4) by then (US DST started 2026-03-08), so local time is Tue 16:00.
  const NOW = "2026-03-10T20:00:00.000Z";
  const TZ = "America/New_York";
  const sub = { endpoint: "https://push.example/a", keys: VALID_KEYS, expirationTime: null };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function scheduleWith(blocks, overrides) {
    return { schedule: { blocks, timezone: TZ, notifyEnabled: true, ...overrides }, pushSubscriptions: [sub] };
  }

  it("sends for a block starting exactly now, and for one starting a few minutes from now (within the 5-minute window)", async () => {
    const kv = fakeKV({
      "progress:on-time@example.com": JSON.stringify(scheduleWith([
        { day: "tue", start: "16:00", end: "17:00", subjectKey: "geometry", subjectLabel: "Geometry" }
      ])),
      "progress:soon@example.com": JSON.stringify(scheduleWith([
        { day: "tue", start: "16:04", end: "17:00", subjectKey: "chemistry", subjectLabel: "Chemistry" }
      ]))
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendScheduledBlockReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not send for a block just outside the 5-minute window, on the wrong day, or already past", async () => {
    const kv = fakeKV({
      "progress:too-late@example.com": JSON.stringify(scheduleWith([
        { day: "tue", start: "16:05", end: "17:00", subjectKey: "geometry", subjectLabel: "Geometry" }
      ])),
      "progress:wrong-day@example.com": JSON.stringify(scheduleWith([
        { day: "wed", start: "16:00", end: "17:00", subjectKey: "geometry", subjectLabel: "Geometry" }
      ])),
      "progress:already-passed@example.com": JSON.stringify(scheduleWith([
        { day: "tue", start: "09:00", end: "10:00", subjectKey: "geometry", subjectLabel: "Geometry" }
      ]))
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendScheduledBlockReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips students with notifications off, no timezone, or no subscription", async () => {
    const dueBlock = [{ day: "tue", start: "16:00", end: "17:00", subjectKey: "geometry", subjectLabel: "Geometry" }];
    const kv = fakeKV({
      "progress:notify-off@example.com": JSON.stringify(scheduleWith(dueBlock, { notifyEnabled: false })),
      "progress:no-tz@example.com": JSON.stringify(scheduleWith(dueBlock, { timezone: null })),
      "progress:no-sub@example.com": JSON.stringify({ schedule: { blocks: dueBlock, timezone: TZ, notifyEnabled: true }, pushSubscriptions: [] })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendScheduledBlockReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prunes a gone (410) subscription after a due block fires", async () => {
    const goneSub = { endpoint: "https://push.example/gone", keys: VALID_KEYS, expirationTime: null };
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        schedule: {
          blocks: [{ day: "tue", start: "16:00", end: "17:00", subjectKey: "aplang", subjectLabel: "AP English Lang & Comp" }],
          timezone: TZ,
          notifyEnabled: true
        },
        pushSubscriptions: [goneSub]
      })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));

    const result = await sendScheduledBlockReminders({ PROGRESS: kv, ...VAPID });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(0);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.pushSubscriptions).toEqual([]);
  });

  it("returns zeroed counts when push isn't configured", async () => {
    const result = await sendScheduledBlockReminders({ PROGRESS: fakeKV() });
    expect(result).toEqual({ checked: 0, sent: 0 });
  });
});

describe("sendStreakReminders", () => {
  // 2026-03-11T00:00:00Z = 2026-03-10 20:00 EDT (UTC-4, DST already in effect) --
  // 8:00 PM local in America/New_York, the start of the reminder window. Their
  // local calendar date at this instant is still 2026-03-10.
  const TZ = "America/New_York";
  const sub = { endpoint: "https://push.example/a", keys: VALID_KEYS, expirationTime: null };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends to a student with an active streak who hasn't studied today, at 8pm local", async () => {
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        streak: { current: 5, longest: 10, lastActiveDate: "2026-03-09", timezone: TZ },
        pushSubscriptions: [sub]
      })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendStreakReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not send to a student who already studied today", async () => {
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        streak: { current: 5, longest: 10, lastActiveDate: "2026-03-10", timezone: TZ },
        pushSubscriptions: [sub]
      })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendStreakReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not send outside the 8:00-8:05pm local window", async () => {
    vi.setSystemTime(new Date("2026-03-10T20:00:00.000Z")); // 4:00 PM local -- too early
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        streak: { current: 5, longest: 10, lastActiveDate: "2026-03-09", timezone: TZ },
        pushSubscriptions: [sub]
      })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendStreakReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips students with no active streak, no timezone, or no subscription", async () => {
    const kv = fakeKV({
      "progress:no-streak@example.com": JSON.stringify({ streak: null, pushSubscriptions: [sub] }),
      "progress:zero-streak@example.com": JSON.stringify({ streak: { current: 0, longest: 5, lastActiveDate: "2026-03-09", timezone: TZ }, pushSubscriptions: [sub] }),
      "progress:no-tz@example.com": JSON.stringify({ streak: { current: 5, longest: 10, lastActiveDate: "2026-03-09", timezone: null }, pushSubscriptions: [sub] }),
      "progress:no-sub@example.com": JSON.stringify({ streak: { current: 5, longest: 10, lastActiveDate: "2026-03-09", timezone: TZ }, pushSubscriptions: [] })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendStreakReminders({ PROGRESS: kv, ...VAPID });

    expect(result.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prunes a gone (410) subscription after sending", async () => {
    const goneSub = { endpoint: "https://push.example/gone", keys: VALID_KEYS, expirationTime: null };
    const kv = fakeKV({
      "progress:student@example.com": JSON.stringify({
        streak: { current: 3, longest: 3, lastActiveDate: "2026-03-09", timezone: TZ },
        pushSubscriptions: [goneSub]
      })
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));

    const result = await sendStreakReminders({ PROGRESS: kv, ...VAPID });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(0);
    const saved = JSON.parse(kv._store.get("progress:student@example.com"));
    expect(saved.pushSubscriptions).toEqual([]);
  });

  it("returns zeroed counts when push isn't configured", async () => {
    const result = await sendStreakReminders({ PROGRESS: fakeKV() });
    expect(result).toEqual({ checked: 0, sent: 0 });
  });
});
