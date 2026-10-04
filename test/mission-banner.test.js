import { describe, it, expect } from "vitest";
import { MISSION_BANNER_HTML, MISSION_BANNER_HEAD } from "../src/mission-banner.js";

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

import { showsBottomNav } from "../src/worker.js";
describe("phone bottom nav placement", () => {
  it("is on secondary pages only", () => {
    for (const p of ["/dashboard/", "/settings/", "/planner/", "/tips/", "/tips/sohcahtoa/", "/about/"]) expect(showsBottomNav(p)).toBe(true);
    for (const p of ["/", "/geometry/", "/geometry/quiz", "/admin/", "/onboarding/", "/age/"]) expect(showsBottomNav(p)).toBe(false);
  });
});
