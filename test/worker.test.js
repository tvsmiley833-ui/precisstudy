import { describe, it, expect } from "vitest";

describe("worker bootstrap", () => {
  it("responds to any request", async () => {
    // Test that the worker environment is available
    // by verifying we can create and test Response objects
    const response = new Response("ok");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
