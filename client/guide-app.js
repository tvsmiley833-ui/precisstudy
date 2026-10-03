// Shared study-guide app logic, loaded by every public/<slug>/index.html
// after its inline data script, which defines UNITS, QUIZ, FLASHCARDS,
// WORKED, HARD_Q, the exam parts, EXAM_META, EXAM_CSS and
// SS_GUIDE = { slug, key, title } (key is the saved-progress id; a few
// legacy guides use a slug without dashes, e.g. ap-lang -> aplang).
// Classic (non-module) script on purpose: the page's inline handlers call
// these functions as globals.
// Some subjects' quiz content was authored with the correct answer always
// (or almost always) listed first -- shuffles q.o once per question instance
// (guarded by q._shuffled so repeats/requeues of the same question keep a
// stable order) and remaps q.a to match, so every caller that already
// compares against q.a (ansQ, ansExam, the mistake log, printWorksheet's
// answer key) keeps working unchanged.
// Options and figures can be inline SVG diagrams (role="img" + aria-label).
// Anywhere an option is shown or sent as plain text, use its label instead.
function ssPlain(s){
  if(typeof s!=='string')return s;
  if(/^\s*<svg/.test(s)){var m=s.match(/aria-label="([^"]*)"/);if(m)return m[1];}
  return s.replace(/<[^>]+>/g,'');
}
function ssShuffleOptions(q){
  if(!q||!q.o||q.o.length<2||q._shuffled)return;
  const orig=q.o.slice();
  const order=orig.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const t=order[i];order[i]=order[j];order[j]=t;
  }
  q.o=order.map(i=>orig[i]);
  if(typeof q.a==='number')q.a=order.indexOf(q.a);
  q._shuffled=true;
}
var ssQuickRebuilt=false;
function switchTab(id){if(id==='quiz'&&!ssQuickRebuilt){ssQuickRebuilt=true;const s=document.getElementById('q-sel');if(s&&s.value==='quick'&&!ssQuizTouched&&typeof loadQ==='function')loadQ();}if(id!=='exam'&&typeof ssLockdownActive!=='undefined'&&ssLockdownActive)ssEndExamLockdown();document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const tabs=document.querySelectorAll('.tab-btn');tabs.forEach(b=>b.classList.remove('active'));document.getElementById('view-'+id).classList.add('active');var idx=-1;tabs.forEach((b,i)=>{if(b.id==='tab-'+id)idx=i;});if(idx!==-1){tabs.forEach((b,i)=>{var on=i===idx;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;});try{tabs[idx].scrollIntoView({inline:'center',block:'nearest',behavior:ssScrollBehavior()});}catch(e){}var _hl=document.getElementById('hero-live');if(_hl)_hl.textContent=tabs[idx].textContent.trim()+' tab';}if(id==='examples'&&!examplesBuilt)buildExamples();if(id==='exam'&&!examBuilt)buildExam();}
let examBuilt=false;
var examplesBuilt=false, ex2map={}, ex2shown={};

function buildExam(){
examBuilt=true;
const v=document.getElementById('view-exam');
// inject CSS
const st=document.createElement('style');st.textContent=EXAM_CSS;document.head.appendChild(st);

v.innerHTML=`
<div class="ex-header">
  <h2>${EXAM_META.title}</h2>
  <p>${EXAM_META.subtitle}</p>
</div>
<div class="ex-lockdown-bar" id="ex-lockdown-bar">
  <div class="ex-lockdown-start-row" id="ex-lockdown-start-row">
    <label class="ex-lockdown-label"><input type="checkbox" id="ex-lockdown-toggle"> Exam-condition mode (fullscreen + tracks time away from the exam — for your eyes only; nothing is recorded or sent anywhere)</label>
    <button type="button" class="btn" onclick="ssStartExamLockdown()">Start Exam</button>
  </div>
  <button type="button" class="btn ex-lockdown-end-btn" id="ex-lockdown-end-btn" style="display:none" onclick="ssEndExamLockdown()">End Exam &amp; Show Focus Summary</button>
</div>
<div class="ex-lockdown-warn" id="ex-lockdown-warn" style="display:none" role="status" aria-live="polite"></div>
<div class="ex-lockdown-summary" id="ex-lockdown-summary" style="display:none"></div>
<div id="ex-score-box" class="ex-score" role="status"></div>
<div id="ex-live" class="sr-only" role="status" aria-live="polite"></div>
${buildPartMC('A',PART_A)}
${buildPartMC('B1',PART_B1)}
${buildPartFR('B2',PART_B2)}
${buildPartFR('C',PART_C)}
`;
// open Part A by default
togglePart('A');
ssTypeset(v);
}

// Exam-condition lockdown mode: purely opt-in UX layered on top of the
// existing exam feature above. See public/shared/exam-lockdown.js for what
// is (and, importantly, is NOT) tracked -- no video/audio/camera/microphone,
// nothing recorded, nothing ever sent to a server. `ssLockdownActive` only
// gates whether ssEndExamLockdown() has anything to tear down; a student who
// never checks the box can still take the exam exactly as before.
var ssLockdownActive=false;
function ssLockdownWarn(){
  var box=document.getElementById('ex-lockdown-warn');
  if(!box)return;
  box.textContent='You left the exam — this will show in your summary at the end.';
  box.style.display='block';
  clearTimeout(ssLockdownWarn._t);
  ssLockdownWarn._t=setTimeout(function(){box.style.display='none';},4000);
}
function ssStartExamLockdown(){
  var cb=document.getElementById('ex-lockdown-toggle');
  var wantLockdown=!!(cb&&cb.checked);
  ssLockdownActive=wantLockdown;
  if(wantLockdown&&window.__ssEnterLockdown)window.__ssEnterLockdown(ssLockdownWarn);
  var startRow=document.getElementById('ex-lockdown-start-row');
  var endBtn=document.getElementById('ex-lockdown-end-btn');
  if(wantLockdown&&!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)){
    // e.g. iPhone Safari: no fullscreen, so only leaving the tab or window can be noticed
    var w=document.getElementById('ex-lockdown-warn');
    if(w){w.textContent='Fullscreen isn\u2019t available on this device, so only switching tabs or apps will be counted.';w.style.display='block';}
  }
  if(startRow)startRow.style.display='none';
  if(endBtn)endBtn.style.display=wantLockdown?'':'none';
}
function ssEndExamLockdown(){
  var summary={exitCount:0,totalTimeAwayMs:0};
  if(ssLockdownActive&&window.__ssExitLockdown)summary=window.__ssExitLockdown();
  ssLockdownActive=false;
  var out=document.getElementById('ex-lockdown-summary');
  if(out){
    var secs=Math.round((summary.totalTimeAwayMs||0)/1000);
    out.style.display='block';out.tabIndex=-1;out.setAttribute('role','status');
    out.innerHTML='<strong>Focus Summary</strong><span>You left the exam view '+(summary.exitCount||0)+' time'+(summary.exitCount===1?'':'s')+', totaling '+secs+' second'+(secs===1?'':'s')+'.</span>';
  }
  var endBtn=document.getElementById('ex-lockdown-end-btn');
  if(endBtn)endBtn.style.display='none';
  var sr=document.getElementById('ex-lockdown-start-row');
  if(sr)sr.style.display=''; // so the exam can be retaken
  if(out&&out.style.display==='block')try{out.focus({preventScroll:false});}catch(e){}
  var warn=document.getElementById('ex-lockdown-warn');
  if(warn)warn.style.display='none';
}

function examPartMeta(id){return (EXAM_META&&EXAM_META.parts&&EXAM_META.parts['PART_'+id])||{};}
function exTimerHtml(id){return examPartMeta(id).minutes?`<span class="ex-timer" id="timer-${id}"></span>`:'';}

function buildPartMC(id,qs){
if(!qs.length)return'';
const meta=examPartMeta(id);
qs.forEach(ssShuffleOptions);
const items=qs.map(q=>`
<div class="ex-q" id="exq-${id}-${q.n}">
  <div class="ex-qnum">Question ${q.n}</div>
  <div class="ex-qtext">${ssFixLt(q.q)}</div>
  <div class="ex-opts">
    ${q.o.map((opt,i)=>`<button class="ex-opt" onclick="ansExam('${id}',${q.n},${i},${q.a})">(${i+1}) ${ssFixLt(opt)}</button>`).join('')}
  </div>
  <div class="ex-exp" id="exp-${id}-${q.n}">${ssFixLt(q.e)}</div>
</div>`).join('');
return `<div class="ex-part" id="ex-part-${id}">
<div class="ex-part-hd" onclick="togglePart('${id}')">
  <h3><span class="ex-part-btn" tabindex="0" role="button" aria-expanded="false" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();togglePart('${id}')}">${meta.title||('Part '+id)} (${qs.length} question${qs.length===1?'':'s'}, 1 pt each)</span></h3>
  <div class="ex-part-hd-meta"><span id="score-${id}">Score: 0 / ${qs.length}</span>${exTimerHtml(id)}</div>
</div>
<div class="ex-part-body">${items}</div></div>`;
}

function buildPartFR(id,qs){
if(!qs.length)return'';
// Some guides author these as genuine free-response (q.sa, a model answer to
// reveal); others reuse the multiple-choice shape (q.o/q.a) for this part.
// Render whichever shape the data actually has instead of assuming sa exists.
const meta=examPartMeta(id);
qs.forEach(function(q){if(q.sa===undefined)ssShuffleOptions(q);});
const items=qs.map(q=>q.sa!==undefined?`
<div class="ex-q">
  <div class="ex-qnum">Question ${q.n}</div>
  <div class="ex-qtext">${ssFixLt(q.q)}</div>
  <button class="ex-opt" style="background:var(--surface-2);text-align:left" onclick="toggleSA(this)">▶ Show Model Answer</button>
  <div class="ex-sa" style="display:none"><strong>Model Answer</strong>${q.sa.replace(/\n/g,'<br>')}</div>
</div>`:`
<div class="ex-q" id="exq-${id}-${q.n}">
  <div class="ex-qnum">Question ${q.n}</div>
  <div class="ex-qtext">${ssFixLt(q.q)}</div>
  <div class="ex-opts">
    ${q.o.map((opt,i)=>`<button class="ex-opt" onclick="ansExam('${id}',${q.n},${i},${q.a})">(${i+1}) ${ssFixLt(opt)}</button>`).join('')}
  </div>
  <div class="ex-exp" id="exp-${id}-${q.n}">${ssFixLt(q.e)}</div>
</div>`).join('');
const allMC=qs.every(q=>q.sa===undefined);
const rightMeta=allMC?`<span id="score-${id}">Score: 0 / ${qs.length}</span>`:`<span style="font-size:18px;color:var(--ink-dim)">Click to show model answers</span>`;
return `<div class="ex-part" id="ex-part-${id}">
<div class="ex-part-hd" onclick="togglePart('${id}')">
  <h3><span class="ex-part-btn" tabindex="0" role="button" aria-expanded="false" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();togglePart('${id}')}">${meta.title||('Part '+id)} (${qs.length} question${qs.length===1?'':'s'})</span></h3>
  <div class="ex-part-hd-meta">${rightMeta}${exTimerHtml(id)}</div>
</div>
<div class="ex-part-body">${items}</div></div>`;
}

/* Per-part countdown timer. In-memory only (module-level `examTimers`) — a
   refresh resets it, matching the fact that exam progress/scores are never
   persisted to localStorage either. Not a proctored test: hitting zero just
   shows "Time's up" and stops, it never auto-submits or locks the part. */
var examTimers={};
// Per-part running score and per-question answered flags, both keyed by
// part id -- read/written by ansExam(). In-memory only, same as the timers.
var examScores={};
var examAnswered={};
// Per-unit exam correctness, keyed by unit id — populated only for guides
// whose exam questions carry a `u` field (see examRecordUnit()/ansExam()).
// In-memory only, matching the fact that exam progress is never persisted.
var examUnitStats={};
function examRecordUnit(q,correct){
  if(!q||q.u===undefined)return;
  var s=examUnitStats[q.u]||(examUnitStats[q.u]={correct:0,total:0});
  s.total++;
  if(correct)s.correct++;
  renderUnitProgress(q.u);
}
function startPartTimer(id){
  const meta=examPartMeta(id);
  if(!meta.minutes)return;
  let t=examTimers[id];
  if(!t){t=examTimers[id]={remaining:meta.minutes*60,expired:false,intervalId:null};}
  if(t.expired||t.intervalId)return; // already ticking, or already ran out
  t.intervalId=setInterval(function(){
    if(document.hidden)return; // a tab left in the background must not burn the student's time
    t.remaining--;
    if(t.remaining<=0){
      t.remaining=0;t.expired=true;
      clearInterval(t.intervalId);t.intervalId=null;
    }
    ssExamTimerSay(id,t);
    renderPartTimer(id);
  },1000);
  renderPartTimer(id);
}
// Screen readers hear the clock only at the moments that matter, not every second.
function ssExamTimerSay(id,t){
  const live=document.getElementById('ex-live');
  if(!live)return;
  const label=(examPartMeta(id).title||('Part '+id));
  if(t.expired)live.textContent=label+': time is up.';
  else if(t.remaining===300)live.textContent=label+': 5 minutes left.';
  else if(t.remaining===60)live.textContent=label+': 1 minute left.';
}
// Running total across every part, shown in #ex-score-box as questions are answered.
function ssExamUpdateTotal(){
  const box=document.getElementById('ex-score-box');
  if(!box)return;
  const pools={A:PART_A,B1:PART_B1};
  let right=0,done=0,total=0;
  Object.keys(pools).forEach(function(k){
    total+=pools[k].length;right+=examScores[k]||0;
    done+=Object.keys(examAnswered[k]||{}).length;
  });
  if(!done){box.textContent='';return;}
  const pct=Math.round(right/done*100);
  box.textContent='Multiple choice so far: '+right+' of '+done+' answered correct ('+pct+'%), '+(total-done)+' not yet answered.';
}
function renderPartTimer(id){
  const el=document.getElementById('timer-'+id);
  const t=examTimers[id];
  if(!el||!t)return;
  if(t.expired){el.textContent="Time's up";el.classList.add('ex-timer-up');return;}
  const m=Math.floor(t.remaining/60),s=t.remaining%60;
  el.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

function togglePart(id){
  const part=document.getElementById('ex-part-'+id);
  const isOpen=part.classList.toggle('open');
  const hd=part.querySelector('.ex-part-btn');
  if(hd)hd.setAttribute('aria-expanded',isOpen?'true':'false');
  if(isOpen)startPartTimer(id);
}

function toggleSA(btn){
const sa=btn.nextElementSibling;
const show=sa.style.display==='none';
sa.style.display=show?'block':'none';
btn.textContent=(show?'▼ Hide':'▶ Show')+' Model Answer';
}

function ansExam(part,qn,chosen,correct){
const opts=document.querySelectorAll(`#exq-${part}-${qn} .ex-opt`);
if(opts[0].disabled)return;
opts.forEach((b,i)=>{b.disabled=true;if(i===correct)b.classList.add('correct');else if(i===chosen)b.classList.add('wrong');});
document.getElementById(`exp-${part}-${qn}`).classList.add('show');
if(!examAnswered[part])examAnswered[part]={};
if(!examAnswered[part][qn]){
examAnswered[part][qn]=true;
if(chosen===correct){examScores[part]=(examScores[part]||0)+1;}
}
const pool={A:PART_A,B1:PART_B1,B2:PART_B2,C:PART_C}[part];
const scoreEl=document.getElementById('score-'+part);
if(scoreEl)scoreEl.textContent=`Score: ${examScores[part]||0} / ${pool.length}`;
examRecordUnit(pool.find(function(x){return x.n===qn;}),chosen===correct);
ssExamUpdateTotal();
}


// Re-typeset $...$ / $$...$$ math in freshly injected DOM. Guides in algebra, precalculus, physics, chemistry and
// statistics use LaTeX in quiz options, explanations, flashcards, worked steps and the exam, so every place that
// writes content after page load must call this (the startup pass only covers what is already in the page).
function ssTypeset(el){
  if(window.MathJax&&window.MathJax.typesetPromise){
    try{return window.MathJax.typesetPromise(el?[el]:undefined);}catch(e){}
  }
}

// GUIDE
const SEARCH_BADGE={concept:'Notes',flashcard:'Flashcard',quiz:'Quiz'};
function searchGuide(){
  const q=(document.getElementById('search-box').value||'').toLowerCase().trim();
  const sr=document.getElementById('search-results');
  document.querySelectorAll('.unit').forEach(u=>u.style.display='');
  document.getElementById('filter-row').style.display='';
  var _hl=document.getElementById('hero-live');
  if(!q){sr.classList.remove('show');sr.style.display='none';if(_hl)_hl.textContent='';return;}
  const matches=[];
  UNITS.forEach(u=>{
    u.concepts.forEach((c,ci)=>{
      const text=(c.l+' '+(c.intro||'')+' '+(c.b||[]).join(' ')).toLowerCase();
      if(text.includes(q))matches.push({type:'concept',unit:u.id,unitName:u.name,concept:c.l,preview:(c.intro||c.b?.[0]||'').slice(0,120),conceptIdx:ci});
    });
    if(u.fms) u.fms.forEach(f=>{if(f.toLowerCase().includes(q))matches.push({type:'concept',unit:u.id,unitName:u.name,concept:'Formula',preview:f,isFormula:true});});
  });
  const unitName=id=>{const u=UNITS.find(x=>x.id===id);return u?u.name:'Unit '+id;};
  (typeof FLASHCARDS!=='undefined'?FLASHCARDS:[]).forEach(f=>{
    const text=(f.t+' '+f.d).toLowerCase();
    if(text.includes(q))matches.push({type:'flashcard',unit:f.u,unitName:unitName(f.u),concept:f.t,preview:f.d.slice(0,120)});
  });
  (typeof QUIZ!=='undefined'?QUIZ:[]).forEach(qq=>{
    const text=(qq.q+' '+(qq.o||[]).join(' ')).toLowerCase();
    if(text.includes(q))matches.push({type:'quiz',unit:qq.u,unitName:unitName(qq.u),concept:'Quiz question',preview:qq.q.slice(0,120)});
  });
  if(!matches.length){sr.style.display='block';sr.classList.add('show');const qEsc=q.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));sr.innerHTML='<div style="color:var(--ink-muted);font-size:14px;padding:8px">No results for "'+qEsc+'"</div>';if(_hl)_hl.textContent='No results for '+q;return;}
  sr.style.display='block';sr.classList.add('show');
  if(_hl)_hl.textContent=matches.length+' result'+(matches.length===1?'':'s')+' for '+q;
  const jump=m=>m.type==='concept'?`jumpToUnit(${m.unit},${m.conceptIdx!==undefined?m.conceptIdx:'null'},${!!m.isFormula})`:m.type==='flashcard'?`jumpToFlashcardUnit(${m.unit})`:`jumpToQuizUnit(${m.unit})`;
  sr.innerHTML='<div style="font-size:13px;color:var(--ink-muted);margin-bottom:6px">'+matches.length+' result(s)</div>'+
    matches.slice(0,12).map(m=>`<button type="button" onclick="${jump(m)}" style="display:block;width:100%;text-align:left;font-family:inherit;padding:8px 12px;background:var(--surface);color:inherit;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:5px;cursor:pointer;">
      <span style="font-size:12px;font-weight:700;color:var(--ink-muted);text-transform:uppercase">${SEARCH_BADGE[m.type]} · Unit ${m.unit}: ${m.unitName}</span>
      <div style="font-size:14px;font-weight:700;color:var(--ink);margin:2px 0">${m.concept}</div>
      <div style="font-size:13px;color:var(--ink-dim)">${m.preview}…</div>
    </button>`).join('');
}
function clearSearch(){document.getElementById('search-box').value='';searchGuide();}
document.addEventListener('keydown',function(e){
  if(e.key!=='/')return;
  var el=document.activeElement;
  var tag=(el&&el.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||(el&&el.isContentEditable))return;
  var box=document.getElementById('search-box');
  if(box){e.preventDefault();box.focus();}
});
/* Spacebar: flip the current flashcard whenever the Flashcards tab is the
   active view — not just when the card itself has focus (the scene element
   already handles Space/Enter locally via its own onkeydown in
   page-views.template.html; this is the page-level, more-discoverable
   version of the same action). Uses the exact activeElement/tag guard as
   the "/" search shortcut above so it never hijacks typing. Also skips
   BUTTON/A and the scene itself so a Space that's about to natively
   activate a focused button (e.g. "Know it") or that the scene's own inline
   handler will already process isn't double-handled. */
document.addEventListener('keydown',function(e){
  if(e.key!==' ')return;
  var el=document.activeElement;
  var tag=(el&&el.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||(el&&el.isContentEditable))return;
  if(tag==='BUTTON'||tag==='A'||(el&&el.id==='scene'))return;
  var vc=document.getElementById('view-cards');
  if(vc&&vc.classList.contains('active')){e.preventDefault();flip();}
});
/* Flashcards tab: left/right move between cards, 1 = known, 2 = still learning. Only acts while focus is on the card, the page or
   the card controls (never in the deck picker, the typing box or any dialog), and ignores modifier keys. */
