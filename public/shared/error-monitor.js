// Site-wide anonymous client-error + Core Web Vitals reporting, loaded on
// every page via one <script src="/shared/error-monitor.js" defer> tag --
// same rollout pattern as command-palette.js/high-contrast.js.
//
// Reports uncaught errors/rejections and LCP/CLS/FCP/TTFB to
// POST /api/client-log (see src/client-log-routes.ts). No cookies, no
// session/email, nothing identifying -- purely for the site owner's own
// error/perf visibility in Workers Logs. INP is skipped: a correct
// implementation needs the Event Timing API's interactionId grouping and
// careful "worst interaction so far" bookkeeping, which is easy to get
// subtly wrong from scratch; LCP/CLS/FCP/TTFB cover the common regressions
// and are safe to compute directly from PerformanceObserver entries.
//
// Wrapped defensively throughout: a bug here must never break the page or
// report itself in a loop.
(function () {
  try {
    var MAX_ERROR_REPORTS = 5;
    var errorCount = 0;
    var vitals = [];

    function post(payload) {
      try {
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          var blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon('/api/client-log', blob);
        } else {
          fetch('/api/client-log', { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () {});
        }
      } catch (e) { /* never let reporting itself throw */ }
    }

    function reportError(message, stack, filename, lineno, colno) {
      try {
        if (errorCount >= MAX_ERROR_REPORTS) return;
        errorCount++;
        post({
          kind: 'error',
          message: String(message || 'Unknown error').slice(0, 500),
          stack: stack ? String(stack).slice(0, 500) : undefined,
          url: location.href,
          line: typeof lineno === 'number' ? lineno : undefined,
          col: typeof colno === 'number' ? colno : undefined
        });
      } catch (e) { /* ignore */ }
    }

    window.addEventListener('error', function (event) {
      try {
        reportError(event.message, event.error && event.error.stack, event.filename, event.lineno, event.colno);
      } catch (e) { /* ignore */ }
    });

    window.addEventListener('unhandledrejection', function (event) {
      try {
        var reason = event.reason;
        var message = reason && reason.message ? reason.message : String(reason);
        var stack = reason && reason.stack ? reason.stack : undefined;
        reportError('Unhandled rejection: ' + message, stack);
      } catch (e) { /* ignore */ }
    });

    // --- Core Web Vitals (native PerformanceObserver, no library) ---

    function addMetric(name, value) {
      try {
        if (typeof value !== 'number' || !isFinite(value)) return;
        vitals.push({ name: name, value: Math.round(value) });
      } catch (e) { /* ignore */ }
    }

    try {
      if (typeof PerformanceObserver !== 'undefined') {
        // LCP: keep the last (largest) entry seen before the page hides.
        var lcpValue = null;
        try {
          var lcpObserver = new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            var last = entries[entries.length - 1];
            if (last) lcpValue = last.renderTime || last.loadTime || last.startTime;
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) { /* unsupported */ }

        // CLS: sum of layout-shift entries, excluding ones with recent input.
        var clsValue = 0;
        try {
          var clsObserver = new PerformanceObserver(function (list) {
            list.getEntries().forEach(function (entry) {
              if (!entry.hadRecentInput) clsValue += entry.value;
            });
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) { /* unsupported */ }

        // FCP.
        var fcpValue = null;
        try {
          var fcpObserver = new PerformanceObserver(function (list) {
            list.getEntries().forEach(function (entry) {
              if (entry.name === 'first-contentful-paint') fcpValue = entry.startTime;
            });
          });
          fcpObserver.observe({ type: 'paint', buffered: true });
        } catch (e) { /* unsupported */ }

        // TTFB via Navigation Timing Level 2.
        var ttfbValue = null;
        try {
          var navEntries = performance.getEntriesByType('navigation');
          if (navEntries && navEntries[0]) ttfbValue = navEntries[0].responseStart;
        } catch (e) { /* unsupported */ }

        var sent = false;
        function flush() {
          try {
            if (sent) return;
            if (lcpValue !== null) addMetric('LCP', lcpValue);
            if (clsValue > 0 || vitals.length) addMetric('CLS', clsValue);
            if (fcpValue !== null) addMetric('FCP', fcpValue);
            if (ttfbValue !== null) addMetric('TTFB', ttfbValue);
            if (!vitals.length) return;
            sent = true;
            post({ kind: 'vitals', url: location.href, metrics: vitals.slice(0, 10) });
          } catch (e) { /* ignore */ }
        }

        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') flush();
        });
        // Fallback for browsers/paths that don't reliably fire
        // visibilitychange (e.g. some mobile Safari navigations).
        window.addEventListener('pagehide', flush);
      }
    } catch (e) { /* ignore -- vitals collection is best-effort */ }
  } catch (e) { /* never let the monitor itself break the page */ }
})();
