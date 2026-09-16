#!/usr/bin/env node
// Mechanical patch: wire "Challenge a Friend" into each subject's Quiz tab.
// Idempotent -- safe to re-run (checks before inserting each piece).
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const PUBLIC_DIR = join(process.cwd(), "public");

const MASTERY_RE = /window\.__ssCreateMastery\('([a-zA-Z0-9_-]+)'/;

const BUTTON_ANCHOR = `<button class="btn" type="button" onclick="printWorksheet()" style="font-size:14px;padding:7px 14px">🖨️ Print Worksheet</button>`;
const BUTTON_INSERT = `\n    <button class="btn" type="button" id="challenge-friend-btn" onclick="challengeFromQuiz()">⚔️ Challenge a Friend</button>`;

const SHOWQ_ANCHOR = `if(diagMode&&showDiagSummary())return;`;
const SHOWQ_INSERT = `if(ssChallengeCode){ssFinishChallenge();return;}`;

const MASTERY_VAR_RE = /var SS_MASTERY = null;/;

const DIAG_MODE_ANCHOR = `(async function ssDiagnosticMode(){
  if(new URLSearchParams(location.search).get('diagnostic')!=='1') return;
  await ssQuizTabClick();
  startDiagnostic();
})();`;

const CHALLENGE_FUNCS_TEMPLATE = (key) => `
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
/* ----- claim a shared challenge link, e.g. /${key}?challenge=ABC123 ----- */
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
    if(!qs.length){if(qb)qb.innerHTML='<div class="result"><div class="sub">Could not load this challenge\\'s questions.</div></div>';return;}
    qPool=qs;qIdx=0;score=0;requeueCounts=new WeakMap();qSessionStart=Date.now();
    showQ();
  }catch(e){
    if(qb)qb.innerHTML='<div class="result"><div class="sub">Something went wrong loading this challenge.</div></div>';
  }
})();`;

function patchFile(path) {
  let html = readFileSync(path, "utf8");
  const original = html;
  const notes = [];

  const m = MASTERY_RE.exec(html);
  if (!m) {
    return { path, error: "no __ssCreateMastery call found -- skipped" };
  }
  const key = m[1];

  // 1. SS_SUBJECT_KEY constant, next to SS_MASTERY var decl.
  if (!html.includes("var SS_SUBJECT_KEY=")) {
    if (!MASTERY_VAR_RE.test(html)) return { path, error: "no 'var SS_MASTERY = null;' anchor found -- skipped" };
    html = html.replace(MASTERY_VAR_RE, `var SS_MASTERY = null;\nvar SS_SUBJECT_KEY='${key}';`);
    notes.push("added SS_SUBJECT_KEY");
  }

  // 2. Button in .q-bar
  if (!html.includes('id="challenge-friend-btn"')) {
    if (!html.includes(BUTTON_ANCHOR)) return { path, error: "Print Worksheet button anchor not found -- skipped" };
    html = html.replace(BUTTON_ANCHOR, BUTTON_ANCHOR + BUTTON_INSERT);
    notes.push("added button");
  }

  // 3. showQ() completion hook
  if (!html.includes("if(ssChallengeCode){ssFinishChallenge();return;}")) {
    if (!html.includes(SHOWQ_ANCHOR)) return { path, error: "showQ() diagMode anchor not found -- skipped" };
    html = html.replace(SHOWQ_ANCHOR, SHOWQ_ANCHOR + SHOWQ_INSERT);
    notes.push("added showQ() hook");
  }

  // 4. challengeFromQuiz()/claim functions, appended after ssDiagnosticMode IIFE
  if (!html.includes("function challengeFromQuiz(")) {
    if (!html.includes(DIAG_MODE_ANCHOR)) return { path, error: "ssDiagnosticMode anchor not found -- skipped" };
    html = html.replace(DIAG_MODE_ANCHOR, DIAG_MODE_ANCHOR + CHALLENGE_FUNCS_TEMPLATE(key));
    notes.push("added challenge functions");
  }

  if (html === original) return { path, skipped: true, key };
  writeFileSync(path, html);
  return { path, key, notes };
}

const dirs = readdirSync(PUBLIC_DIR).filter((d) => {
  const full = join(PUBLIC_DIR, d);
  if (!statSync(full).isDirectory()) return false;
  const idx = join(full, "index.html");
  try {
    return readFileSync(idx, "utf8").includes("__ssCreateMastery(");
  } catch {
    return false;
  }
});

let ok = 0, skipped = 0, errors = 0;
for (const d of dirs) {
  const idx = join(PUBLIC_DIR, d, "index.html");
  const result = patchFile(idx);
  if (result.error) {
    console.error(`ERROR ${d}: ${result.error}`);
    errors++;
  } else if (result.skipped) {
    console.log(`skip  ${d} (already patched, key=${result.key})`);
    skipped++;
  } else {
    console.log(`patch ${d} (key=${result.key}): ${result.notes.join(", ")}`);
    ok++;
  }
}
console.log(`\n${ok} patched, ${skipped} already up to date, ${errors} errors, ${dirs.length} total subject pages found.`);
if (errors > 0) process.exit(1);
