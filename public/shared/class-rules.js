// Rules for choosing classes, shared by onboarding and Settings: which classes cover the same course (picking one
// replaces another), and which classes to show first for a student's grade (grade is kept on this device only).
(function () {
  var SAME_COURSE = [
    ['calculus', 'calc-ab', 'calc-bc'], ['biology', 'apbiology'], ['chemistry', 'ap-chemistry'], ['physics', 'ap-physics'],
    ['apush', 'us-history'], ['world-history', 'ap-world', 'globalhistory'], ['statistics', 'ap-stats'], ['psychology', 'ap-psych'],
    ['us-government', 'ap-usgov'], ['english-9', 'english-10', 'aplang'], ['spanish-1', 'spanish-2', 'spanish-3'],
    ['french-1', 'french-2', 'french-3'], ['economics', 'ap-macro'], ['economics', 'ap-micro'], ['environmental-science', 'ap-environmental-science']
  ];
  var GRADES = ['9', '10', '11', '12', 'Other'];
  function getGrade() { try { return localStorage.getItem('ss-grade') || ''; } catch (e) { return ''; } }
  function setGrade(g) { try { if (g) localStorage.setItem('ss-grade', g); else localStorage.removeItem('ss-grade'); } catch (e) { /* storage blocked */ } }
  // Keys of the other classes that cover the same course as `key`.
  function sameCourseAs(key) {
    var out = [];
    SAME_COURSE.forEach(function (g) { if (g.indexOf(key) !== -1) g.forEach(function (o) { if (o !== key && out.indexOf(o) === -1) out.push(o); }); });
    return out;
  }
  // Juniors and seniors prepare for the ACT and SAT, so test-prep entries (items with cat === 'testprep') come first.
  function orderForGrade(list, grade) {
    if (grade !== '11' && grade !== '12') return list;
    return list.slice().sort(function (a, b) { return (b.cat === 'testprep') - (a.cat === 'testprep'); });
  }
  window.ssClassRules = { GRADES: GRADES, getGrade: getGrade, setGrade: setGrade, sameCourseAs: sameCourseAs, orderForGrade: orderForGrade };
})();