document.addEventListener('keydown',function(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  var vc=document.getElementById('view-cards');
  if(!vc||!vc.classList.contains('active'))return;
  var el=document.activeElement;
  var tag=(el&&el.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(el&&el.isContentEditable))return;
  if(el&&el!==document.body&&!vc.contains(el))return;
  if(typeof fcMode!=='undefined'&&fcMode==='type')return;
  if(e.key==='ArrowRight'){e.preventDefault();fcNav(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();fcNav(-1);}
  else if(e.key==='1'){e.preventDefault();rateFC('known');}
  else if(e.key==='2'){e.preventDefault();rateFC('learning');}
});
/* "?" opens the keyboard-shortcuts reference modal. Same guard as above. */
document.addEventListener('keydown',function(e){
  if(e.key!=='?')return;
  var el=document.activeElement;
  var tag=(el&&el.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||(el&&el.isContentEditable))return;
  e.preventDefault();
  shortcutsModalToggle();
});
function jumpToFlashcardUnit(id){
  clearSearch();
  switchTab('cards');
  const sel=document.getElementById('fc-sel');
  if(sel){sel.value=id;loadFC();}
}
async function jumpToQuizUnit(id){
  clearSearch();
  await ssQuizTabClick();
  if(!SS_SESSION)return;
  const sel=document.getElementById('q-sel');
  if(sel){sel.value=id;loadQ();}
}
// Smooth scrolling unless the student has asked their device for reduced motion (CSS alone can't
// override an explicit scroll behavior passed from script).
// Guide text is inserted as HTML, so a literal "<" followed by a letter (ArrayList<Integer>, i<arr.length) would be
// parsed as a tag and vanish. Escape any "<" that does not start one of the tags the content really uses.
function ssFixLt(s){return String(s==null?'':s).replace(/<(?!\/?(?:b|i|em|strong|sup|sub|br|code|span|u|small|a|p|ul|li|ol|div|table|tr|td|th|thead|tbody|pre|mark|kbd|abbr|hr|img|svg|path|g|circle|line|rect|text|tspan|polygon|polyline|ellipse|defs|marker|style|h3|h4|details|summary|figure|figcaption)(?=[\s/>]))(?=[A-Za-z])/gi,'&lt;');}
function ssScrollBehavior(){
  try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';}catch(e){return 'smooth';}
}
// Same as generate-guide.mjs labelSvg(): a caption-based description for an SVG diagram.
function ssLabelSvg(svg,cap){
  if(/^\s*<svg\b[^>]*\brole=/.test(svg))return svg;
  const text=String(cap||'Diagram').replace(/<[^>]+>/g,' ').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&')
    .replace(/\s+/g,' ').trim().replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  return svg.replace(/^(\s*)<svg\b/,function(m,ws){return ws+'<svg role="img" aria-label="'+text+'"';});
}
// conceptIdx/isFormula (both optional) let a search result open the unit
// AND scroll straight to the matched concept or formula block inside it,
// instead of just landing on the unit header -- see searchGuide()'s jump().
function jumpToUnit(id,conceptIdx,isFormula){
  clearSearch();
  switchTab('guide');
  const el=document.querySelector(`.unit[data-id="${id}"]`);
  if(!el)return;
  const wasClosed=!el.classList.contains('open');
  el.classList.add('open');
  const title=el.querySelector('.unit-hd .unit-title');
  if(title)title.setAttribute('aria-expanded','true');
  const target=isFormula?el.querySelector('.formula')
    :(conceptIdx!=null?el.querySelector(`.concept[data-idx="${conceptIdx}"]`):null);
  if(!target){el.scrollIntoView({behavior:ssScrollBehavior(),block:'start'});return;}
  // Give the unit-body's own open animation/layout a moment to settle before
  // measuring scroll position, otherwise scrollIntoView can land short on a
  // unit that was just expanded (its height was 0 a frame ago).
  setTimeout(()=>{
    // A block taller than the viewport (e.g. a long line-by-line list) centred
    // would land mid-list, so align its top instead.
    target.scrollIntoView({behavior:ssScrollBehavior(),block:target.offsetHeight>innerHeight*.8?'start':'center'});
    target.classList.add('ss-search-hit');
    setTimeout(()=>target.classList.remove('ss-search-hit'),2200);
  },wasClosed?60:0);
}
// "Just Start" (diag-skip-btn): a student with zero background skips the diagnostic. They used to be given two fake wrong
// answers on Unit 1 so the dashboard would list the subject, which polluted every readiness figure; enrolling the subject
// (the same list the dashboard reads) does the job without inventing data.
function justStartUnit1(){
  ssEnrollInThisSubject();
  if(UNITS.length)jumpToUnit(UNITS[0].id);
}
function ssEnrollInThisSubject(){
  if(!SS_SESSION||typeof SS_GUIDE==='undefined')return;
  fetch('/api/progress').then(r=>r.ok?r.json():null).then(blob=>{
    const cur=(blob&&Array.isArray(blob.enrolledSubjects))?blob.enrolledSubjects:[];
    if(cur.indexOf(SS_GUIDE.key)>=0)return;
    return fetch('/api/enrolled-subjects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjects:cur.concat(SS_GUIDE.key)})});
  }).catch(function(){});
}

const filterTags={};
// Single source of truth for "which unit is selected", driven by either the
// desktop chip row or the mobile <select> — both call this so filtering logic
// never lives in two places.
function ssFilterByUnit(unitId){
  const all=document.getElementById('filter-row')&&document.getElementById('filter-row').children[0];
  if(all)all.classList.toggle('on',!unitId);
  Object.keys(filterTags).forEach(k=>filterTags[k].classList.toggle('on',!!unitId&&k==unitId));
  document.querySelectorAll('.unit').forEach(el=>el.style.display=(!unitId||el.dataset.id==unitId)?'':'none');
  const sel=document.getElementById('filter-select');
  if(sel&&sel.value!=String(unitId||0))sel.value=String(unitId||0);
}
function ssFilterSelectChange(){
  const sel=document.getElementById('filter-select');
  ssFilterByUnit(sel?+sel.value:0);
}
// Text-to-speech: reads a unit's concepts aloud via the browser's built-in
// Web Speech API (no TTS provider/API key needed -- distinct from
// "AI-generated audio narration", which would need one). One utterance at a
// time across the whole page; clicking the same unit's button again, or
// starting a different unit, both stop whatever is currently speaking.
const SS_TTS_SPEAKER_ICON='<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const SS_TTS_STOP_ICON='<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
let ssTtsUnitId=null;

// ----- Drag-to-reorder units: a per-guide, per-browser custom display
// order for the Study Guide tab. Purely cosmetic -- quiz/flashcard/search
// logic all key off the real unit id (UNITS array order), never DOM order,
// so a custom order can never desync progress, mastery or scoring.
const SS_UNIT_DRAG_ICON='<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>';
function ssUnitDragHandleHtml(id){
  return `<span class="unit-drag-handle" tabindex="0" role="button" aria-label="Drag to reorder this unit, or press the up/down arrow keys" onclick="event.stopPropagation()" onkeydown="ssUnitDragKeydown(event,${id})">${SS_UNIT_DRAG_ICON}</span>`;
}
function ssUnitOrderKey(){return 'ss-unit-order-'+SS_GUIDE.slug;}
function ssLoadUnitOrder(){
  try{
    const raw=localStorage.getItem(ssUnitOrderKey());
    if(!raw)return null;
    const order=JSON.parse(raw);
    return Array.isArray(order)?order:null;
  }catch(e){return null;}
}
function ssSaveUnitOrder(order){
  try{localStorage.setItem(ssUnitOrderKey(),JSON.stringify(order));}catch(e){/* private mode etc -- order just won't persist */}
}
function ssCurrentUnitOrder(){
  const ul=document.getElementById('units');
  return ul?Array.from(ul.children).map(el=>parseInt(el.dataset.id,10)):[];
}
function ssShowUnitOrderReset(){
  if(document.getElementById('unit-order-reset-btn'))return;
  const ul=document.getElementById('units');
  if(!ul||!ul.parentNode)return;
  const btn=document.createElement('button');
  btn.type='button';btn.className='unit-order-reset';btn.id='unit-order-reset-btn';
  btn.textContent='↺ Reset unit order';
  btn.onclick=()=>{try{localStorage.removeItem(ssUnitOrderKey());}catch(e){}location.reload();};
  ul.parentNode.insertBefore(btn,ul);
}
// Only reorders if the saved id set still exactly matches today's units --
// guards against a guide gaining/losing units since the order was saved.
function ssApplySavedUnitOrder(){
  const order=ssLoadUnitOrder();
  const ul=document.getElementById('units');
  if(!order||!ul)return;
  const byId={};
  Array.from(ul.children).forEach(el=>{byId[el.dataset.id]=el;});
  const current=Object.keys(byId).map(Number).sort((a,b)=>a-b);
  const saved=order.slice().sort((a,b)=>a-b);
  if(current.length!==saved.length||current.some((v,i)=>v!==saved[i]))return;
  order.forEach(id=>{const el=byId[id];if(el)ul.appendChild(el);});
  ssShowUnitOrderReset();
}
// Titles show the unit's current position ("Unit 1" after dragging Unit 11 to the
// top). Only the visible label changes: data-id, progress, mastery and quiz
// scoring keep using the real unit id.
function ssRenumberUnitTitles(){
  const ul=document.getElementById('units');
  if(!ul)return;
  Array.from(ul.children).forEach((el,i)=>{
    const title=el.querySelector('.unit-title'),t=title&&title.firstChild;
    if(t&&t.nodeType===3)t.nodeValue=t.nodeValue.replace(/^Unit \d+/,'Unit '+(i+1));
  });
}
// Native drag-and-drop only nudges the page near the edge in some browsers, so
// scroll it ourselves while a unit is held near the top or bottom of the window.
let ssDragScrollRaf=0,ssDragY=0;
function ssDragScrollTick(){
  const edge=90,max=22;
  let dy=0;
  if(ssDragY<edge)dy=-Math.ceil((edge-Math.max(ssDragY,0))/edge*max);
  else if(ssDragY>innerHeight-edge)dy=Math.ceil((ssDragY-(innerHeight-edge))/edge*max);
  if(dy)window.scrollBy({top:dy,behavior:'instant'});
  ssDragScrollRaf=requestAnimationFrame(ssDragScrollTick);
}
function ssDragScrollStart(){
  if(!ssDragScrollRaf)ssDragScrollRaf=requestAnimationFrame(ssDragScrollTick);
}
function ssDragScrollStop(){
  cancelAnimationFrame(ssDragScrollRaf);ssDragScrollRaf=0;
}
document.addEventListener('dragover',e=>{if(ssDragUnitId!=null)ssDragY=e.clientY;});
let ssDragUnitId=null;
function ssWireUnitDrag(div){
  const handle=div.querySelector('.unit-drag-handle');
  if(!handle||handle.dataset.wired)return;
  handle.dataset.wired='1';
  handle.setAttribute('draggable','true');
  handle.addEventListener('dragstart',e=>{
    ssDragUnitId=div.dataset.id;
    ssDragScrollStart();
    div.classList.add('ss-dragging');
    e.dataTransfer.effectAllowed='move';
    try{e.dataTransfer.setData('text/plain',div.dataset.id);}catch(err){}
  });
  handle.addEventListener('dragend',()=>{
    div.classList.remove('ss-dragging');
    document.querySelectorAll('.unit.ss-drop-before,.unit.ss-drop-after').forEach(el=>el.classList.remove('ss-drop-before','ss-drop-after'));
    ssDragUnitId=null;
    ssDragScrollStop();
  });
  div.addEventListener('dragover',e=>{
    if(ssDragUnitId==null||div.dataset.id===ssDragUnitId)return;
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    const rect=div.getBoundingClientRect();
    const before=(e.clientY-rect.top)<rect.height/2;
    div.classList.toggle('ss-drop-before',before);
    div.classList.toggle('ss-drop-after',!before);
  });
  div.addEventListener('dragleave',()=>div.classList.remove('ss-drop-before','ss-drop-after'));
  div.addEventListener('drop',e=>{
    e.preventDefault();
    const before=div.classList.contains('ss-drop-before');
    div.classList.remove('ss-drop-before','ss-drop-after');
    if(ssDragUnitId==null||div.dataset.id===ssDragUnitId)return;
    const dragEl=document.querySelector(`.unit[data-id="${ssDragUnitId}"]`);
    if(!dragEl)return;
    const ul=div.parentNode;
    ul.insertBefore(dragEl,before?div:div.nextSibling);
    ssRenumberUnitTitles();
    ssSaveUnitOrder(ssCurrentUnitOrder());
    ssShowUnitOrderReset();
  });
}
// Keyboard equivalent of dragging: swap this unit with its previous/next
// sibling. Needed because native HTML5 drag-and-drop has no keyboard path.
function ssUnitDragKeydown(e,id){
  if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
  e.preventDefault();
  const div=document.querySelector(`.unit[data-id="${id}"]`);
  if(!div)return;
  const sib=e.key==='ArrowUp'?div.previousElementSibling:div.nextElementSibling;
  if(!sib||!sib.classList.contains('unit'))return;
  const ul=div.parentNode;
  if(e.key==='ArrowUp')ul.insertBefore(div,sib);else ul.insertBefore(sib,div);
  ssRenumberUnitTitles();
  ssSaveUnitOrder(ssCurrentUnitOrder());
  ssShowUnitOrderReset();
  e.target.focus();
}
function ssInitUnitReorder(){
  ssApplySavedUnitOrder();
  ssRenumberUnitTitles();
  document.querySelectorAll('.unit').forEach(ssWireUnitDrag);
}
// ---- Read aloud: pick the most natural voice, turn math into words, speak in
// sentence-sized pieces (natural pauses, and Chrome cuts off very long utterances).
const SS_TTS_MATH_WORDS={sin:'sine',cos:'cosine',tan:'tangent',sec:'secant',csc:'cosecant',cot:'cotangent',log:'log',ln:'natural log',
  pm:'plus or minus',mp:'minus or plus',neq:'is not equal to',ne:'is not equal to',le:'less than or equal to',leq:'less than or equal to',
  ge:'greater than or equal to',geq:'greater than or equal to',cdot:'times',times:'times',div:'divided by',pi:'pi',theta:'theta',alpha:'alpha',
  beta:'beta',Delta:'delta',delta:'delta',sigma:'sigma',mu:'mu',lambda:'lambda',infty:'infinity',approx:'is approximately',to:'to',rightarrow:'goes to',
  angle:'angle',circ:'degrees',degree:'degrees',ldots:'and so on',dots:'and so on',in:'in',cup:'union',cap:'intersection',sum:'the sum of'};
function ssMathToSpeech(tex){
  // Binary minus first (before exponent/fraction rewriting inserts spaces that make it look unary).
  let t=tex.replace(/([\w})])\s*-\s*(?=[\w\\({])/g,'$1 minus ');
  for(let n=0;n<6;n++){
    const before=t;
    t=t.replace(/\\[td]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,' the fraction $1, over $2, ')
       .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g,function(m,n,x){return ' the '+({3:'cube',4:'fourth',5:'fifth'}[n.trim()]||n+'th')+' root of '+x+' ';})
       .replace(/\\sqrt\s*\{([^{}]*)\}/g,' the square root of $1 ')
       .replace(/\\bar\s*\{([^{}]*)\}/g,' $1 bar ')
       .replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g,' $1 ');
    if(t===before)break;
  }
  t=t.replace(/\^\s*\{?\s*2\s*\}?/g,' squared ').replace(/\^\s*\{?\s*3\s*\}?/g,' cubed ')
     .replace(/\^\s*\{\s*-\s*1\s*\}/g,' inverse ')
     .replace(/\^\s*\{([^{}]*)\}/g,' to the power of $1 ').replace(/\^\s*(\w)/g,' to the power of $1 ')
     .replace(/_\s*\{([^{}]*)\}/g,' sub $1 ').replace(/_\s*(\w)/g,' sub $1 ')
     .replace(/\\(left|right|big|Big|displaystyle)\b/g,' ')
     .replace(/\\[,;:! ]/g,' ')
     .replace(/\\([a-zA-Z]+)/g,function(m,w){return ' '+(SS_TTS_MATH_WORDS[w]||w)+' ';})
     .replace(/[{}]/g,'')
     .replace(/\s*=\s*/g,' equals ').replace(/\s*\+\s*/g,' plus ')
     .replace(/(^|[\s(,])-\s*(?=[\w(])/g,'$1negative ')
     .replace(/\s*>\s*/g,' is greater than ').replace(/\s*<\s*/g,' is less than ')
     .replace(/\s*\/\s*/g,' over ').replace(/\s*\*\s*/g,' times ');
  return t.replace(/\s+/g,' ').replace(/\s+([.,;:!?)])/g,'$1').replace(/,+$/,'').trim();
}
function ssSpeechClean(raw){
  let s=String(raw).replace(/<[^>]+>/g,' ');
  // Math spans: $$...$$ and $...$, but not money like "$50 per month plus $3".
  s=s.replace(/\$\$([^$]+)\$\$|\$([^$\n]+)\$/g,function(m,a,b){
    const body=a||b;
    if(/^\d[\d,]*(\.\d+)?\s/.test(body)&&!/[\\^_=]/.test(body))return m;
    return ' '+ssMathToSpeech(body)+' ';
  });
  s=s.replace(/&amp;|&/g,' and ').replace(/&lt;/g,' less than ').replace(/&gt;/g,' greater than ').replace(/&nbsp;/g,' ')
     .replace(/(\d)\s*%/g,'$1 percent').replace(/≠/g,' is not equal to ').replace(/≤/g,' less than or equal to ').replace(/≥/g,' greater than or equal to ')
     .replace(/√/g,' the square root of ').replace(/π/g,' pi ').replace(/[×·]/g,' times ').replace(/÷/g,' divided by ').replace(/±/g,' plus or minus ')
     .replace(/\be\.g\.,?/gi,'for example,').replace(/\bi\.e\.,?/gi,'that is,').replace(/\bvs\.?(?=\s)/gi,'versus').replace(/\betc\./gi,'and so on.')
     .replace(/\bp\.\s?(\d)/g,'page $1').replace(/\bpp\.\s?(\d)/g,'pages $1')
     .replace(/\{\s*([^|{}]+?)\s*\|\s*/g,'the set of $1 such that ').replace(/[{}]/g,'')
     .replace(/∞/g,' infinity ').replace(/→/g,' is written ').replace(/\s>\s/g,' is greater than ').replace(/\s<\s/g,' is less than ')
     .replace(/\s[—–]\s|--/g,', ').replace(/~/g,' about ').replace(/[*_`#]/g,' ').replace(/\s+/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim();
  return s;
}
// One utterance per concept title / intro / bullet, split further at sentence ends.
function ssUnitSpeechSegments(u){
  const el=document.querySelector('.unit[data-id="'+u.id+'"] .unit-title');
  const label=el&&el.firstChild&&el.firstChild.nodeType===3?el.firstChild.nodeValue.trim():('Unit '+u.id+': '+u.name);
  const raw=[label.replace(/:\s*$/,'')+'.'];
  u.concepts.forEach(function(c){
    raw.push(c.l+'.');
    if(c.intro)raw.push(c.intro);
    (c.b||[]).forEach(function(b){raw.push(b);});
  });
  const out=[];
  raw.forEach(function(r){
    const t=ssSpeechClean(r);
    if(!t)return;
    let cur='';
    t.split(/(?<=[.!?])\s+/).forEach(function(sent){
      if(cur&&(cur+' '+sent).length>220){out.push(cur);cur=sent;}else cur=cur?cur+' '+sent:sent;
    });
    if(cur)out.push(/[.!?:]$/.test(cur)?cur:cur+'.');
  });
  return out;
}
const SS_TTS_AVOID=/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|agnes|bruce|vicki|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
function ssVoiceScore(v){
  const n=v.name;let sc=0;
  if(/natural|neural/i.test(n))sc+=120;
  if(/online/i.test(n))sc+=30;
  if(/premium|enhanced/i.test(n))sc+=100;
  if(/google (us|uk) english/i.test(n))sc+=70;
  if(/\b(samantha|ava|allison|susan|zoe|evan|tom|nicky|serena|daniel|karen|moira|aria|jenny|guy|libby|sonia)\b/i.test(n))sc+=45;
  if(/compact/i.test(n))sc-=25;
  if(SS_TTS_AVOID.test(n))sc-=1000;
  if(/en[-_]US/i.test(v.lang))sc+=8;else if(/en[-_](GB|AU|CA|IE)/i.test(v.lang))sc+=4;
  if(v.default)sc+=2;
  return sc;
}
function ssEnglishVoices(){
  return (window.speechSynthesis.getVoices()||[]).filter(function(v){return /^en(-|_|$)/i.test(v.lang);});
}
function ssTtsPrefs(){
  try{return{voice:localStorage.getItem('ss-tts-voice')||'',rate:parseFloat(localStorage.getItem('ss-tts-rate'))||0.96};}
  catch(e){return{voice:'',rate:0.96};}
}
// The student's saved choice if that voice still exists on this device, else the best-scored one.
function ssPickVoice(){
  const voices=ssEnglishVoices();
  if(!voices.length)return null;
  const pref=ssTtsPrefs().voice;
  if(pref){const chosen=voices.find(function(v){return v.voiceURI===pref;});if(chosen)return chosen;}
  return voices.slice().sort(function(a,b){return ssVoiceScore(b)-ssVoiceScore(a);})[0];
}
// Voices load asynchronously (Chrome/Safari), so wait briefly for the list.
function ssVoicesReady(){
  return new Promise(function(resolve){
    const synth=window.speechSynthesis;
    if(synth.getVoices().length)return resolve();
    const done=function(){synth.removeEventListener('voiceschanged',done);resolve();};
    synth.addEventListener('voiceschanged',done);
    setTimeout(done,900);
  });
}
function ssUpdateTtsButtons(){
  document.querySelectorAll('.unit-tts-btn').forEach(function(b){
    const active=ssTtsUnitId===parseInt(b.dataset.unit,10);
    b.classList.toggle('on',active);
    b.setAttribute('aria-label',active?'Stop reading aloud':'Read this unit aloud');
    b.innerHTML=active?SS_TTS_STOP_ICON:SS_TTS_SPEAKER_ICON;
  });
}
// ---- Voice picker (Tools menu): choose a voice and speed, preview, reset to automatic.
async function ssOpenVoiceDialog(){
  if(!('speechSynthesis' in window))return;
  await ssVoicesReady();
  let dlg=document.getElementById('ss-voice-dlg');
  if(dlg)dlg.remove();
  const prefs=ssTtsPrefs();
  const usable=ssEnglishVoices().filter(function(v){return !SS_TTS_AVOID.test(v.name);}).sort(function(a,b){return ssVoiceScore(b)-ssVoiceScore(a);});
  const auto=usable.length?usable[0]:null;
  dlg=document.createElement('dialog');
  dlg.id='ss-voice-dlg';dlg.className='ss-voice-dlg';
  dlg.setAttribute('aria-labelledby','ss-voice-title');
  const opts=['<option value="">Automatic'+(auto?' (best match: '+ssEscapeText(auto.name)+')':'')+'</option>'].concat(usable.map(function(v){
    return '<option value="'+ssEscapeText(v.voiceURI)+'"'+(v.voiceURI===prefs.voice?' selected':'')+'>'+ssEscapeText(v.name)+' — '+ssEscapeText(v.lang)+(v.localService?'':' (online)')+'</option>';
  }));
  dlg.innerHTML='<form method="dialog"><h2 id="ss-voice-title">Read-aloud voice</h2>'
    +(usable.length?'<label for="ss-voice-sel">Voice</label><select id="ss-voice-sel">'+opts.join('')+'</select>'
      +'<label for="ss-voice-rate">Speed <output id="ss-voice-rate-out">'+prefs.rate.toFixed(2)+'x</output></label>'
      +'<input type="range" id="ss-voice-rate" min="0.7" max="1.3" step="0.02" value="'+prefs.rate+'">'
      :'<p>No English voices were found on this device.</p>')
    +'<p class="ss-voice-tip">Tip: newer devices include higher-quality voices. On a Mac, add an Enhanced or Premium voice in System Settings, Accessibility, Spoken Content. Microsoft Edge has built-in Natural voices.</p>'
    +'<div class="ss-voice-actions"><button type="button" id="ss-voice-prev">Preview</button><button type="button" id="ss-voice-reset">Reset</button><button value="close" class="primary">Done</button></div></form>';
  document.body.appendChild(dlg);
  const sel=dlg.querySelector('#ss-voice-sel'),rate=dlg.querySelector('#ss-voice-rate'),out=dlg.querySelector('#ss-voice-rate-out');
  const save=function(){try{localStorage.setItem('ss-tts-voice',sel.value);localStorage.setItem('ss-tts-rate',rate.value);}catch(e){/* private mode: choice lasts this page only */}};
  const preview=function(){
    const synth=window.speechSynthesis;ssTtsToken++;synth.cancel();ssTtsUnitId=null;ssUpdateTtsButtons();
    const ut=new SpeechSynthesisUtterance('This is how I will read your study guide. The square root of 16 is 4.');
    const v=ssPickVoice();if(v){ut.voice=v;ut.lang=v.lang;}
    ut.rate=ssTtsPrefs().rate;synth.speak(ut);
  };
  if(sel){
    sel.addEventListener('change',function(){save();preview();});
    rate.addEventListener('input',function(){out.textContent=parseFloat(rate.value).toFixed(2)+'x';});
    rate.addEventListener('change',function(){save();preview();});
    dlg.querySelector('#ss-voice-prev').addEventListener('click',preview);
    dlg.querySelector('#ss-voice-reset').addEventListener('click',function(){
      sel.value='';rate.value='0.96';out.textContent='0.96x';
      try{localStorage.removeItem('ss-tts-voice');localStorage.removeItem('ss-tts-rate');}catch(e){}
      preview();
    });
  }
  dlg.addEventListener('close',function(){window.speechSynthesis.cancel();dlg.remove();});
  dlg.showModal();
}
function ssEscapeText(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
let ssTtsToken=0;
async function ssReadUnitAloud(unitId){
  if(!('speechSynthesis' in window))return;
  const synth=window.speechSynthesis;
  const wasThisUnit=ssTtsUnitId===unitId;
  const token=++ssTtsToken;
  synth.cancel();
  if(wasThisUnit){ssTtsUnitId=null;ssUpdateTtsButtons();return;}
  const u=UNITS.find(function(x){return x.id===unitId;});
  if(!u)return;
  ssTtsUnitId=unitId;
  ssUpdateTtsButtons();
  await ssVoicesReady();
  if(token!==ssTtsToken)return;
  const voice=ssPickVoice(),segs=ssUnitSpeechSegments(u);
  if(!segs.length){ssTtsUnitId=null;ssUpdateTtsButtons();return;}
  const finish=function(){if(token===ssTtsToken){ssTtsUnitId=null;ssUpdateTtsButtons();}};
  segs.forEach(function(text,i){
    const ut=new SpeechSynthesisUtterance(text);
    if(voice){ut.voice=voice;ut.lang=voice.lang;}
    ut.rate=ssTtsPrefs().rate;ut.pitch=1;
    if(i===segs.length-1){ut.onend=finish;}
    ut.onerror=function(e){if(e.error!=='canceled'&&e.error!=='interrupted')finish();};
    synth.speak(ut);
  });
}
if('speechSynthesis' in window){
  window.addEventListener('beforeunload',function(){window.speechSynthesis.cancel();});
}
function buildGuide(){
  const fr=document.getElementById('filter-row');
  const ul=document.getElementById('units');
  const all=document.createElement('button');
  all.className='chip on';all.textContent='All Units';
  all.onclick=()=>ssFilterByUnit(0);
  fr.appendChild(all);
  UNITS.forEach(u=>{
    const chip=document.createElement('button');
    chip.className='chip';chip.textContent='Unit '+u.id;
    chip.onclick=()=>ssFilterByUnit(u.id);
    fr.appendChild(chip);filterTags[u.id]=chip;
    const div=document.createElement('div');div.className='unit';div.dataset.id=u.id;
    const hd=document.createElement('div');hd.className='unit-hd';
    const estMins=Math.max(5,Math.round(u.concepts.length*3+(u.traps?u.traps.length:0)*2+(u.fms?u.fms.length:0)*2));
    hd.innerHTML=`${ssUnitDragHandleHtml(u.id)}<h2 class="unit-h"><span class="unit-title">Unit ${u.id}: ${u.name}<span class="unit-meta">${u.concepts.length} concepts · ~${estMins} min</span></span></h2><span class="unit-progress" id="unit-progress-${u.id}" style="display:none"><span class="unit-progress-track"><span class="unit-progress-fill"></span></span><span class="unit-progress-label"></span></span><button type="button" class="unit-tts-btn" data-unit="${u.id}" aria-label="Read this unit aloud" onclick="event.stopPropagation();ssReadUnitAloud(${u.id})">${SS_TTS_SPEAKER_ICON}</button><span class="chevron">▾</span>`;
    ssWireUnitHeader(div,hd);
    const body=document.createElement('div');body.className='unit-body';
    u.concepts.forEach((c,ci)=>{
      const cd=document.createElement('div');cd.className='concept';cd.dataset.idx=ci;
      let h=`<h3 class="c-label">${ssFixLt(c.l)}</h3>`;
      if(c.intro)h+=`<div class="c-text">${ssFixLt(c.intro)}</div>`;
      if(c.b&&c.b.length){h+='<ul class="c-list">';c.b.forEach(item=>h+=`<li>${ssFixLt(item)}</li>`);h+='</ul>';}
      if(c.figs&&c.figs.length)c.figs.forEach(f=>{h+=`<div class="diagram c-fig"><div class="dlabel">${f.label||'Graph'}</div>${ssLabelSvg(f.svg,f.cap)}<p class="dcap">${f.cap}</p></div>`;});
      cd.innerHTML=h;body.appendChild(cd);
    });
    if(u.traps&&u.traps.length){u.traps.forEach(t=>{const td=document.createElement('div');td.className='trap';td.textContent=t;body.appendChild(td);});}
    if(u.fms&&u.fms.length){const fd=document.createElement('div');fd.className='formula';fd.innerHTML=u.fms.map(ssFixLt).join('<br>');body.appendChild(fd);}
    if(DIAGRAMS&&DIAGRAMS[u.id]){const dd=document.createElement('div');dd.className='diagram';dd.innerHTML=`<div class="dlabel">Diagram</div>${ssLabelSvg(DIAGRAMS[u.id].svg,DIAGRAMS[u.id].cap)}<p class="dcap">${DIAGRAMS[u.id].cap}</p>`;body.appendChild(dd);}
    div.appendChild(hd);div.appendChild(body);ul.appendChild(div);
  });
}
// Unit header wiring. The whole row toggles on click, but only the title is
// the keyboard/screen-reader button: the row also holds the read-aloud
// button, and a button can't contain another control (WCAG 4.1.2).
// "Check yourself": three questions from the quiz bank for this unit, added to the bottom of the unit the first
// time it is opened, so the study guide asks for recall instead of being read-only. Not scored or saved.
function ssUnitCheckPick(bank,unitId,n,rand){
  const pool=(bank||[]).filter(function(q){return q.u===unitId&&q.o&&q.o.length>1&&!q.fig;});
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));const x=pool[i];pool[i]=pool[j];pool[j]=x;}
  return pool.slice(0,n);
}
function ssUnitCheckEnsure(div){
  const body=div.querySelector('.unit-body');
  if(!body||body.querySelector('.unit-check')||typeof QUIZ==='undefined')return;
  const qs=ssUnitCheckPick(QUIZ,Number(div.dataset.id),3,Math.random);
  if(!qs.length)return;
  const wrap=document.createElement('section');
  wrap.className='unit-check';
  wrap.setAttribute('aria-label','Check yourself');
  const h=document.createElement('h3');h.className='unit-check-h';h.textContent='Check yourself';
  wrap.appendChild(h);
  qs.forEach(function(q,qi){
    const box=document.createElement('div');box.className='unit-check-q';
    const p=document.createElement('p');p.className='unit-check-text';p.textContent=(qi+1)+'. '+q.q;
    const opts=document.createElement('div');opts.className='unit-check-opts';opts.setAttribute('role','group');opts.setAttribute('aria-label','Answer choices');
    const fb=document.createElement('p');fb.className='unit-check-fb';fb.setAttribute('role','status');
    q.o.forEach(function(o,i){
      const b=document.createElement('button');b.type='button';b.className='unit-check-opt';b.textContent=o;
      b.onclick=function(){
        opts.querySelectorAll('button').forEach(function(x,xi){x.disabled=true;if(xi===q.a)x.classList.add('correct');});
        if(i!==q.a)b.classList.add('wrong');
        fb.textContent=(i===q.a?'Correct. ':'Not quite. The answer is '+q.o[q.a]+'. ')+(q.e||'');
      };
      opts.appendChild(b);
    });
    box.appendChild(p);box.appendChild(opts);box.appendChild(fb);wrap.appendChild(box);
  });
  body.appendChild(wrap);
  ssTypeset(wrap);
}
function ssWireUnitHeader(div,hd){
  const title=hd.querySelector('.unit-title')||hd;
  hd.removeAttribute('role');hd.removeAttribute('tabindex');hd.removeAttribute('aria-expanded');
  title.setAttribute('role','button');title.tabIndex=0;
  title.setAttribute('aria-expanded',div.classList.contains('open')?'true':'false');
  hd.onclick=()=>{const isOpen=div.classList.toggle('open');title.setAttribute('aria-expanded',isOpen?'true':'false');if(isOpen)ssUnitCheckEnsure(div);};
  title.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hd.click();}};
}
function hydrateGuide(){
  const fr=document.getElementById('filter-row');
  const chips=Array.from(fr.children);
  const all=chips[0];
  all.onclick=()=>ssFilterByUnit(0);
  UNITS.forEach((u,i)=>{
    const chip=chips[i+1];
    chip.onclick=()=>ssFilterByUnit(u.id);
    filterTags[u.id]=chip;
  });
  document.querySelectorAll('.unit').forEach(div=>{
    ssWireUnitHeader(div,div.querySelector('.unit-hd'));
  });
}
(function(){
  const btn=document.getElementById('back-to-top');
  if(!btn)return;
  const threshold=()=>window.innerHeight||800;
  window.addEventListener('scroll',function(){
    btn.classList.toggle('visible',window.scrollY>threshold());
  },{passive:true});
})();
if(document.getElementById('units').children.length===0){buildGuide();}else{hydrateGuide();}
ssInitUnitReorder();
ssTypeset(document.getElementById('units'));

// AI concept-breakdown highlighting: selecting any text inside the guide
// content surfaces a floating "Break this down" button that hands the
// exact selection to the existing AI helper (cbotAskAndOpen -- same
// call already used by the "explain why this wrong answer is wrong"
// button), so this needs no new backend endpoint or prompt plumbing.
(function(){
  const root=document.getElementById('units');
  if(!root)return;
  let btn=null,hideTimer=null;
  function hideBtn(){if(btn){btn.remove();btn=null;}}
  function placeBtn(){
    clearTimeout(hideTimer);
    const sel=window.getSelection();
    const text=sel&&sel.toString().trim();
    if(!text||text.length<3||text.length>400||!sel.rangeCount){hideBtn();return;}
    const anchor=sel.anchorNode;
    if(!anchor||!root.contains(anchor)){hideBtn();return;}
    const rect=sel.getRangeAt(0).getBoundingClientRect();
    if(!rect||(!rect.width&&!rect.height)){hideBtn();return;}
    hideBtn();
    btn=document.createElement('button');
    btn.type='button';
    btn.className='ss-concept-btn';
    btn.textContent='Break this down';
    btn.style.left=Math.max(8,rect.left+window.scrollX+rect.width/2)+'px';
    btn.style.top=Math.max(8,rect.top+window.scrollY-40)+'px';
    btn.onmousedown=function(e){e.preventDefault();};
    btn.onclick=function(){
      const q='Break down this concept in simple, plain-English terms, with a short example if it helps: "'+text+'"';
      const display='Break down: "'+(text.length>60?text.slice(0,60)+'…':text)+'"';
      cbotAskAndOpen(q,display);
      hideBtn();
      sel.removeAllRanges();
    };
    document.body.appendChild(btn);
  }
  document.addEventListener('selectionchange',function(){
    clearTimeout(hideTimer);
    hideTimer=setTimeout(placeBtn,150);
  });
  window.addEventListener('scroll',hideBtn,{passive:true});
  document.addEventListener('mousedown',function(e){if(btn&&e.target!==btn)hideBtn();});
})();

// Plain iterative Levenshtein (edit distance) -- O(m*n) on short
// term-length strings, cheap enough to run per keystroke-triggered check.
// Normalized to a 0-1 similarity ratio so the match threshold is
// length-independent (a 1-char typo in a 20-char term shouldn't fail the
// same threshold as a 1-char typo in a 4-char term).
function ssLevenshtein(a,b){
  const m=a.length,n=b.length;
  if(!m)return n;if(!n)return m;
  let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    const cur=[i];
    for(let j=1;j<=n;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
    }
    prev=cur;
  }
  return prev[n];
}
const FUZZY_THRESHOLD=0.82;
// Typed answers are compared without case, accents, punctuation or a trailing "(parenthetical)", and a term written
// "a / b" accepts either side. A answer that is right except for an accent counts but is flagged (accentOnly).
function ssNormTyped(s,keepAccents){
  let x=String(s).toLowerCase();
  if(!keepAccents)x=x.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return x.replace(/['\u2019`]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
}
function ssTypedCandidates(correct){
  const raw=String(correct);
  const bare=raw.replace(/\([^)]*\)/g,' ');
  const out=[raw,bare];
  bare.split('/').forEach(function(p){out.push(p);});
  return out.filter(function(x,i){return x.trim()&&out.indexOf(x)===i;});
}
function ssFuzzyMatch(typed,correct){
  const a=ssNormTyped(typed);
  if(!a)return{match:false,exact:false,ratio:0};
  let best=0,accentOnly=false;
  const lit=ssNormTyped(typed,true);
  for(const cand of ssTypedCandidates(correct)){
    const b=ssNormTyped(cand);
    if(!b)continue;
    if(a===b){
      accentOnly=lit!==ssNormTyped(cand,true);
      return{match:true,exact:!accentOnly,ratio:1,accentOnly};
    }
    const ratio=1-ssLevenshtein(a,b)/Math.max(a.length,b.length,1);
    if(ratio>best)best=ratio;
  }
  return{match:best>=FUZZY_THRESHOLD,exact:false,ratio:best,accentOnly:false};
}

// SPACED REPETITION (Leitner boxes, per browser). Each rated card gets a box 1-5;
// a right answer moves it up and pushes its due date out (1, 3, 7, 14, 30 days),
// a miss drops it two boxes (min 1) and makes it due immediately; a right answer on a card that isn't due yet changes nothing. Cards never rated have
// no schedule and stay in "Still learning" until first rated.
const SRS_DAYS=[0,1,3,7,14,30],SRS_DAY_MS=864e5;
// The schedule lives in the mastery state (public/shared/mastery.js), so it is saved
// locally and, when signed in, synced to the account with the rest of the progress.
// Entries are [box, due ms, last reviewed ms].
function ssSrsLoad(){return (SS_MASTERY&&SS_MASTERY.getSnapshot().srs)||{};}
// One-time moves into the synced state: a schedule saved in this browser by the
// first version of this feature, then cards marked known before it existed (given
// a first review spread over the next few days so there's no big first-week wave).
function ssSrsSeed(){
  if(!SS_MASTERY)return;
  const legacyKey='ss-srs-'+SS_GUIDE.slug;
  try{
    const old=JSON.parse(localStorage.getItem(legacyKey)||'null');
    if(old&&typeof old==='object'){SS_MASTERY.mergeSrs(old);localStorage.removeItem(legacyKey);}
  }catch(e){/* unreadable legacy data: ignore */}
  const srs=ssSrsLoad(),now=Date.now();let n=0;
  SS_MASTERY.getSnapshot().cardsKnown.forEach(function(t){
    if(srs[t])return;
    SS_MASTERY.setSrs(t,[2,now+((n++%5)+1)*SRS_DAY_MS,0]);
  });
}
function ssSrsRecord(term,known){
  const cur=ssSrsLoad()[term],now=Date.now();
  // Only a card that is due (or brand new) earns a box: "Know it" a few seconds after the last review
  // is cramming, not recall, and must not push the next review out. A miss costs two boxes and is due now.
  if(known&&cur&&cur[1]>now){SS_MASTERY.setSrs(term,[cur[0],cur[1],now]);ssSrsRefresh();return;}
  const box=known?Math.min(5,(cur?cur[0]:0)+1):Math.max(1,(cur?cur[0]:1)-2);
  SS_MASTERY.setSrs(term,[box,known?now+SRS_DAYS[box]*SRS_DAY_MS:now,now]);
  ssSrsRefresh();
}
function ssSrsIsDue(term){const r=ssSrsLoad()[term];return !!r&&r[1]<=Date.now();}
function ssSrsDueCount(){
  const srs=ssSrsLoad(),now=Date.now();
  return (typeof FLASHCARDS!=='undefined'?FLASHCARDS:[]).filter(function(c){const r=srs[c.t];return r&&r[1]<=now;}).length;
}
function ssSrsNextDue(){
  const srs=ssSrsLoad(),now=Date.now();let next=Infinity;
  FLASHCARDS.forEach(function(c){const r=srs[c.t];if(r&&r[1]>now&&r[1]<next)next=r[1];});
  return next===Infinity?null:next;
}
function ssSrsNextLabel(ts){
  const days=Math.ceil((ts-Date.now())/SRS_DAY_MS);
  return days<=1?'tomorrow':'in '+days+' days';
}
function ssSrsRefresh(){
  const due=ssSrsDueCount();
  const chip=document.getElementById('fc-due-chip');
  if(chip){
    const next=ssSrsNextDue();
    chip.className='fc-due-chip'+(due?' has-due':'');
    chip.textContent=due?due+' card'+(due===1?'':'s')+' due for review — start':(next?'All caught up. Next review '+ssSrsNextLabel(next)+'.':'Rate cards to start your review schedule.');
    chip.disabled=!due;
  }
  const tab=document.getElementById('tab-cards');
  if(tab){
    let b=tab.querySelector('.ss-due-badge');
    if(due){
      if(!b){b=document.createElement('span');b.className='ss-due-badge';tab.appendChild(b);}
      b.textContent=due+' due';
    }else if(b)b.remove();
  }
  const fb=document.getElementById('filter-btn');
  if(fb&&fcFilterMode==='due')fb.textContent='Show: Due ('+due+')';
}
function ssSrsStartDue(){
  fcFilterMode='due';
  const sel=document.getElementById('fc-sel');if(sel){sel.value='0';fcDeck=[...FLASHCARDS];}
  fcIdx=0;showFC();
}

// FLASHCARDS
let fcDeck=[],fcIdx=0,fcFilterMode='all',fcMode='flip';
function toggleFcMode(){
  fcMode=fcMode==='flip'?'type':'flip';
  const btn=document.getElementById('fc-mode-btn');
  if(btn)btn.textContent=fcMode==='type'?'Flip mode':'✎ Type it';
  showFC();
}
function checkTypedAnswer(){
  const deck=getActiveDeck();
  const input=document.getElementById('fc-type-input');
  const fb=document.getElementById('fc-type-feedback');
  if(!deck.length||!input||input.disabled)return;
  const card=deck[fcIdx];
  const {match,exact,accentOnly}=ssFuzzyMatch(input.value,card.t);
  input.disabled=true;
  if(!SS_MASTERY){setTimeout(()=>fcNav(1),400);return;}
  if(match){
    SS_MASTERY.markCardKnown(card.t);ssSrsRecord(card.t,true);
    fb.className='fc-type-feedback correct';
    fb.textContent=exact?'✓ Correct!':(accentOnly?'✓ Right — mind the accent: "'+card.t+'"':'✓ Close enough — "'+card.t+'"');
    if(window.__ssCelebrateCorrect)window.__ssCelebrateCorrect(input);
  }else{
    SS_MASTERY.unmarkCardKnown(card.t);ssSrsRecord(card.t,false);
    fb.className='fc-type-feedback wrong';
    fb.textContent='✗ It was: "'+card.t+'" ';
    // Stay on the card until the student moves on, and let them overrule a harsh miss.
    const right=document.createElement('button');right.type='button';right.className='btn';right.textContent='I was right';
    right.onclick=function(){SS_MASTERY.markCardKnown(card.t);ssSrsRecord(card.t,true);renderUnitProgress(card.u);fcNav(1);};
    const next=document.createElement('button');next.type='button';next.className='btn';next.textContent='Next card';
    next.onclick=function(){fcNav(1);};
    fb.appendChild(right);fb.appendChild(next);next.focus();
    if(window.__ssResetCombo)window.__ssResetCombo();
  }
  renderUnitProgress(card.u);
  if(match)setTimeout(()=>fcNav(1),900);
}
function buildFCSel(){
  const sel=document.getElementById('fc-sel');
  sel.innerHTML='<option value="0">All Units ('+FLASHCARDS.length+' cards)</option>';
  UNITS.forEach(u=>{const n=FLASHCARDS.filter(f=>f.u===u.id).length;if(n)sel.innerHTML+=`<option value="${u.id}">Unit ${u.id}: ${u.name} (${n})</option>`;});
  loadFC();
}
function loadFC(){
  fcFilterMode='all';
  if(document.getElementById('filter-btn'))document.getElementById('filter-btn').textContent='Show: All';
  const v=+document.getElementById('fc-sel').value;
  fcDeck=v===0?[...FLASHCARDS]:FLASHCARDS.filter(f=>f.u===v);
  fcIdx=0;showFC();
}
function fcKnownSet(){return new Set((SS_MASTERY&&SS_MASTERY.getSnapshot().cardsKnown)||[]);}
function getActiveDeck(){
  const known=fcKnownSet();
  if(fcFilterMode==='learning')return fcDeck.filter(c=>!known.has(c.t));
  if(fcFilterMode==='known')return fcDeck.filter(c=>known.has(c.t));
  if(fcFilterMode==='due')return fcDeck.filter(c=>ssSrsIsDue(c.t));
  return fcDeck;
}
let ssSrsUiReady=false,ssSrsSeeded=false;
function ssSrsEnsureUi(){
  if(SS_MASTERY&&!ssSrsSeeded){ssSrsSeeded=true;ssSrsSeed();}
  if(!ssSrsUiReady){
    const prog=document.getElementById('fc-progress');
    if(prog){
      const b=document.createElement('button');b.type='button';b.id='fc-due-chip';b.onclick=ssSrsStartDue;
      prog.parentNode.insertBefore(b,prog);ssSrsUiReady=true;
    }
  }
  ssSrsRefresh();
}
// Language guides: the flashcard term is in the target language, so a screen reader gets lang= on it and sighted
// students get a button that says it aloud in a matching voice (when the device has one).
function ssVoiceForLang(lang){
  const vs=(window.speechSynthesis&&window.speechSynthesis.getVoices())||[];
  return vs.find(function(v){return v.lang&&v.lang.toLowerCase().indexOf(lang)===0;})||null;
}
function ssFcSpeak(){
  const deck=getActiveDeck(),card=deck[fcIdx];
  if(!card||!SS_GUIDE.lang||!('speechSynthesis' in window))return;
  const ut=new SpeechSynthesisUtterance(card.t);
  const v=ssVoiceForLang(SS_GUIDE.lang);
  if(v)ut.voice=v;
  ut.lang=v?v.lang:SS_GUIDE.lang;
  window.speechSynthesis.cancel();window.speechSynthesis.speak(ut);
}
function ssFcEnsureSpeak(){
  if(!SS_GUIDE.lang||!('speechSynthesis' in window)||document.getElementById('fc-speak'))return;
  const scene=document.getElementById('scene');if(!scene)return;
  const b=document.createElement('button');
  b.type='button';b.id='fc-speak';b.className='btn';b.textContent='\u{1F50A} Hear it';
  b.setAttribute('aria-label','Hear this term pronounced');
  b.onclick=ssFcSpeak;
  scene.parentNode.insertBefore(b,scene.nextSibling);
}
function showFC(){
  ssSrsEnsureUi();
  const deck=getActiveDeck();
  const scene=document.getElementById('scene');
  const typeRow=document.getElementById('fc-type-row');
  const isType=fcMode==='type';
  if(scene)scene.style.display=isType?'none':'';
  if(typeRow)typeRow.style.display=isType?'':'none';
  if(!deck.length){document.getElementById('fc-term').textContent='No cards';document.getElementById('fc-def').textContent=fcFilterMode==='due'?'Nothing is due right now':'Rate some cards first';document.getElementById('fc-count').textContent='0 / 0';document.getElementById('fc-progress').textContent='';return;}
  if(fcIdx>=deck.length)fcIdx=0;
  const card=deck[fcIdx];
  const termEl=document.getElementById('fc-term');
  termEl.textContent=card.t;
  if(SS_GUIDE.lang)termEl.setAttribute('lang',SS_GUIDE.lang);
  ssFcEnsureSpeak();
  document.getElementById('fc-def').textContent=card.d;
  const known=fcKnownSet();
  const knownCount=fcDeck.filter(c=>known.has(c.t)).length;
  const learningCount=fcDeck.length-knownCount;
  document.getElementById('fc-count').textContent=(fcIdx+1)+' / '+deck.length;
  document.getElementById('fc-progress').textContent=`✓ ${knownCount} known  ·  ✗ ${learningCount} still learning`;
  if(scene){scene.classList.remove('flipped');ssFcSyncFaces(false);}
  const liveCard=document.getElementById('fc-live');
  if(liveCard&&!isType)liveCard.textContent='Card '+(fcIdx+1)+' of '+deck.length+'. Term: '+card.t;
  if(isType&&typeRow){
    document.getElementById('fc-type-def').textContent=card.d;
    const input=document.getElementById('fc-type-input');
    const fb=document.getElementById('fc-type-feedback');
    if(input){input.value='';input.disabled=false;setTimeout(()=>input.focus(),0);}
    if(fb){fb.textContent='';fb.className='fc-type-feedback';}
  }
  ssTypeset(isType&&typeRow?typeRow:scene);
}
// Only the face that is showing is exposed to screen readers (the other would read the answer out with the question), and the
// newly showing face is announced, since flipping is otherwise silent for them.
function ssFcSyncFaces(announce){
  const scene=document.getElementById('scene');if(!scene)return;
  const flipped=scene.classList.contains('flipped');
  const front=scene.querySelector('.face.front'),back=scene.querySelector('.face.back');
  if(front)front.setAttribute('aria-hidden',flipped?'true':'false');
  if(back)back.setAttribute('aria-hidden',flipped?'false':'true');
  if(announce){
    const live=document.getElementById('fc-live');
    if(live)live.textContent=(flipped?'Definition: ':'Term: ')+(document.getElementById(flipped?'fc-def':'fc-term')||{}).textContent;
  }
}
function flip(){document.getElementById('scene').classList.toggle('flipped');ssFcSyncFaces(true);}
function fcNav(d){const deck=getActiveDeck();if(!deck.length)return;fcIdx=(fcIdx+d+deck.length)%deck.length;showFC();}
// Shuffle the underlying deck, not the filtered copy getActiveDeck() returns: a filter builds a new array each call, so shuffling
// that did nothing in the Learning / Known / Due views.
function fcShuffle(){const deck=fcDeck;for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}fcIdx=0;showFC();}
// Anki/Quizlet both import plain tab-separated text (front<TAB>back per
// line) via their "Import" flow, so one export format covers both --
// avoids maintaining two export paths for one underlying need. The
// 'apush' literal here is replaced with the real subject slug by
// generate-guide.mjs's existing substitution, same as SS_MASTERY's key.
function exportFlashcards(){
  const rows=FLASHCARDS.map(f=>f.t.replace(/\t/g,' ')+'\t'+f.d.replace(/\t/g,' ').replace(/\n/g,' '));
  const blob=new Blob([rows.join('\n')],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=SS_GUIDE.slug+'-flashcards.txt';
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
}
// Builds a throwaway #ss-print-container with just the requested content,
// hides everything else via body.ss-printing (see style.css), prints, then
// cleans up on 'afterprint' -- simpler and more robust than trying to print
// the interactive flip-card/quiz UI (or a JS PDF library) for content that's
// already just static text.
function ssRunPrintJob(title,bodyHtml){
  var old=document.getElementById('ss-print-container');
  if(old)old.remove();
  var container=document.createElement('div');
  container.id='ss-print-container';
  container.innerHTML='<h1>'+title+'</h1>'+bodyHtml;
  document.body.appendChild(container);
  document.body.classList.add('ss-printing');
  function cleanup(){
    document.body.classList.remove('ss-printing');
    container.remove();
    window.removeEventListener('afterprint',cleanup);
  }
  window.addEventListener('afterprint',cleanup);
  var go=function(){window.print();};
  if(window.MathJax&&window.MathJax.typesetPromise){
    // Wait for math to render so the printout shows equations, not raw $...$ source.
    try{window.MathJax.typesetPromise([container]).then(function(){setTimeout(go,50);},function(){setTimeout(go,50);});}
    catch(e){setTimeout(go,50);}
  }else setTimeout(go,50);
}
function printFlashcardSheet(){
  var byUnit={};
  (FLASHCARDS||[]).forEach(function(f){(byUnit[f.u]=byUnit[f.u]||[]).push(f);});
  var body=UNITS.map(function(u){
    var cards=byUnit[u.id]||[];
    if(!cards.length)return '';
    return '<h2>Unit '+u.id+': '+u.name+'</h2>'
      +'<table class="ss-print-table"><thead><tr><th>Term</th><th>Definition</th></tr></thead><tbody>'
      +cards.map(function(f){return '<tr><td>'+f.t+'</td><td>'+f.d+'</td></tr>';}).join('')
      +'</tbody></table>';
  }).join('');
  ssRunPrintJob(document.title.replace(/\s*[—-].*$/,'')+' — Flashcards Study Sheet',body);
}
function printWorksheet(){
  // Print the unit chosen in the quiz picker, not the whole bank with its answer key.
  var picked=document.getElementById('q-sel'),only=picked&&/^\d+$/.test(picked.value)&&+picked.value>0?+picked.value:0;
  var byUnit={};
  (QUIZ||[]).forEach(function(q){if(only&&q.u!==only)return;(byUnit[q.u]=byUnit[q.u]||[]).push(q);});
  var num=0;
  var keyLines=[];
  var letters=['A','B','C','D','E','F'];
  var body=UNITS.map(function(u){
    var qs=byUnit[u.id]||[];
    if(!qs.length)return '';
    var qHtml=qs.map(function(q){
      num++;
      keyLines.push('<span>'+num+'. '+letters[q.a]+'</span>');
      return '<div class="ss-print-q"><div class="ss-print-q-text">'+num+'. '+q.q+'</div>'
        +'<div class="ss-print-opts">'+(q.o||[]).map(function(o,i){return '<div>'+letters[i]+'. '+o+'</div>';}).join('')+'</div></div>';
    }).join('');
    return '<h2>Unit '+u.id+': '+u.name+'</h2>'+qHtml;
  }).join('');
  var answerKey='<div class="ss-print-pagebreak"></div><h2>Answer Key</h2><div class="ss-print-key">'+keyLines.join('')+'</div>';
  ssRunPrintJob(document.title.replace(/\s*[—-].*$/,'')+' — Practice Worksheet',body+answerKey);
}
// After a rating the card may leave the filtered deck (a 'Still learning' deck loses a card you just marked known, a 'Due' deck
// loses one you just reviewed). Advancing by index would then skip the next card, so remember which card is next and find it
// again in the rebuilt deck. A card rated 'still learning' is also moved a few places later in the deck so it comes back soon.
const FC_AGAIN_GAP=4;
function ssNextCardAfterRating(deckBefore,idx,deckAfter){
  if(!deckAfter.length)return 0;
  const next=deckBefore[(idx+1)%deckBefore.length];
  const at=deckAfter.indexOf(next);
  return at>=0?at:Math.min(idx,deckAfter.length-1);
}
function ssRequeueCard(deck,card,gap){
  const from=deck.indexOf(card);
  if(from<0)return;
  deck.splice(from,1);
  deck.splice(Math.min(from+gap,deck.length),0,card);
}
function rateFC(rating){
  const deck=getActiveDeck();
  if(!deck.length||!SS_MASTERY)return;
  const card=deck[fcIdx];
  const sc=document.getElementById('scene');
  if(sc&&!sc.classList.contains('flipped')){const lv=document.getElementById('fc-live');if(lv)lv.textContent='Flip the card to check your answer before rating it.';return;}
  const before=deck.slice(); // in the unfiltered view the active deck IS fcDeck, which the requeue below reorders
  if(rating==='known')SS_MASTERY.markCardKnown(card.t);
  else SS_MASTERY.unmarkCardKnown(card.t);
  ssSrsRecord(card.t,rating==='known');
  if(rating!=='known')ssRequeueCard(fcDeck,card,FC_AGAIN_GAP);
  renderUnitProgress(card.u);
  fcIdx=ssNextCardAfterRating(before,fcIdx,getActiveDeck());
  showFC();
}
function filterFC(){
  if(fcFilterMode==='all'){fcFilterMode='learning';document.getElementById('filter-btn').textContent='Show: Still Learning';}
  else if(fcFilterMode==='learning'){fcFilterMode='known';document.getElementById('filter-btn').textContent='Show: Known';}
  else if(fcFilterMode==='known'){fcFilterMode='due';document.getElementById('filter-btn').textContent='Show: Due ('+ssSrsDueCount()+')';}
  else{fcFilterMode='all';document.getElementById('filter-btn').textContent='Show: All';}
  fcIdx=0;showFC();
}
buildFCSel();

// QUIZ
let qPool=[],qIdx=0,score=0;
let requeueCounts=new WeakMap();
const REQUEUE_DELAY=3,MAX_REQUEUES=2;

/* ----- server-synced mastery (Chemistry has no prior local tracking to
   migrate from - this is the first time per-unit progress persists at all) */
function buildExamples(){
  examplesBuilt=true;
  const v=document.getElementById('view-examples');
  if(!v||typeof WORKED==='undefined'||!WORKED.length)return;
  let h='<div class="ex2-intro">Try each problem on your own first — then reveal the solution one step at a time. Mark “Got it” to track your progress.</div>';
  const doneMap=(SS_MASTERY&&SS_MASTERY.getSnapshot().examples)||{};
  UNITS.forEach(u=>{
    const list=WORKED.filter(w=>w.u===u.id);if(!list.length)return;
    h+=`<div class="ex2-unit"><h3 class="ex2-h">Unit ${u.id}: ${u.name}</h3>`;
    list.forEach((w,wi)=>{
      const id=u.id+'-'+wi;ex2map[id]=w;
      const done=doneMap[id]?' done':'';
      h+=`<div class="ex2-card${done}" data-id="${id}">
        <div class="ex2-title">${w.title}</div>
        <div class="ex2-prompt">${w.prompt}</div>
        <div class="ex2-steps" id="ex2s-${id}"></div>
        <div class="ex2-actions">
          <button class="btn ex2-reveal" onclick="revealStep('${id}')">Reveal step ▾</button>
          <button class="btn" onclick="revealAll('${id}')">Show all</button>
          <button class="btn ex2-done" onclick="markExample('${id}')">✓ Got it</button>
        </div></div>`;
    });
    h+='</div>';
  });
  v.innerHTML=h;
  ssTypeset(v);
}
function revealStep(id){
  const w=ex2map[id];const c=document.getElementById('ex2s-'+id);let n=ex2shown[id]||0;
  if(n<w.steps.length){
    const d=document.createElement('div');d.className='ex2-step';d.innerHTML='<span>'+(n+1)+'</span><div>'+w.steps[n]+'</div>';c.appendChild(d);ssTypeset(d);
    n++;ex2shown[id]=n;
    if(n===w.steps.length){
      const a=document.createElement('div');a.className='ex2-answer';a.innerHTML='✓ '+w.answer;c.appendChild(a);ssTypeset(a);
      const btn=document.querySelector('.ex2-card[data-id="'+id+'"] .ex2-reveal');if(btn)btn.style.display='none';
    }
  }
}
function revealAll(id){const w=ex2map[id];while((ex2shown[id]||0)<w.steps.length)revealStep(id);}
function markExample(id){
  if(SS_MASTERY)SS_MASTERY.markExampleDone(id);
  const card=document.querySelector('.ex2-card[data-id="'+id+'"]');if(card)card.classList.add('done');
}

// Stamp "last visited subject" on every guide-page load, not just when the
// dashboard's own subject cards are clicked (see the matching write in
// public/dashboard/index.html) -- otherwise a student who lands on a guide
// directly (search, bookmark, shared link) never gets a homepage resume
// banner, since ss-last-subject would stay unset for that whole session.
// unit/concept/where (the exact block last being read, see the observer at the
// bottom of this file) are carried over when reopening the same guide so a bare
// page load doesn't wipe the saved position.
function ssSaveLast(pos){
  try{
    var prev=null;try{prev=JSON.parse(localStorage.getItem('ss-last-subject')||'null');}catch(e){}
    var keep=pos||(prev&&prev.key===SS_GUIDE.key?{unit:prev.unit,concept:prev.concept,where:prev.where}:{});
    localStorage.setItem('ss-last-subject',JSON.stringify(Object.assign({key:SS_GUIDE.key,label:SS_GUIDE.title,href:'/'+SS_GUIDE.slug+'/',ts:Date.now()},keep)));
  }catch(e){/* private mode etc -- resume banner just won't have anything to show */}
}
ssSaveLast();

var SS_MASTERY = null;
var SS_SUBJECT_KEY=SS_GUIDE.key;
window.__ssMasteryInstances = window.__ssMasteryInstances || [];
function ssStartChemMastery(){
  SS_MASTERY = window.__ssCreateMastery(SS_GUIDE.key, UNITS.map(function(u){return u.id;}), UNITS.reduce(function(acc,u){acc[u.id]=u.name;return acc;},{}));
  window.__ssMasteryInstances.push(SS_MASTERY);
  SS_MASTERY.init().then(function(){ try{ showFC(); if(new URLSearchParams(location.search).get('due')==='1'&&ssSrsDueCount())ssSrsStartDue(); }catch(e){} try{ if(examplesBuilt) buildExamples(); }catch(e){} try{ ssOverallProgressUpdate(); }catch(e){} try{ renderAllUnitProgress(); }catch(e){} });
}
if (window.__ssCreateMastery) { ssStartChemMastery(); }
else { window.addEventListener('ss-mastery-ready', ssStartChemMastery, { once: true }); }

/* bookmarked question ids, kept separate from server-synced mastery state
   (this is purely a local toggle-and-persist affordance, no filter UI yet) */
var Q_BOOKMARK_KEY='ssBookmarks_'+SS_GUIDE.slug;
function qBookmarkSet(){
  try{return new Set(JSON.parse(localStorage.getItem(Q_BOOKMARK_KEY)||'[]'));}catch(e){return new Set();}
}
function qBookmarkToggle(qid){
  var set=qBookmarkSet();
  if(set.has(qid))set.delete(qid);else set.add(qid);
  try{localStorage.setItem(Q_BOOKMARK_KEY,JSON.stringify(Array.from(set)));}catch(e){}
  return set.has(qid);
}
function qId(q){return q.u+'|'+q.q;}

/* Mistake Log: localStorage-backed, keyed the same way as the bookmark set
   (ssBookmarks_<slug>) — a currently-unresolved-misses list, not full history.
   A question moves in when answered wrong and out the moment it's answered
   correctly again (from anywhere: normal quiz, diagnostic, hard mode, or the
   log's own review pass). */
var MISTAKE_LOG_KEY='ssMistakes_'+SS_GUIDE.slug;
function mistakeLogMap(){
  try{return JSON.parse(localStorage.getItem(MISTAKE_LOG_KEY)||'{}');}catch(e){return {};}
}
function mistakeLogSave(map){
  try{localStorage.setItem(MISTAKE_LOG_KEY,JSON.stringify(map));}catch(e){}
  updateMistakeLogBadge();
}
function mistakeLogAdd(q){
  const map=mistakeLogMap();
  map[qId(q)]={u:q.u,q:q.q,o:q.o,a:q.a,e:q.e,d:q.d,topic:q.topic,fig:q.fig};
  mistakeLogSave(map);
}
function mistakeLogRemove(q){
  const map=mistakeLogMap();
  const id=qId(q);
  if(!(id in map))return;
  delete map[id];
  mistakeLogSave(map);
}
function updateMistakeLogBadge(){
  const el=document.getElementById('mistake-log-count');
  if(!el)return;
  const n=Object.keys(mistakeLogMap()).length;
  el.textContent=String(n);
  el.style.display=n?'':'none';
}
var mistakeReviewMode=false;
function openMistakeLog(){
  switchTab('quiz');
  mistakeReviewMode=true;
  diagMode=false;
  const banner=document.getElementById('diag-banner');if(banner)banner.style.display='none';
  const summary=document.getElementById('diag-summary');if(summary)summary.innerHTML='';
  const map=mistakeLogMap();
  qPool=Object.values(map);
  qIdx=0;score=0;requeueCounts=new WeakMap();
  const qb=document.getElementById('qbox');
  if(!qPool.length){
    qb.innerHTML='<div class="mistake-log-empty">No mistakes logged right now — nice work. Answer a question wrong anywhere in the quiz and it will show up here until you get it right.</div>';
    document.getElementById('q-prog').textContent='';
    document.getElementById('q-sc').textContent='';
    return;
  }
  showQ();
}

function quizShuffle(){
  if(!qPool.length)return;
  for(let i=qPool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[qPool[i],qPool[j]]=[qPool[j],qPool[i]];}
  qIdx=0;score=0;requeueCounts=new WeakMap();showQ();
}

function unitNameFor(unitId){const u=UNITS.find(x=>x.id===unitId);return u?u.name:'Unit '+unitId;}

/* ----- Per-unit weighted progress (feature: per-unit accordion badges) -----
   Blends up to three signals into a single 0-100 score for one unit:
     - Flashcards known: knownCards / totalCardsInUnit          (weight .40)
     - Quiz accuracy:    correctAnswered / totalAnswered so far  (weight .40)
     - Exam accuracy:    correctAnswered / totalAnswered so far  (weight .20)
       among this unit's practice-exam questions (only guides whose exam
       questions carry a `u` field support this — most don't yet).
   A component is only counted once there is something to measure: a unit
   with zero flashcards drops the flashcard term, and quiz/exam terms only
   count once at least one question in that unit has actually been
   answered (an unattempted quiz isn't "0% mastery", it's "not started" —
   same distinction the shared mastery module already makes at total<2).
   Whatever weight a dropped component held is redistributed proportionally
   across the components that ARE present, so e.g. a unit with flashcards
   and quiz activity but no exam coverage is scored 50/50 instead of being
   capped near 80%. If nothing has been touched yet for a unit, returns
   null so callers can omit the badge entirely rather than show a
   meaningless 0%. */
function unitWeightedPct(unitId){
  var parts=[];
  var cards=(typeof FLASHCARDS!=='undefined'?FLASHCARDS:[]).filter(function(f){return f.u===unitId;});
  if(cards.length){
    var known=fcKnownSet();
    var knownCount=cards.filter(function(c){return known.has(c.t);}).length;
    parts.push({weight:0.4,pct:(knownCount/cards.length)*100});
  }
  var mastery=SS_MASTERY?(SS_MASTERY.getSnapshot().mastery||{}):{};
  var qrec=mastery[String(unitId)];
  if(qrec&&qrec.total>0)parts.push({weight:0.4,pct:(qrec.correct/qrec.total)*100});
  var erec=examUnitStats[unitId];
  if(erec&&erec.total>0)parts.push({weight:0.2,pct:(erec.correct/erec.total)*100});
  if(!parts.length)return null;
  var totalWeight=parts.reduce(function(s,p){return s+p.weight;},0);
  var weighted=parts.reduce(function(s,p){return s+p.pct*(p.weight/totalWeight);},0);
  return Math.max(0,Math.min(100,Math.round(weighted)));
}
function renderUnitProgress(unitId){
  var el=document.getElementById('unit-progress-'+unitId);
  if(!el)return;
  var pct=unitWeightedPct(unitId);
  if(pct===null){el.style.display='none';return;}
  el.style.display='';
  var fill=el.querySelector('.unit-progress-fill');
  var label=el.querySelector('.unit-progress-label');
  if(fill)fill.style.width=pct+'%';
  if(label)label.textContent=pct+'%';
}
function renderAllUnitProgress(){
  if(typeof UNITS==='undefined')return;
  UNITS.forEach(function(u){renderUnitProgress(u.id);});
}

function ssOverallProgressUpdate(){
  var fill=document.getElementById('ss-overall-progress-fill');
  var label=document.getElementById('ss-overall-progress-label');
  if(!fill||!label)return;
  var total=(typeof QUIZ!=='undefined'?QUIZ.length:0);
  if(!total){fill.parentElement.parentElement.style.display='none';return;}
  var answered=0;
  if(SS_MASTERY){
    var mastery=SS_MASTERY.getSnapshot().mastery||{};
    Object.keys(mastery).forEach(function(k){answered+=mastery[k].total||0;});
  }
  var pct=Math.max(0,Math.min(100,Math.round((answered/total)*100)));
  fill.style.width=pct+'%';
  label.textContent=pct+'% of the question bank attempted';
}

let diagMode=false;
function ssHardQ(){return (typeof HARD_Q!=='undefined'&&Array.isArray(HARD_Q))?HARD_Q:[];}
// A question's difficulty: its own d field, or 'hard' when it comes from the guide's hard-question bank.
function ssDiffOf(q){return q.d||(ssHardQ().indexOf(q)>=0?'hard':null);}
// How many questions sit at each level. Only the SAT guide tags easy/medium/hard, so the chips are shown for a level only
// when it has enough questions to practise with; otherwise a chip just produced an empty quiz and a "0/0 NaN%" result.
const SS_MIN_PER_LEVEL=10;
function ssDifficultyLevels(){
  const counts={easy:0,medium:0,hard:0};
  QUIZ.concat(ssHardQ()).forEach(function(q){const d=ssDiffOf(q);if(d&&d in counts)counts[d]++;});
  return counts;
}
function ssInitDifficultyChips(){
  const counts=ssDifficultyLevels();
  let shown=0;
  document.querySelectorAll('.diff-chip').forEach(function(c){
    const d=c.dataset.diff;
    if(d==='all')return;
    const ok=counts[d]>=SS_MIN_PER_LEVEL;
    c.style.display=ok?'':'none';
    if(ok)shown++;
  });
  const row=document.querySelector('.diff-chips');
  if(row)row.style.display=shown?'flex':'none';
  if(!shown)difficultyFilter='all';
}
function buildQSel(){
  const sel=document.getElementById('q-sel');
  const HQ=ssHardQ();
  sel.innerHTML='<option value="quick">⚡ Quick 10: mixed, weighted to your weak units</option><option value="0">All Units ('+(QUIZ.length+HQ.length)+' questions)</option>';
  UNITS.forEach(u=>{const n=QUIZ.filter(q=>q.u===u.id).length+HQ.filter(q=>q.u===u.id).length;if(n)sel.innerHTML+=`<option value="${u.id}">Unit ${u.id}: ${u.name} (${n} Qs)</option>`;});
  if(HQ.length)sel.innerHTML+='<option value="hard">Hard Mode Only ('+HQ.length+' Qs)</option>';
  ssInitDifficultyChips();
  loadQ();
}
let difficultyFilter='all';
function setDifficultyFilter(d){
  difficultyFilter=d;
  document.querySelectorAll('.diff-chip').forEach(function(c){c.classList.toggle('on',c.dataset.diff===d);});
  loadQ();
}
function loadQ(){
  diagMode=false;
  mistakeReviewMode=false;
  const banner=document.getElementById('diag-banner');if(banner)banner.style.display='none';
  const summary=document.getElementById('diag-summary');if(summary)summary.innerHTML='';
  const raw=document.getElementById('q-sel').value;
  const HQ=ssHardQ();
  let src;
  if(raw==='quick')src=ssQuickTen(QUIZ.concat(HQ));
  else if(raw==='hard')src=HQ.slice();
  else if(+raw===0)src=QUIZ.concat(HQ);
  else src=QUIZ.concat(HQ).filter(q=>q.u===+raw);
  if(difficultyFilter!=='all')src=src.filter(q=>ssDiffOf(q)===difficultyFilter);
  qPool=raw==='quick'?src:src.sort(()=>Math.random()-.5);
  qIdx=0;score=0;qStreak=0;qBestStreak=0;qMissedUnits=new Set();requeueCounts=new WeakMap();qSessionStart=null;showQ();
}
let qStreak=0,qBestStreak=0,qMissedUnits=new Set();
// Ten questions, drawn without replacement with each unit weighted by how
// much it needs work: unassessed units count as 50%, mastered units (80%+)
// still appear occasionally.
function ssQuickTen(all){
  const m=(SS_MASTERY&&SS_MASTERY.getSnapshot().mastery)||{};
  const weight=function(u){const r=m[String(u)];const pct=r&&r.total>=2?r.correct/r.total*100:50;return 1+Math.max(0,100-pct)/20;};
  const pool=all.filter(function(q){return difficultyFilter==='all'||ssDiffOf(q)===difficultyFilter;}).map(function(q){return {q:q,w:weight(q.u)};});
  const out=[];
  while(out.length<10&&pool.length){
    let t=pool.reduce(function(a,x){return a+x.w;},0)*Math.random(),i=0;
    while(i<pool.length-1&&(t-=pool[i].w)>0)i++;
    out.push(pool.splice(i,1)[0].q);
  }
  return out;
}
let qSessionStart=null;
function ssPracticeUnit(u){const sel=document.getElementById('q-sel');sel.value=String(u);loadQ();}
function diagSetActive(active){
  const vq=document.getElementById('view-quiz');if(vq)vq.classList.toggle('diag-mode',active);
  const btn=document.getElementById('diag-start-btn');const lbl=document.getElementById('diag-start-btn-label');
  if(btn)btn.disabled=active;
  if(lbl)lbl.textContent=active?'Diagnostic in progress…':'Start Diagnostic — 2 questions per unit, finds your weak spots';
}
// Adaptive routing: after the initial 2-per-unit pass, units still under
// the 80% mastery bar get a follow-up round drawn from THAT unit's
// untested questions (see diagAskedIds) -- routing more practice toward
// exactly where the live results say it's needed, instead of a single
// fixed sample. Capped at MAX_DIAG_ROUNDS total rounds so a student who
// stays weak everywhere isn't stuck in an unbounded loop.
const MAX_DIAG_ROUNDS=3, DIAG_ROUND_QS_PER_UNIT=3;
let diagRound=0, diagAskedIds=null, diagTally={};
function startDiagnostic(){
  switchTab('quiz');
  /* already mid-diagnostic (not yet finished) — re-focus it instead of wiping progress and restarting */
  if(diagMode&&qPool&&qPool.length&&qIdx<qPool.length){showQ();return;}
  diagRound=1;diagAskedIds=new Set();diagTally={};
  const perUnit={};
  QUIZ.forEach(q=>{(perUnit[q.u]=perUnit[q.u]||[]).push(q);});
  let pool=[];
  UNITS.forEach(u=>{
    const qs=(perUnit[u.id]||[]).slice().sort(()=>Math.random()-.5);
    pool=pool.concat(qs.slice(0,2));
  });
  pool.forEach(q=>diagAskedIds.add(qId(q)));
  pool=pool.sort(()=>Math.random()-.5);
  qPool=pool;qIdx=0;score=0;requeueCounts=new WeakMap();diagMode=true;
  diagSetActive(true);
  const banner=document.getElementById('diag-banner');
  if(banner){banner.style.display='block';banner.textContent='Diagnostic in progress — '+qPool.length+' questions (2 per unit). Answer honestly; your weak units appear below when you finish.';}
  const summary=document.getElementById('diag-summary');if(summary)summary.innerHTML='';
  showQ();
}
// Returns true if it routed the student into another adaptive round
// (qPool/qIdx already reassigned, showQ() already called for the new
// round's first question) -- the caller (showQ) must bail out without
// rendering its own terminal scoreboard when this returns true.
function showDiagSummary(){
  // Scored from THIS run only: lifetime mastery would let months-old answers decide which units look weak today.
  const rows=UNITS.map(u=>{
    const rec=diagTally[u.id];
    if(!rec||rec.total<1)return null;
    const pct=Math.round(rec.correct/rec.total*100);
    return {id:u.id,name:u.name,pct};
  }).filter(Boolean);
  const weak=rows.filter(r=>r.pct<80).sort((a,b)=>a.pct-b.pct);

  if(weak.length&&diagRound<MAX_DIAG_ROUNDS){
    const perUnit={};
    QUIZ.forEach(q=>{(perUnit[q.u]=perUnit[q.u]||[]).push(q);});
    let extra=[];
    weak.forEach(w=>{
      const remaining=(perUnit[w.id]||[]).filter(q=>!diagAskedIds.has(qId(q)));
      const pick=remaining.sort(()=>Math.random()-.5).slice(0,DIAG_ROUND_QS_PER_UNIT);
      pick.forEach(q=>diagAskedIds.add(qId(q)));
      extra=extra.concat(pick);
    });
    if(extra.length){
      diagRound++;
      extra=extra.sort(()=>Math.random()-.5);
      qPool=extra;qIdx=0;score=0;requeueCounts=new WeakMap();
      const banner=document.getElementById('diag-banner');
      const units=weak.map(w=>'Unit '+w.id).join(', ');
      if(banner){banner.style.display='block';banner.textContent='Adaptive round '+diagRound+' — '+extra.length+' more questions routed to your weak units ('+units+').';}
      showQ();
      return true;
    }
  }

  diagMode=false;
  diagSetActive(false);
  const banner=document.getElementById('diag-banner');if(banner)banner.style.display='none';
  const summary=document.getElementById('diag-summary');
  if(!summary||!SS_MASTERY){return false;}
  if(!weak.length){
    summary.innerHTML='<div class="result" style="padding:16px"><div class="sub" style="color:var(--success)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Every unit you were tested on scored 80%+! Try the practice exam next.</div></div>'+(SS_SESSION?'':'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:14.5px;color:var(--ink-muted)">Sign in to save these results and unlock the full question bank.<div class="ss-login-box" style="margin-top:8px"></div></div>');
    if(!SS_SESSION)ssRenderLoginBoxes();
    ssDiagBatchRenderContinue();
    return false;
  }
  const roundNote=diagRound>1?`<div style="font-size:13px;color:var(--ink-muted);margin-bottom:10px">After ${diagRound} rounds of adaptive practice, still below 80%:</div>`:'';
  summary.innerHTML='<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;margin-top:14px">'
    +'<div style="font-weight:700;color:var(--ink);margin-bottom:10px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Weak units from this diagnostic</div>'
    +roundNote
    +weak.map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14.5px">
      <span style="color:var(--ink)">Unit ${r.id}: ${r.name}</span><span style="color:var(--danger);font-weight:700">${r.pct}%</span></div>`).join('')
    +'</div>'+(SS_SESSION?'':'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:14.5px;color:var(--ink-muted)">Sign in to save these results and unlock the full question bank.<div class="ss-login-box" style="margin-top:8px"></div></div>');
  if(!SS_SESSION)ssRenderLoginBoxes();
  ssDiagBatchRenderContinue();
  return false;
}
function showQ(){
  const qb=document.getElementById('qbox');
  if(qPool.length&&qIdx<qPool.length&&qSessionStart===null)qSessionStart=Date.now(); // time from the first question on screen, not from page load
  if(!qPool.length){
    // An empty pool (a filter with no matches) must not fall through to the results card: it would show "0/0 NaN%".
    qb.innerHTML='<div class="result"><div class="sub">No questions match this choice yet.</div><button class="btn" onclick="setDifficultyFilter(\'all\')">Show all questions</button></div>';
    return;
  }
  if(qIdx>=qPool.length){
    if(diagMode&&showDiagSummary())return;
    if(ssChallengeCode){ssFinishChallenge();return;}
    const elapsedSec=qSessionStart?Math.max(1,Math.round((Date.now()-qSessionStart)/1000)):null;
    const elapsedStr=elapsedSec!=null?(elapsedSec>=60?Math.floor(elapsedSec/60)+'m '+(elapsedSec%60)+'s':elapsedSec+'s'):null;
    const xpEarned=score*10; // same 10-XP-per-correct-answer the dashboard's computeXP() awards -- not a separate estimate
    qb.innerHTML=`<div class="result"><div class="big">${score}/${qPool.length}</div><div class="sub">${Math.round(score/qPool.length*100)}% — ${score/qPool.length>=.85?'Excellent work':score/qPool.length>=.65?'Solid — review the misses':(document.getElementById('q-sel').value==='quick'?'Good practice — the units below need another look':'Keep reviewing this unit')}</div>`+
      `<div class="q-session-stats">${xpEarned?`<span>+${xpEarned} XP</span>`:''}${qBestStreak>1?`<span>Best streak ${qBestStreak}</span>`:''}${elapsedStr?`<span>${elapsedStr}</span>`:''}</div>`+
      (qMissedUnits.size?`<div class="q-review">Review next: ${Array.from(qMissedUnits).map(function(u){const x=UNITS.find(function(y){return y.id===u;});return x?'<button type="button" class="chip" onclick="ssPracticeUnit('+u+')">Unit '+u+': '+x.name+'</button>':'';}).join(' ')}</div>`:'')+
      `<button class="btn" onclick="loadQ()">${document.getElementById('q-sel').value==='quick'?'Another Quick 10':'Try Again'}</button></div>`;return;}
  const q=qPool[qIdx];
  qHintTier=0;
  ssShuffleOptions(q);
  document.getElementById('q-prog').textContent=`Q ${qIdx+1}/${qPool.length}`;
  document.getElementById('q-sc').textContent=`Score: ${score}`;
  const bid=qId(q);
  const bookmarked=qBookmarkSet().has(bid);
  const STAR_OUTLINE='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.5 15.09 9.26 22 10.27 17 15.14 18.18 22 12 18.56 5.82 22 7 15.14 2 10.27 8.91 9.26"/></svg>';
  const STAR_FILLED='<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.5 15.09 9.26 22 10.27 17 15.14 18.18 22 12 18.56 5.82 22 7 15.14 2 10.27 8.91 9.26"/></svg>';
  const diffPill=q.d?`<span class="q-diff q-diff-${q.d}">${q.d}</span>`:'';
  let h=`<div class="q-block"><div class="q-block-hd"><div class="q-text">${ssFixLt(q.q)}</div>${diffPill}`+
    `<button type="button" class="q-bookmark${bookmarked?' on':''}" id="q-bookmark" onclick="toggleQBookmark()" aria-label="${bookmarked?'Remove bookmark':'Bookmark this question'}" aria-pressed="${bookmarked}">${bookmarked?STAR_FILLED:STAR_OUTLINE}</button></div>`+
    (q.fig?`<figure class="q-fig">${q.fig}</figure>`:'')+
    (q.topic?`<div class="q-topic">${q.topic}</div>`:'')+
    `<button class="guess-btn" id="guess-btn" onclick="markGuess()">I'm just guessing</button> `+
    `<button class="q-hint-btn" id="q-hint-btn" onclick="revealNextHintTier()">Hint (1/3)</button>`+
    `<div class="q-hint-box" id="q-hint-box"></div>`+
    `<div class="q-opts" role="group" aria-label="Answer choices">`;
  q.o.forEach((opt,i)=>h+=`<button class="q-opt" onclick="ansQ(${i})">`+
    `<svg class="q-opt-icon icon-correct" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`+
    `<svg class="q-opt-icon icon-wrong" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`+
    `<span>${ssFixLt(opt)}</span></button>`);
  h+=`</div><div class="q-exp" id="q-exp">${ssFixLt(q.e)}</div><button class="q-next show" id="q-next" onclick="nextQ()" style="display:none">Next →</button></div>`;
  qb.innerHTML=h;
  ssTypeset(qb);
  if(ssQuizTouched){var qt=qb.querySelector('.q-text');if(qt){qt.setAttribute('tabindex','-1');try{qt.focus({preventScroll:true});}catch(e){}}}
}
function toggleQBookmark(){
  const q=qPool[qIdx];if(!q)return;
  const on=qBookmarkToggle(qId(q));
  const btn=document.getElementById('q-bookmark');
  if(!btn)return;
  btn.classList.toggle('on',on);
  btn.setAttribute('aria-pressed',String(on));
  btn.setAttribute('aria-label',on?'Remove bookmark':'Bookmark this question');
  btn.innerHTML=on?'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.5 15.09 9.26 22 10.27 17 15.14 18.18 22 12 18.56 5.82 22 7 15.14 2 10.27 8.91 9.26"/></svg>'
    :'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.5 15.09 9.26 22 10.27 17 15.14 18.18 22 12 18.56 5.82 22 7 15.14 2 10.27 8.91 9.26"/></svg>';
}
// Three progressively stronger hints per question, each a click away
// rather than shown all at once -- a student who just wants a nudge (which
// unit this is from) shouldn't have to see the near-answer tier 3 gives.
// Tier 2 eliminates one wrong, unselected option (classic 50/50) without
// removing it from the DOM, so option indices (and ansQ(i)) stay valid.
let qHintTier=0;
function revealNextHintTier(){
  const q=qPool[qIdx];
  const box=document.getElementById('q-hint-box');
  const btn=document.getElementById('q-hint-btn');
  if(!q||!box||!btn||qHintTier>=3)return;
  qHintTier++;
  box.classList.add('show');
  if(qHintTier===1){
    box.textContent='Hint: this is from Unit '+q.u+': '+unitNameFor(q.u);
  }else if(qHintTier===2){
    const opts=Array.from(document.querySelectorAll('.q-opt'));
    const eliminable=opts.map((el,i)=>i).filter(i=>i!==q.a&&!opts[i].disabled);
    if(eliminable.length){
      const cut=eliminable[Math.floor(Math.random()*eliminable.length)];
      opts[cut].disabled=true;
      opts[cut].classList.add('q-opt-eliminated');
    }
    box.textContent='Hint: one wrong answer has been ruled out.';
  }else{
    const preview=(q.e||'').split(/(?<=[.!?])\s/)[0]||q.e||'';
    box.textContent='Hint: '+preview;
  }
  btn.textContent=qHintTier>=3?'No more hints':`Hint (${qHintTier+1}/3)`;
  if(qHintTier>=3)btn.disabled=true;
}
// What a quiz answer is worth: only a first, unaided correct answer earns mastery credit. A guess, a 50/50 (hint tier 2)
// or the answer preview (tier 3) counts as a miss, and a repeat of a question already seen answered records nothing.
function ssAnswerCredit(correct,guessed,hintTier,priorAsks){
  if(priorAsks>0)return {record:false,credited:false};
  return {record:true,credited:!!correct&&!guessed&&hintTier<2};
}
let guessFlag=false, guessedQs=[], guessedRight=0;
function markGuess(){
  guessFlag=!guessFlag;
  const b=document.getElementById('guess-btn');
  if(b){b.classList.toggle('on',guessFlag);b.innerHTML=guessFlag?"Marked as a guess":"I'm just guessing";}
}
function ansQ(i){
  const q=qPool[qIdx];
  const wasGuess=guessFlag;
  const priorAsks=requeueCounts.get(q)||0; // >0: this is a repeat of a question the student already saw answered
  const assisted=wasGuess||qHintTier>=2; // a 50/50 or the answer preview, or an admitted guess
  document.querySelectorAll('.q-opt').forEach((btn,idx)=>{
    btn.disabled=true;
    // Correct/wrong used to be shown by colour alone; add the same information as text for screen readers.
    var note=idx===q.a?(idx===i?' (your answer, correct)':' (correct answer)'):(idx===i?' (your answer, incorrect)':'');
    if(note){var sr=document.createElement('span');sr.className='sr-only';sr.textContent=note;btn.appendChild(sr);}
    if(idx===q.a)btn.classList.add('correct');
    else if(idx===i&&i!==q.a)btn.classList.add('wrong');
  });
  ssQuizTouched=true;
  if(i===q.a){qStreak++;qBestStreak=Math.max(qBestStreak,qStreak);}else{qStreak=0;qMissedUnits.add(q.u);}
  if(i===q.a){
    score++;
    if(window.__ssCelebrateCorrect){
      var correctBtn=document.querySelectorAll('.q-opt')[q.a];
      window.__ssCelebrateCorrect(correctBtn);
    }
    if(wasGuess){
      guessedQs.push(q);guessedRight++;
      const n=requeueCounts.get(q)||0;
      if(n<MAX_REQUEUES&&!diagMode){
        requeueCounts.set(q,n+1);
        qPool.splice(Math.min(qIdx+REQUEUE_DELAY,qPool.length),0,q);
      }
    }
  }else{
    if(window.__ssResetCombo)window.__ssResetCombo();
    if(wasGuess)guessedQs.push(q);
    const n=requeueCounts.get(q)||0;
    if(n<MAX_REQUEUES&&!diagMode){
      requeueCounts.set(q,n+1);
      qPool.splice(Math.min(qIdx+REQUEUE_DELAY,qPool.length),0,q);
    }
  }
  // Only a first, unaided correct answer earns mastery credit. A guess, a 50/50 or the answer preview counts as a miss, and
  // a repeat of a question the student has already seen answered is practice that records nothing.
  const credit=ssAnswerCredit(i===q.a,wasGuess,qHintTier,priorAsks);
  if(credit.record){
    if(SS_MASTERY)SS_MASTERY.recordAnswer(q.u,credit.credited);
    if(diagMode){const t=diagTally[q.u]||(diagTally[q.u]={correct:0,total:0});t.total++;if(credit.credited)t.correct++;}
  }
  if(i===q.a&&!assisted)mistakeLogRemove(q);else if(i!==q.a)mistakeLogAdd(q);
  ssOverallProgressUpdate();
  renderUnitProgress(q.u);
  const expEl=document.getElementById('q-exp');
  expEl.classList.add('show','q-why');
  expEl.classList.toggle('q-why-right',i===q.a);
  // "Why" card: say plainly whether they got it and what the answer is,
  // then the explanation. personality.js adds Sage beside the heading.
  if(!expEl.querySelector('.q-why-hd')){
    const hd=document.createElement('div');
    hd.className='q-why-hd';
    hd.innerHTML=i===q.a?'<p><b>Correct!</b> Here\u2019s why:</p>':'<p><b>Not quite.</b> The answer is <b></b>. Here\u2019s why:</p>';
    if(i!==q.a)hd.querySelectorAll('b')[1].innerHTML=ssFixLt(q.o[q.a]); // same trusted markup the option buttons render
    expEl.prepend(hd);
  }
  if(wasGuess){
    expEl.innerHTML=(i===q.a?'<b class="guess-flag">Lucky guess — added back for more practice.</b><br>':'<b class="guess-flag">Marked as a guess.</b><br>')+expEl.innerHTML;
  }
  ssTypeset(expEl); // the "answer is …" heading was just filled in, so typeset again
  // The static q.e explanation only ever covers why the correct answer is
  // right, not why the specific wrong choice a student picked is wrong --
  // that's a different explanation for every possible wrong option, not
  // worth pre-writing/storing for every question. Ask the AI helper
  // on-demand instead, scoped to exactly the choice this student made.
  const oldExplainBtn=document.getElementById('q-explain-wrong-btn');
  if(oldExplainBtn)oldExplainBtn.remove();
  if(i!==q.a){
    const explainBtn=document.createElement('button');
    explainBtn.type='button';
    explainBtn.id='q-explain-wrong-btn';
    explainBtn.className='q-explain-wrong-btn';
    explainBtn.textContent='Explain why "'+ssPlain(q.o[i])+'" is wrong';
    explainBtn.onclick=function(){
      var prompt='For this question: "'+ssPlain(q.q)+(q.fig?' ['+ssPlain(q.fig)+']':'')+'" -- why is the answer "'+ssPlain(q.o[i])+'" wrong? The correct answer is "'+ssPlain(q.o[q.a])+'". Keep it short and specific to that wrong choice, not a general re-explanation of the correct answer.';
      var display='Why is "'+ssPlain(q.o[i])+'" wrong?';
      cbotAskAndOpen(prompt,display);
    };
    expEl.appendChild(document.createElement('br'));
    expEl.appendChild(explainBtn);
  }
  // Inline "report this question": lands in the same feedback queue admins
  // already review, tagged with enough context to find the item.
  const oldRep=document.getElementById('q-report');
  if(oldRep)oldRep.remove();
  const rep=document.createElement('button');
  rep.type='button';rep.id='q-report';rep.className='q-report';
  rep.textContent='Report a problem with this question';
  rep.onclick=function(){
    var why=prompt('What looks wrong with this question? (wrong answer, typo, unclear...)');
    if(why===null)return;
    rep.disabled=true;rep.textContent='Sending\u2026';
    fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      category:'bug',page:location.pathname,
      message:('[Question report] '+SS_GUIDE.slug+' unit '+q.u+'\nQ: '+q.q+'\nKeyed answer: '+ssPlain(q.o[q.a])+'\nNote: '+(why||'(none)')).slice(0,1990)
    })}).then(function(r){rep.textContent=r.ok?'Thanks \u2014 reported for review':'Could not send \u2014 try again';rep.disabled=r.ok;})
      .catch(function(){rep.textContent='Could not send \u2014 try again';rep.disabled=false;});
  };
  expEl.appendChild(rep);
  var nextBtn=document.getElementById('q-next');
  nextBtn.style.display='inline-block';
  document.getElementById('q-sc').textContent=`Score: ${score}`;
  var _hl=document.getElementById('hero-live');
  if(_hl)_hl.textContent=(i===q.a?'Correct. ':'Incorrect. The correct answer is '+ssPlain(q.o[q.a])+'. ')+ssPlain(q.e||'');
  // The focused option was just disabled, which would drop keyboard focus to the page; keep it in the quiz on the next action.
  try{nextBtn.focus({preventScroll:true});}catch(e){}
  guessFlag=false;
}
let ssQuizTouched=false; // true once the student has acted in the quiz, so focus is only moved after real use, never on page load
function nextQ(){ssQuizTouched=true;qIdx++;showQ();}
// Bare-key shortcuts (1-4 to answer, Enter for Next) only act while focus is inside the question area itself. Anywhere else
// (a link, a tab, the search box, a dialog) the keys keep their normal meaning, and Enter on a focused button or link is left
// to that control, which is what a keyboard user expects (WCAG 2.1.1 / 2.1.4).
function ssQuizKeyboardShortcuts(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  var vq=document.getElementById('view-quiz');
  if(!vq||!vq.classList.contains('active'))return;
  var qb=document.getElementById('qbox');
  var el=document.activeElement;
  if(!qb||!el||!qb.contains(el))return;
  var tag=el.tagName||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||el.isContentEditable)return;
  if(e.key>='1'&&e.key<='4'){
    var idx=+e.key-1;
    var opts=document.querySelectorAll('.q-opt');
    if(opts[idx]&&!opts[idx].disabled){opts[idx].click();e.preventDefault();}
  }else if(e.key==='Enter'){
    if(tag==='BUTTON'||tag==='A'||el.closest('.q-exp'))return; // the focused control handles Enter itself
    var nb=document.getElementById('q-next');
    if(nb&&nb.style.display!=='none'){nb.click();e.preventDefault();}
  }
}
document.addEventListener('keydown',ssQuizKeyboardShortcuts);
buildQSel();
updateMistakeLogBadge();

