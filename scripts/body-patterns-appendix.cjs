
// ===== Page-body watermark patterns (subtle full-page symbol layer) =====
function bodyPattern(slug, hex){
  const acc='%23'+hex.replace('#','');
  const F={
    '_lang':"<text x='20' y='60' font-size='42' fill='"+acc+"' opacity='.06' font-family='Georgia'>&#191;?</text><text x='120' y='140' font-size='38' fill='"+acc+"' opacity='.055' font-family='Georgia'>&#161;!</text>",
    'french-1':"<path d='M40 15 l6 14 15 1 -11 10 3 15 -13 -8 -13 8 3 -15 -11 -10 15 -1 z' fill='"+acc+"' opacity='.07'/>",
    'german-1':"<rect x='25' y='25' width='30' height='30' rx='4' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><rect x='40' y='40' width='30' height='30' rx='4' fill='"+acc+"' opacity='.05'/>",
    'geometry':"<path d='M35 35 L70 35 L52 65 Z' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.09'/><circle cx='130' cy='110' r='22' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><path d='M120 30 h36 M138 12 v36' stroke='"+acc+"' stroke-width='2' opacity='.08'/>",
    'chemistry':"<path d='M45 45 l14 -8 14 8 v16 l-14 8 -14 -8 z' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><ellipse cx='135' cy='120' rx='18' ry='7' fill='none' stroke='"+acc+"' stroke-width='1.6' opacity='.06'/><ellipse cx='135' cy='120' rx='7' ry='18' fill='none' stroke='"+acc+"' stroke-width='1.6' opacity='.06'/>",
    '_science':"<circle cx='45' cy='45' r='8' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><circle cx='68' cy='58' r='5' fill='"+acc+"' opacity='.06'/><path d='M53 51 l9 4' stroke='"+acc+"' stroke-width='2' opacity='.08'/><path d='M125 115 l12 -7 12 7 v14 l-12 7 -12 -7 z' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.07'/>",
    'anatomy':"<path d='M30 50 q0 -14 15 -14 q15 0 15 14 q0 12 -15 22 q-15 -10 -15 -22' fill='"+acc+"' opacity='.07'/>",
    'astronomy':"<g fill='"+acc+"' opacity='.10'><circle cx='35' cy='35' r='2'/><circle cx='90' cy='70' r='1.6'/><circle cx='145' cy='30' r='2.2'/></g><path d='M35 35 L90 70 L145 30' stroke='"+acc+"' stroke-width='.8' opacity='.09' fill='none'/>",
    '_history':"<path d='M20 100 Q95 40 170 100' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.07'/><path d='M40 95 v10 M80 78 v27 M120 68 v37 M155 84 v21' stroke='"+acc+"' stroke-width='2' opacity='.07'/>",
    'geography':"<ellipse cx='48' cy='48' rx='22' ry='22' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><ellipse cx='48' cy='48' rx='22' ry='9' fill='none' stroke='"+acc+"' stroke-width='1.2' opacity='.07'/>",
    '_english':"<text x='28' y='62' font-size='46' fill='"+acc+"' opacity='.07' font-family='Georgia'>\"</text><path d='M110 118 h44 M110 130 h30' stroke='"+acc+"' stroke-width='2' opacity='.05'/>",
    'computer-science':"<text x='24' y='56' font-size='30' fill='"+acc+"' opacity='.09' font-family='monospace'>&lt;/&gt;</text><path d='M110 120 h30 l10 -10' fill='none' stroke='"+acc+"' stroke-width='1.8' opacity='.08'/><circle cx='155' cy='108' r='3' fill='"+acc+"' opacity='.1'/>",
    '_ap':"<text x='30' y='60' font-size='36' fill='"+acc+"' opacity='.08' font-family='Georgia'>AP</text><path d='M115 115 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.07'/>",
    '_test':"<circle cx='48' cy='48' r='17' fill='none' stroke='"+acc+"' stroke-width='2.4' opacity='.08'/><circle cx='48' cy='48' r='8' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.09'/><text x='118' y='126' font-size='24' fill='"+acc+"' opacity='.07' font-family='Georgia'>A B C</text>",
    '_health':"<path d='M20 60 h26 l9 -18 12 34 10 -26 7 10 h36' fill='none' stroke='"+acc+"' stroke-width='2.4' opacity='.08'/>",
    '_music':"<ellipse cx='42' cy='48' rx='8' ry='6' transform='rotate(-20 42 48)' fill='"+acc+"' opacity='.08'/><path d='M49 46 V20' stroke='"+acc+"' stroke-width='2' opacity='.08'/><line x1='15' y1='132' x2='165' y2='132' stroke='"+acc+"' stroke-width='1' opacity='.05'/><line x1='15' y1='146' x2='165' y2='146' stroke='"+acc+"' stroke-width='1' opacity='.05'/>",
    '_math':"<text x='25' y='55' font-size='34' fill='"+acc+"' opacity='.07' font-family='Georgia'>&#960;</text><text x='110' y='130' font-size='30' fill='"+acc+"' opacity='.06' font-family='Georgia'>&#8721;</text><path d='M150 40 q12 -16 24 0' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.07'/><text x='60' y='150' font-size='26' fill='"+acc+"' opacity='.06'>x&#178;</text>",
    '_skills':"<circle cx='45' cy='45' r='14' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><path d='M39 59 v6 h12 v-6' fill='none' stroke='"+acc+"' stroke-width='2' opacity='.08'/><path d='M122 112 h34 M122 124 h24' stroke='"+acc+"' stroke-width='2.4' opacity='.07'/>"
  };
  const mathFam=['algebra1','algebra2','precalc','statistics','sat-math'];
  const sciFam=['biology','earth-science','environmental-science','psychology'];
  const histFam=['global-history','us-government','world-history','apush','ap-world','economics'];
  const engFam=['english-9','english-10','creative-writing','journalism','speech-debate','art-history','sat-reading'];
  let key;
  if(F[slug]) key=slug;
  else if(slug==='ap-biology'||slug==='ap-chemistry') key='_science';
  else if(mathFam.includes(slug)) key='_math';
  else if(sciFam.includes(slug)) key='_science';
  else if(histFam.includes(slug)) key='_history';
  else if(engFam.includes(slug)) key='_english';
  else if(['computer-science','ap-csa'].includes(slug)) key='computer-science';
  else if(['ap-lang','ap-euro','ap-usgov','ap-macro','ap-micro','ap-stats','ap-psych','ap-physics'].includes(slug)) key='_ap';
  else if(['study-skills','sociology','health'].includes(slug)) key='_skills';
  else if(['spanish-1','spanish-2','spanish-3'].includes(slug)) key='_lang';
  else key='_skills';
  return {svg:F[key]||F._skills, size:190};
}
if (typeof module!=='undefined') module.exports={heroPattern,bodyPattern};
