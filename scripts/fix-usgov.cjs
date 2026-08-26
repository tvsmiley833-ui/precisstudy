const {heroPattern}=require('/Users/smiley/Claude/precisstudy/scripts/hero-patterns.cjs');
const fs=require('fs');
const f='/Users/smiley/Claude/precisstudy/public/us-government/index.html';
let h=fs.readFileSync(f,'utf8');
const gh=heroPattern('us-government','#1e3a8a');
const enc=s=>encodeURIComponent(s.replace(/%23/g,'#').replace(/'/g,"\u2019")).replace(/%27/g,"'");
// This page's template CSS lives in a <style> block; find the LAST </style> in the doc
// and append our override AFTER it so it wins the cascade.
const css="\n<style>.hero::after{background-image:url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='"+gh.size+"' height='"+gh.size+"'>"+enc(gh.svg)+"\")!important;background-size:"+gh.size+"px "+gh.size+"px!important;opacity:.5!important;}</style>";
// insert right before closing body tag (or at end of file)
if(h.includes('</body>')){
  h=h.replace('</body>',css+'\n</body>');
}else{
  h=h+css;
}
fs.writeFileSync(f,h);
console.log('us-government: override appended at document end, motif',gh.size);
