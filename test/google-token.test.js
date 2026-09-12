import { describe, it, expect } from "vitest";
import {
  encryptTokenRecord, decryptTokenRecord,
  putGoogleToken, getGoogleToken, deleteGoogleToken, googleTokenKey
} from "../src/google-token.js";

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
  refreshToken: "1//refresh-abc",
  googleEmail: "student@school.edu",
  scopes: ["openid", "email"],
  connectedAt: "2026-09-10T00:00:00.000Z"
};

describe("google-token crypto", () => {
  it("encrypt -> decrypt round-trips a record", async () => {
    const packed = await encryptTokenRecord("secret-A", record);
    expect(await decryptTokenRecord("secret-A", packed)).toEqual(record);
  });

  it("a record encrypted under a different secret fails to decrypt (throws)", async () => {
    const packed = await encryptTokenRecord("secret-A", record);
    await expect(decryptTokenRecord("secret-B", packed)).rejects.toThrow();
  });

  it("ciphertext does not contain the plaintext refresh token", async () => {
    const packed = await encryptTokenRecord("secret-A", record);
    expect(packed).not.toContain("1//refresh-abc");
  });

  it("two encryptions of the same record differ (random IV)", async () => {
    const a = await encryptTokenRecord("secret-A", record);
    const b = await encryptTokenRecord("secret-A", record);
    expect(a).not.toBe(b);
  });
});

describe("google-token KV helpers", () => {
  const env = () => ({ PROGRESS: fakeKV(), SESSION_SECRET: "secret-A" });

  it("put then get returns the same record", async () => {
    const e = env();
    await putGoogleToken(e, "student@school.edu", record);
    expect(e.PROGRESS._store.has(googleTokenKey("student@school.edu"))).toBe(true);
    expect(await getGoogleToken(e, "student@school.edu")).toEqual(record);
  });

  it("get returns null when nothing is stored", async () => {
    expect(await getGoogleToken(env(), "nobody@school.edu")).toBeNull();
  });

  it("get returns null (not throw) when the stored blob is corrupt", async () => {
    const e = env();
    e.PROGRESS._store.set(googleTokenKey("x@y.z"), "not-base64-$$$");
    expect(await getGoogleToken(e, "x@y.z")).toBeNull();
  });

  it("delete removes the record", async () => {
    const e = env();
    await putGoogleToken(e, "student@school.edu", record);
    await deleteGoogleToken(e, "student@school.edu");
    expect(await getGoogleToken(e, "student@school.edu")).toBeNull();
  });
});
