const {bodyPattern,heroPattern}=require('/Users/smiley/Claude/precisstudy/scripts/hero-patterns.cjs');
const fs=require('fs');
// Hand-authored pages: add body watermarks (+ hero for geometry)
const jobs=[
  ['geometry','#7c3aed'],['chemistry','#0d9488'],['algebra1','#2563eb'],
  ['algebra2','#7c3aed'],['precalc','#0891b2'],['biology','#16a34a'],
  ['ap-biology','#15803d'],['physics','#8b5cf6'],['ap-lang','#b45309'],
  ['global-history','#dc2626'],['us-government','#1e3a8a'],['apush','#a16207']
];
for(const [slug,hex] of jobs){
  const f='/Users/smiley/Claude/precisstudy/public/'+slug+'/index.html';
  let h=fs.readFileSync(f,'utf8');
  if(h.includes('subject-symbols')) continue;
  const bp=bodyPattern(slug,hex);
  const enc=s=>encodeURIComponent(s.replace(/%23/g,'#').replace(/'/g,"\u2019")).replace(/%27/g,"'");
  const bsvg="url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='"+bp.size+"' height='"+bp.size+"'>"+enc(bp.svg)+"\")";
  const css="\n<style id='subject-symbols'>\nbody::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background-image:"+bsvg+";background-size:"+bp.size+"px "+bp.size+"px;opacity:.9;}\n.page,.hero,.nav,.content,main,.wrap{position:relative;z-index:1}\n[data-theme=\"dark\"] body::before{opacity:.5}\n</style>";
  h=h.replace('</head>', css+'\n</head>');
  fs.writeFileSync(f,h);
  console.log(slug,'+body symbols');
}
// geometry hero motif
let g=fs.readFileSync('/Users/smiley/Claude/precisstudy/public/geometry/index.html','utf8');
if(!g.includes("hero::after{background-image")){
  const gh=heroPattern('geometry','#a78bfa');
  const enc=s=>encodeURIComponent(s.replace(/%23/g,'#').replace(/'/g,"\u2019")).replace(/%27/g,"'");
  const hsvg="url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='"+gh.size+"' height='"+gh.size+"'>"+enc(gh.svg)+"\")";
  const css="<style>.hero::after{background-image:"+hsvg+"!important;background-size:"+gh.size+"px "+gh.size+"px!important;opacity:.5!important;}</style>";
  g=g.replace('</head>',css+'\n</head>');
  fs.writeFileSync('/Users/smiley/Claude/precisstudy/public/geometry/index.html',g);
  console.log('geometry +hero motif');
}
console.log('done');
