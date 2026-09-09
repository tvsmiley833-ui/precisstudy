function switchTab(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const tabs=document.querySelectorAll('.tab-btn');tabs.forEach(b=>b.classList.remove('active'));document.getElementById('view-'+id).classList.add('active');const idx={guide:0,cards:1,quiz:2,exam:3,qref:4,memory:5}[id];if(idx!==undefined){tabs.forEach((b,i)=>{var on=i===idx;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;});var _hl=document.getElementById('hero-live');if(_hl)_hl.textContent=tabs[idx].textContent.trim()+' tab';}if(id==='exam'&&!examBuilt)buildExam();var spc=document.getElementById('spc-card');if(spc)spc.style.display=(id==='guide')?'':'none';}
let examBuilt=false;

function buildExam(){
examBuilt=true;
const v=document.getElementById('view-exam');
// inject CSS
const st=document.createElement('style');st.textContent=EXAM_CSS;document.head.appendChild(st);

v.innerHTML=`
<div class="ex-header">
  <h2>APUSH — Full Practice Exam</h2>
  <p>Part A (30 pts) · Part B-1 (20 pts) · Part B-2 (15 pts) · Part C (20 pts) · Based on Jan 2026 format</p>
</div>
<div id="ex-score-box" class="ex-score"></div>
${buildPartMC('A','Part A — Multiple Choice (30 questions, 1 pt each)',PART_A)}
${buildPartMC('B1','Part B–1 — Multiple Choice (20 questions, 1 pt each)',PART_B1)}
${buildPartFR('B2','Part B–2 — Short Answer (show work, 1 pt each)',PART_B2)}
${buildPartFR('C','Part C — Extended Response (1–2 pts each)',PART_C)}
`;
// open Part A by default
document.getElementById('ex-part-A').classList.add('open');
}

function buildPartMC(id,title,qs){
const items=qs.map(q=>`
<div class="ex-q" id="exq-${id}-${q.n}">
  <div class="ex-qnum">Question ${q.n}</div>
  <div class="ex-qtext">${q.q}</div>
  <div class="ex-opts">
    ${q.o.map((opt,i)=>`<button class="ex-opt" onclick="ansExam('${id}',${q.n},${i},${q.a})">(${i+1}) ${opt}</button>`).join('')}
  </div>
  <div class="ex-exp" id="exp-${id}-${q.n}">${q.e}</div>
</div>`).join('');
return `<div class="ex-part" id="ex-part-${id}">
<div class="ex-part-hd" tabindex="0" role="button" aria-expanded="false" onclick="togglePart('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePart('${id}')}">
  <h3>${title}</h3><span id="score-${id}">Score: 0 / ${qs.length}</span>
</div>
<div class="ex-part-body">${items}</div></div>`;
}

function buildPartFR(id,title,qs){
// Some guides author these as genuine free-response (q.sa, a model answer to
// reveal); others reuse the multiple-choice shape (q.o/q.a) for this part.
// Render whichever shape the data actually has instead of assuming sa exists.
const items=qs.map(q=>q.sa!==undefined?`
<div class="ex-q">
  <div class="ex-qnum">Question ${q.n}</div>
  <div class="ex-qtext">${q.q}</div>
  <button class="ex-opt" style="background:var(--surface-2);text-align:left" onclick="toggleSA(this)">▶ Show Model Answer</button>
  <div class="ex-sa" style="display:none"><strong>Model Answer</strong>${q.sa.replace(/\n/g,'<br>')}</div>
</div>`:`
<div class="ex-q" id="exq-${id}-${q.n}">
  <div class="ex-qnum">Question ${q.n}</div>
  <div class="ex-qtext">${q.q}</div>
  <div class="ex-opts">
    ${q.o.map((opt,i)=>`<button class="ex-opt" onclick="ansExam('${id}',${q.n},${i},${q.a})">(${i+1}) ${opt}</button>`).join('')}
  </div>
  <div class="ex-exp" id="exp-${id}-${q.n}">${q.e}</div>
</div>`).join('');
const allMC=qs.every(q=>q.sa===undefined);
return `<div class="ex-part" id="ex-part-${id}">
<div class="ex-part-hd" tabindex="0" role="button" aria-expanded="false" onclick="togglePart('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePart('${id}')}">
  <h3>${title}</h3>${allMC?`<span id="score-${id}">Score: 0 / ${qs.length}</span>`:`<span style="font-size:18px;color:var(--ink-dim)">Click to show model answers</span>`}
</div>
<div class="ex-part-body">${items}</div></div>`;
}

