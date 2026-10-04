// Phone menu for the shared site header on secondary pages (About, Dashboard,
// Settings, …). The header markup itself is static in each page; this only
// opens/closes (styles live in /shared/site-header.css), #ss-mobile-menu from
// #ss-menu-btn (Escape, outside click and link clicks close it).
(function () {
  document.querySelectorAll(".ss-mail-link").forEach(function (el) {
    var addr = el.dataset.u + "@" + el.dataset.d;
    el.href = "mailto:" + addr;
    var span = el.querySelector(".ss-mail-addr");
    if (span) span.textContent = addr;
  });
  var btn = document.getElementById("ss-menu-btn");
  var menu = document.getElementById("ss-mobile-menu");
  if (!btn || !menu) return;


  function setOpen(open) {
    menu.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!menu.classList.contains("open"));
  });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", function (e) {
    if (menu.classList.contains("open") && !menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("open")) { setOpen(false); btn.focus(); }
  });
})();
