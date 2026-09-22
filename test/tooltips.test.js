import { describe, it, expect } from "vitest";
import { computePosition } from "../public/shared/tooltips.js";

var VIEWPORT = { width: 1024, height: 768 };

describe("computePosition", () => {
  it("places the tip above the trigger when there is room", () => {
    var trigger = { left: 400, top: 300, width: 80, height: 20 };
    var tip = { width: 120, height: 30 };
    var pos = computePosition(trigger, tip, VIEWPORT);
    expect(pos.placement).toBe("top");
    expect(pos.top).toBe(300 - 8 - 30);
  });

  it("flips below the trigger when there is no room above", () => {
    var trigger = { left: 400, top: 10, width: 80, height: 20 };
    var tip = { width: 120, height: 30 };
    var pos = computePosition(trigger, tip, VIEWPORT);
    expect(pos.placement).toBe("bottom");
    expect(pos.top).toBe(10 + 20 + 8);
  });

  it("clamps horizontally so the tip never runs off the left edge", () => {
    var trigger = { left: 2, top: 300, width: 20, height: 20 };
    var tip = { width: 200, height: 30 };
    var pos = computePosition(trigger, tip, VIEWPORT);
    expect(pos.left).toBe(8); // MARGIN
  });

  it("clamps horizontally so the tip never runs off the right edge", () => {
    var trigger = { left: 1000, top: 300, width: 20, height: 20 };
    var tip = { width: 200, height: 30 };
    var pos = computePosition(trigger, tip, VIEWPORT);
    expect(pos.left).toBe(VIEWPORT.width - 200 - 8);
  });

  it("clamps vertically so the tip never runs off the top edge", () => {
    var trigger = { left: 400, top: 5, width: 80, height: 2 };
    var tip = { width: 120, height: 400 };
    var pos = computePosition(trigger, tip, VIEWPORT);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  it("centers the tip horizontally on the trigger", () => {
    var trigger = { left: 500, top: 300, width: 100, height: 20 };
    var tip = { width: 40, height: 20 };
    var pos = computePosition(trigger, tip, VIEWPORT);
    expect(pos.left).toBe(500 + 50 - 20);
  });
});
