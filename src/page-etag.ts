// Page ETags that change with every deploy.
//
// The asset layer's ETag covers only the static HTML file, but the Worker rewrites each page: shared scripts and styles get
// ?v=<hash> URLs, and the banner, theme bootstrap and widgets are injected. With the raw ETag, a returning browser asked
// "has /geometry/ changed?", got 304, and kept its old copy pointing at the old script URLs, so a deploy that touched only
// a shared file never reached it. The ETag sent to browsers is therefore `W/"<asset etag>.<deploy id>"`.

/** True for page addresses ("/", "/geometry/", "/geometry/quiz"); false for files with an extension and for API routes. */
export function isPagePath(pathname: string): boolean {
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) return false;
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return !last.includes(".");
}

const strip = (etag: string): string => etag.replace(/^W\//, "").replace(/^"|"$/g, "");

/** The ETag to send for a page: the asset's own tag plus this deploy's id. */
export function pageEtag(assetEtag: string, deployId: string): string {
  return `W/"${strip(assetEtag)}.${deployId}"`;
}

/**
 * What to forward as If-None-Match to the asset layer. A tag from this deploy maps back to the asset's own tag (so an
 * unchanged page still answers 304); a tag from an older deploy maps to null, which forces a full, freshly rewritten page.
 */
export function assetIfNoneMatch(header: string | null, deployId: string): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = strip(part.trim());
    const suffix = "." + deployId;
    if (tag.endsWith(suffix)) return `"${tag.slice(0, -suffix.length)}"`;
  }
  return null;
}
