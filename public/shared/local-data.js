// Signing out on a shared (school) computer must not leave the previous student's progress behind: clear this site's saved
// progress, drafts and caches. Theme and accessibility choices are kept (they belong to the device, not the account).
window.ssClearLocalData = function () {
  try {
    var drop = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && /^(ssMastery_|ssBookmarks_|ss-quiz-run-|ss-last-|ss-unit-order-|ss-srs-|ss-visit-days|ss-mission)/.test(k)) drop.push(k);
    }
    drop.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try { if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }); } catch (e) {}
};
