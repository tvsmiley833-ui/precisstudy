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

  it("has 55 subjects extracted from the homepage class cards", () => {
    expect(Object.keys(SUBJECT_ICONS).length).toBe(55);
  });
});