function togglePart(id){
  const part=document.getElementById('ex-part-'+id);
  const isOpen=part.classList.toggle('open');
  const hd=part.querySelector('.ex-part-hd');
  if(hd)hd.setAttribute('aria-expanded',isOpen?'true':'false');
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
}


// GUIDE
const SEARCH_BADGE={concept:'📖 Notes',flashcard:'📇 Flashcard',quiz:'❓ Quiz'};
function searchGuide(){
  const q=(document.getElementById('search-box').value||'').toLowerCase().trim();
  const sr=document.getElementById('search-results');
  document.querySelectorAll('.unit').forEach(u=>u.style.display='');
  document.getElementById('filter-row').style.display='flex';
  var _hl=document.getElementById('hero-live');
  if(!q){sr.style.display='none';if(_hl)_hl.textContent='';return;}
  const matches=[];
  UNITS.forEach(u=>{
    u.concepts.forEach(c=>{
      const text=(c.l+' '+(c.intro||'')+' '+(c.b||[]).join(' ')).toLowerCase();
      if(text.includes(q))matches.push({type:'concept',unit:u.id,unitName:u.name,concept:c.l,preview:(c.intro||c.b?.[0]||'').slice(0,120)});
    });
    if(u.fms) u.fms.forEach(f=>{if(f.toLowerCase().includes(q))matches.push({type:'concept',unit:u.id,unitName:u.name,concept:'Formula',preview:f});});
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
  if(!matches.length){sr.style.display='block';sr.innerHTML='<div style="color:var(--ink-muted);font-size:14px;padding:8px">No results for "'+q+'"</div>';if(_hl)_hl.textContent='No results for '+q;return;}
  sr.style.display='block';
  if(_hl)_hl.textContent=matches.length+' result'+(matches.length===1?'':'s')+' for '+q;
  const jump=m=>m.type==='concept'?`jumpToUnit(${m.unit})`:m.type==='flashcard'?`jumpToFlashcardUnit(${m.unit})`:`jumpToQuizUnit(${m.unit})`;
  sr.innerHTML='<div style="font-size:13px;color:var(--ink-muted);margin-bottom:6px">'+matches.length+' result(s)</div>'+
    matches.slice(0,12).map(m=>`<div onclick="${jump(m)}" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:5px;cursor:pointer;">
      <span style="font-size:12px;font-weight:700;color:var(--ink-muted);text-transform:uppercase">${SEARCH_BADGE[m.type]} · Unit ${m.unit}: ${m.unitName}</span>
      <div style="font-size:14px;font-weight:700;color:var(--ink);margin:2px 0">${m.concept}</div>
      <div style="font-size:13px;color:var(--ink-dim)">${m.preview}…</div>
    </div>`).join('');
}
function clearSearch(){document.getElementById('search-box').value='';searchGuide();}
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
function jumpToUnit(id){
  clearSearch();
  switchTab('guide');
  const el=document.querySelector(`.unit[data-id="${id}"]`);
  if(el){el.classList.add('open');el.scrollIntoView({behavior:'smooth',block:'start'});}
}

const filterTags={};
function buildGuide(){
  const fr=document.getElementById('filter-row');
  const ul=document.getElementById('units');
  const all=document.createElement('button');
  all.className='chip on';all.textContent='All Units';
  all.onclick=()=>{Object.keys(filterTags).forEach(k=>filterTags[k].classList.remove('on'));all.classList.add('on');document.querySelectorAll('.unit').forEach(u=>u.style.display='');};
  fr.appendChild(all);
  UNITS.forEach(u=>{
    const chip=document.createElement('button');
    chip.className='chip';chip.textContent='Unit '+u.id;
    chip.onclick=()=>{
      all.classList.remove('on');
      Object.values(filterTags).forEach(c=>c.classList.remove('on'));
      chip.classList.add('on');
      document.querySelectorAll('.unit').forEach(el=>el.style.display=el.dataset.id==u.id?'':'none');
    };
    fr.appendChild(chip);filterTags[u.id]=chip;
    const div=document.createElement('div');div.className='unit';div.dataset.id=u.id;
    const hd=document.createElement('div');hd.className='unit-hd';
    hd.innerHTML=`<span class="unit-title">Unit ${u.id}: ${u.name}<span class="unit-meta">${u.concepts.length} concepts</span></span><span class="chevron">▾</span>`;
    hd.tabIndex=0;hd.setAttribute('role','button');hd.setAttribute('aria-expanded','false');
    hd.onclick=()=>{const isOpen=div.classList.toggle('open');hd.setAttribute('aria-expanded',isOpen?'true':'false');};
    hd.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hd.click();}};
    const body=document.createElement('div');body.className='unit-body';
    u.concepts.forEach(c=>{
      const cd=document.createElement('div');cd.className='concept';
      let h=`<div class="c-label">${c.l}</div>`;
      if(c.intro)h+=`<div class="c-text">${c.intro}</div>`;
      if(c.b&&c.b.length){h+='<ul class="c-list">';c.b.forEach(item=>h+=`<li>${item}</li>`);h+='</ul>';}
      cd.innerHTML=h;body.appendChild(cd);
    });
    if(u.traps&&u.traps.length){u.traps.forEach(t=>{const td=document.createElement('div');td.className='trap';td.textContent=t;body.appendChild(td);});}
    if(u.fms&&u.fms.length){const fd=document.createElement('div');fd.className='formula';fd.innerHTML=u.fms.join('<br>');body.appendChild(fd);}
    if(DIAGRAMS&&DIAGRAMS[u.id]){const dd=document.createElement('div');dd.className='diagram';dd.innerHTML=`<div class="dlabel">Diagram</div>${DIAGRAMS[u.id].svg}<p class="dcap">${DIAGRAMS[u.id].cap}</p>`;body.appendChild(dd);}
    div.appendChild(hd);div.appendChild(body);ul.appendChild(div);
  });
}
function hydrateGuide(){
  const fr=document.getElementById('filter-row');
  const chips=Array.from(fr.children);
  const all=chips[0];
  all.onclick=()=>{Object.keys(filterTags).forEach(k=>filterTags[k].classList.remove('on'));all.classList.add('on');document.querySelectorAll('.unit').forEach(u=>u.style.display='');};
  UNITS.forEach((u,i)=>{
    const chip=chips[i+1];
    chip.onclick=()=>{
      all.classList.remove('on');
      Object.values(filterTags).forEach(c=>c.classList.remove('on'));
      chip.classList.add('on');
      document.querySelectorAll('.unit').forEach(el=>el.style.display=el.dataset.id==u.id?'':'none');
    };
    filterTags[u.id]=chip;
  });
  document.querySelectorAll('.unit').forEach(div=>{
    const hd=div.querySelector('.unit-hd');
    hd.onclick=()=>{const isOpen=div.classList.toggle('open');hd.setAttribute('aria-expanded',isOpen?'true':'false');};
    hd.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hd.click();}};
  });
}
if(document.getElementById('units').children.length===0){buildGuide();}else{hydrateGuide();}

