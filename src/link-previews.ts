import { loadBlob, summarizeShare } from "./progress-routes.js";
import { loadChallenge } from "./challenge-routes.js";
import { displayNameFor } from "./leaderboard-routes.js";

// Link-preview crawlers (iMessage, Slack, Discord, ...) don't run JavaScript,
// so the Open Graph / Twitter tags for shared links must be in the HTML the
// Worker serves. Three link kinds are resolved here with one or two KV reads:
// progress shares (/share/?t=), peer challenges (/challenge?challenge=), and
// invites (?ref= on any page). Every dynamic value ends up in an attribute or
// text node written through HTMLRewriter (setAttribute / setInnerContent), or
// through escapeAttr for tags that don't exist yet. Only what the public page
// already exposes is ever used -- never an email.

const ORIGIN = "https://precisstudy.com";
const IMAGE = `${ORIGIN}/logo-full.png`;
const TOKEN_RE = /^[A-Za-z0-9_-]{10,40}$/;
const CODE_RE = /^[A-Za-z0-9]{6}$/;

// Same {key: label} map as SUBJECT_LABELS in public/share/index.html.
const SUBJECT_LABELS: Record<string, string> = {
  "geometry": "Geometry",
  "chemistry": "Chemistry",
  "algebra1": "Algebra I",
  "algebra2": "Algebra II",
  "aplang": "AP English Lang & Comp",
  "globalhistory": "Global History",
  "apbiology": "AP Biology",
  "apush": "APUSH",
  "us-history": "US History",
  "physics": "Physics",
  "biology": "Biology",
  "precalc": "PreCalculus",
  "act-prep": "ACT Prep",
  "anatomy": "Anatomy & Physiology",
  "ap-chemistry": "AP Chemistry",
  "ap-csa": "AP Computer Science A",
  "ap-euro": "AP European History",
  "ap-macro": "AP Macroeconomics",
  "ap-micro": "AP Microeconomics",
  "ap-physics": "AP Physics 1",
  "ap-psych": "AP Psychology",
  "ap-stats": "AP Statistics",
  "ap-usgov": "AP US Government",
  "ap-world": "AP World History",
  "ap-human-geography": "AP Human Geography",
  "art-history": "Art History",
  "astronomy": "Astronomy",
  "computer-science": "Computer Science",
  "creative-writing": "Creative Writing",
  "earth-science": "Earth Science",
  "economics": "Economics",
  "english-10": "English 10",
  "english-9": "English 9",
  "environmental-science": "Environmental Science",
  "french-1": "French 1",
  "geography": "Geography",
  "german-1": "German 1",
  "health": "Health",
  "journalism": "Journalism",
  "music-theory": "Music Theory",
  "psychology": "Psychology",
  "sat-math": "SAT Math Prep",
  "sat-reading": "SAT Reading & Writing",
  "sociology": "Sociology",
  "spanish-1": "Spanish 1",
  "spanish-2": "Spanish 2",
  "spanish-3": "Spanish 3",
  "speech-debate": "Speech & Debate",
  "statistics": "Statistics",
  "study-skills": "Study Skills",
  "us-government": "US Government",
  "world-history": "World History",
  "calculus": "Calculus",
  "calc-ab": "AP Calculus AB",
  "calc-bc": "AP Calculus BC"
};

export interface Preview {
  title: string;
  description: string;
  url: string;
}

const SHARE_GENERIC: Preview = {
  title: "A student's study progress — PrecisStudy",
  description: "See a student's study streak and subject readiness on PrecisStudy — free study guides, quizzes and flashcards.",
  url: `${ORIGIN}/share/`
};

const CHALLENGE_GENERIC: Preview = {
  title: "Peer Challenge — PrecisStudy",
  description: "A classmate challenged you to a head-to-head quiz on PrecisStudy. Free, no sign-up needed to look.",
  url: `${ORIGIN}/challenge`
};

const INVITE: Omit<Preview, "url"> = {
  title: "A classmate invited you to PrecisStudy",
  description: "A classmate invited you to PrecisStudy — free study guides, quizzes and flashcards, no sign-up."
};

