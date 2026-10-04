// Single source for the site footer. Guide pages (generate-guide.mjs) use the
// compact variant; hand-authored pages get the full one via sync-footer.mjs.
const LINKS = [
  ["/about/", "Who are we"],
  ["/request/", "Request a guide"],
  ["/educators/", "Educators"],
  ["/tips/", "Study tips"],
  ["/changelog/", "Changelog"],
  ["/privacy/", "Privacy"],
  ["/terms/", "Terms"],
  ["/parents-bill-of-rights/", "Parents' Bill of Rights"],
];
const COMPACT = new Set(["/about/", "/request/", "/tips/", "/privacy/", "/terms/"]);
const MAIL = `<a href="#" class="ss-mail-link" data-u="support" data-d="precisstudy.com">Questions or feedback? <span class="ss-mail-addr"></span></a>`;

export function siteFooter({ full }) {
  const links = LINKS.filter(([h]) => full || COMPACT.has(h))
    .map(([h, t]) => `  <a href="${h}">${t.replace("'", "&#39;")}</a>`).join("\n");
  return `<footer class="site-foot">\n${links}${full ? `\n  ${MAIL}` : ""}\n</footer>\n`;
}
