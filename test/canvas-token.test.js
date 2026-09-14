import { describe, it, expect } from "vitest";
import {
  putCanvasToken, getCanvasToken, deleteCanvasToken, canvasTokenKey
} from "../src/canvas-token.js";

function fakeKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store
  };
}

const record = {
  domain: "school.instructure.com",
  apiToken: "canvas-token-abc123",
  connectedAt: "2026-09-14T00:00:00.000Z"
};

describe("canvas-token KV helpers", () => {
  const env = () => ({ PROGRESS: fakeKV(), SESSION_SECRET: "secret-A" });

  it("put then get returns the same record", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", record);
    expect(e.PROGRESS._store.has(canvasTokenKey("student@school.edu"))).toBe(true);
    expect(await getCanvasToken(e, "student@school.edu")).toEqual(record);
  });

  it("get returns null when nothing is stored", async () => {
    expect(await getCanvasToken(env(), "nobody@school.edu")).toBeNull();
  });

  it("get returns null (not throw) with the wrong SESSION_SECRET", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", record);
    const wrongSecretEnv = { PROGRESS: e.PROGRESS, SESSION_SECRET: "secret-B" };
    expect(await getCanvasToken(wrongSecretEnv, "student@school.edu")).toBeNull();
  });

  it("get returns null (not throw) when the stored blob is corrupt", async () => {
    const e = env();
    e.PROGRESS._store.set(canvasTokenKey("x@y.z"), "not-base64-$$$");
    expect(await getCanvasToken(e, "x@y.z")).toBeNull();
  });

  it("stored ciphertext does not contain the plaintext api token", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", record);
    expect(e.PROGRESS._store.get(canvasTokenKey("student@school.edu"))).not.toContain("canvas-token-abc123");
  });

  it("delete removes the record", async () => {
    const e = env();
    await putCanvasToken(e, "student@school.edu", record);
    await deleteCanvasToken(e, "student@school.edu");
    expect(await getCanvasToken(e, "student@school.edu")).toBeNull();
  });
});
