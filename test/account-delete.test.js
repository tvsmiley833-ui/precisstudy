import { describe, it, expect } from "vitest";
import { deleteUserData } from "../src/account-delete.js";
import { loadGroup } from "../src/leaderboard-routes.js";

// In-memory KV with prefix listing, like Cloudflare KV (enough for deleteUserData).
function kvStub() {
  const m = new Map();
  return {
    _m: m,
    get: (k) => Promise.resolve(m.has(k) ? m.get(k) : null),
    put: (k, v) => { m.set(k, typeof v === "string" ? v : String(v)); return Promise.resolve(); },
    delete: (k) => { m.delete(k); return Promise.resolve(); },
    list: ({ prefix = "" } = {}) => Promise.resolve({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}

const ME = "Learner@Example.com"; // mixed case on purpose: keys are written with the session's spelling
const OTHER = "friend@example.com";

function seed() {
  const PROGRESS = kvStub(), FEEDBACK = kvStub(), GUIDE_REQUESTS = kvStub();
  const p = PROGRESS._m;
  p.set("progress:" + ME, JSON.stringify({ shareToken: "sharetok1", calendarToken: "caltok1", inviteToken: "invtok1", leaderboard: { optedIn: true, handle: "Owl1", groupCode: "GRP1" }, pushSubscriptions: [{ endpoint: "https://push.example/x" }] }));
  p.set("login:learner@example.com", "{}");
  for (const pre of ["gtok:", "gsettings:", "gcache:", "syldates:", "canvastok:"]) p.set(pre + ME, "x");
  p.set("share:sharetok1", ME); p.set("cal:caltok1", ME); p.set("invite:invtok1", ME);
  p.set("history:" + ME, "[]");
  p.set("chalidx:learner@example.com", "[]");
  p.set("sv:learner@example.com", "3"); // session version is kept on purpose
  p.set("lbgroup:GRP1", JSON.stringify({ members: [ME], createdAt: "2026-01-01" })); // pre-change array membership
  p.set("lbgm:GRP1:" + OTHER, "1"); // new-style membership
  p.set("lbgm:GRP1:learner@example.com", "1");
  p.set("challenge:AAAAAA", JSON.stringify({ creatorEmail: ME, opponentEmail: OTHER }));
  p.set("challenge:BBBBBB", JSON.stringify({ creatorEmail: OTHER, opponentEmail: "learner@example.com" }));
  p.set("challenge:CCCCCC", JSON.stringify({ creatorEmail: OTHER, opponentEmail: "third@example.com" }));
  // someone else's data must survive
  p.set("progress:" + OTHER, JSON.stringify({ shareToken: "othershare" })); p.set("share:othershare", OTHER);
  FEEDBACK._m.set("fb:1", JSON.stringify({ message: "love it", email: ME, category: "praise" }));
  FEEDBACK._m.set("fb:2", JSON.stringify({ message: "ok", email: OTHER }));
  GUIDE_REQUESTS._m.set("req:1", JSON.stringify({ className: "AP Art", email: "learner@example.com", files: [] }));
  return { env: { SESSION_SECRET: "s", PROGRESS, FEEDBACK, GUIDE_REQUESTS }, PROGRESS, FEEDBACK, GUIDE_REQUESTS };
}

describe("deleteUserData", () => {
  it("removes every per-user key and reverse-lookup token, whatever the email's case", async () => {
    const { env, PROGRESS } = seed();
    const report = await deleteUserData(env, ME);
    const left = [...PROGRESS._m.keys()].filter(k => k.toLowerCase().includes("learner@example.com") || ["share:sharetok1", "cal:caltok1", "invite:invtok1"].includes(k));
    expect(left).toEqual(["sv:learner@example.com"]); // only the session-version counter stays, so old cookies stay dead
    expect(report.canvasTokenRemoved).toBe(true);
    expect(report.keysDeleted).toBe(12); // progress, login, gtok, gsettings, gcache, syldates, canvastok, chalidx, history + share, cal, invite
  });

  it("removes the person from a shared group and deletes the group when nobody is left", async () => {
    const { env, PROGRESS } = seed();
    await deleteUserData(env, ME);
    expect((await loadGroup(env, "GRP1")).members).toEqual([OTHER]);
    expect(PROGRESS._m.has("lbgm:GRP1:learner@example.com")).toBe(false);
    PROGRESS._m.set("progress:" + OTHER, JSON.stringify({ leaderboard: { groupCode: "GRP1" } }));
    await deleteUserData(env, OTHER);
    expect(PROGRESS._m.has("lbgroup:GRP1")).toBe(false);
    expect(PROGRESS._m.has("lbgm:GRP1:" + OTHER)).toBe(false);
  });

  it("deletes challenges the person created or joined, and leaves unrelated ones", async () => {
    const { env, PROGRESS } = seed();
    const report = await deleteUserData(env, ME);
    expect(PROGRESS._m.has("challenge:AAAAAA")).toBe(false);
    expect(PROGRESS._m.has("challenge:BBBBBB")).toBe(false);
    expect(PROGRESS._m.has("challenge:CCCCCC")).toBe(true);
    expect(report.challengesDeleted).toBe(2);
  });

  it("strips the address from feedback and guide requests but keeps the text and other people's records", async () => {
    const { env, FEEDBACK, GUIDE_REQUESTS } = seed();
    await deleteUserData(env, ME);
    expect(JSON.parse(FEEDBACK._m.get("fb:1"))).toMatchObject({ message: "love it", email: "" });
    expect(JSON.parse(FEEDBACK._m.get("fb:2")).email).toBe(OTHER);
    expect(JSON.parse(GUIDE_REQUESTS._m.get("req:1"))).toMatchObject({ className: "AP Art", email: "" });
  });

  it("does not touch another user's progress or share link", async () => {
    const { env, PROGRESS } = seed();
    await deleteUserData(env, ME);
    expect(PROGRESS._m.has("progress:" + OTHER)).toBe(true);
    expect(PROGRESS._m.get("share:othershare")).toBe(OTHER);
  });

  it("works for a user with no data at all", async () => {
    const env = { SESSION_SECRET: "s", PROGRESS: kvStub() };
    const report = await deleteUserData(env, "nobody@example.com");
    expect(report.keysDeleted).toBe(0);
    expect(report.scanTruncated).toBe(false);
  });
});
