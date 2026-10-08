// Markdown content negotiation (https://acceptmarkdown.com): an agent that sends `Accept: text/markdown` gets a Markdown
// version of the homepage and of the 404 page, with `Vary: Accept` so caches keep the HTML and Markdown copies apart.
// Browsers (which ask for text/html) are unaffected.

const SITE = "https://precisstudy.com";

/** The q-value the Accept header gives a media range, or 0 when no range in it matches. */
function qFor(accept: string, type: string): number {
  const [group] = type.split("/");
  let best = -1;
  let q = 0;
  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().split(";").map((s) => s.trim());
    if (!range) continue;
    const specificity = range === type ? 3 : range === `${group}/*` ? 2 : range === "*/*" ? 1 : 0;
    if (specificity <= best) continue;
    const p = params.find((x) => x.toLowerCase().startsWith("q="));
    const v = p ? Number.parseFloat(p.slice(2)) : 1;
    best = specificity;
    q = Number.isFinite(v) ? v : 1;
  }
  return best < 0 ? 0 : q;
}

/** True when the client asked for Markdown at least as strongly as HTML. A bare `*​/*` (curl, most crawlers) keeps HTML. */
export function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const md = accept.split(",").some((p) => p.split(";")[0]!.trim() === "text/markdown") ? qFor(accept, "text/markdown") : 0;
  return md > 0 && md >= qFor(accept, "text/html");
}

export const HOME_MARKDOWN = `# PrecisStudy

> Free study guides with quizzes, flashcards, practice exams and an AI study assistant for high-school and AP courses. Built by a student, for students. No paywalls, and no account is needed to study.

## What you can do here

- Read a unit-by-unit study guide with notes, diagrams and worked examples for each course.
- Practice with multiple-choice quizzes, a Hard Mode question bank, and short-response questions you score yourself.
- Review with flashcards and take a full practice exam.
- Ask the AI study assistant a question about the guide you are reading.
- Plan study time on the planner and track progress on the dashboard (signing in is optional and only syncs progress).

## Find a study guide

- [Full list of guides](${SITE}/llms.txt): every course with its address, in the form \`${SITE}/<slug>/\`.
- [Sitemap](${SITE}/sitemap.xml)
- [Study tips](${SITE}/tips/)

## About

- [About PrecisStudy](${SITE}/about/)
- [Privacy policy](${SITE}/privacy/)
`;

export function notFoundMarkdown(pathname: string): string {
  const shown = pathname.replace(/[`\r\n]/g, "").slice(0, 200);
  return `# 404: page not found

There is no page at \`${shown}\` on PrecisStudy. The address may have moved, or the link may have a typo.

## Where to look instead

- [Home](${SITE}/)
- [List of study guides (llms.txt)](${SITE}/llms.txt)
- [Sitemap](${SITE}/sitemap.xml)
- [Study tips](${SITE}/tips/)
`;
}

function markdownResponse(body: string, status: number, head: boolean): Response {
  return new Response(head ? null : body, {
    status,
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept", "Cache-Control": "public, max-age=300" }
  });
}

function addVaryAccept(res: Response): Response {
  const vary = res.headers.get("Vary");
  if (vary && /(^|,\s*)(accept|\*)\s*(,|$)/i.test(vary)) return res;
  const out = new Response(res.body, res);
  out.headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
  return out;
}

/** Applies negotiation to the response the site would normally send for the homepage or for a missing page. */
export function negotiate(request: Request, res: Response): Response {
  if (request.method !== "GET" && request.method !== "HEAD") return res;
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) return res;
  const head = request.method === "HEAD";
  const markdown = wantsMarkdown(request.headers.get("Accept"));
  if (pathname === "/" && res.status === 200) return markdown ? markdownResponse(HOME_MARKDOWN, 200, head) : addVaryAccept(res);
  if (res.status === 404) return markdown ? markdownResponse(notFoundMarkdown(pathname), 404, head) : addVaryAccept(res);
  return res;
}
