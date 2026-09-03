/**
 * Per-subject hero background patterns — replaces the shared starfield.
 * Each subject family gets a distinct SVG motif, tinted with the guide's accent color.
 * Usage: heroPattern(slug) → {svg, size} or null for default subtle grid.
 */
const STARS_SLUGS = new Set(['astronomy','ap-physics','physics']);

// SVG motifs per subject (fill/stroke placeholders %ACC% get accent-tinted)
const PATTERNS = {
  // Languages — speech-bubble dots
  default: {
    svg: `<circle cx='30' cy='30' r='4' fill='%ACC%' opacity='.5'/><circle cx='90' cy='60' r='3' fill='%ACC%' opacity='.35'/><circle cx='140' cy='25' r='5' fill='%ACC%' opacity='.4'/><circle cx='55' cy='110' r='3' fill='%ACC%' opacity='.45'/><circle cx='150' cy='130' r='4' fill='%ACC%' opacity='.3'/>`,
    size: 180,
    lines: true
  },
};

function heroPattern(slug, hex) {
  const acc = '%23' + hex.replace('#','');
  // hand-tuned motifs: (paths, size)
  const M = {
    'spanish-1': {s:`<path d='M20 20 h50 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-30 l-12 12 v-12 h-8 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.38'/><path d='M120 100 h44 a7 7 0 0 1 7 7 v18 a7 7 0 0 1 -7 7 h-26 l-10 10 v-10 h-8 a7 7 0 0 1 -7 -7 v-18 a7 7 0 0 1 7 -7' fill='none' stroke='${acc}' stroke-width='2' opacity='.28'/>`, sz:190},
    'spanish-2': {s:`<path d='M20 20 h50 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-30 l-12 12 v-12 h-8 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.38'/><path d='M120 100 h44 a7 7 0 0 1 7 7 v18 a7 7 0 0 1 -7 7 h-26 l-10 10 v-10 h-8 a7 7 0 0 1 -7 -7 v-18 a7 7 0 0 1 7 -7' fill='none' stroke='${acc}' stroke-width='2' opacity='.28'/>`, sz:190},
    'spanish-3': {s:`<path d='M20 20 h50 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-30 l-12 12 v-12 h-8 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.38'/>`, sz:190},
    'french-1': {s:`<path d='M40 15 l6 14 15 1 -11 10 3 15 -13 -8 -13 8 3 -15 -11 -10 15 -1 z' fill='${acc}' opacity='.30'/><circle cx='130' cy='80' r='9' fill='none' stroke='${acc}' stroke-width='2' opacity='.35'/><rect x='120' y='125' width='24' height='16' rx='3' fill='${acc}' opacity='.22'/>`, sz:170},
    'german-1': {s:`<rect x='25' y='25' width='34' height='34' rx='4' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><rect x='33' y='33' width='34' height='34' rx='4' fill='${acc}' opacity='.18'/><path d='M120 110 l14 -24 14 24 z' fill='${acc}' opacity='.3'/>`, sz:175},
    // Math family — grid + formulas feel: crosses & plus signs
    '_math': {s:`<path d='M40 30 v24 M28 42 h24' stroke='${acc}' stroke-width='3' opacity='.35'/><path d='M120 90 v20 M110 100 h20' stroke='${acc}' stroke-width='2.5' opacity='.3'/><circle cx='160' cy='40' r='10' fill='none' stroke='${acc}' stroke-width='2' opacity='.32'/><path d='M70 140 q10 -18 20 0 t20 0' fill='none' stroke='${acc}' stroke-width='2' opacity='.3'/>`, sz:185},
    // Science — molecules/hexagons
    '_science': {s:`<circle cx='40' cy='40' r='9' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><circle cx='72' cy='58' r='6' fill='${acc}' opacity='.3'/><path d='M49 46 L66 54' stroke='${acc}' stroke-width='2' opacity='.4'/><path d='M130 110 l12 -7 12 7 v14 l-12 7 -12 -7 z' fill='none' stroke='${acc}' stroke-width='2' opacity='.35'/><circle cx='160' cy='35' r='4' fill='${acc}' opacity='.35'/>`, sz:180},
    // History — timeline ticks & laurel arcs
    '_history': {s:`<path d='M10 100 Q95 30 180 100' fill='none' stroke='${acc}' stroke-width='2' opacity='.35'/><path d='M30 96 v8 M70 76 v28 M110 66 v38 M150 82 v22' stroke='${acc}' stroke-width='2.5' opacity='.4'/><circle cx='30' cy='100' r='3.5' fill='${acc}' opacity='.5'/><circle cx='150' cy='93' r='3.5' fill='${acc}' opacity='.5'/>`, sz:190},
    // English — open book + pen nib
    '_english': {s:`<path d='M30 40 q25 -12 50 0 v40 q-25 -12 -50 0 z' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><path d='M55 40 v40' stroke='${acc}' stroke-width='2' opacity='.4'/><path d='M120 115 l18 -26 6 4 -18 26 z' fill='${acc}' opacity='.3'/>`, sz:180},
    // Technology — circuit traces
    '_tech': {s:`<path d='M20 40 h36 l14 14 h30' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><circle cx='104' cy='54' r='4' fill='${acc}' opacity='.5'/><path d='M140 110 h24 l12 -12 h20' fill='none' stroke='${acc}' stroke-width='2' opacity='.35'/><rect x='30' y='120' width='18' height='18' rx='3' fill='${acc}' opacity='.28'/>`, sz:195},
    // AP — laurel wreath arc + star burst (distinct from old stars)
    '_ap': {s:`<path d='M20 130 Q90 40 160 130' fill='none' stroke='${acc}' stroke-width='3' opacity='.35'/><path d='M50 118 q6 -10 12 0 M138 118 q6 -10 12 0' fill='none' stroke='${acc}' stroke-width='2' opacity='.4'/><circle cx='90' cy='75' r='12' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.45'/><circle cx='90' cy='75' r='4' fill='${acc}' opacity='.5'/>`, sz:185},
    // Test prep — target/bullseye
    '_test': {s:`<circle cx='45' cy='45' r='16' fill='none' stroke='${acc}' stroke-width='3' opacity='.4'/><circle cx='45' cy='45' r='8' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.5'/><circle cx='45' cy='45' r='2.5' fill='${acc}' opacity='.6'/><path d='M130 105 h30 M145 90 v30' stroke='${acc}' stroke-width='2.5' opacity='.35'/>`, sz:175},
    // Geography — latitude/longitude globe wireframe
    '_geo': {s:`<ellipse cx='50' cy='50' rx='26' ry='26' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><ellipse cx='50' cy='50' rx='26' ry='11' fill='none' stroke='${acc}' stroke-width='1.5' opacity='.35'/><line x1='24' y1='50' x2='76' y2='50' stroke='${acc}' stroke-width='1.5' opacity='.35'/><path d='M140 110 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M140 110 a8 20 0 1 0 40 0' fill='none' stroke='${acc}' stroke-width='2' opacity='.3'/>`, sz:190},
    // Health/Anatomy — heartbeat pulse line
    '_health': {s:`<path d='M10 60 h30 l10 -22 14 44 12 -34 8 12 h40' fill='none' stroke='${acc}' stroke-width='3' opacity='.42'/><path d='M130 120 h44' stroke='${acc}' stroke-width='2' opacity='.25'/><circle cx='150' cy='35' r='6' fill='${acc}' opacity='.3'/>`, sz:200},
    // Music — notes
    '_music': {s:`<ellipse cx='40' cy='50' rx='9' ry='7' transform='rotate(-20 40 50)' fill='${acc}' opacity='.4'/><path d='M48 48 V18 q14 4 16 12' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><ellipse cx='120' cy='115' rx='8' ry='6' transform='rotate(15 120 115)' fill='${acc}' opacity='.35'/><path d='M127 112 V86' stroke='${acc}' stroke-width='2.5' opacity='.35'/><line x1='20' y1='140' x2='170' y2='140' stroke='${acc}' stroke-width='1' opacity='.2'/>`, sz:185},
    // Study skills / electives — lightbulb + checklist
    '_skills': {s:`<circle cx='50' cy='42' r='17' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><path d='M43 59 v8 h14 v-8' fill='none' stroke='${acc}' stroke-width='2.5' opacity='.4'/><path d='M128 108 h8 m6 0 h8 m6 0 h8' stroke='${acc}' stroke-width='3' opacity='.4'/><rect x='118' y='122' width='52' height='3' rx='1.5' fill='${acc}' opacity='.3'/>`, sz:190},
    // Astronomy keeps stars but denser constellation style w/ connecting lines (unique flavor)
    'astronomy': {s:`<g fill='${acc}'><circle cx='30' cy='30' r='3'/><circle cx='85' cy='65' r='2.5'/><circle cx='140' cy='25' r='3.5'/><circle cx='60' cy='115' r='2.5'/><circle cx='155' cy='135' r='3'/></g><path d='M30 30 L85 65 L140 25 M85 65 L60 115' stroke='${acc}' stroke-width='1' opacity='.4' fill='none'/>`, sz:180},
  };
  // Family resolution
  const mathFam=['algebra1','algebra2','geometry','precalc','statistics','sat-math','calculus','calc-ab','calc-bc'];
  const sciFam=['biology','chemistry','earth-science','environmental-science','anatomy','ap-chemistry','psychology'];
  const histFam=['global-history','us-government','world-history','apush','ap-world','economics'];
  const engFam=['english-9','english-10','creative-writing','journalism','speech-debate','art-history'];
  const techFam=['computer-science','ap-csa'];
  const apFam=['ap-biology','ap-lang','ap-euro','ap-usgov','ap-macro','ap-micro','ap-stats','ap-psych','ap-physics'];
  let key = M[slug] ? slug : null;
  if (!key) {
    if (slug==='geography') key='_geo';
    else if (['health'].includes(slug)) key='_health';
    else if (slug==='music-theory') key='_music';
    else if (['study-skills','sociology'].includes(slug)) key='_skills';
    else if (mathFam.includes(slug)) key='_math';
    else if (sciFam.includes(slug)) key='_science';
    else if (histFam.includes(slug)) key='_history';
    else if (engFam.includes(slug)) key='_english';
    else if (techFam.includes(slug)) key='_tech';
    else if (slug.startsWith('ap-')) key='_ap';
    else if (['sat-reading','act-prep','sat-math'].includes(slug)) key='_test';
    else key='_skills';
  }
  const m=M[key] || M['_skills'];
  return {svg:m.s, size:m.sz};
}