/* ----- APG tabs: roving-tabindex arrow-key nav on the hero tab bar. Manual
   activation — arrows move focus only; Enter/Space fire the button's own click
   (native), which runs switchTab()/ssQuizTabClick() and syncs aria-selected. ----- */
(function(){
  var tl=document.querySelector('.tablist');
  if(!tl)return;
  var tabs=Array.prototype.slice.call(tl.querySelectorAll('.tab-btn'));
  if(!tabs.length)return;
  tl.addEventListener('keydown',function(e){
    var cur=tabs.indexOf(document.activeElement);
    if(cur<0)return;
    var next=null;
    if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(cur+1)%tabs.length;
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(cur-1+tabs.length)%tabs.length;
    else if(e.key==='Home')next=0;
    else if(e.key==='End')next=tabs.length-1;
    if(next===null)return;
    e.preventDefault();
    tabs.forEach(function(t,i){t.tabIndex=i===next?0:-1;});
    tabs[next].focus();
  });
})();

/* ----- Study plan as a calendar file (.ics). Pure functions, no DOM, so they can be tested. ----- */
function ssIcsText(t){return String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');}
// RFC 5545 caps lines at 75 octets; continuation lines start with one space.
function ssIcsFold(line){
  var enc=new TextEncoder(),out=[],cur='',n=0;
  for(var ch of line){
    var w=enc.encode(ch).length,max=out.length?74:75;
    if(n+w>max){out.push(cur);cur='';n=0;}
    cur+=ch;n+=w;
  }
  out.push(cur);
  return out.join('\r\n ');
}
function ssP2(n){return (n<10?'0':'')+n;}
function ssYmd(d){return d.getFullYear()+ssP2(d.getMonth()+1)+ssP2(d.getDate());}
// o: {days, mins, perDayQ, timeStr 'HH:MM', now Date, covered (units to cover), title, slug, origin, units [{id,name}]}
function ssBuildPlanIcs(o){
  var days=o.days,mins=o.mins,units=o.units,covered=o.covered,title=o.title,slug=o.slug;
  var hm=/^(\d{2}):(\d{2})$/.exec(o.timeStr)||['','16','00'];
  var now=o.now,exam=new Date(now.getFullYear(),now.getMonth(),now.getDate()+days);
  var start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  // Today only counts if the reminder time hasn't passed yet.
  if(now.getHours()*60+now.getMinutes()>=(+hm[1])*60+(+hm[2]))start.setDate(start.getDate()+1);
  var n=Math.max(1,Math.round((exam-start)/864e5));
  var stamp=now.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  var end=new Date(2000,0,1,+hm[1],+hm[2]+mins);
  var endStr=ssP2(end.getHours())+ssP2(end.getMinutes())+'00';
  var ev=[];
  // The last day of a multi-day plan is a final review, so the units are spread over the days before it.
  var m=n>1?n-1:1;
  for(var i=0;i<n;i++){
    var d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);
    var k=Math.min(i,m-1);
    var lo=Math.floor(k*covered/m),hi=Math.max(lo,Math.floor((k+1)*covered/m)-1);
    var names=[];for(var u=lo;u<=hi&&u<units.length;u++)names.push('Unit '+units[u].id+': '+units[u].name);
    var last=i===n-1&&n>1;
    var what=last?'Final review + mixed quiz':(names.length>1?'Units '+units[lo].id+'\u2013'+units[hi].id:'Unit '+units[lo].id);
    var desc=(last?'Mixed practice across everything you have covered.':names.join('\n'))+'\n\nGoal: about '+o.perDayQ+' questions in '+mins+' minutes.\nOpen the guide: '+o.origin+'/'+slug+'/';
    ev.push(['BEGIN:VEVENT','UID:'+slug+'-plan-'+ssYmd(d)+'@precisstudy.com','DTSTAMP:'+stamp,
      'DTSTART:'+ssYmd(d)+'T'+hm[1]+hm[2]+'00','DTEND:'+ssYmd(d)+'T'+endStr,
      'SUMMARY:'+ssIcsText('Study '+title+': '+what),'DESCRIPTION:'+ssIcsText(desc),
      'BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY','DESCRIPTION:'+ssIcsText('Study time: '+title),'END:VALARM','END:VEVENT'].join('\r\n'));
  }
  var next=new Date(exam.getFullYear(),exam.getMonth(),exam.getDate()+1);
  ev.push(['BEGIN:VEVENT','UID:'+slug+'-exam-'+ssYmd(exam)+'@precisstudy.com','DTSTAMP:'+stamp,
    'DTSTART;VALUE=DATE:'+ssYmd(exam),'DTEND;VALUE=DATE:'+ssYmd(next),'SUMMARY:'+ssIcsText(title+' exam day'),'TRANSP:TRANSPARENT','END:VEVENT'].join('\r\n'));
  var lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PrecisStudy//Study Plan//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+ssIcsText(title+' study plan')].concat(ev.join('\r\n').split('\r\n'),['END:VCALENDAR']);
  return lines.map(ssIcsFold).join('\r\n')+'\r\n';
}

