// Replace starfield with history-family motif on apush + us-government
const {heroPattern}=require('/Users/smiley/Claude/precisstudy/scripts/hero-patterns.cjs');
const fs=require('fs');
for(const [slug,hex] of [['apush','#a16207'],['us-government','#1e3a8a']]){
  const f='/Users/smiley/Claude/precisstudy/public/'+slug+'/index.html';
  let h=fs.readFileSync(f,'utf8');
  const gh=heroPattern(slug,hex);
  const enc=s=>encodeURIComponent(s.replace(/%23/g,'#').replace(/'/g,"\u2019")).replace(/%27/g,"'");
  const hsvg="url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='"+gh.size+"' height='"+gh.size+"'>"+enc(gh.svg)+"\")";
  // neutralize the OLD starfield rule (first hero::after) and append override at end of head
  if(!h.includes('subject-hero-fix')){
    const css="<style id='subject-hero-fix'>.hero::after{background-image:"+hsvg+"!important;background-size:"+gh.size+"px "+gh.size+"px!important;opacity:.5!important;}</style>";
    h=h.replace('</head>',css+'\n</head>');
    fs.writeFileSync(f,h);
    console.log(slug,'starfield → timeline motif');
  }
}