// FLASHCARDS
let fcDeck=[],fcIdx=0,fcFilterMode='all';
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
function fcKnownSet(){return new Set((CHEM_MASTERY&&CHEM_MASTERY.getSnapshot().cardsKnown)||[]);}
function getActiveDeck(){
  const known=fcKnownSet();
  if(fcFilterMode==='learning')return fcDeck.filter(c=>!known.has(c.t));
  if(fcFilterMode==='known')return fcDeck.filter(c=>known.has(c.t));
  return fcDeck;
}
function showFC(){
  const deck=getActiveDeck();
  if(!deck.length){document.getElementById('fc-term').textContent='No cards';document.getElementById('fc-def').textContent='Rate some cards first';document.getElementById('fc-count').textContent='0 / 0';document.getElementById('fc-progress').textContent='';return;}
  if(fcIdx>=deck.length)fcIdx=0;
  const card=deck[fcIdx];
  document.getElementById('fc-term').textContent=card.t;
  document.getElementById('fc-def').textContent=card.d;
  const known=fcKnownSet();
  const knownCount=fcDeck.filter(c=>known.has(c.t)).length;
  const learningCount=fcDeck.length-knownCount;
  document.getElementById('fc-count').textContent=(fcIdx+1)+' / '+deck.length;
  document.getElementById('fc-progress').textContent=`✓ ${knownCount} known  ·  ✗ ${learningCount} still learning`;
  document.getElementById('scene').classList.remove('flipped');
}
function flip(){document.getElementById('scene').classList.toggle('flipped');}
function fcNav(d){const deck=getActiveDeck();if(!deck.length)return;fcIdx=(fcIdx+d+deck.length)%deck.length;showFC();}
function fcShuffle(){const deck=getActiveDeck();for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}fcIdx=0;showFC();}
function rateFC(rating){
  const deck=getActiveDeck();
  if(!deck.length||!CHEM_MASTERY)return;
  const card=deck[fcIdx];
  if(rating==='known')CHEM_MASTERY.markCardKnown(card.t);
  else CHEM_MASTERY.unmarkCardKnown(card.t);
  fcNav(1);
}
function filterFC(){
  if(fcFilterMode==='all'){fcFilterMode='learning';document.getElementById('filter-btn').textContent='Show: Still Learning';}
  else if(fcFilterMode==='learning'){fcFilterMode='known';document.getElementById('filter-btn').textContent='Show: Known';}
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
var CHEM_MASTERY = null;
window.__ssMasteryInstances = window.__ssMasteryInstances || [];
function ssStartChemMastery(){
  CHEM_MASTERY = window.__ssCreateMastery('apush', UNITS.map(function(u){return u.id;}), UNITS.reduce(function(acc,u){acc[u.id]=u.name;return acc;},{}));
  window.__ssMasteryInstances.push(CHEM_MASTERY);
  CHEM_MASTERY.init().then(function(){ try{ showFC(); }catch(e){} });
}
if (window.__ssCreateMastery) { ssStartChemMastery(); }
else { window.addEventListener('ss-mastery-ready', ssStartChemMastery, { once: true }); }

let diagMode=false;
function buildQSel(){
  const sel=document.getElementById('q-sel');
  sel.innerHTML='<option value="0">All Units ('+QUIZ.length+' questions)</option>';
  UNITS.forEach(u=>{const n=QUIZ.filter(q=>q.u===u.id).length;if(n)sel.innerHTML+=`<option value="${u.id}">Unit ${u.id}: ${u.name} (${n} Qs)</option>`;});
  loadQ();
}
function loadQ(){
  diagMode=false;
  const banner=document.getElementById('diag-banner');if(banner)banner.style.display='none';
  const summary=document.getElementById('diag-summary');if(summary)summary.innerHTML='';
  const v=+document.getElementById('q-sel').value;
  const src=v===0?[...QUIZ]:QUIZ.filter(q=>q.u===v);
  qPool=src.sort(()=>Math.random()-.5);
  qIdx=0;score=0;requeueCounts=new WeakMap();showQ();
}
function diagSetActive(active){
  const vq=document.getElementById('view-quiz');if(vq)vq.classList.toggle('diag-mode',active);
  const btn=document.getElementById('diag-start-btn');const lbl=document.getElementById('diag-start-btn-label');
  if(btn)btn.disabled=active;
  if(lbl)lbl.textContent=active?'Diagnostic in progress…':'Start Diagnostic — 2 questions per unit, finds your weak spots';
}
function startDiagnostic(){
  switchTab('quiz');
  /* already mid-diagnostic (not yet finished) — re-focus it instead of wiping progress and restarting */
  if(diagMode&&qPool&&qPool.length&&qIdx<qPool.length){showQ();return;}
  const perUnit={};
  QUIZ.forEach(q=>{(perUnit[q.u]=perUnit[q.u]||[]).push(q);});
  let pool=[];
  UNITS.forEach(u=>{
    const qs=(perUnit[u.id]||[]).slice().sort(()=>Math.random()-.5);
    pool=pool.concat(qs.slice(0,2));
  });
  pool=pool.sort(()=>Math.random()-.5);
  qPool=pool;qIdx=0;score=0;requeueCounts=new WeakMap();diagMode=true;
  diagSetActive(true);
  const banner=document.getElementById('diag-banner');
  if(banner){banner.style.display='block';banner.textContent='Diagnostic in progress — '+qPool.length+' questions (2 per unit). Answer honestly; your weak units appear below when you finish.';}
  const summary=document.getElementById('diag-summary');if(summary)summary.innerHTML='';
  showQ();
}
function showDiagSummary(){
  diagMode=false;
  diagSetActive(false);
  const banner=document.getElementById('diag-banner');if(banner)banner.style.display='none';
  const summary=document.getElementById('diag-summary');
  if(!summary||!CHEM_MASTERY){return;}
  const mastery=CHEM_MASTERY.getSnapshot().mastery||{};
  const rows=UNITS.map(u=>{
    const rec=mastery[u.id];
    if(!rec||rec.total<1)return null;
    const pct=Math.round(rec.correct/rec.total*100);
    return {id:u.id,name:u.name,pct};
  }).filter(Boolean);
  const weak=rows.filter(r=>r.pct<80).sort((a,b)=>a.pct-b.pct);
  if(!weak.length){
    summary.innerHTML='<div class="result" style="padding:16px"><div class="sub" style="color:var(--success)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Every unit you were tested on scored 80%+! Try the practice exam next.</div></div>'+(SS_SESSION?'':'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:14.5px;color:var(--ink-muted)">Sign in to save these results and unlock the full question bank.<div class="ss-login-box" style="margin-top:8px"></div></div>');
    if(!SS_SESSION)ssRenderLoginBoxes();
    return;
  }
  summary.innerHTML='<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;margin-top:14px">'
    +'<div style="font-weight:700;color:var(--ink);margin-bottom:10px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Weak units from this diagnostic</div>'
    +weak.map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14.5px">
      <span style="color:var(--ink)">Unit ${r.id}: ${r.name}</span><span style="color:var(--danger);font-weight:700">${r.pct}%</span></div>`).join('')
    +'</div>'+(SS_SESSION?'':'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:14.5px;color:var(--ink-muted)">Sign in to save these results and unlock the full question bank.<div class="ss-login-box" style="margin-top:8px"></div></div>');
  if(!SS_SESSION)ssRenderLoginBoxes();
}
function showQ(){
  const qb=document.getElementById('qbox');
  if(qIdx>=qPool.length){
    if(diagMode)showDiagSummary();
    qb.innerHTML=`<div class="result"><div class="big">${score}/${qPool.length}</div><div class="sub">${Math.round(score/qPool.length*100)}% — ${score/qPool.length>=.85?'Excellent work':score/qPool.length>=.65?'Solid — review the misses':'Keep reviewing this unit'}</div><button class="btn" onclick="loadQ()">Try Again</button></div>`;return;}
  const q=qPool[qIdx];
  document.getElementById('q-prog').textContent=`Q ${qIdx+1}/${qPool.length}`;
  document.getElementById('q-sc').textContent=`Score: ${score}`;
  let h=`<div class="q-block"><div class="q-text">${q.q}</div><button class="guess-btn" id="guess-btn" onclick="markGuess()">I'm just guessing</button><div class="q-opts">`;
  q.o.forEach((opt,i)=>h+=`<button class="q-opt" onclick="ansQ(${i})">${opt}</button>`);
  h+=`</div><div class="q-exp" id="q-exp">${q.e}</div><button class="q-next show" id="q-next" onclick="nextQ()" style="display:none">Next →</button></div>`;
  qb.innerHTML=h;
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
  document.querySelectorAll('.q-opt').forEach((btn,idx)=>{
    btn.disabled=true;
    if(idx===q.a)btn.classList.add('correct');
    else if(idx===i&&i!==q.a)btn.classList.add('wrong');
  });
  if(i===q.a){
    score++;
    if(window.__ssCelebrateCorrect){
      var correctBtn=document.querySelectorAll('.q-opt')[q.a];
      window.__ssCelebrateCorrect(correctBtn);
    }
    if(wasGuess){
      guessedQs.push(q);guessedRight++;
      const n=requeueCounts.get(q)||0;
      if(n<MAX_REQUEUES){
        requeueCounts.set(q,n+1);
        qPool.splice(Math.min(qIdx+REQUEUE_DELAY,qPool.length),0,q);
      }
    }
  }else{
    if(window.__ssResetCombo)window.__ssResetCombo();
    if(wasGuess)guessedQs.push(q);
    const n=requeueCounts.get(q)||0;
    if(n<MAX_REQUEUES){
      requeueCounts.set(q,n+1);
      qPool.splice(Math.min(qIdx+REQUEUE_DELAY,qPool.length),0,q);
    }
  }
  if(CHEM_MASTERY)CHEM_MASTERY.recordAnswer(q.u,i===q.a);
  const expEl=document.getElementById('q-exp');
  expEl.classList.add('show');
  if(wasGuess){
    expEl.innerHTML=(i===q.a?'<b class="guess-flag">Lucky guess — added back for more practice.</b><br>':'<b class="guess-flag">Marked as a guess.</b><br>')+expEl.innerHTML;
  }
  document.getElementById('q-next').style.display='inline-block';
  document.getElementById('q-sc').textContent=`Score: ${score}`;
  var _hl=document.getElementById('hero-live');
  if(_hl)_hl.textContent=(i===q.a?'Correct. ':'Incorrect. ')+(q.e||'');
  guessFlag=false;
}
function nextQ(){qIdx++;showQ();}
function ssQuizKeyboardShortcuts(e){
  var vq=document.getElementById('view-quiz');
  if(!vq||!vq.classList.contains('active'))return;
  var tag=(document.activeElement&&document.activeElement.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if(e.key>='1'&&e.key<='4'){
    var idx=+e.key-1;
    var opts=document.querySelectorAll('.q-opt');
    if(opts[idx]&&!opts[idx].disabled){opts[idx].click();e.preventDefault();}
  }else if(e.key==='Enter'){
    var nb=document.getElementById('q-next');
    if(nb&&nb.style.display!=='none'){nb.click();e.preventDefault();}
  }
}
document.addEventListener('keydown',ssQuizKeyboardShortcuts);
buildQSel();

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

(function(){
  var CHEM_TOTAL_Q=QUIZ.length, CHEM_UNITS=UNITS.length, MIN_PER_Q=1.5;
  var daysEl=document.getElementById('spc-days');
  var minsEl=document.getElementById('spc-mins');
  if(!daysEl||!minsEl)return;
  function update(){
    var days=parseInt(daysEl.value,10);
    var mins=parseInt(minsEl.value,10);
    document.getElementById('spc-days-val').textContent=days+(days===1?' day':' days');
    document.getElementById('spc-mins-val').textContent=mins+' min';
    var totalMinutes=days*mins;
    var questions=Math.min(CHEM_TOTAL_Q,Math.round(totalMinutes/MIN_PER_Q));
    var pct=Math.min(100,Math.round((questions/CHEM_TOTAL_Q)*100));
    var units=Math.min(CHEM_UNITS,Math.max(1,Math.round((pct/100)*CHEM_UNITS)));
    document.getElementById('spc-questions').textContent=questions.toLocaleString();
    document.getElementById('spc-units').textContent=units;
    document.getElementById('spc-pct').textContent=pct+'%';
    var tier=document.getElementById('spc-tier');
    var title=document.getElementById('spc-tier-title');
    var sub=document.getElementById('spc-tier-sub');
    if(pct>=90){
      tier.style.background='var(--success-soft)';tier.style.color='var(--success)';
      title.textContent='Exam Ready';sub.textContent="You'll work through the full question bank before test day.";
    }else if(pct>=50){
      tier.style.background='var(--accent-soft)';tier.style.color='var(--accent-ink)';
      title.textContent='On Track';sub.textContent='Solid coverage — keep this pace going.';
    }else{
      tier.style.background='var(--surface-2)';tier.style.color='var(--ink-muted)';
      title.textContent='Just Getting Started';sub.textContent='Add a few more minutes a day to cover more ground before your exam.';
    }
  }
  daysEl.addEventListener('input',update);
  minsEl.addEventListener('input',update);
  update();
})();

/* ===== study helper chatbot ===== */
const CBOT_KEY='chemCbotConfig';
const CBOT_OMNIROUTE_URL='http://127.0.0.1:20128/api/v1';
const CBOT_OMNIROUTE_MODEL='kiro/claude-haiku-4.5';
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
      jump:function(){switchTab('memory');setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),80);}});
  });
  document.querySelectorAll('#view-qref .qr-card').forEach(card=>{
    const k=card.querySelector('.qr-k'),v=card.querySelector('.qr-v');
    if(!k||!v)return;
    idx.push({label:k.textContent,source:'Quick Reference',text:v.textContent,
      tokens:cbotTokenize(k.textContent+' '+v.textContent),
      jump:function(){switchTab('qref');setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),80);}});
  });
  document.querySelectorAll('#view-qref .qr-table tr').forEach(row=>{
    const cells=row.querySelectorAll('td');
    if(cells.length<2)return;
    const label=cells[0].textContent,text=cells[1].textContent;
    idx.push({label:label,source:'Quick Reference',text:text,tokens:cbotTokenize(label+' '+text),
      jump:function(){switchTab('qref');setTimeout(()=>row.scrollIntoView({behavior:'smooth',block:'center'}),80);}});
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
  setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),80);
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

