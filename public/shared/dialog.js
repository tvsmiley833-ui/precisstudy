// Site-wide replacements for confirm(), alert() and prompt(): a native <dialog> (focus is trapped, Escape cancels, the
// page behind is inert) styled to match the site. Each returns a Promise, so callers write `if (!(await ssConfirm(...))) return;`.
(function () {
  if (window.ssConfirm) return;
  var css = document.createElement('style');
  css.textContent = 'dialog.ss-dlg{border:1px solid var(--border,#8a8f98);border-radius:18px;background:var(--bg-card,var(--surface,#fff));color:var(--text,var(--ink,#111));padding:24px;max-width:min(440px,calc(100vw - 32px));box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:inherit}'
    + 'dialog.ss-dlg::backdrop{background:rgba(0,0,0,.55)}'
    + '.ss-dlg p{margin:0 0 16px;font-size:15.5px;line-height:1.5}.ss-dlg input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px 12px;border-radius:12px;border:1px solid var(--border,#8a8f98);background:var(--bg,transparent);color:inherit;margin:0 0 16px}'
    + '.ss-dlg-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}'
    + '.ss-dlg button{font:inherit;font-weight:700;font-size:14.5px;min-height:44px;padding:10px 20px;border-radius:999px;cursor:pointer;border:2px solid var(--border,#8a8f98);background:transparent;color:inherit}'
    + '.ss-dlg button.ok{background:var(--accent-solid,#1f6e46);border-color:var(--accent-solid,#1f6e46);color:#fff}.ss-dlg button.danger{background:#b3362c;border-color:#b3362c;color:#fff}'
    + '.ss-dlg button:focus-visible,.ss-dlg input:focus-visible{outline:2px solid var(--accent-bright,#4fbf85);outline-offset:2px}';
  document.head.appendChild(css);
  function open(msg, o) {
    return new Promise(function (resolve) {
      var d = document.createElement('dialog'); d.className = 'ss-dlg'; d.setAttribute('aria-label', o.label || 'Please confirm');
      var p = document.createElement('p'); p.textContent = msg; d.appendChild(p);
      var inp = null;
      if (o.input) { inp = document.createElement('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', o.label || 'Answer'); d.appendChild(inp); }
      var row = document.createElement('div'); row.className = 'ss-dlg-row';
      if (!o.alert) { var c = document.createElement('button'); c.type = 'button'; c.textContent = 'Cancel'; c.onclick = function () { d.close('cancel'); }; row.appendChild(c); }
      var ok = document.createElement('button'); ok.type = 'button'; ok.className = o.danger ? 'danger' : 'ok'; ok.textContent = o.okText || 'OK';
      ok.onclick = function () { d.close('ok'); }; row.appendChild(ok); d.appendChild(row);
      d.addEventListener('close', function () { var v = d.returnValue === 'ok'; var val = inp ? inp.value : ''; d.remove(); resolve(inp ? (v ? val : null) : v); });
      if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); d.close('ok'); } });
      document.body.appendChild(d); d.showModal(); (inp || (o.alert ? ok : row.firstChild)).focus();
    });
  }
  window.ssConfirm = function (msg, o) { return open(msg, Object.assign({ okText: 'Yes, continue' }, o || {})); };
  window.ssAlert = function (msg) { return open(msg, { alert: true, label: 'Notice' }); };
  window.ssPrompt = function (msg, o) { return open(msg, Object.assign({ input: true, okText: 'Confirm', danger: true }, o || {})); };
})();
