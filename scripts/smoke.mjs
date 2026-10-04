// Post-deploy smoke check: node scripts/smoke.mjs [origin]
// Hits the pages and endpoints a broken deploy would take down first and fails loudly (exit 1) if any look wrong.
const origin = (process.argv[2] || "https://precisstudy.com").replace(/\/$/, "");

const checks = [
  { path: "/", status: 200, contains: "PrecisStudy" },
  { path: "/spanish-1/", status: 200, contains: "Spanish 1" },
  { path: "/algebra2/", status: 200, contains: "mjx" , optional: true },
  { path: "/dashboard/", status: 200, contains: "dashboard-app.js" },
  { path: "/settings/", status: 200, contains: "settings-app.js" },
  { path: "/offline.html", status: 200, contains: "offline" },
  { path: "/manifest.json", status: 200, json: (j) => Array.isArray(j.icons) && j.icons.length >= 3 },
  { path: "/sw.js", status: 200, header: ["cache-control", /must-revalidate|no-cache|max-age=0/] },
  { path: "/auth/me", status: 200, json: (j) => j.loggedIn === false, header: ["cache-control", /no-store/] },
  { path: "/api/progress", status: 401 },
  { path: "/shared/guide-base.css", status: 200, contains: ".unit-hd" },
  { path: "/tips/", status: 200, contains: "Study tips" },
  { path: "/tips/sohcahtoa/", status: 200, contains: "SOH-CAH-TOA" },
  { path: "/planner/", status: 200, contains: "sb-grid" },
  { path: "/sitemap.xml", status: 200, contains: "/tips/sohcahtoa/" },
  { path: "/api/profile", status: 401 },
  { path: "/api/stats", status: 401 },
  { path: "/api/sessions", status: 401 },
  { path: "/api/avatar", status: 401 },
  { path: "/shared/account-menu.js", status: 200, contains: "ss-avatar-btn" },
  { path: "/shared/plan.js", status: 200, contains: "ssPlan" },
  { path: "/shared/class-counts.json", status: 200, contains: "geometry" },
];

let failed = 0;
for (const c of checks) {
  try {
    const res = await fetch(origin + c.path, { redirect: "follow" });
    const body = await res.text();
    const problems = [];
    if (res.status !== c.status) problems.push(`status ${res.status} (wanted ${c.status})`);
    if (c.contains && !body.toLowerCase().includes(c.contains.toLowerCase()) && !c.optional) problems.push(`missing "${c.contains}"`);
    if (c.json) { try { if (!c.json(JSON.parse(body))) problems.push("unexpected JSON"); } catch (e) { problems.push("not JSON"); } }
    if (c.header && !c.header[1].test(res.headers.get(c.header[0]) || "")) problems.push(`header ${c.header[0]}: ${res.headers.get(c.header[0])}`);
    console.log(`${problems.length ? "FAIL" : "ok  "} ${c.path}${problems.length ? "  — " + problems.join("; ") : ""}`);
    if (problems.length) failed++;
  } catch (e) {
    console.log(`FAIL ${c.path}  — ${e.message}`); failed++;
  }
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nsmoke check passed");