(function(){
  var SS_TOTAL_Q=QUIZ.length, SS_UNIT_COUNT=UNITS.length, MIN_PER_Q=1.5;
  var daysEl=document.getElementById('spc-days');
  var minsEl=document.getElementById('spc-mins');
  if(!daysEl||!minsEl)return;
  var daysNum=document.getElementById('spc-days-num');
  var minsNum=document.getElementById('spc-mins-num');
  // A saved exam date (set on the homepage) pre-fills "days until your exam".
  try{
    var ex=JSON.parse(localStorage.getItem('ss-exam')||'null');
    if(ex&&/^\d{4}-\d{2}-\d{2}$/.test(ex.date)){
      var t0=new Date();t0.setHours(0,0,0,0);
      var dl=Math.round((new Date(ex.date+'T00:00:00')-t0)/864e5);
      if(dl>=parseInt(daysEl.min,10)&&dl<=parseInt(daysEl.max,10)){daysEl.value=dl;if(daysNum)daysNum.value=dl;}
    }
  }catch(e){/* no saved exam date */}
  var DAYS_DEFAULT=daysEl.value, MINS_DEFAULT=minsEl.value;
  function setFill(el){
    var min=parseFloat(el.min),max=parseFloat(el.max),val=parseFloat(el.value);
    var pct=max>min?((val-min)/(max-min))*100:0;
    el.style.setProperty('--fill',pct+'%');
  }
  function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
  function update(){
    var days=parseInt(daysEl.value,10);
    var mins=parseInt(minsEl.value,10);
    document.getElementById('spc-days-val').textContent=days+(days===1?' day':' days');
    if(daysNum)daysNum.value=days;
    if(minsNum)minsNum.value=mins;
    setFill(daysEl);setFill(minsEl);
    var totalMinutes=days*mins;
    var questions=Math.min(SS_TOTAL_Q,Math.round(totalMinutes/MIN_PER_Q));
    var pct=Math.min(100,Math.round((questions/SS_TOTAL_Q)*100));
    var units=Math.min(SS_UNIT_COUNT,Math.max(1,Math.round((pct/100)*SS_UNIT_COUNT)));
    document.getElementById('spc-questions').textContent=questions.toLocaleString();
    document.getElementById('spc-units').textContent=units;
    document.getElementById('spc-pct').textContent=pct+'%';
    var tier=document.getElementById('spc-tier');
    var title=document.getElementById('spc-tier-title');
    var sub=document.getElementById('spc-tier-sub');
    tier.classList.remove('good','moderate','behind');
    if(pct>=90){
      tier.classList.add('good');
      title.textContent='Exam Ready';sub.textContent="You'll work through the full question bank before test day.";
    }else if(pct>=50){
      tier.classList.add('moderate');
      title.textContent='On Track';sub.textContent='Solid coverage — keep this pace going.';
    }else{
      tier.classList.add('behind');
      title.textContent='Just Getting Started';sub.textContent='Add a few more minutes a day to cover more ground before your exam.';
    }
  }
  daysEl.addEventListener('input',update);
  minsEl.addEventListener('input',update);
  if(daysNum)daysNum.addEventListener('change',function(){
    daysEl.value=clamp(parseInt(daysNum.value,10)||parseInt(daysEl.min,10),parseInt(daysEl.min,10),parseInt(daysEl.max,10));
    update();
  });
  if(minsNum)minsNum.addEventListener('change',function(){
    minsEl.value=clamp(parseInt(minsNum.value,10)||parseInt(minsEl.min,10),parseInt(minsEl.min,10),parseInt(minsEl.max,10));
    update();
  });
  var resetBtn=document.getElementById('spc-reset-btn');
  if(resetBtn)resetBtn.addEventListener('click',function(){
    daysEl.value=DAYS_DEFAULT;minsEl.value=MINS_DEFAULT;update();
  });
  update();

  /* ----- "Add to calendar": the plan above as a downloadable .ics (no account needed) ----- */
  function buildPlanIcs(timeStr){
    return ssBuildPlanIcs({days:parseInt(daysEl.value,10),mins:parseInt(minsEl.value,10),perDayQ:Math.round(parseInt(minsEl.value,10)/MIN_PER_Q),
      timeStr:timeStr,now:new Date(),covered:Math.min(SS_UNIT_COUNT,Math.max(1,parseInt(document.getElementById('spc-units').textContent,10)||1)),
      title:SS_GUIDE.title,slug:SS_GUIDE.slug,origin:location.origin,units:UNITS});
  }
  var body=document.getElementById('spc-body');
  if(body&&resetBtn){
    var row=document.createElement('div');row.className='spc-cal';
    row.innerHTML='<label for="spc-cal-time">Daily reminder time</label><input type="time" id="spc-cal-time" value="16:00">'
      +'<button type="button" class="spc-cal-btn" id="spc-cal-btn">Add plan to calendar (.ics)</button>'
      +'<span class="spc-cal-note" id="spc-cal-note" role="status" aria-live="polite"></span>';
    body.insertBefore(row,resetBtn);
    try{var saved=localStorage.getItem('ss-cal-time');if(saved)document.getElementById('spc-cal-time').value=saved;}catch(e){}
    document.getElementById('spc-cal-btn').addEventListener('click',function(){
      var t=document.getElementById('spc-cal-time').value||'16:00';
      try{localStorage.setItem('ss-cal-time',t);}catch(e){}
      var url=URL.createObjectURL(new Blob([buildPlanIcs(t)],{type:'text/calendar;charset=utf-8'}));
      var a=document.createElement('a');a.href=url;a.download=SS_GUIDE.slug+'-study-plan.ics';
      document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);
      document.getElementById('spc-cal-note').textContent='Downloaded. Open the file to add it to your calendar.';
    });
  }
})();

