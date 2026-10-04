def mark(ink,r1,r2,r3):
    return f'<path d="M-62 -70H-30Q-26 -70 -26 -66V74L-46 54L-66 74V-66Q-66 -70 -62 -70Z" fill="{ink}"/><circle cx="18" cy="-34" r="71" fill="{r1}"/><circle cx="18" cy="-34" r="48" fill="{r2}"/><circle cx="18" cy="-34" r="26" fill="{r3}"/><circle cx="18" cy="-34" r="9" fill="{ink}"/>'
# name: (light bg, light colours), (dark bg, dark colours)  colours = ink,r1,r2,r3
P=[('1 Forest',('#f4f1e6',('#1e293b','#1f6e46','#f5b83d','#fff3c9')),('#14302a',('#f8fafc','#4fbf85','#f5b83d','#14302a'))),
('2 Sunset',('#fdfdfb',('#1e293b','#e11d48','#fb923c','#fde047')),('#12151f',('#f8fafc','#fb4d6d','#fb923c','#fde047'))),
('3 Ocean',('#eef6fa',('#0f2a43','#0e7490','#38bdf8','#e0f7ff')),('#0b1c2c',('#f1f9ff','#22b8d8','#38bdf8','#0b1c2c'))),
('4 Plum',('#f7f2fb',('#2b1b3d','#7c3aed','#f472b6','#fde8f3')),('#1a1026',('#f8f3ff','#a78bfa','#f472b6','#1a1026'))),
('5 Mono',('#f3f4f6',('#111827','#374151','#9ca3af','#f3f4f6')),('#111827',('#f9fafb','#d1d5db','#6b7280','#111827')))]
W,H=1500,520
o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#ffffff"/>']
for i,(n,l,d) in enumerate(P):
    cx=150+i*300
    for j,(bg,c) in enumerate([l,d]):
        cy=140+j*190
        o.append(f'<rect x="{cx-130}" y="{cy-90}" width="260" height="180" rx="18" fill="{bg}"/><g transform="translate({cx} {cy}) scale(.85)">{mark(*c)}</g>')
    o.append(f'<text x="{cx}" y="{505}" text-anchor="middle" font-family="Helvetica" font-size="20" font-weight="700" fill="#333">{n}</text>')
o.append(f'<text x="8" y="22" font-family="Helvetica" font-size="14" fill="#666">top row: light mode, bottom row: dark mode</text></svg>')
open('palettes.svg','w').write('\n'.join(o))
