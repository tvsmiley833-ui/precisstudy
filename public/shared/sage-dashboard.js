// @ts-check
// Sage's card on the dashboard: a sleepy Sage when the streak is at risk, a
// friendly nudge when no classes are picked yet, and the accessory closet
// (accessories unlock at 80% readiness in a class group; the chosen one is
// worn by Sage everywhere on the site).
import { owlSvg, OWL_CSS, ACCESSORIES, wornAccessory } from "/shared/owl.js";

const UNLOCK_PCT = 80;
const mount = document.getElementById("dash-sage");

/** @param {string} s */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render() {
  const data = /** @type {any} */ (window).__ssDashData;
  if (!mount || !data) return;
  const blob = data.blob || {};
  const readiness = data.readiness || {};

  let setupDone = !!(blob.quest && blob.quest.setupClaimed);
  try { setupDone = setupDone || localStorage.getItem("ob-done-v2") === "1"; } catch (e) {}
  /** @param {any} a */
  const unlocked = (a) => a.id === "cap" ? setupDone : (a.groups || []).some((/** @type {string} */ k) => (readiness[k] || 0) >= UNLOCK_PCT);

  const streak = blob.streak;
  const today = streak && streak.timezone ? new Intl.DateTimeFormat("en-CA", { timeZone: streak.timezone }).format(new Date()) : null;
  const atRisk = !!(streak && streak.current > 0 && today && streak.lastActiveDate !== today);
  const noClasses = !(blob.enrolledSubjects || []).length;

  const labels = data.labels || {};
  /** @type {[string, number][]} */
  const studied = Object.entries(readiness).filter(([, pct]) => typeof pct === "number");
  // The closest locked accessory: the one whose best class is nearest 80%.
  let next = null;
  for (const a of ACCESSORIES) {
    if (unlocked(a) || !a.groups) continue;
    for (const [k, pct] of studied) if (a.groups.includes(k) && (!next || pct > next.pct)) next = { acc: a, key: k, pct };
  }

  let mood = "happy", line = "Good to see you! Pick up where you left off, or try a quick quiz.", link = "";
  if (atRisk) { mood = "sleepy"; line = `Your ${streak.current}-day streak is getting sleepy. One quick quiz wakes it up!`; }
  else if (noClasses && studied.length) {
    mood = "think";
    const names = studied.map(([k]) => labels[k] || k).slice(0, 2).join(" and ");
    line = `You've been studying ${names}. Add your classes so I can plan your week around them.`;
    link = ' <a href="/settings">Add classes →</a>';
  }
  else if (noClasses) { mood = "think"; line = "Nothing picked yet. Choose your classes and I'll keep track of them for you."; link = ' <a href="/settings">Pick classes →</a>'; }
  else if (next) {
    mood = "cheer";
    line = `${labels[next.key] || next.key} is ${next.pct}% ready. ${UNLOCK_PCT - next.pct} more points unlocks my ${next.acc.label.toLowerCase()}!`;
  }

  let worn = wornAccessory();
  const wornDef = ACCESSORIES.find((a) => a.id === worn);
  if (worn && (!wornDef || !unlocked(wornDef))) worn = "";

  const closet = ACCESSORIES.map((a) => {
    const ok = unlocked(a);
    return `<button type="button" class="sage-acc${a.id === worn ? " on" : ""}" data-acc="${a.id}" ${ok ? "" : "disabled"}
      aria-pressed="${a.id === worn}" title="${esc(ok ? a.label : a.how)}">
      ${owlSvg({ mood: "idle", acc: a.id, size: 40, label: "" })}<span>${esc(ok ? a.label : "Locked")}</span></button>`;
  }).join("");

  mount.innerHTML = `<div class="sage-dash">
    <div class="sage-dash-owl">${owlSvg({ mood: /** @type {any} */ (mood), acc: worn, size: 84 })}</div>
    <div class="sage-dash-body">
      <p class="sage-dash-line"><b>Sage</b>${esc(line)}${link}</p>
      <details class="sage-closet"><summary>Sage's closet · ${ACCESSORIES.filter(unlocked).length}/${ACCESSORIES.length} unlocked</summary>
        <div class="sage-closet-grid">${closet}</div>
        <p class="sage-closet-note">Reach ${UNLOCK_PCT}% in a class to unlock its accessory. Sage wears your pick everywhere on the site.</p>
      </details>
    </div>
  </div>`;

  mount.querySelectorAll(".sage-acc:not([disabled])").forEach((b) => b.addEventListener("click", () => {
    const id = b.getAttribute("data-acc") || "";
    try { localStorage.setItem("sage-acc", id === worn ? "" : id); } catch (e) {}
    const open = /** @type {HTMLDetailsElement|null} */ (mount.querySelector(".sage-closet"))?.open;
    render();
    const d = /** @type {HTMLDetailsElement|null} */ (mount.querySelector(".sage-closet"));
    if (d && open) d.open = true;
  }));
}

const st = document.createElement("style");
st.textContent = OWL_CSS + `
.sage-dash{display:flex;gap:14px;align-items:flex-start;max-width:620px;margin:18px auto 0;text-align:left}
.sage-dash-owl{flex-shrink:0}
.sage-dash-body{flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:14px 16px}
.sage-dash-line{margin:0 0 8px;font-size:15px;line-height:1.45;color:var(--text)}
.sage-dash-line b{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:2px}
.sage-dash-line a{color:var(--accent);font-weight:700;text-decoration:none}
.sage-closet summary{cursor:pointer;font-weight:700;font-size:13.5px;color:var(--text-muted)}
.sage-closet-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.sage-acc{display:flex;flex-direction:column;align-items:center;gap:2px;width:84px;padding:6px 4px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--text);font:600 11.5px inherit;cursor:pointer}
.sage-acc.on{border-color:var(--accent);background:color-mix(in oklab,var(--accent) 12%,transparent)}
.sage-acc[disabled]{opacity:.45;cursor:not-allowed;filter:grayscale(1)}
.sage-closet-note{margin:8px 0 0;font-size:12.5px;color:var(--text-muted)}
`;
document.head.appendChild(st);

window.addEventListener("ss-dash-ready", render);
render();
