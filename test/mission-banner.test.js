import { describe, it, expect } from "vitest";
import { MISSION_BANNER_HTML, MISSION_BANNER_HEAD } from "../src/worker.js";

describe("mission banner is part of the first paint", () => {
  it("ships as markup with a close button, not only as a deferred script", () => {
    expect(MISSION_BANNER_HTML).toContain('id="mb-bar"');
    expect(MISSION_BANNER_HTML).toContain('id="mb-close"');
    expect(MISSION_BANNER_HTML).toContain("/about");
  });
  it("hides itself before paint for visitors who dismissed it, using the same storage key as the script", () => {
    expect(MISSION_BANNER_HEAD).toContain("ss-mission-banner-dismissed");
    expect(MISSION_BANNER_HEAD).toContain("html[data-mb=off] #mb-bar{display:none}");
  });
});