/* ===== study helper chatbot ===== */
let cbotIndex=null;
let cbotHistory=[];

const CBOT_STOPWORDS=['the','and','for','are','was','with','that','this','from','its','has','have','measure','measures','find','which',
  'what','why','when','where','how','does','did','do','mean','means','meaning','call','called','word','words',
  'kind','type','types','use','used','using','know','understand','explain','tell','please','can','could','would',
  'should','will','going','get','gets','got','need','needs','like','about','some','any','all','one','two','they',
  'them','their','there','here','then','than','into','onto','your','you','our','out','not','but','just','really',
  'actually','basically','thing','things','stuff','exam','test','question','guide','regents','also','more','most',
  'much','many','make','made','making','give','gives','given','look','looks','looking','see','seen','say','says',
  'said','want','wants','wanted'];
function cbotTokenize(s){
  return (s||'').toLowerCase().replace(/[△∠≅≠∥⊥°±→↔⇌√π²³⁺⁻⁰¹⁴⁵⁶⁷⁸⁹½⅓⅔¼×÷≈≤≥Δ·]/g,' ')
    .split(/[^a-z0-9']+/).filter(t=>t.length>2 && !CBOT_STOPWORDS.includes(t));
}

function cbotBuildIndex(){
  const idx=[];
  UNITS.forEach(u=>{
    u.concepts.forEach(c=>{
      const text=(c.intro||'')+' '+(c.b||[]).join(' ');
      idx.push({label:c.l,unit:u.id,unitName:u.name,source:'Unit '+u.id+' — '+u.name,
        text:text.replace(/<[^>]+>/g,''),tokens:cbotTokenize(c.l+' '+text),
        jump:function(){cbotJumpGuide(u.id,c.l);}});
    });
  });
  document.querySelectorAll('#view-memory .mem-card').forEach(card=>{
    const t=card.querySelector('.mem-t'),d=card.querySelector('.mem-d');
    if(!t||!d)return;
    idx.push({label:t.textContent,source:'Memory Trick',text:d.textContent,
      tokens:cbotTokenize(t.textContent+' '+d.textContent),
      jump:function(){switchTab('memory');setTimeout(()=>card.scrollIntoView({behavior:ssScrollBehavior(),block:'center'}),80);}});
  });
  document.querySelectorAll('#view-qref .qr-card').forEach(card=>{
    const k=card.querySelector('.qr-k'),v=card.querySelector('.qr-v');
    if(!k||!v)return;
    idx.push({label:k.textContent,source:'Quick Reference',text:v.textContent,
      tokens:cbotTokenize(k.textContent+' '+v.textContent),
      jump:function(){switchTab('qref');setTimeout(()=>card.scrollIntoView({behavior:ssScrollBehavior(),block:'center'}),80);}});
  });
  document.querySelectorAll('#view-qref .qr-table tr').forEach(row=>{
    const cells=row.querySelectorAll('td');
    if(cells.length<2)return;
    const label=cells[0].textContent,text=cells[1].textContent;
    idx.push({label:label,source:'Quick Reference',text:text,tokens:cbotTokenize(label+' '+text),
      jump:function(){switchTab('qref');setTimeout(()=>row.scrollIntoView({behavior:ssScrollBehavior(),block:'center'}),80);}});
  });
  return idx;
}

function cbotJumpGuide(unitId,conceptLabel){
  switchTab('guide');
  if(typeof filterTags!=='undefined'&&filterTags[unitId])filterTags[unitId].click();
  const unitDiv=document.querySelector('.unit[data-id="'+unitId+'"]');
  if(!unitDiv)return;
  unitDiv.classList.add('open');
  let target=unitDiv;
  unitDiv.querySelectorAll('.concept .c-label').forEach(el=>{if(el.textContent===conceptLabel)target=el.closest('.concept');});
  setTimeout(()=>target.scrollIntoView({behavior:ssScrollBehavior(),block:'start'}),80);
}

function cbotSearch(query){
  if(!cbotIndex)cbotIndex=cbotBuildIndex();
  const qTokens=cbotTokenize(query);
  if(!qTokens.length)return [];
  const scored=cbotIndex.map(entry=>{
    let score=0;
    qTokens.forEach(qt=>{
      if(entry.tokens.includes(qt))score+=2;
      else if(entry.tokens.some(et=>et.includes(qt)||qt.includes(et)))score+=1;
    });
    const labelLower=entry.label.toLowerCase();
    qTokens.forEach(qt=>{if(labelLower.includes(qt))score+=1.5;});
    return {entry,score};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
  return scored.slice(0,3);
}

var cbotReturnFocus=null;
function cbotKeydown(e){if(e.key==='Escape'){var p=document.getElementById('cbot-panel');if(p&&p.contains(document.activeElement))cbotToggle();}}
function cbotToggle(){
  var panel=document.getElementById('cbot-panel');
  var opening=panel.classList.toggle('open');
  panel.setAttribute('aria-hidden',opening?'false':'true');
  if(!opening){
    document.removeEventListener('keydown',cbotKeydown);
    if(cbotReturnFocus&&document.contains(cbotReturnFocus))cbotReturnFocus.focus();
    cbotReturnFocus=null;
  }
  if(opening){
    cbotReturnFocus=document.activeElement;
    document.addEventListener('keydown',cbotKeydown);
    ssBringToFront(panel);
    setTimeout(function(){var i=document.getElementById('cbot-input');if(i)i.focus();},0);
    if(!cbotHistory.length){const ex=cbotExamples();cbotAddMsg('bot',"Hi! Ask me about any term or concept from the guide — like "+ex[0]+" or "+ex[1]+" — and I'll pull up the explanation. No setup needed.");};
  }
}
// Bouncing-dots bubble shown while the AI Study Helper's reply is pending.
// cbotAddMsg() removes it automatically the moment a real bot message
// renders, so every reply path (proxy, custom API, local search fallback)
// clears it without needing its own cleanup call.
function cbotShowTyping(){
  cbotHideTyping();
  const wrap=document.getElementById('cbot-msgs');
  if(!wrap)return;
  const div=document.createElement('div');
  div.className='cbot-msg bot cbot-typing';
  div.id='cbot-typing-indicator';
  div.setAttribute('aria-label','AI Study Helper is typing');
  div.innerHTML='<span class="cbot-typing-dot"></span><span class="cbot-typing-dot"></span><span class="cbot-typing-dot"></span>';
  wrap.appendChild(div);
  wrap.scrollTop=wrap.scrollHeight;
}
function cbotHideTyping(){
  const el=document.getElementById('cbot-typing-indicator');
  if(el)el.remove();
}
// historyText lets the transcript sent to the model differ from what the
// student sees -- e.g. ssExplainWrongAnswer shows "Why is 'X' wrong?" but
// the model needs the full question/choice/correct-answer context to
// actually answer that, not just the four-word display bubble.
// Two example terms from THIS guide's flashcards, so the helper's prompts match the subject.
function cbotExamples(){
  const f=(typeof FLASHCARDS!=='undefined'&&FLASHCARDS)||[];
  const terms=f.map(function(c){return c.t;}).filter(function(x){return x&&x.length<=32;});
  return terms.length>=2?['\"'+terms[0]+'\"','\"'+terms[Math.floor(terms.length/2)]+'\"']:['a term','a concept'];
}
function cbotAddMsg(role,text,jumpFn,jumpLabel,historyText){
  if(role==='bot')cbotHideTyping();
  const wrap=document.getElementById('cbot-msgs');
  const div=document.createElement('div');
  div.className='cbot-msg '+role;
  div.textContent=text;
  if(jumpFn){
    const btn=document.createElement('button');
    btn.className='cbot-jump';btn.textContent=jumpLabel||'Jump to this in the guide →';
    btn.onclick=jumpFn;
    div.appendChild(document.createElement('br'));
    div.appendChild(btn);
  }
  wrap.appendChild(div);
  wrap.scrollTop=wrap.scrollHeight;
  cbotHistory.push({role:role==='user'?'user':'assistant',content:historyText!==undefined?historyText:text});
}


const CBOT_PUBLISHED=(location.protocol==='http:'||location.protocol==='https:');

// What Sage should know about where the student is: the tab, the unit or
// quiz question on screen, and the guide passages that match their question
// (so answers come from this course's notes, not just the model's memory).
function cbotContext(query){
  const strip=function(h){const d=document.createElement('div');d.innerHTML=String(h||'');return (d.textContent||'').replace(/\s+/g,' ').trim();};
  const ctx={notes:[]};
  const tab=document.querySelector('.tab-btn.active');if(tab)ctx.tab=tab.textContent.trim();
  const quizOn=document.getElementById('view-quiz')&&document.getElementById('view-quiz').classList.contains('active');
  const q=quizOn&&typeof qPool!=='undefined'&&qPool[qIdx];
  if(q){
    ctx.question=strip(q.q)+(q.o?' Options: '+q.o.map(strip).join(' | '):'');
    const u=UNITS.find(function(x){return x.id===q.u;});if(u)ctx.unit='Unit '+u.id+': '+u.name;
  }else{
    const open=document.querySelector('#units > .unit.open .unit-title');
    if(open&&open.firstChild)ctx.unit=open.firstChild.textContent.trim();
  }
  try{ctx.notes=cbotSearch(query).map(function(r){return (r.entry.label+': '+strip(r.entry.text)).slice(0,600);}).filter(function(n,i,a){return a.indexOf(n)===i;}).slice(0,3);}catch(e){}
  return ctx;
}

async function cbotCallProxy(query){
  const history=cbotHistory.slice(-9).map(m=>({role:m.role,content:m.content}));
  const res=await fetch('/api/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({history:history,context:cbotContext(query)})
  });
  if(!res.ok){
    let detail='';
    try{const errBody=await res.json();detail=errBody&&errBody.error?': '+errBody.error:'';}catch(e){}
    throw new Error(res.status+detail);
  }
  const data=await res.json();
  return data.reply;
}

// Shared by the free-text input (cbotSend) and any programmatic prompt
// (e.g. ssExplainWrongAnswer's "why is this wrong?") -- both need the exact
// same search-then-AI-then-fallback flow, just with the query coming from
// a different place.
async function cbotAsk(query){
  const sendBtn=document.querySelector('#cbot-form button[type="submit"]');
  if(sendBtn)sendBtn.disabled=true;
  cbotShowTyping();

  const results=cbotSearch(query);
  const exs=cbotExamples();
  const noKeyFallbackText="I couldn't find that in the guide. Try a specific term (e.g. "+exs[0]+", "+exs[1]+") or check the Quick Reference / Memory Tricks tabs.";

  if(CBOT_PUBLISHED){
    try{
      const reply=await cbotCallProxy(query);
      const top=results.length?results[0].entry:null;
      cbotAddMsg('bot',reply||"I didn't get a usable reply — try rephrasing?",top&&top.jump,top?'Jump to this in the guide →':undefined);
    }catch(err){
      cbotAddMsg('bot','The AI helper is temporarily unavailable ('+err.message+'). Here\'s the closest match from the guide instead:');
      if(results.length){const top=results[0].entry;cbotAddMsg('bot',top.label+'\n\n'+top.text,top.jump,'Jump to this in the guide →');}
      else cbotAddMsg('bot',noKeyFallbackText);
    }
  }else if(results.length&&results[0].score>=2.5){
    const top=results[0].entry;
    cbotAddMsg('bot',top.label+'\n\n'+top.text+'\n\n['+top.source+']',top.jump,'Jump to this in the guide →');
  }else if(results.length){
    const top=results[0].entry;
    cbotAddMsg('bot',"Not an exact match, but this looks related:\n\n"+top.label+'\n\n'+top.text,top.jump,'Jump to this in the guide →');
  }else{
    cbotAddMsg('bot',noKeyFallbackText);
  }
  if(sendBtn)sendBtn.disabled=false;
}
async function cbotSend(e){
  e.preventDefault();
  const input=document.getElementById('cbot-input');
  const query=input.value.trim();
  if(!query)return false;
  cbotAddMsg('user',query);
  input.value='';
  await cbotAsk(query);
  return false;
}
// Opens the AI helper panel (if not already open) and asks it a
// programmatic question -- used by ssExplainWrongAnswer(). displayQuery is
// what shows in the chat transcript (short, human-readable); if omitted,
// the full query is shown as-is.
function cbotAskAndOpen(query,displayQuery){
  const panel=document.getElementById('cbot-panel');
  if(panel&&!panel.classList.contains('open'))cbotToggle();
  if(typeof toolkitClose==='function')toolkitClose();
  cbotAddMsg('user',displayQuery||query,undefined,undefined,query);
  cbotAsk(query);
}

/* study session timer in the nav: a stopwatch, or Pomodoro mode (25 min focus / 5 min break, 15 after every 4th) */
const SS_POMO={focus:25*60,short:5*60,long:15*60,every:4};
// What comes after the current Pomodoro phase. `done` counts finished focus sessions.
function ssPomoNext(phase,done){
  if(phase==='focus'){const d=done+1;return{phase:'break',done:d,secs:d%SS_POMO.every===0?SS_POMO.long:SS_POMO.short};}
  return{phase:'focus',done:done,secs:SS_POMO.focus};
}
function ssFmtClock(s){
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
  return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');
}
(function(){
  var nav=document.querySelector('.hero .nav');if(!nav)return;
  var ICON_PLAY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
  var ICON_PAUSE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  var ICON_RESET='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 17 5"/><polyline points="21 3 21 9 15 9"/></svg>';
  var ICON_POMO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 3h6"/></svg>';
  var d=document.createElement('div');d.id='sg-timer';
  d.innerHTML='<span class="sgt-label">Study timer</span><span id="sgt-time" role="timer">00:00</span>'+
    '<button class="sgt-b" id="sgt-btn" aria-label="start study timer">'+ICON_PLAY+'</button>'+
    '<button class="sgt-b" id="sgt-reset" aria-label="reset study timer">'+ICON_RESET+'</button>'+
    '<button class="sgt-b sgt-mode" id="sgt-mode" aria-pressed="false" aria-label="Pomodoro mode: 25 minute focus sessions with 5 minute breaks" title="Pomodoro: 25 min focus, 5 min break">'+ICON_POMO+'</button>';
  nav.appendChild(d);
  var timeEl=document.getElementById('sgt-time'),btn=document.getElementById('sgt-btn'),modeBtn=document.getElementById('sgt-mode');
  var mode='watch',run=false,last=0,iv=null,elapsed=0,phase='focus',done=0,left=SS_POMO.focus;
  try{if(localStorage.getItem('ss-timer-mode')==='pomo')mode='pomo';}catch(e){}
  function say(msg){var l=document.getElementById('hero-live');if(l)l.textContent=msg;}
  // A short two-note chime, only after the student has pressed start (so audio is allowed).
  function chime(){
    try{
      var C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      var ctx=new C(),t=ctx.currentTime;
      [660,880].forEach(function(f,i){
        var o=ctx.createOscillator(),g=ctx.createGain(),at=t+i*.18;
        o.frequency.value=f;o.connect(g);g.connect(ctx.destination);
        g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.15,at+.02);g.gain.exponentialRampToValueAtTime(.0001,at+.3);
        o.start(at);o.stop(at+.32);
      });
      setTimeout(function(){ctx.close();},900);
    }catch(e){/* no audio available: the live-region message still announces the change */}
  }
  function render(){
    timeEl.textContent=ssFmtClock(mode==='pomo'?Math.max(0,Math.ceil(left)):Math.floor(elapsed));
    timeEl.dataset.phase=mode==='pomo'?phase:'';
    modeBtn.setAttribute('aria-pressed',String(mode==='pomo'));
    var label=mode==='pomo'?(phase==='focus'?'Focus session '+(done+1):'Break'):'Study timer';
    timeEl.setAttribute('aria-label',label+', '+timeEl.textContent);
    btn.innerHTML=run?ICON_PAUSE:ICON_PLAY;
    btn.setAttribute('aria-label',(run?'pause ':'start ')+(mode==='pomo'?'pomodoro':'study')+' timer');
  }
  function tick(){
    var now=Date.now(),dt=(now-last)/1000;last=now; // wall-clock based, so a throttled background tab stays accurate
    if(mode==='watch')elapsed+=dt;
    else{
      left-=dt;
      while(left<=0){
        var carry=-left,n=ssPomoNext(phase,done);
        phase=n.phase;done=n.done;left=n.secs-carry;
        chime();
        say(phase==='break'?'Focus session '+done+' complete. Take a '+Math.round(n.secs/60)+' minute break.':'Break over. Time to focus.');
      }
    }
    render();
  }
  function stop(){run=false;clearInterval(iv);}
  btn.onclick=function(){
    run=!run;
    if(run){last=Date.now();iv=setInterval(tick,500);}else{tick();stop();}
    render();
  };
  document.getElementById('sgt-reset').onclick=function(){
    stop();elapsed=0;phase='focus';done=0;left=SS_POMO.focus;render();
  };
  modeBtn.onclick=function(){
    stop();mode=mode==='pomo'?'watch':'pomo';elapsed=0;phase='focus';done=0;left=SS_POMO.focus;
    try{localStorage.setItem('ss-timer-mode',mode);}catch(e){}
    say(mode==='pomo'?'Pomodoro mode on: 25 minute focus sessions.':'Stopwatch mode on.');
    render();
  };
  render();
})();

/* Pinning the hero tab row on scroll (position:fixed + measured spacer) was
   found during QA to visually overlap page content in some scroll states —
   disabled pending a redesign that doesn't rely on a JS-measured spacer.
   The tab row stays in its normal in-flow position; the independent sticky
   search/filter bar (.ss-sticky-top, CSS-only position:sticky) is unaffected
   and still docks correctly since it doesn't depend on --ss-nav-h being set
   (it defaults to 0px). */

function ssToggleTheme(){
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('ss-theme', 'light'); } catch (e) {}
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('ss-theme', 'dark'); } catch (e) {}
  }
}

