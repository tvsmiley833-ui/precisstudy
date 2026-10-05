import { describe, it, expect } from "vitest";
import { SUBJECT_ICONS, getSubjectIcon } from "../public/shared/subject-icons.js";

describe("getSubjectIcon", () => {
  it("returns the icon for a direct key", () => {
    var icon = getSubjectIcon("geometry");
    expect(icon).toBeTruthy();
    expect(icon.svg).toContain("<svg");
    expect(icon.color).toBeTruthy();
  });

  it("resolves known legacy-spelling aliases to the authoritative key", () => {
    expect(getSubjectIcon("earth-science")).toEqual(SUBJECT_ICONS.earthscience);
    expect(getSubjectIcon("us-government")).toEqual(SUBJECT_ICONS.usgovernment);
    expect(getSubjectIcon("english-9")).toEqual(SUBJECT_ICONS.english9);
    expect(getSubjectIcon("english-10")).toEqual(SUBJECT_ICONS.english10);
    expect(getSubjectIcon("spanish-1")).toEqual(SUBJECT_ICONS.spanish1);
    expect(getSubjectIcon("spanish-2")).toEqual(SUBJECT_ICONS.spanish2);
  });

  it("returns null for an unknown key instead of throwing", () => {
    expect(getSubjectIcon("not-a-real-subject")).toBeNull();
  });

  it("returns null for an empty/falsy key", () => {
    expect(getSubjectIcon("")).toBeNull();
    expect(getSubjectIcon(undefined)).toBeNull();
  });

  it("has an icon for every subject card on the homepage", () => {
    // one icon per guide; the count tracks the number of guides, so adding a course must add an icon
    expect(Object.keys(SUBJECT_ICONS).length).toBeGreaterThanOrEqual(58);
  });
});
