import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker bootstrap", () => {
  it("responds to any request", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