function cbotToggle(){
  document.getElementById('cbot-panel').classList.toggle('open');
  if(document.getElementById('cbot-panel').classList.contains('open')&&!cbotHistory.length){
    cbotAddMsg('bot',"Hi! Ask me about any term or concept from the guide — like \"activation energy\" or \"limiting reagent\" — and I'll pull up the explanation. No setup needed.");
  }
}
function cbotToggleSettings(){document.getElementById('cbot-settings').classList.toggle('open');}

function cbotLoadSettings(){
  try{
    const raw=JSON.parse(localStorage.getItem(CBOT_KEY)||'null');
    if(!raw||!raw.key)return null;
    return {url:CBOT_OMNIROUTE_URL,model:CBOT_OMNIROUTE_MODEL,key:raw.key};
  }catch(e){return null;}
}
function cbotSaveSettings(){
  const key=document.getElementById('cbot-key').value.trim();
  if(key){
    try{
      localStorage.setItem(CBOT_KEY,JSON.stringify({key:key}));
      cbotAddMsg('bot','Saved. Open-ended questions now route through your local OmniRoute server ('+CBOT_OMNIROUTE_MODEL+') — check OmniRoute\'s usage/cost report after asking something to see it tick up.');
    }catch(e){
      cbotAddMsg('bot','Couldn\'t save — this browser/page is blocking local storage (e.g. private browsing). Try opening the file normally, not from a sandboxed preview.');
    }
  }else{
    cbotAddMsg('bot','Paste your OmniRoute API key above to enable live AI — or leave it blank to just use the built-in guide search.');
  }
  document.getElementById('cbot-settings').classList.remove('open');
}
function cbotClearSettings(){
  try{localStorage.removeItem(CBOT_KEY);}catch(e){}
  document.getElementById('cbot-key').value='';
  cbotAddMsg('bot','Cleared. Back to built-in guide search only.');
  document.getElementById('cbot-settings').classList.remove('open');
}
(function(){const raw=(function(){try{return JSON.parse(localStorage.getItem(CBOT_KEY)||'null');}catch(e){return null;}})();
  if(raw&&raw.key){const k=document.getElementById('cbot-key');if(k)k.value=raw.key;}
})();

