import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { wantsMarkdown, notFoundMarkdown } from "../src/markdown-negotiation.js";

describe("wantsMarkdown", () => {
  it("accepts a request that asks for Markdown first or as strongly as HTML", () => {
    for (const a of ["text/markdown", "text/markdown, text/html;q=0.9", "text/markdown;q=1, text/html;q=1", "text/html;q=0.5, text/markdown"]) expect(wantsMarkdown(a)).toBe(true);
  });
  it("keeps HTML for browsers, bare wildcards and an absent header", () => {
    for (const a of [null, "", "*/*", "text/html", "text/html,application/xhtml+xml,*/*;q=0.8", "text/html, text/markdown;q=0.5", "text/markdown;q=0"]) expect(wantsMarkdown(a)).toBe(false);
  });
});

describe("Markdown negotiation on the live worker", () => {
  it("serves the homepage as Markdown with Vary: Accept", async () => {
    const res = await SELF.fetch("https://precisstudy.com/", { headers: { Accept: "text/markdown" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/markdown/);
    expect(res.headers.get("Vary")).toMatch(/Accept/i);
    const body = await res.text();
    expect(body.startsWith("# PrecisStudy")).toBe(true);
    expect(body).toContain("https://precisstudy.com/llms.txt");
  });
  it("keeps serving HTML for text/html and marks it Vary: Accept", async () => {
    const res = await SELF.fetch("https://precisstudy.com/", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
    expect(res.headers.get("Vary")).toMatch(/Accept/i);
    expect(await res.text()).toContain("<html");
  });
  it("answers a missing page with a 404 and a Markdown body when Markdown is requested", async () => {
    const res = await SELF.fetch("https://precisstudy.com/__no-such-page", { headers: { Accept: "text/markdown" } });
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/markdown/);
    expect(res.headers.get("Vary")).toMatch(/Accept/i);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain("https://precisstudy.com/llms.txt");
    expect(body).toContain("https://precisstudy.com/sitemap.xml");
  });
  it("still sends the HTML 404 page to browsers", async () => {
    const res = await SELF.fetch("https://precisstudy.com/__no-such-page", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
  });
  it("leaves other pages and API routes alone", async () => {
    const guide = await SELF.fetch("https://precisstudy.com/geometry/", { headers: { Accept: "text/markdown" } });
    expect(guide.headers.get("Content-Type")).toMatch(/^text\/html/);
    const api = await SELF.fetch("https://precisstudy.com/api/nothing", { headers: { Accept: "text/markdown" } });
    expect(api.headers.get("Content-Type") || "").not.toMatch(/markdown/);
  });
  it("neutralizes backticks in the path echoed into the 404 body", () => {
    expect(notFoundMarkdown("/a`b\nc")).not.toMatch(/a`b/);
  });
});
