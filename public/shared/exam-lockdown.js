// Exam-condition lockdown mode: an OPT-IN, entirely client-side simulation
// of exam-day focus conditions for the site's existing timed practice exam.
//
// This is self-reported, for the student's own benefit only:
//   - no video/audio/camera/microphone access of any kind
//   - nothing is recorded
//   - nothing about the student's behavior is ever sent to a server
//   - all counts live only in memory for the current exam session and are
//     discarded on exitLockdown()/refresh, same as the exam's own timers
//     and scores (see the comment above `examTimers` in shared/guide-app.js)
//
// It detects (1) leaving the tab/window (Page Visibility API), (2) the
// window losing focus, and (3) exiting fullscreen -- and shows the student a
// small on-screen notice each time, plus a final tally. It is NOT an
// anti-cheat or surveillance system: there is no scoring, flagging, or
// reporting of this data anywhere.

let state = null;

function now() {
  return Date.now();
}

/**
 * Enter exam-condition lockdown mode. Requests fullscreen (best-effort --
 * degrades gracefully to tab/blur detection only if fullscreen is blocked,
 * denied, or unsupported, e.g. some iOS Safari contexts) and starts
 * listening for the student leaving the exam view.
 *
 * @param {Function} onWarn - called (no args) each time the student leaves,
 *   so the exam UI can show a brief on-screen notice.
 */
export function enterLockdown(onWarn) {
  try {
    if (state) exitLockdown(); // defensive: never double-attach listeners

    state = {
      exitCount: 0,
      totalTimeAwayMs: 0,
      awaySince: null,
      fullscreenActive: false,
      listeners: [],
    };
    const warn = typeof onWarn === "function" ? onWarn : function () {};

    const markAway = () => {
      if (!state || state.awaySince) return; // already mid-departure
      state.awaySince = now();
      state.exitCount++;
      try { warn(); } catch (e) {}
    };
    const markBack = () => {
      if (!state || !state.awaySince) return;
      state.totalTimeAwayMs += now() - state.awaySince;
      state.awaySince = null;
    };

    const onVisibility = () => { if (document.hidden) markAway(); else markBack(); };
    const onBlur = () => markAway();
    const onFocus = () => markBack();
    const onFullscreenChange = () => {
      const fsActive = !!document.fullscreenElement;
      if (state.fullscreenActive && !fsActive) markAway();
      state.fullscreenActive = fsActive;
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    state.listeners = [
      ["visibilitychange", onVisibility, document],
      ["blur", onBlur, window],
      ["focus", onFocus, window],
      ["fullscreenchange", onFullscreenChange, document],
    ];

    // Fullscreen is best-effort: some browsers/contexts (e.g. certain iOS
    // Safari embeds) reject or simply lack requestFullscreen. Either way we
    // still proceed with tab-switch/blur detection rather than blocking the
    // whole feature.
    try {
      const el = document.documentElement;
      if (el && typeof el.requestFullscreen === "function") {
        Promise.resolve(el.requestFullscreen())
          .then(() => { if (state) state.fullscreenActive = true; })
          .catch(() => {});
      }
    } catch (e) {}
  } catch (e) {
    // A lockdown/monitoring script must never itself break the exam.
  }
}

/**
 * Exit lockdown mode: removes all listeners, exits fullscreen if still
 * active, and returns the final self-reported summary.
 * @returns {{exitCount:number, totalTimeAwayMs:number}}
 */
export function exitLockdown() {
  const summary = { exitCount: 0, totalTimeAwayMs: 0 };
  try {
    if (!state) return summary;
    if (state.awaySince) {
      state.totalTimeAwayMs += now() - state.awaySince;
      state.awaySince = null;
    }
    (state.listeners || []).forEach(([type, fn, target]) => {
      try { target.removeEventListener(type, fn); } catch (e) {}
    });
    summary.exitCount = state.exitCount;
    summary.totalTimeAwayMs = state.totalTimeAwayMs;
    try {
      if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
        Promise.resolve(document.exitFullscreen()).catch(() => {});
      }
    } catch (e) {}
  } catch (e) {
  } finally {
    state = null;
  }
  return summary;
}

/**
 * Live in-progress counts, for an optional on-screen indicator while the
 * exam is still running.
 * @returns {{exitCount:number, totalTimeAwayMs:number, active:boolean}}
 */
export function getLockdownSummary() {
  try {
    if (!state) return { exitCount: 0, totalTimeAwayMs: 0, active: false };
    const inProgress = state.awaySince ? now() - state.awaySince : 0;
    return {
      exitCount: state.exitCount,
      totalTimeAwayMs: state.totalTimeAwayMs + inProgress,
      active: true,
    };
  } catch (e) {
    return { exitCount: 0, totalTimeAwayMs: 0, active: false };
  }
}