function cbotAddMsg(role,text,jumpFn,jumpLabel){
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
  cbotHistory.push({role:role==='user'?'user':'assistant',content:text});
}

async function cbotCallApi(cfg,query){
  const sys="You are a concise, friendly tutor helping a student study APUSH. Keep answers short (2-5 sentences), accurate, and focused on the question asked.";
  const messages=[{role:'system',content:sys}].concat(cbotHistory.slice(-8));
  const res=await fetch(cfg.url.replace(/\/$/,'')+'/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
    body:JSON.stringify({model:cfg.model,messages:messages,max_tokens:400,stream:false})
  });
  if(!res.ok){
    let detail='';
    try{const errBody=await res.json();detail=errBody&&errBody.error&&errBody.error.message?': '+errBody.error.message:'';}catch(e){}
    throw new Error(res.status+detail);
  }
  const data=await res.json();
  return data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
}

const CBOT_PUBLISHED=(location.protocol==='http:'||location.protocol==='https:');
if(CBOT_PUBLISHED){
  const sBtn=document.getElementById('cbot-settings-btn');
  if(sBtn)sBtn.style.display='none';
}

async function cbotCallProxy(){
  const history=cbotHistory.slice(-9).map(m=>({role:m.role,content:m.content}));
  const res=await fetch('/api/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({history:history})
  });
  if(!res.ok){
    let detail='';
    try{const errBody=await res.json();detail=errBody&&errBody.error?': '+errBody.error:'';}catch(e){}
    throw new Error(res.status+detail);
  }
  const data=await res.json();
  return data.reply;
}

