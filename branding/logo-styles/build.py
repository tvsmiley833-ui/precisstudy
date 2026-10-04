G,A,C='#1f6e46','#f5b83d','#fff3c9'
def s1(fg,ac,bg):  # Bookmark P
    return f'<path d="M-62 -70H-30Q-26 -70 -26 -66V74L-46 54L-66 74V-66Q-66 -70 -62 -70Z" fill="{fg}"/><circle cx="18" cy="-34" r="71" fill="{fg}"/><circle cx="18" cy="-34" r="48" fill="{ac}"/><circle cx="18" cy="-34" r="26" fill="{bg}"/><circle cx="18" cy="-34" r="9" fill="{fg}"/>'
def s2(fg,ac,bg):  # Monoline P with open page tail
    return f'<g fill="none" stroke="{fg}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><path d="M-40 70V-70H10A46 46 0 0 1 10 22H-40"/></g><path d="M-62 70H46" stroke="{ac}" stroke-width="16" stroke-linecap="round"/><circle cx="12" cy="-24" r="10" fill="{ac}"/>'
def s3(fg,ac,bg):  # Seal
    return f'<circle r="86" fill="{fg}"/><circle r="70" fill="none" stroke="{bg}" stroke-width="4"/><path d="M-30 -48H-14V52H-30Z" fill="{bg}"/><path d="M-14 -48H14A31 31 0 0 1 14 14H-14V-2H14A15 15 0 0 0 14 -32H-14Z" fill="{bg}"/><path d="M26 -86H50V-34L38 -44L26 -34Z" fill="{ac}"/>'
def s4(fg,ac,bg):  # Open book + rising target
    return f'<circle cx="0" cy="-8" r="50" fill="{ac}"/><circle cx="0" cy="-8" r="32" fill="{bg}"/><circle cx="0" cy="-8" r="14" fill="{fg}"/><path d="M-84 8Q-42 -4 0 22Q42 -4 84 8V70Q42 58 0 84Q-42 58 -84 70Z" fill="{fg}"/><path d="M0 28V80" stroke="{bg}" stroke-width="5"/>'
def sage(fg,ac,bg,full=False):
    head=f'<path d="M-62 -34L-62 -78L-30 -56Q0 -66 30 -56L62 -78L62 -34V10Q62 60 0 60Q-62 60 -62 10Z" fill="{fg}"/><circle cx="-26" cy="-14" r="24" fill="{bg}"/><circle cx="26" cy="-14" r="24" fill="{bg}"/><circle cx="-26" cy="-12" r="10" fill="{fg}"/><circle cx="26" cy="-12" r="10" fill="{fg}"/><path d="M-9 8H9L0 26Z" fill="{ac}"/>'
    if not full: return head+f'<path d="M-30 40Q0 52 30 40" fill="none" stroke="{ac}" stroke-width="6" stroke-linecap="round"/>'
    return head
def s5(fg,ac,bg): return sage(fg,ac,bg)
styles=[('1 Bookmark P',s1),('2 Monoline P',s2),('3 Seal',s3),('4 Book + Target',s4),('5 Sage head',s5)]
W,H=1500,560
o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#f4f1e6"/>']
o.append('<text x="30" y="40" font-family="Helvetica" font-size="22" font-weight="700" fill="#1f6e46">PrecisStudy logo styles - palette: forest green #1f6e46 / amber #f5b83d / cream #fff3c9</text>')
for i,(n,f) in enumerate(styles):
    cx=150+i*300
    for j,(bgc,fg,ac,bg) in enumerate([(C,G,A,C),(G,C,A,G)]):
        cy=170+j*190
        o.append(f'<rect x="{cx-130}" y="{cy-90}" width="260" height="180" rx="18" fill="{bgc}"/>')
        o.append(f'<g transform="translate({cx} {cy}) scale(.85)">{f(fg,ac,bg)}</g>')
    o.append(f'<text x="{cx}" y="{545}" text-anchor="middle" font-family="Helvetica" font-size="20" font-weight="700" fill="#1f6e46">{n}</text>')
o.append('</svg>')
open('styles.svg','w').write('\n'.join(o))
# flat Sage full
S=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 380" width="1040" height="760"><rect width="520" height="380" fill="#f4f1e6"/>']
def tile(x,bgc,fg,ac,bg):
    t=f'<rect x="{x}" y="20" width="240" height="340" rx="20" fill="{bgc}"/><g transform="translate({x+120} 150) scale(1.5)">'
    t+=f'<path d="M-50 40Q-62 120 0 128Q62 120 50 40Z" fill="{fg}"/><path d="M-26 66Q0 78 26 66M-24 86Q0 98 24 86M-20 106Q0 116 20 106" fill="none" stroke="{ac}" stroke-width="5" stroke-linecap="round"/>'
    t+=f'<path d="M-24 128H-10M10 128H24" stroke="{ac}" stroke-width="7" stroke-linecap="round"/>'
    t+=sage(fg,ac,bg,True)+'</g>'
    return t
S.append(tile(10,C,G,A,C)); S.append(tile(270,G,C,A,G)); S.append('</svg>')
open('sage-flat.svg','w').write('\n'.join(S))