// A student-chosen nickname is untrusted text: collapse whitespace and cap the
// length so a preview can't be stuffed with a wall of text. Angle brackets are
// dropped outright: HTMLRewriter's setAttribute escapes quotes (enough to keep
// a value inside its attribute) but leaves < and > as-is, and a nickname never
// needs them. Full escaping otherwise happens at the HTML boundary.
function clean(text: string, max: number): string {
  const t = text.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export async function sharePreview(env: Env, token: string): Promise<Preview> {
  if (!env.PROGRESS || !TOKEN_RE.test(token)) return SHARE_GENERIC;
  const email = await env.PROGRESS.get("share:" + token);
  if (!email) return SHARE_GENERIC;
  const blob = await loadBlob(env, email);
  if (blob.shareToken !== token) return SHARE_GENERIC;

  const { streak, subjects } = summarizeShare(blob);
  const parts: string[] = [];
  if (streak && streak.current > 0) parts.push(`${streak.current}-day study streak`);
  const top = subjects[0];
  if (top) {
    const overall = Math.round(subjects.reduce((s, x) => s + x.pct, 0) / subjects.length);
    parts.push(`${overall}% overall readiness`);
    parts.push(`top subject ${SUBJECT_LABELS[top.key] || top.key} at ${top.pct}%`);
  }
  return {
    title: SHARE_GENERIC.title,
    description: parts.length ? `${parts.join(" · ")}. Shared on PrecisStudy.` : SHARE_GENERIC.description,
    url: `${ORIGIN}/share/?t=${token}`
  };
}

export async function challengePreview(env: Env, code: string): Promise<Preview> {
  if (!env.PROGRESS || !CODE_RE.test(code)) return CHALLENGE_GENERIC;
  const challenge = await loadChallenge(env, code);
  if (!challenge || Date.parse(challenge.expiresAt) < Date.now()) return CHALLENGE_GENERIC;

  // Read-only on purpose (a GET must not mint a handle the way the API's
  // ensureHandle does): a creator with no handle yet is just "A classmate".
  const lb = (await loadBlob(env, challenge.creatorEmail)).leaderboard;
  const who = lb?.handle ? clean(displayNameFor(lb), 40) : "A classmate";
  const n = challenge.questionNumbers.length;
  const subject = SUBJECT_LABELS[challenge.subjectKey] || "Quiz";
  // No scores here: the creator's result is only ever hinted at, never shown,
  // and the opponent's is never mentioned at all.
  const description = challenge.creatorResult
    ? `${n} question${n === 1 ? "" : "s"}. Can you beat ${who}'s score?`
    : `${n} question${n === 1 ? "" : "s"}. ${who} challenged you to a head-to-head quiz.`;
  return {
    title: `Challenge: ${subject} quiz on PrecisStudy`,
    description,
    url: `${ORIGIN}/challenge?challenge=${code}`
  };
}

// Invites only need to know the token is real; the inviter is never looked up.
export async function invitePreview(env: Env, ref: string, pathname: string): Promise<Preview | null> {
  if (!env.PROGRESS || !TOKEN_RE.test(ref)) return null;
  if (!(await env.PROGRESS.get("invite:" + ref))) return null;
  return { ...INVITE, url: ORIGIN + pathname };
}

export async function resolvePreview(request: Request, env: Env): Promise<Preview | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/share" || path === "/share/") return sharePreview(env, url.searchParams.get("t") || "");
  if (path === "/challenge" || path === "/challenge/") return challengePreview(env, url.searchParams.get("challenge") || "");
  const ref = url.searchParams.get("ref");
  if (ref) return invitePreview(env, ref, path);
  return null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Sets every preview tag: existing ones via setAttribute, missing ones
// appended once at the end of <head>.
export function applyPreview(res: Response, p: Preview): Response {
  if (!res.headers.get("Content-Type")?.includes("text/html")) return res;
  const tags: Array<{ selector: string; attr: "name" | "property"; key: string; value: string }> = [
    { selector: 'meta[name="description"]', attr: "name", key: "description", value: p.description },
    { selector: 'meta[property="og:title"]', attr: "property", key: "og:title", value: p.title },
    { selector: 'meta[property="og:description"]', attr: "property", key: "og:description", value: p.description },
    { selector: 'meta[property="og:url"]', attr: "property", key: "og:url", value: p.url },
    { selector: 'meta[property="og:type"]', attr: "property", key: "og:type", value: "website" },
    { selector: 'meta[property="og:image"]', attr: "property", key: "og:image", value: IMAGE },
    { selector: 'meta[name="twitter:card"]', attr: "name", key: "twitter:card", value: "summary" },
    { selector: 'meta[name="twitter:title"]', attr: "name", key: "twitter:title", value: p.title },
    { selector: 'meta[name="twitter:description"]', attr: "name", key: "twitter:description", value: p.description },
    { selector: 'meta[name="twitter:image"]', attr: "name", key: "twitter:image", value: IMAGE }
  ];
  const seen = new Set<string>();
  const rewriter = new HTMLRewriter().on("title", { element(el) { el.setInnerContent(p.title); } });
  for (const t of tags) {
    rewriter.on(t.selector, {
      element(el) {
        seen.add(t.key);
        el.setAttribute("content", t.value);
      }
    });
  }
  rewriter.on("head", {
    element(el) {
      el.onEndTag(end => {
        const missing = tags
          .filter(t => !seen.has(t.key))
          .map(t => `<meta ${t.attr}="${t.key}" content="${escapeAttr(t.value)}"/>`)
          .join("");
        if (missing) end.before(missing, { html: true });
      });
    }
  });
  return rewriter.transform(res);
}

export async function withLinkPreview(res: Response, request: Request, env: Env): Promise<Response> {
  if (!res.headers.get("Content-Type")?.includes("text/html")) return res;
  const preview = await resolvePreview(request, env);
  return preview ? applyPreview(res, preview) : res;
}
