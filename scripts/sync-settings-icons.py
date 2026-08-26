#!/usr/bin/env python3
"""Add all guides to settings SUBJECTS (with per-subject icon + color)
and put each subject's icon/logo next to its name in the dashboard cards."""
import json, glob, os, re

BASE="/Users/smiley/Claude/precisstudy"

# ---------- subject icon library (24x24 stroke SVGs) ----------
ICONS = {
 'default':'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
 'geometry':'<polygon points="3,20 21,20 3,3"/><line x1="7" y1="20" x2="7" y2="17"/><line x1="11" y1="20" x2="11" y2="17"/><line x1="15" y1="20" x2="15" y2="17"/>',
 'chemistry':'<path d="M7 2h10v6c0 1-1 2-2 2H9c-1 0-2-1-2-2V2z"/><path d="M7 8h10v10c0 2-1.5 3-5 3s-5-1-5-3V8z"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="14" r=".8"/>',
 'physics':'<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
 'biology':'<circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/>',
 '_history':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"/>',
 '_english':'<path d="M2 6l4-3 4 3v13l-4-2-4 2V6z"/><path d="M10 6l4-3 4 3v13l-4-2-4 2"/>',
 '_math':'<line x1="4" y1="19" x2="20" y2="5"/><circle cx="6" cy="17" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="7" r="1.4" fill="currentColor" stroke="none"/><path d="M14 19h6"/><path d="M4 9V5h4"/>',
 '_lang':'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
 '_ap':'<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
 '_test':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
 'computer-science':'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
 'music-theory':'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 'health':'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
 'anatomy':'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/><path d="M7 12h3l1.5-3 2 6L15 9l1 3h2" stroke-width="1.2"/>',
 'astronomy':'<circle cx="12" cy="12" r="4"/><g stroke-width="1"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></g>',
 'environmental-science':'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
 'psychology':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M9 3h6M9 21h6" stroke-width="1.2"/>',
 'sociology':'<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M3.5 20c.5-3.5 2.7-5.5 5.5-5.5s5 2 5.5 5.5"/><path d="M15.5 15.5c2.3.3 4.2 2 4.8 4.5"/>',
 'world-history':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h8M7 17h5"/>',
 'geography':'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>',
 'economics':'<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
 'art-history':'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.8 2-1.8 0-1.6-1.6-1.7-1.6-3 0-1 .8-1.7 2.1-1.7H17a4 4 0 0 0 4-4c0-5-4-8.5-9-8.5z"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none"/>',
 'music-theory2':None,
 'creative-writing':'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
 'journalism':'<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>',
 'speech-debate':'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
 'study-skills':'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
 'spanish-1':'<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia">ñ</text>',
 'spanish-2':'<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia">ñ</text><path d="M4 20h16" stroke-width="1.2"/>',
 'spanish-3':'<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia">¿</text>',
 'french-1':'<path d="M12 2v20M8 4h8M8 20h8M12 2c-3 2-4 5-4 8 0 4 2 8 4 10 2-2 4-6 4-10 0-3-1-6-4-8z"/>',
 'german-1':'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
}
def icon(slug,title):
    if slug in ICONS: return ICONS[slug]
    if title.startswith('AP'): return ICONS['_ap']
    if any(x in title.lower() for x in ['sat','act']): return ICONS['_test']
    if 'english' in slug or 'writing' in slug: return ICONS['_english']
    if 'history' in slug or slug in ('global-history','apush','us-government','ap-world','ap-euro','ap-usgov','economics','ap-macro','ap-micro','geography','psychology','sociology'): return ICONS['_history'] if 'geo' not in slug else ICONS['geography']
    return ICONS['default']

# gather guides
entries=[]
for f in sorted(glob.glob(f"{BASE}/guides/*.json")):
    slug=os.path.basename(f)[:-5]
    if slug=='economics-core': continue
    d=json.load(open(f))
    entries.append((slug,d.get('title',slug),d.get('accentColor') or '#23744f',d.get('units',[])))

# ---------- 1. settings SUBJECTS array ----------
p=f"{BASE}/public/settings/index.html"
s=open(p).read()
lines=[]
for slug,title,acc,units in entries:
    ic=icon(slug,title)
    lines.append("  { key: '%s', label: '%s', color: '%s', icon: '<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">%s</svg>' }," % (slug,title.replace("'","\\'"),acc,ic))
new_arr="var SUBJECTS = [\n"+"\n".join(lines)+"\n];"
s=re.sub(r'var SUBJECTS = \[.*?\n\];', new_arr, s, count=1, flags=re.S)
open(p,'w').write(s)
print("settings:",len(entries),"subjects")

# ---------- 2. dashboard: icon next to name ----------
p=f"{BASE}/public/dashboard/index.html"
s=open(p).read()
# add ICONS map before renderSubject
if 'const SUB_ICONS' not in s:
    ic_lines=[]
    for slug,title,acc,_ in entries:
        ic_lines.append("  '%s': { c: '%s', p: \"%s\" }," % (slug,acc,icon(slug,title)))
    icons_js="\nconst SUB_ICONS = {\n"+"\n".join(ic_lines)+"\n};\n"
    s=s.replace("function statusColor(pct)", icons_js+"function statusColor(pct)",1)

# patch renderSubject to inject icon next to the label
m=re.search(r"function renderSubject\(subjectKey, label, href, subjectData, unitIds, unitNames\) \{",s)
assert m,"renderSubject not found"
# find where it builds header HTML — look for label usage within first 60 lines after fn start
seg_start=m.end()
seg=s[seg_start:seg_start+3000]
print("---renderSubject body snippet---")
mm=re.search(r"(innerHTML|insertAdjacentHTML)[^;]{0,200}",seg)
print(seg[:900])
