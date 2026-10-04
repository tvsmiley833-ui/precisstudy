// The mission banner is part of the first paint: the Worker writes its markup into the page, so it never pushes content down
// after load (a ~40px layout shift on every guide). The tiny head script hides it before paint for visitors who dismissed it.
export const MISSION_BANNER_HTML =
  '<div id="mb-bar" role="note"><span>PrecisStudy is 100% free, always \u2014 no paywalls. Signing in is optional and just syncs your progress. <a href="/about">Our mission</a></span>' +
  '<button id="mb-close" type="button" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>';
export const MISSION_BANNER_HEAD =
  "<style>#mb-bar{position:relative;z-index:9997;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:9px 40px 9px 16px;font-family:inherit;font-size:13px;line-height:21px;font-weight:600;text-align:center;background:var(--accent-solid,#1f7a4d);color:#fff}" +
  "#mb-bar a{color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap}#mb-close{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#fff;opacity:.8;cursor:pointer;width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;line-height:0;border-radius:6px}" +
  "#mb-close:hover{opacity:1}#mb-close svg{width:14px;height:14px;display:block}@media(max-width:520px){#mb-bar{font-size:12.5px;padding:8px 36px 8px 12px}}html[data-mb=off] #mb-bar{display:none}</style>" +
  "<script>try{if(localStorage.getItem('ss-mission-banner-dismissed')==='1')document.documentElement.setAttribute('data-mb','off')}catch(e){}</script>";