// Dyslexia-friendly mode: Atkinson Hyperlegible + looser spacing (guide-polish.css,
// html[data-dys]). Persisted; the head script applies it before first paint.
function ssToggleDyslexia(){
  var on = document.documentElement.toggleAttribute('data-dys');
  try { localStorage.setItem('ss-dyslexia', on ? '1' : '0'); } catch (e) {}
  var btn = document.getElementById('dys-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(on));
}
(function(){
  var btn = document.getElementById('dys-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(document.documentElement.hasAttribute('data-dys')));
})();

// Hides the hero (breadcrumb, title, tab bar, toolbar) so the current
// panel's content fills the viewport -- session-only, not persisted, since
// it's a per-reading-session choice, not a standing preference like theme.
function ssToggleFocusMode(){
  var on = document.documentElement.classList.toggle('ss-focus-mode');
  var btn = document.getElementById('focus-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(on));
  if (on) document.getElementById('focus-exit-btn').focus();
  else if (btn) btn.focus();
}
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  if (document.documentElement.classList.contains('ss-focus-mode')) ssToggleFocusMode();
});

/* ===== PrecisStudy auth ===== */
let SS_SESSION;

function ssLoginBoxHtml(){
  // Carry the page the student is on through OAuth so they land back here
  // (e.g. /calculus/quiz) instead of the site root. The worker validates
  // this via safeNext() — same-origin absolute paths only.
  var n = encodeURIComponent(location.pathname);
  return '<a class="ss-oauth-btn" href="/auth/google/start?next=' + n + '">Continue with Google</a>'
    + '<a class="ss-oauth-btn" href="/auth/github/start?next=' + n + '">Continue with GitHub</a>'
    + '<div class="ss-status"></div>';
}

function ssRenderLoginBoxes(){
  document.querySelectorAll('.ss-login-box').forEach(function(el){ el.innerHTML = ssLoginBoxHtml(); });
}

async function ssCheckSession(){
  try{
    // Shared with mastery.js/unit-order.js so the page asks only once.
    window.__ssMe = window.__ssMe || fetch('/auth/me').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    const data = await window.__ssMe;
    SS_SESSION = data && data.loggedIn ? data : false;
  }catch(e){
    SS_SESSION = false;
  }
  window.__ssSignedIn = !!SS_SESSION;
  return SS_SESSION;
}

// The whole quiz is open to everyone; signing in only syncs progress. So the unit picker is always shown and the
// note is just a nudge for signed-out students.
function ssApplyQuizGate(){
  const sel = document.getElementById('q-sel');
  const note = document.getElementById('anon-quiz-note');
  if(sel) sel.style.display = '';
  if(SS_SESSION){
    if(note) note.style.display = 'none';
  }else if(note){
    note.style.display = 'block'; ssRenderLoginBoxes();
  }
}

async function ssQuizTabClick(){
  switchTab('quiz');
  if(SS_SESSION === undefined) await ssCheckSession();
  ssApplyQuizGate();
}

ssCheckSession();

/* ----- Reference drawer: a compact, always-available companion to the full
   Quick Reference TAB. Reuses the exact HTML the generator already emits into
   #view-qref (buildQref() in generate-guide.mjs) instead of rebuilding it —
   the drawer body is filled by copying that markup once, on first open. ----- */
function qrefDrawerOpen(){
  var panel=document.getElementById('qref-drawer');
  if(!panel)return;
  var body=document.getElementById('qref-drawer-body');
  if(body&&!body.dataset.filled){
    var src=document.getElementById('view-qref');
    if(src){body.innerHTML=src.innerHTML;body.dataset.filled='1';}
  }
  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  ssBringToFront(panel);
  var fab=document.getElementById('qref-drawer-fab');
  if(fab)fab.setAttribute('aria-expanded','true');
  var closeBtn=panel.querySelector('.qref-drawer-close');
  if(closeBtn)closeBtn.focus();
  document.addEventListener('keydown',qrefDrawerKeydown);
}
function qrefDrawerClose(){
  var panel=document.getElementById('qref-drawer');
  if(!panel||!panel.classList.contains('open'))return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden','true');
  var fab=document.getElementById('qref-drawer-fab');
  if(fab){fab.setAttribute('aria-expanded','false');fab.focus();}
  document.removeEventListener('keydown',qrefDrawerKeydown);
}
function qrefDrawerToggle(){
  var panel=document.getElementById('qref-drawer');
  if(panel&&panel.classList.contains('open'))qrefDrawerClose();else qrefDrawerOpen();
}
function qrefDrawerKeydown(e){if(e.key==='Escape')qrefDrawerClose();}

/* ----- Optional Desmos graphing calculator. Disabled by default: leave
   DESMOS_API_KEY empty and this entire feature (button, panel, external
   script) never appears and never makes a network request. To enable it,
   the site owner gets a free key for personal/school use at
   https://www.desmos.com/api/v1.12/calculator.js docs (sign in at
   desmos.com/my-api) and pastes it in below. Generic — available on every
   guide once a key is configured, not gated to any subject. ----- */
const DESMOS_API_KEY = "8479496f50ff414cac31c105094c403c";
let desmosScriptLoaded=false, desmosCalculator=null;
function desmosInit(){
  if(!DESMOS_API_KEY)return;
  var panel=document.createElement('div');
  panel.id='desmos-panel';
  panel.className='desmos-panel';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','false');
  panel.setAttribute('aria-label','Graphing calculator');
  panel.setAttribute('aria-hidden','true');
  panel.innerHTML='<div class="desmos-panel-hd"><b>Graphing Calculator</b>'+
    '<button type="button" class="desmos-panel-close" aria-label="Close graphing calculator">✕</button></div>'+
    '<div class="desmos-calc" id="desmos-calc"></div>';
  document.body.appendChild(panel);
  panel.querySelector('.desmos-panel-close').onclick=desmosToggle;
  ssMakeDraggable(panel,'.desmos-panel-hd');
}
function desmosToggle(){
  var panel=document.getElementById('desmos-panel');
  if(!panel)return;
  var opening=!panel.classList.contains('open');
  panel.classList.toggle('open',opening);
  panel.setAttribute('aria-hidden',opening?'false':'true');
  var fab=document.getElementById('desmos-fab');
  if(fab)fab.setAttribute('aria-expanded',opening?'true':'false');
  if(opening){
    ssBringToFront(panel);
    document.addEventListener('keydown',desmosKeydown);
    if(!desmosScriptLoaded)desmosLoadScript();
  }else{
    document.removeEventListener('keydown',desmosKeydown);
    if(fab)fab.focus();
  }
}
function desmosKeydown(e){if(e.key==='Escape')desmosToggle();}
function desmosLoadScript(){
  desmosScriptLoaded=true;
  var s=document.createElement('script');
  s.src='https://www.desmos.com/api/v1.12/calculator.js?apiKey='+encodeURIComponent(DESMOS_API_KEY);
  s.onload=function(){
    var el=document.getElementById('desmos-calc');
    if(el&&window.Desmos)desmosCalculator=Desmos.GraphingCalculator(el);
  };
  document.head.appendChild(s);
}
/* The AI Study Helper's panel (#cbot-panel and children) is referenced by
   id throughout cbotToggle()/cbotSend()/etc. above, but no template file
   ever emits that markup as static HTML — inject it once here so those
   existing functions have something to operate on. */
function cbotPanelInit(){
  if(document.getElementById('cbot-panel'))return;
  var panel=document.createElement('div');
  panel.id='cbot-panel';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Study helper');panel.setAttribute('aria-hidden','true');
  panel.innerHTML='<div class="cbot-hd"><b>Study Helper</b>'+
    '<button type="button" onclick="cbotToggle()" aria-label="Close study helper">✕</button></div>'+
    '<div class="cbot-disclaimer">AI-generated — can be wrong, especially on math and science. Double-check anything important.</div>'+
    '<div id="cbot-msgs" role="log" aria-live="polite" aria-label="Conversation"></div>'+
    '<form id="cbot-form" onsubmit="return cbotSend(event)">'+
      '<input id="cbot-input" type="text" enterkeyhint="send" aria-label="Ask the study helper" placeholder="Ask about a term or concept…" autocomplete="off"/>'+
      '<button type="submit" aria-label="Send">➤</button>'+
    '</form>';
  document.body.appendChild(panel);
  ssMakeDraggable(panel,'.cbot-hd');
}

/* Consolidated "toolkit" FAB: one floating button that pops open a small
   speed-dial menu of the individual tools (Quick Reference, AI Study
   Helper, and — only when configured — the Desmos calculator), instead of
   each tool having its own separate floating button. */
/* ---- Draggable toolkit windows: every panel opened from the toolkit menu
   (Quick Reference, AI Study Helper, Calculator, Official Reference) can be
   open at the same time as the others and moved anywhere on screen by its
   header, like a floating desktop window. Dragging or clicking a panel
   raises it above the others via a shared, ever-increasing z-index. ---- */
var ssTopZ=300;
function ssBringToFront(panel){panel.style.zIndex=String(++ssTopZ);}
function ssMakeDraggable(panel,handleSelector){
  if(!panel||panel._ssDraggable)return;
  var handle=typeof handleSelector==='string'?panel.querySelector(handleSelector):handleSelector;
  if(!handle)return;
  panel._ssDraggable=true;
  handle.style.cursor='move';
  handle.style.touchAction='none';
  var dragging=false,startX=0,startY=0,startLeft=0,startTop=0;
  function pointOf(e){return e.touches&&e.touches.length?e.touches[0]:e;}
  function down(e){
    if(e.target.closest('button,a,input,select,textarea'))return;
    ssBringToFront(panel);
    dragging=true;
    var pt=pointOf(e);
    startX=pt.clientX;startY=pt.clientY;
    var rect=panel.getBoundingClientRect();
    startLeft=rect.left;startTop=rect.top;
    panel.style.left=startLeft+'px';
    panel.style.top=startTop+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    document.body.style.userSelect='none';
    if(e.cancelable)e.preventDefault();
  }
  function move(e){
    if(!dragging)return;
    var pt=pointOf(e);
    var newLeft=startLeft+(pt.clientX-startX);
    var newTop=startTop+(pt.clientY-startY);
    newLeft=Math.max(8-panel.offsetWidth+40,Math.min(newLeft,window.innerWidth-40));
    newTop=Math.max(0,Math.min(newTop,window.innerHeight-40));
    panel.style.left=newLeft+'px';
    panel.style.top=newTop+'px';
    if(e.cancelable)e.preventDefault();
  }
  function up(){dragging=false;document.body.style.userSelect='';}
  handle.addEventListener('mousedown',down);
  document.addEventListener('mousemove',move);
  document.addEventListener('mouseup',up);
  handle.addEventListener('touchstart',down,{passive:false});
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('touchend',up);
  panel.addEventListener('mousedown',function(){ssBringToFront(panel);});
  panel.addEventListener('touchstart',function(){ssBringToFront(panel);},{passive:true});
}

function toolkitInit(){
  var fab=document.createElement('button');
  fab.type='button';
  fab.id='toolkit-fab';
  fab.className='toolkit-fab';
  fab.setAttribute('aria-label','Open study toolkit');
  fab.setAttribute('aria-expanded','false');
  fab.title='Study toolkit';
  fab.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/><path d="M3 12h18"/><path d="M10 12v2M14 12v2"/></svg><span class="toolkit-fab-label">Tools</span>';

  var menu=document.createElement('div');
  menu.id='toolkit-menu';
  menu.className='toolkit-menu';
  menu.setAttribute('role','menu');

  function item(label,svg,onClick){
    var b=document.createElement('button');
    b.type='button';
    b.className='toolkit-item';
    b.setAttribute('role','menuitem');
    b.innerHTML=svg+'<span>'+label+'</span>';
    b.onclick=function(){ toolkitClose(); onClick(); };
    menu.appendChild(b);
  }

  item('Quick Reference','<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',qrefDrawerToggle);
  item('AI Study Helper','<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',cbotToggle);
  if('speechSynthesis' in window)item('Read-aloud voice',SS_TTS_SPEAKER_ICON,ssOpenVoiceDialog);
  if(DESMOS_API_KEY){
    item('Graphing Calculator','<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 9 13 13 21 5"/><polyline points="15 5 21 5 21 11"/></svg>',desmosToggle);
  }
  if(typeof OFFICIAL_REFERENCE!=='undefined'&&OFFICIAL_REFERENCE){
    var refSvg='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 11h2"/></svg>';
    // .content is a self-contained formula sheet rendered in-page (e.g. the
    // Digital SAT's on-screen Math Reference) -- .url is for a genuinely
    // external, authoritative document (a state exam's official PDF) that
    // this site shouldn't be reproducing or risk going stale on.
    item(OFFICIAL_REFERENCE.label,refSvg,OFFICIAL_REFERENCE.content?referencePanelToggle:function(){window.open(OFFICIAL_REFERENCE.url,'_blank','noopener');});
  }

  fab.onclick=toolkitToggle;
  document.body.appendChild(menu);
  document.body.appendChild(fab);
}
function toolkitToggle(){
  var menu=document.getElementById('toolkit-menu');
  if(menu&&menu.classList.contains('open'))toolkitClose();else toolkitOpen();
}
function toolkitOpen(){
  var menu=document.getElementById('toolkit-menu'),fab=document.getElementById('toolkit-fab');
  if(!menu||!fab)return;
  menu.classList.add('open');
  fab.setAttribute('aria-expanded','true');
  document.addEventListener('keydown',toolkitKeydown);
  document.addEventListener('click',toolkitOutsideClick,true);
}
function toolkitClose(){
  var menu=document.getElementById('toolkit-menu'),fab=document.getElementById('toolkit-fab');
  if(!menu||!menu.classList.contains('open'))return;
  menu.classList.remove('open');
  if(fab)fab.setAttribute('aria-expanded','false');
  document.removeEventListener('keydown',toolkitKeydown);
  document.removeEventListener('click',toolkitOutsideClick,true);
}
function toolkitKeydown(e){if(e.key==='Escape')toolkitClose();}
function toolkitOutsideClick(e){
  var menu=document.getElementById('toolkit-menu'),fab=document.getElementById('toolkit-fab');
  if(menu&&!menu.contains(e.target)&&fab&&!fab.contains(e.target))toolkitClose();
}

/* ----- Keyboard-shortcuts reference modal, opened with "?" (see the
   keydown listener above). Injected the same way as the AI helper panel
   (cbotPanelInit) since no static template markup exists for it — this is a
   template-only, always-available feature, not subject-specific content. ----- */
function shortcutsModalInit(){
  if(document.getElementById('shortcuts-modal'))return;
  var panel=document.createElement('div');
  panel.id='shortcuts-modal';
  panel.className='shortcuts-modal';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','Keyboard shortcuts');
  panel.setAttribute('aria-hidden','true');
  var rows=[
    ['/','Focus search'],
    ['Space','Flip flashcard (Flashcards tab)'],
    ['← →','Previous / next flashcard'],
    ['1 / 2','Flashcards: known / still learning'],
    ['1 – 4','Answer a quiz question (while focus is in the quiz)'],
    ['Enter','Next question · flip flashcard'],
    ['Esc','Close panels'],
    ['?','Show this list']
  ];
  panel.innerHTML='<div class="shortcuts-modal-card"><div class="shortcuts-modal-hd"><b>Keyboard Shortcuts</b>'+
    '<button type="button" class="shortcuts-modal-close" onclick="shortcutsModalClose()" aria-label="Close shortcuts">✕</button></div>'+
    '<div class="shortcuts-modal-body">'+rows.map(function(r){return '<div class="shortcuts-modal-row"><span>'+r[1]+'</span><kbd>'+r[0]+'</kbd></div>';}).join('')+'</div></div>';
  document.body.appendChild(panel);
}
var shortcutsModalReturnFocus=null;
function shortcutsModalOpen(){
  var panel=document.getElementById('shortcuts-modal');
  if(!panel)return;
  shortcutsModalReturnFocus=document.activeElement;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  var closeBtn=panel.querySelector('.shortcuts-modal-close');
  if(closeBtn)closeBtn.focus();
  document.addEventListener('keydown',shortcutsModalKeydown);
}
function shortcutsModalClose(){
  var panel=document.getElementById('shortcuts-modal');
  if(!panel||!panel.classList.contains('open'))return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden','true');
  document.removeEventListener('keydown',shortcutsModalKeydown);
  // "?" can open this from anywhere on the page, unlike the toolkit panels
  // which always open from the same FAB -- restore whatever actually had
  // focus, not a fixed element.
  if(shortcutsModalReturnFocus&&document.body.contains(shortcutsModalReturnFocus))shortcutsModalReturnFocus.focus();
  shortcutsModalReturnFocus=null;
}
function shortcutsModalToggle(){
  var panel=document.getElementById('shortcuts-modal');
  if(panel&&panel.classList.contains('open'))shortcutsModalClose();else shortcutsModalOpen();
}
function shortcutsModalKeydown(e){
  if(e.key==='Escape')shortcutsModalClose();
  else if(e.key==='Tab'){e.preventDefault();var b=document.querySelector('#shortcuts-modal .shortcuts-modal-close');if(b)b.focus();} // the close button is the only control
}

/* ----- official reference sheet, e.g. the Digital SAT's on-screen Math
   Reference -- rendered inline from OFFICIAL_REFERENCE.content instead of
   linking out to a PDF (see toolkitInit()). Only built when a guide
   actually configures reference content, same lazy-init pattern as the
   AI helper and shortcuts panels. ----- */
function referencePanelInit(){
  if(document.getElementById('reference-panel'))return;
  if(typeof OFFICIAL_REFERENCE==='undefined'||!OFFICIAL_REFERENCE||!OFFICIAL_REFERENCE.content)return;
  var panel=document.createElement('div');
  panel.id='reference-panel';
  panel.className='reference-panel';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','false');
  panel.setAttribute('aria-label',OFFICIAL_REFERENCE.label);
  panel.setAttribute('aria-hidden','true');
  var pdfLink=OFFICIAL_REFERENCE.url?'<div class="reference-panel-pdf-link"><a href="'+OFFICIAL_REFERENCE.url+'" target="_blank" rel="noopener">View the full official PDF ↗</a></div>':'';
  panel.innerHTML='<div class="reference-panel-card"><div class="reference-panel-hd">'+
    '<div class="reference-panel-hd-text"><b>'+OFFICIAL_REFERENCE.label+'</b><small>Available anytime while you work.</small></div>'+
    '<button type="button" class="reference-panel-close" onclick="referencePanelClose()" aria-label="Close reference sheet">✕</button></div>'+
    '<div class="reference-panel-body">'+OFFICIAL_REFERENCE.content+pdfLink+'</div></div>';
  document.body.appendChild(panel);
  ssMakeDraggable(panel,'.reference-panel-hd');
}
function referencePanelOpen(){
  referencePanelInit();
  var panel=document.getElementById('reference-panel');
  if(!panel)return;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  ssBringToFront(panel);
  var closeBtn=panel.querySelector('.reference-panel-close');
  if(closeBtn)closeBtn.focus();
  document.addEventListener('keydown',referencePanelKeydown);
}
function referencePanelClose(){
  var panel=document.getElementById('reference-panel');
  if(!panel||!panel.classList.contains('open'))return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden','true');
  document.removeEventListener('keydown',referencePanelKeydown);
  // Same toolkit-FAB return target as qrefDrawerClose()/desmosToggle() --
  // this panel is only ever opened from that FAB's menu.
  var fab=document.getElementById('toolkit-fab');
  if(fab)fab.focus();
}
function referencePanelToggle(){
  var panel=document.getElementById('reference-panel');
  if(panel&&panel.classList.contains('open'))referencePanelClose();else referencePanelOpen();
}
function referencePanelKeydown(e){if(e.key==='Escape')referencePanelClose();}

desmosInit();
cbotPanelInit();
toolkitInit();
// The study-plan preview is about quizzing, so it lives at the top of the
// Quiz tab rather than above every tab.
(function(){
  var spc=document.getElementById('spc-card'),quiz=document.getElementById('quiz-real');
  if(spc&&quiz)quiz.prepend(spc);
})();
shortcutsModalInit();
ssMakeDraggable(document.getElementById('qref-drawer'),'.qref-drawer-hd');

/* ----- unit-filtered practice, e.g. /chemistry?practice=3 (from the dashboard's "study this next") ----- */
(async function ssPracticeMode(){
  var practiceUnit = new URLSearchParams(location.search).get('practice');
  if(!practiceUnit) return;
  await ssQuizTabClick();
  if(!SS_SESSION) return;
  var sel = document.getElementById('q-sel');
  if(sel){ sel.value = practiceUnit; loadQ(); }
})();

/* ----- diagnostic batch starter: /geometry?diagnostic=1 auto-starts the
   diagnostic (queued by the dashboard's "Start diagnostics for all
   unassessed" button — see sbStartDiagBatch() there). When it finishes,
   showDiagSummary() checks sessionStorage for the rest of the queue and
   offers a one-click "Next subject" button instead of making the student
   navigate back to the dashboard between every diagnostic. ----- */
(async function ssDiagnosticMode(){
  if(new URLSearchParams(location.search).get('diagnostic')!=='1') return;
  await ssQuizTabClick();
  startDiagnostic();
})();

/* ===== Peer Challenge: create/claim from inside this subject's Quiz tab =====
   Mirrors public/challenge/index.html's API calls and result-comparison
   logic, but sources questions straight from this page's own QUIZ array
   instead of re-fetching the page over the network. */
function ssEscHtml(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
var ssChallengeCode=null;
async function challengeFromQuiz(){
  if(SS_SESSION===undefined) await ssCheckSession();
  if(!SS_SESSION){
    alert('Sign in to challenge a friend -- use the sign-in options in the Quiz tab.');
    return;
  }
  var pool=(qPool||[]).filter(function(q){return QUIZ.indexOf(q)!==-1;});
  if(pool.length<5){
    alert('Load a bigger question set first (try "All Units", or a unit with at least 5 questions) to start a challenge.');
    return;
  }
  var shuffled=pool.slice();
  for(var i=shuffled.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=shuffled[i];shuffled[i]=shuffled[j];shuffled[j]=t;}
  var picked=shuffled.slice(0,Math.min(8,shuffled.length));
  var questionNumbers=picked.map(function(q){return QUIZ.indexOf(q);});
  var btn=document.getElementById('challenge-friend-btn');
  if(btn)btn.disabled=true;
  try{
    var res=await fetch('/api/challenge/create',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({subjectKey:SS_SUBJECT_KEY,questionNumbers:questionNumbers})
    });
    var data=await res.json();
    if(!res.ok){alert(data.error||'Could not create a challenge right now.');return;}
    var link=location.origin+location.pathname+'?challenge='+data.code;
    prompt('Challenge created! Copy this link to share with a friend:',link);
  }catch(e){
    alert('Something went wrong creating the challenge.');
  }finally{
    if(btn)btn.disabled=false;
  }
}
function ssRenderChallengeResult(data){
  var qb=document.getElementById('qbox');
  var mine=data.role==='creator'?data.creatorResult:data.opponentResult;
  var theirs=data.role==='creator'?data.opponentResult:data.creatorResult;
  var myName=data.role==='creator'?data.creatorHandle:(data.opponentHandle||'You');
  var theirName=data.role==='creator'?(data.opponentHandle||'Opponent'):data.creatorHandle;
  if(!mine){qb.innerHTML='<div class="result"><div class="sub">Result submitted.</div></div>';return;}
  if(!theirs){
    qb.innerHTML='<div class="result"><div class="big">'+mine.correct+'/'+mine.total+'</div>'
      +'<div class="sub">Waiting for '+ssEscHtml(theirName)+' to finish -- check back later and refresh.</div>'
      +'<button class="btn" onclick="loadQ()">Back to Quiz</button></div>';
    return;
  }
  var myPct=mine.total?Math.round(mine.correct/mine.total*100):0;
  var theirPct=theirs.total?Math.round(theirs.correct/theirs.total*100):0;
  var verdict=myPct>theirPct?'You won!':myPct<theirPct?'They won this one.':"It's a tie!";
  qb.innerHTML='<div class="result"><div class="big">'+verdict+'</div>'
    +'<div class="sub">'+ssEscHtml(myName)+': '+mine.correct+'/'+mine.total+' ('+myPct+'%) vs '+ssEscHtml(theirName)+': '+theirs.correct+'/'+theirs.total+' ('+theirPct+'%)</div>'
    +'<button class="btn" onclick="loadQ()">Back to Quiz</button></div>';
}
async function ssFinishChallenge(){
  var qb=document.getElementById('qbox');
  qb.innerHTML='<div class="result"><div class="sub">Submitting your result...</div></div>';
  try{
    var res=await fetch('/api/challenge/'+ssChallengeCode+'/submit',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({correct:score,total:qPool.length})
    });
    var data=await res.json();
    if(!res.ok){qb.innerHTML='<div class="result"><div class="sub">'+ssEscHtml(data.error||'Could not submit your result.')+'</div></div>';return;}
    var infoRes=await fetch('/api/challenge/'+ssChallengeCode);
    var info=await infoRes.json();
    if(!infoRes.ok){qb.innerHTML='<div class="result"><div class="sub">Result submitted, but could not load the comparison.</div></div>';return;}
    ssRenderChallengeResult(info);
  }catch(e){
    qb.innerHTML='<div class="result"><div class="sub">Something went wrong submitting your result.</div></div>';
  }
}
/* ----- claim a shared challenge link, e.g. /geometry?challenge=ABC123 ----- */
(async function ssChallengeClaimMode(){
  var code=new URLSearchParams(location.search).get('challenge');
  if(!code) return;
  code=code.toUpperCase();
  await ssQuizTabClick();
  if(!SS_SESSION) return;
  var qb=document.getElementById('qbox');
  try{
    var res=await fetch('/api/challenge/'+code);
    var data=await res.json();
    if(!res.ok){alert(data.error||'That challenge code was not found.');return;}
    if(data.subjectKey!==SS_SUBJECT_KEY){
      if(confirm('This challenge is for a different subject. Open the Peer Challenge page instead?'))location.href='/challenge?challenge='+code;
      return;
    }
    if(data.role==='none'){
      var claimRes=await fetch('/api/challenge/'+code+'/claim',{method:'POST'});
      var claimData=await claimRes.json();
      if(!claimRes.ok){alert(claimData.error||'Could not join this challenge.');return;}
      data.questionNumbers=claimData.questionNumbers;
      data.role='opponent';
    }
    ssChallengeCode=code;
    var myResult=data.role==='creator'?data.creatorResult:data.opponentResult;
    if(myResult){ssRenderChallengeResult(data);return;}
    var qns=data.questionNumbers||[];
    var qs=qns.map(function(n){return QUIZ[n];}).filter(Boolean);
    if(!qs.length){if(qb)qb.innerHTML='<div class="result"><div class="sub">Could not load this challenge\'s questions.</div></div>';return;}
    qPool=qs;qIdx=0;score=0;requeueCounts=new WeakMap();qSessionStart=Date.now();
    showQ();
  }catch(e){
    if(qb)qb.innerHTML='<div class="result"><div class="sub">Something went wrong loading this challenge.</div></div>';
  }
})();
function ssDiagBatchPeekQueue(){
  var queue=[];
  try{queue=JSON.parse(sessionStorage.getItem('ssDiagBatchQueue')||'[]');}catch(e){}
  return Array.isArray(queue)?queue:[];
}
function ssDiagBatchRenderContinue(){
  var queue=ssDiagBatchPeekQueue();
  if(!queue.length)return;
  var summary=document.getElementById('diag-summary');
  if(!summary)return;
  var next=queue[0], rest=queue.slice(1);
  var box=document.createElement('div');
  box.style.cssText='margin-top:14px;padding:14px 16px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap';
  box.innerHTML='<div style="font-size:14px;color:var(--ink)">Diagnostic batch: '+queue.length+' more to go</div>'
    +'<button type="button" class="btn" id="ss-diag-batch-next-btn">Next: '+next.label+' &rarr;</button>';
  summary.appendChild(box);
  document.getElementById('ss-diag-batch-next-btn').addEventListener('click',function(){
    try{sessionStorage.setItem('ssDiagBatchQueue',JSON.stringify(rest));}catch(e){}
    location.href=next.href+(next.href.indexOf('?')===-1?'?':'&')+'diagnostic=1';
  });
}