async function cbotSend(e){
  e.preventDefault();
  const input=document.getElementById('cbot-input');
  const query=input.value.trim();
  if(!query)return false;
  cbotAddMsg('user',query);
  input.value='';
  const sendBtn=document.querySelector('#cbot-form button[type="submit"]');
  sendBtn.disabled=true;

  const results=cbotSearch(query);
  const cfg=CBOT_PUBLISHED?null:cbotLoadSettings();
  const noKeyFallbackText="I couldn't find that in the guide. Try a specific term (e.g. \"activation energy\", \"limiting reagent\", \"pH\") or check the Quick Reference / Memory Tricks tabs."+(CBOT_PUBLISHED?"":" You can also connect your own AI API in Advanced settings for open-ended help.");

  if(CBOT_PUBLISHED){
    try{
      const reply=await cbotCallProxy();
      const top=results.length?results[0].entry:null;
      cbotAddMsg('bot',reply||"I didn't get a usable reply — try rephrasing?",top&&top.jump,top?'Jump to this in the guide →':undefined);
    }catch(err){
      cbotAddMsg('bot','The AI helper is temporarily unavailable ('+err.message+'). Here\'s the closest match from the guide instead:');
      if(results.length){const top=results[0].entry;cbotAddMsg('bot',top.label+'\n\n'+top.text,top.jump,'Jump to this in the guide →');}
      else cbotAddMsg('bot',noKeyFallbackText);
    }
  }else if(cfg){
    try{
      const reply=await cbotCallApi(cfg,query);
      const top=results.length?results[0].entry:null;
      cbotAddMsg('bot',reply||"I didn't get a usable reply from the API.",top&&top.jump,top?'Jump to this in the guide →':undefined);
    }catch(err){
      cbotAddMsg('bot','Couldn\'t reach your configured API ('+err.message+'). Here\'s the closest match from the guide instead:');
      if(results.length){const top=results[0].entry;cbotAddMsg('bot',top.label+'\n\n'+top.text,top.jump,'Jump to this in the guide →');}
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
  sendBtn.disabled=false;
  return false;
}

/* study session timer in the nav */
(function(){
  var nav=document.querySelector('.hero .nav');if(!nav)return;
  var d=document.createElement('div');d.id='sg-timer';
  d.innerHTML='<span id="sgt-time">00:00</span><button class="sgt-b" id="sgt-btn" aria-label="start or pause study timer">▶</button><button class="sgt-b" id="sgt-reset" aria-label="reset study timer">↺</button>';
  nav.appendChild(d);
  var sec=0,run=false,iv=null;
  function fmt(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
    return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
  document.getElementById('sgt-btn').onclick=function(){
    run=!run;this.textContent=run?'⏸':'▶';
    if(run){iv=setInterval(function(){sec++;var el=document.getElementById('sgt-time');if(el)el.textContent=fmt(sec);},1000);}
    else clearInterval(iv);
  };
  document.getElementById('sgt-reset').onclick=function(){sec=0;clearInterval(iv);run=false;
    document.getElementById('sgt-btn').textContent='▶';document.getElementById('sgt-time').textContent='00:00';};
})();

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

/* ===== PrecisStudy auth ===== */
let SS_SESSION;

function ssLoginBoxHtml(){
  return '<a class="ss-oauth-btn" href="/auth/google/start">Continue with Google</a>'
    + '<a class="ss-oauth-btn" href="/auth/github/start">Continue with GitHub</a>'
    + '<div class="ss-status"></div>';
}

function ssRenderLoginBoxes(){
  document.querySelectorAll('.ss-login-box').forEach(function(el){ el.innerHTML = ssLoginBoxHtml(); });
}

async function ssCheckSession(){
  try{
    const res = await fetch('/auth/me');
    const data = await res.json();
    SS_SESSION = data.loggedIn ? data : false;
  }catch(e){
    SS_SESSION = false;
  }
  window.__ssSignedIn = !!SS_SESSION;
  return SS_SESSION;
}

function ssApplyQuizGate(){
  const gate = document.getElementById('quiz-gate');
  const real = document.getElementById('quiz-real');
  if(!gate || !real) return;
  gate.style.display = 'none';
  real.style.display = '';
  const sel = document.getElementById('q-sel');
  const note = document.getElementById('anon-quiz-note');
  if(SS_SESSION){
    if(sel) sel.style.display = '';
    if(note) note.style.display = 'none';
  }else{
    if(sel) sel.style.display = 'none';
    if(note){ note.style.display = 'block'; ssRenderLoginBoxes(); }
  }
}

async function ssQuizTabClick(){
  switchTab('quiz');
  if(SS_SESSION === undefined) await ssCheckSession();
  ssApplyQuizGate();
}

ssCheckSession();

/* ----- unit-filtered practice, e.g. /chemistry?practice=3 (from the dashboard's "study this next") ----- */
(async function ssPracticeMode(){
  var practiceUnit = new URLSearchParams(location.search).get('practice');
  if(!practiceUnit) return;
  await ssQuizTabClick();
  if(!SS_SESSION) return;
  var sel = document.getElementById('q-sel');
  if(sel){ sel.value = practiceUnit; loadQ(); }
})();

/* ----- real per-view URLs: /chemistry/flashcards, /chemistry/quiz, /chemistry/exam, etc.
   Each view is now a genuine bookmarkable/shareable URL instead of only a client-side
   tab. switchTab() is wrapped (not edited) to stay compatible with the tab-building
   logic above; the wrapper just keeps the URL in sync and reads it back on load and
   on back/forward navigation. Quiz still always goes through the sign-in gate. ----- */
(function(){
  var SS_BASE='/apush';
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
</script></body></html>
