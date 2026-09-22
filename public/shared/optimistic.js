// Optimistic UI helper: update the UI first, then confirm with the server, and
// roll back if the request fails or the server rejects it. Plain script (no
// module syntax) so pages load it with one <script src="/shared/optimistic.js">
// tag; the Worker injects it site-wide. Exposes window.ssOptimistic.
//
//   ssOptimistic(applyFn, requestFn, revertFn)  ->  Promise<{ok, value?, error?}>
//
// Order is always: applyFn() runs synchronously, then requestFn() is awaited.
// If requestFn throws/rejects, revertFn(error) runs and the result is
// { ok: false, error }. It never rejects, so callers do not need try/catch.
// Only use it for actions the server has no reason to reject (toggles,
// preferences, opt-out); anything needing validation should show a pending
// state instead of claiming success.
// Loaded as a real ES module (see the "type=module" script tag injected by
// injectSiteWidgets in src/worker.ts), the same way test/mastery.test.js
// tests public/shared/mastery.js, so ssOptimistic/ssOptimisticFetch can be
// unit-tested with a plain `import`.
export function ssOptimistic(applyFn, requestFn, revertFn) {
  try { applyFn(); } catch (e) { return Promise.resolve({ ok: false, error: e }); }
  var started;
  try { started = Promise.resolve(requestFn()); } catch (e) { started = Promise.reject(e); }
  return started.then(
    function (value) { return { ok: true, value: value }; },
    function (error) {
      try { revertFn(error); } catch (e) { /* revert must never throw into the caller */ }
      return { ok: false, error: error };
    }
  );
}

// Wraps a fetch so a non-2xx response counts as failure (fetch alone only
// rejects on network errors). Resolves to the parsed JSON body when there is
// one. Error carries .status and a server-provided message when available.
export function ssOptimisticFetch(url, init) {
  return fetch(url, init).then(function (res) {
    return res.text().then(function (text) {
      var body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
      if (!res.ok) {
        var err = new Error((body && body.error) || "Request failed");
        err.status = res.status;
        throw err;
      }
      return body;
    });
  });
}

ssOptimistic.fetch = ssOptimisticFetch;

if (typeof window !== "undefined") {
  window.ssOptimistic = ssOptimistic;
}