/* ----- real per-view URLs: /chemistry/flashcards, /chemistry/quiz, /chemistry/exam, etc.
   Each view is now a genuine bookmarkable/shareable URL instead of only a client-side
   tab. switchTab() is wrapped (not edited) to stay compatible with the tab-building
   logic above; the wrapper just keeps the URL in sync and reads it back on load and
   on back/forward navigation. Quiz still always goes through the sign-in gate. ----- */
(function(){
  var SS_BASE='/'+SS_GUIDE.slug;
  var TAB_TO_SEG={guide:'',cards:'flashcards',quiz:'quiz',examples:'examples',exam:'exam',qref:'reference',memory:'memory'};
  var SEG_TO_TAB={flashcards:'cards',quiz:'quiz',examples:'examples',exam:'exam',reference:'qref',memory:'memory'};
  var TAB_TITLES={cards:'Flashcards',quiz:'Quiz',examples:'Worked Examples',exam:'Practice Exam',qref:'Quick Reference',memory:'Memory Tricks'};
  var BASE_TITLE=document.title;
  var SUBJECT_NAME=BASE_TITLE.replace(/\s*Study Guide.*$/,'');
  var _prevSwitchTab=switchTab;
  switchTab=function(id){
    _prevSwitchTab(id);
    var seg=TAB_TO_SEG[id];
    var path=SS_BASE+(seg?'/'+seg:'/');
    if(location.pathname!==path){ try{ history.pushState({tab:id},'',path); }catch(e){} }
    document.title=TAB_TITLES[id]?(TAB_TITLES[id]+' \u2014 '+SUBJECT_NAME+' Study Guide'):BASE_TITLE;
  };
  function tabFromUrl(){
    var rest=location.pathname.slice(SS_BASE.length).replace(/^\/|\/$/g,'');
    return rest&&SEG_TO_TAB[rest]?SEG_TO_TAB[rest]:'guide';
  }
  async function activate(id){
    if(id==='quiz'){ await ssQuizTabClick(); }else{ switchTab(id); }
  }
  window.addEventListener('popstate',function(){ activate(tabFromUrl()); });
  var initialTab=tabFromUrl();
  if(initialTab!=='guide') activate(initialTab);
})();

