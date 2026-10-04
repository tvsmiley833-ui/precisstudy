import { describe, it, expect } from "vitest";
import { isPagePath, pageEtag, assetIfNoneMatch } from "../src/page-etag.js";

describe("page ETags change with each deploy", () => {
  it("treats pages as pages and files and APIs as not", () => {
    for (const p of ["/", "/geometry/", "/geometry/quiz", "/tips/sohcahtoa/"]) expect(isPagePath(p)).toBe(true);
    for (const p of ["/shared/guide-app.js", "/favicon.png", "/api/progress", "/auth/me", "/sitemap.xml"]) expect(isPagePath(p)).toBe(false);
  });
  it("combines the asset tag with the deploy id", () => {
    expect(pageEtag('"abc"', "d1")).toBe('W/"abc.d1"');
    expect(pageEtag('W/"abc"', "d1")).toBe('W/"abc.d1"');
  });
  it("lets a tag from this deploy revalidate, and refuses one from an older deploy", () => {
    expect(assetIfNoneMatch('W/"abc.d1"', "d1")).toBe('"abc"');
    expect(assetIfNoneMatch('W/"abc.d0"', "d1")).toBeNull();
    expect(assetIfNoneMatch('"abc"', "d1")).toBeNull(); // the raw asset tag older browsers still hold
    expect(assetIfNoneMatch(null, "d1")).toBeNull();
  });
});