// ===== Page-body watermark patterns (subtle full-page symbol layer) =====
function bodyPattern(slug, hex){
  const acc='%23'+hex.replace('#','');
  const F={
    '_lang':"<text x='20' y='60' font-size='42' fill='"+acc+"' opacity='0.114' font-family='Georgia'>&#191;?</text><text x='120' y='140' font-size='38' fill='"+acc+"' opacity='0.104' font-family='Georgia'>&#161;!</text>",
    'french-1':"<path d='M40 15 l6 14 15 1 -11 10 3 15 -13 -8 -13 8 3 -15 -11 -10 15 -1 z' fill='"+acc+"' opacity='0.133'/>",
    'german-1':"<rect x='25' y='25' width='30' height='30' rx='4' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><rect x='40' y='40' width='30' height='30' rx='4' fill='"+acc+"' opacity='0.095'/>",
    'geometry':"<path d='M35 35 L70 35 L52 65 Z' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.171'/><circle cx='130' cy='110' r='22' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><path d='M120 30 h36 M138 12 v36' stroke='"+acc+"' stroke-width='2' opacity='0.152'/>",
    'chemistry':"<path d='M45 45 l14 -8 14 8 v16 l-14 8 -14 -8 z' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><ellipse cx='135' cy='120' rx='18' ry='7' fill='none' stroke='"+acc+"' stroke-width='1.6' opacity='0.114'/><ellipse cx='135' cy='120' rx='7' ry='18' fill='none' stroke='"+acc+"' stroke-width='1.6' opacity='0.114'/>",
    '_science':"<circle cx='45' cy='45' r='8' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><circle cx='68' cy='58' r='5' fill='"+acc+"' opacity='0.114'/><path d='M53 51 l9 4' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><path d='M125 115 l12 -7 12 7 v14 l-12 7 -12 -7 z' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.133'/>",
    'anatomy':"<path d='M30 50 q0 -14 15 -14 q15 0 15 14 q0 12 -15 22 q-15 -10 -15 -22' fill='"+acc+"' opacity='0.133'/>",
    'astronomy':"<g fill='"+acc+"' opacity='0.19'><circle cx='35' cy='35' r='2'/><circle cx='90' cy='70' r='1.6'/><circle cx='145' cy='30' r='2.2'/></g><path d='M35 35 L90 70 L145 30' stroke='"+acc+"' stroke-width='.8' opacity='0.171' fill='none'/>",
    '_history':"<path d='M20 100 Q95 40 170 100' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.133'/><path d='M40 95 v10 M80 78 v27 M120 68 v37 M155 84 v21' stroke='"+acc+"' stroke-width='2' opacity='0.133'/>",
    'geography':"<ellipse cx='48' cy='48' rx='22' ry='22' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><ellipse cx='48' cy='48' rx='22' ry='9' fill='none' stroke='"+acc+"' stroke-width='1.2' opacity='0.133'/>",
    '_english':"<text x='28' y='62' font-size='46' fill='"+acc+"' opacity='0.133' font-family='Georgia'>\"</text><path d='M110 118 h44 M110 130 h30' stroke='"+acc+"' stroke-width='2' opacity='0.095'/>",
    'computer-science':"<text x='24' y='56' font-size='30' fill='"+acc+"' opacity='0.171' font-family='monospace'>&lt;/&gt;</text><path d='M110 120 h30 l10 -10' fill='none' stroke='"+acc+"' stroke-width='1.8' opacity='0.152'/><circle cx='155' cy='108' r='3' fill='"+acc+"' opacity='0.19'/>",
    '_ap':"<text x='30' y='60' font-size='36' fill='"+acc+"' opacity='0.152' font-family='Georgia'>AP</text><path d='M115 115 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.133'/>",
    '_test':"<circle cx='48' cy='48' r='17' fill='none' stroke='"+acc+"' stroke-width='2.4' opacity='0.152'/><circle cx='48' cy='48' r='8' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.171'/><text x='118' y='126' font-size='24' fill='"+acc+"' opacity='0.133' font-family='Georgia'>A B C</text>",
    '_health':"<path d='M20 60 h26 l9 -18 12 34 10 -26 7 10 h36' fill='none' stroke='"+acc+"' stroke-width='2.4' opacity='0.152'/>",
    '_music':"<ellipse cx='42' cy='48' rx='8' ry='6' transform='rotate(-20 42 48)' fill='"+acc+"' opacity='0.152'/><path d='M49 46 V20' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><line x1='15' y1='132' x2='165' y2='132' stroke='"+acc+"' stroke-width='1' opacity='0.095'/><line x1='15' y1='146' x2='165' y2='146' stroke='"+acc+"' stroke-width='1' opacity='0.095'/>",
    '_math':"<text x='25' y='55' font-size='34' fill='"+acc+"' opacity='0.133' font-family='Georgia'>&#960;</text><text x='110' y='130' font-size='30' fill='"+acc+"' opacity='0.114' font-family='Georgia'>&#8721;</text><path d='M150 40 q12 -16 24 0' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.133'/><text x='60' y='150' font-size='26' fill='"+acc+"' opacity='0.114'>x&#178;</text>",
    '_skills':"<circle cx='45' cy='45' r='14' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><path d='M39 59 v6 h12 v-6' fill='none' stroke='"+acc+"' stroke-width='2' opacity='0.152'/><path d='M122 112 h34 M122 124 h24' stroke='"+acc+"' stroke-width='2.4' opacity='0.133'/>"
  };
  const mathFam=['algebra1','algebra2','precalc','statistics','sat-math','calculus','calc-ab','calc-bc'];
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
