import { describe, it, expect, vi } from "vitest";
import { ssOptimistic, ssOptimisticFetch } from "../public/shared/optimistic.js";

describe("ssOptimistic", () => {
  it("applies immediately, then resolves ok on success without reverting", async () => {
    var order = [];
    var applyFn = vi.fn(() => order.push("apply"));
    var requestFn = vi.fn(() => { order.push("request"); return Promise.resolve("value"); });
    var revertFn = vi.fn(() => order.push("revert"));

    var promise = ssOptimistic(applyFn, requestFn, revertFn);
    // apply runs synchronously, before the request's promise settles.
    expect(order).toEqual(["apply", "request"]);

    var result = await promise;
    expect(result).toEqual({ ok: true, value: "value" });
    expect(revertFn).not.toHaveBeenCalled();
  });

  it("reverts and reports failure when the request rejects", async () => {
    var order = [];
    var error = new Error("boom");
    var applyFn = () => order.push("apply");
    var requestFn = () => { order.push("request"); return Promise.reject(error); };
    var revertFn = (e) => order.push("revert:" + e.message);

    var result = await ssOptimistic(applyFn, requestFn, revertFn);
    expect(order).toEqual(["apply", "request", "revert:boom"]);
    expect(result).toEqual({ ok: false, error: error });
  });

  it("resolves with ok:false instead of throwing when applyFn itself throws", async () => {
    var error = new Error("apply failed");
    var applyFn = () => { throw error; };
    var requestFn = vi.fn();
    var revertFn = vi.fn();

    var result = await ssOptimistic(applyFn, requestFn, revertFn);
    expect(result).toEqual({ ok: false, error: error });
    expect(requestFn).not.toHaveBeenCalled();
    expect(revertFn).not.toHaveBeenCalled();
  });

  it("never throws into the caller when revertFn itself throws", async () => {
    var requestFn = () => Promise.reject(new Error("net"));
    var revertFn = () => { throw new Error("revert also broke"); };

    var result = await ssOptimistic(() => {}, requestFn, revertFn);
    expect(result.ok).toBe(false);
  });

  it("rejects when requestFn throws synchronously instead of returning a rejected promise", async () => {
    var revertFn = vi.fn();
    var result = await ssOptimistic(() => {}, () => { throw new Error("sync throw"); }, revertFn);
    expect(result.ok).toBe(false);
    expect(revertFn).toHaveBeenCalled();
  });
});

describe("ssOptimisticFetch", () => {
  it("resolves with the parsed JSON body on a 2xx response", async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ hello: "world" }))
    }));
    var body = await ssOptimisticFetch("/api/x");
    expect(body).toEqual({ hello: "world" });
  });

  it("throws an error carrying .status on a non-2xx response", async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: "nope" }))
    }));
    await expect(ssOptimisticFetch("/api/x")).rejects.toMatchObject({ message: "nope", status: 400 });
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 500,
      text: () => Promise.resolve("<html>oops</html>")
    }));
    await expect(ssOptimisticFetch("/api/x")).rejects.toMatchObject({ message: "Request failed", status: 500 });
  });
});