// Resume-at-exact-section: remember the concept crossing the upper-middle band of
// the viewport, and reopen it when the homepage "Resume" link arrives with
// #u=<unitId>&c=<conceptIdx> (see ssRenderHeroResume in public/index.html).
(function(){
  if(typeof UNITS==='undefined')return;
  var cur=null,timer=0;
  function save(){
    if(!cur)return;
    var unit=cur.closest('.unit'),id=unit&&unit.getAttribute('data-id'),idx=cur.getAttribute('data-idx');
    if(id==null||idx==null)return;
    var u=UNITS.find(function(x){return String(x.id)===id;}),c=u&&u.concepts[+idx];
    ssSaveLast({unit:id,concept:+idx,where:(u?u.name:'')+(c&&c.l?' › '+c.l:'')});
  }
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting)cur=e.target;});
      clearTimeout(timer);timer=setTimeout(save,800);
    },{rootMargin:'-20% 0px -60% 0px'});
    document.querySelectorAll('.unit .concept[data-idx]').forEach(function(c){io.observe(c);});
  }
  var m=/^#u=([\w-]+)&c=(\d+)$/.exec(location.hash);
  if(m)setTimeout(function(){jumpToUnit(m[1],+m[2]);},150);
})();

// Sticky "next concept" bar: follows the concept at the top of the viewport (180px line, matching .concept scroll-margin-top) and
// steps through every concept in page order (unit order included), opening the
// next unit when needed. After the last concept it points at the Quiz tab.
(function(){
  if(typeof UNITS==='undefined')return;
  var all=[].slice.call(document.querySelectorAll('.unit .concept[data-idx]'));
  if(!all.length)return;
  var bar=document.createElement('div');
  bar.className='ss-cnav';bar.setAttribute('role','region');bar.setAttribute('aria-label','Concept navigation');bar.hidden=true;
  bar.innerHTML='<button type="button" class="ss-cnav-prev" aria-label="Previous concept">&larr;</button><span class="ss-cnav-where"></span><button type="button" class="ss-cnav-next"></button>';
  document.body.appendChild(bar);
  var where=bar.querySelector('.ss-cnav-where'),prev=bar.querySelector('.ss-cnav-prev'),next=bar.querySelector('.ss-cnav-next');
  var cur=-1,raf=0;
  function label(c){var l=c&&c.querySelector('.c-label');return l?l.textContent.trim():'Next concept';}
  function unitOf(c){return c.closest('.unit');}
  function update(){
    raf=0;
    var guide=document.getElementById('view-guide');
    var i=-1,line=180;
    if(guide&&guide.classList.contains('active')){
      for(var k=0;k<all.length;k++){
        var c=all[k];if(!c.offsetParent)continue;
        var r=c.getBoundingClientRect();
        if(r.top<=line)i=k;else break;
      }
      if(i>-1&&line-all[i].getBoundingClientRect().bottom>400)i=-1;
    }
    if(i===cur&&!bar.hidden===(i>-1))return;
    cur=i;
    if(i<0){bar.hidden=true;return;}
    var c=all[i],u=unitOf(c),sib=u.querySelectorAll('.concept[data-idx]');
    where.innerHTML='<b>Unit '+u.getAttribute('data-id')+'</b> · concept '+(+c.getAttribute('data-idx')+1)+' of '+sib.length;
    prev.disabled=i===0;
    next.textContent=i<all.length-1?'Next: '+label(all[i+1])+' →':'Take the quiz →';
    bar.hidden=false;
  }
  function go(c){
    var u=unitOf(c);
    if(u.classList.contains('open'))c.scrollIntoView({behavior:ssScrollBehavior(),block:'start'});
    else jumpToUnit(u.getAttribute('data-id'),+c.getAttribute('data-idx'));
  }
  next.addEventListener('click',function(){
    if(cur<0)return;
    if(cur<all.length-1)go(all[cur+1]);
    else{switchTab('quiz');window.scrollTo({top:0,behavior:ssScrollBehavior()});}
  });
  prev.addEventListener('click',function(){if(cur>0)go(all[cur-1]);});
  function sched(){if(!raf)raf=requestAnimationFrame(update);}
  addEventListener('scroll',sched,{passive:true});
  addEventListener('resize',sched);
  document.addEventListener('click',sched);
  sched();
})();

// Flashcard swipe-to-rate: drag right = "Know it", left = "Still learning".
// A tap (no drag) still flips; vertical pans still scroll (touch-action:pan-y).
// Keyboard/buttons are unchanged, so swiping is a shortcut, never the only way.
(function(){
  var scene=document.getElementById('scene');
  if(!scene||!window.PointerEvent)return;
  var sx=0,sy=0,dx=0,drag=false,live=false,swallow=false,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var THRESH=90;
  function reset(anim){
    scene.classList.remove('swiping');scene.classList.toggle('swipe-out',!!anim);
    scene.style.transform='';scene.style.opacity='';scene.style.removeProperty('--sw');scene.removeAttribute('data-dir');
  }
  scene.addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    live=true;drag=false;dx=0;sx=e.clientX;sy=e.clientY;
  });
  scene.addEventListener('pointermove',function(e){
    if(!live)return;
    dx=e.clientX-sx;var dy=e.clientY-sy;
    if(!drag){
      if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5){drag=true;scene.setPointerCapture(e.pointerId);scene.classList.remove('swipe-out');scene.classList.add('swiping');}
      else return;
    }
    scene.style.transform='translateX('+dx+'px) rotate('+(dx/25)+'deg)';
    scene.style.setProperty('--sw',Math.min(1,Math.abs(dx)/THRESH).toFixed(2));
    scene.setAttribute('data-dir',dx>0?'known':'learning');
  });
  function end(){
    if(!live)return;live=false;
    if(!drag)return;
    drag=false;swallow=true;setTimeout(function(){swallow=false;},0);
    if(Math.abs(dx)>=THRESH){
      var rating=dx>0?'known':'learning';
      if(reduce){reset(false);rateFC(rating);return;}
      scene.classList.add('swipe-out');
      scene.style.transform='translateX('+(dx>0?'':'-')+'120%) rotate('+(dx>0?'':'-')+'12deg)';scene.style.opacity='0';
      setTimeout(function(){reset(false);rateFC(rating);},180);
    }else reset(!reduce);
  }
  scene.addEventListener('pointerup',end);
  scene.addEventListener('pointercancel',function(){live=false;if(drag){drag=false;reset(!reduce);}});
  scene.addEventListener('click',function(e){if(swallow){e.stopImmediatePropagation();e.preventDefault();}},true);
  if(matchMedia('(pointer: coarse)').matches){
    var h=document.querySelector('#view-cards .hint');
    if(h)h.textContent='Tap to flip · Swipe right = know it · Swipe left = still learning';
  }
})();
