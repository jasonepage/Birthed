import math, random, sys

def hexpath(cx, cy, r):
    pts = []
    for i in range(6):
        a = math.radians(60 * i - 30)
        pts.append(f"{cx + r*math.cos(a):.1f},{cy + r*math.sin(a):.1f}")
    return "M" + " L".join(pts) + " Z"

DEFS = '''
  <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#E9A826"/><stop offset="1" stop-color="#E9A826"/>
  </linearGradient>
  <linearGradient id="waxlit" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF1C2" stop-opacity="0.75"/><stop offset="0.25" stop-color="#FFC94A" stop-opacity="0.05"/><stop offset="1" stop-color="#2A1204" stop-opacity="0.55"/>
  </linearGradient>
  <linearGradient id="stripe" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#7A1E14"/><stop offset="0.5" stop-color="#C94A2E"/><stop offset="1" stop-color="#6E1A10"/>
  </linearGradient>
  <linearGradient id="cakeside" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C98A3A"/><stop offset="1" stop-color="#9A5E22"/>
  </linearGradient>
  <linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#1A0C02" stop-opacity="0.8"/><stop offset="0.28" stop-color="#5A2E08" stop-opacity="0.25"/><stop offset="0.5" stop-color="#FFE9A0" stop-opacity="0.18"/><stop offset="0.72" stop-color="#5A2E08" stop-opacity="0.3"/><stop offset="1" stop-color="#1A0C02" stop-opacity="0.85"/>
  </linearGradient>
  <pattern id="hexwax2" x="0" y="0" width="90" height="156" patternUnits="userSpaceOnUse">
    <path d="{hx1}" fill="#F2B83A" stroke="#7A4306" stroke-width="7"/>
    <path d="{hx2}" fill="#F2B83A" stroke="#7A4306" stroke-width="7"/>
    <path d="{hx3}" fill="#F2B83A" stroke="#7A4306" stroke-width="7"/>
    <path d="{hx4}" fill="#FFE07A" opacity="0.5"/><path d="{hx5}" fill="#FFE07A" opacity="0.5"/><path d="{hx6}" fill="#FFE07A" opacity="0.5"/>
  </pattern>
  <linearGradient id="honey" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFD866"/><stop offset="0.55" stop-color="#F0A21C"/><stop offset="1" stop-color="#B86A08"/>
  </linearGradient>
  <linearGradient id="honeydrip" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C77A0E"/><stop offset="0.5" stop-color="#F7B531"/><stop offset="1" stop-color="#FFD866"/>
  </linearGradient>
  <radialGradient id="honeytop" cx="0.42" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#FFEFB8"/><stop offset="0.45" stop-color="#F7B531"/><stop offset="1" stop-color="#B06206"/>
  </radialGradient>
  <linearGradient id="abdomen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFD24A"/><stop offset="0.5" stop-color="#F2A81C"/><stop offset="1" stop-color="#9A5A06"/>
  </linearGradient>
  <linearGradient id="thorax" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C98A2A"/><stop offset="0.55" stop-color="#7A4C12"/><stop offset="1" stop-color="#3A2006"/>
  </linearGradient>
  <linearGradient id="wing" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFF4D0" stop-opacity="0.6"/><stop offset="0.6" stop-color="#FFD98A" stop-opacity="0.25"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0.08"/>
  </linearGradient>
  <radialGradient id="flameOuter" cx="0.5" cy="0.75" r="0.75">
    <stop offset="0" stop-color="#FFB13A"/><stop offset="0.6" stop-color="#FF7A1F"/><stop offset="1" stop-color="#FF5A1F" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="flameMid" cx="0.5" cy="0.8" r="0.7">
    <stop offset="0" stop-color="#FFF3A0"/><stop offset="0.7" stop-color="#FFCF4A"/><stop offset="1" stop-color="#FF8A1A" stop-opacity="0.2"/>
  </radialGradient>
  <radialGradient id="flameCore" cx="0.5" cy="0.8" r="0.7">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#FFFBE0"/><stop offset="1" stop-color="#FFE48A" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="flameBlue" cx="0.5" cy="0.4" r="0.7">
    <stop offset="0" stop-color="#9ED8FF"/><stop offset="0.6" stop-color="#3F7FD6" stop-opacity="0.8"/><stop offset="1" stop-color="#3F7FD6" stop-opacity="0"/>
  </radialGradient>
  <pattern id="hexwax" x="0" y="0" width="60" height="104" patternUnits="userSpaceOnUse">
    <path d="{h1}" fill="none" stroke="#5A2E04" stroke-width="5" opacity="0.6"/>
    <path d="{h2}" fill="none" stroke="#5A2E04" stroke-width="5" opacity="0.6"/>
    <path d="{h3}" fill="none" stroke="#5A2E04" stroke-width="5" opacity="0.6"/>
    <path d="{h4}" fill="#FFE68A" opacity="0.14"/>
  </pattern>
'''.replace("{h1}", hexpath(30,26,30)).replace("{h2}", hexpath(0,78,30)).replace("{h3}", hexpath(60,78,30)).replace("{h4}", hexpath(30,26,22)).replace("{hx1}", hexpath(45,39,45)).replace("{hx2}", hexpath(0,117,45)).replace("{hx3}", hexpath(90,117,45)).replace("{hx4}", hexpath(45,39,30)).replace("{hx5}", hexpath(0,117,30)).replace("{hx6}", hexpath(90,117,30))

def common_defs(W, H, fx, fy, scale, glow_r):
    return f'''<defs>
  <radialGradient id="bg" cx="{fx}" cy="{fy}" r="{W*0.7}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#6B3A0C"/><stop offset="0.3" stop-color="#3A2008"/><stop offset="0.7" stop-color="#1A0F05"/><stop offset="1" stop-color="#0E0803"/>
  </radialGradient>
  <radialGradient id="flameglow" cx="{fx}" cy="{fy}" r="{glow_r}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFE08A" stop-opacity="0.9"/><stop offset="0.2" stop-color="#FFA526" stop-opacity="0.5"/><stop offset="0.55" stop-color="#C85A10" stop-opacity="0.14"/><stop offset="1" stop-color="#C85A10" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="hexfade" cx="{fx}" cy="{fy}" r="{W*0.55}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="0.4" stop-color="#FFFFFF" stop-opacity="0.4"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <mask id="hexmask"><rect width="{W}" height="{H}" fill="url(#hexfade)"/></mask>
  <pattern id="hexwall" x="0" y="0" width="{int(180*scale)}" height="{int(312*scale)}" patternUnits="userSpaceOnUse">
    <path d="{hexpath(90*scale,78*scale,84*scale)}" fill="#F0A21C" opacity="0.07" stroke="#F7B531" stroke-width="{7*scale:.1f}"/>
    <path d="{hexpath(0,234*scale,84*scale)}" fill="#F0A21C" opacity="0.07" stroke="#F7B531" stroke-width="{7*scale:.1f}"/>
    <path d="{hexpath(180*scale,234*scale,84*scale)}" fill="#F0A21C" opacity="0.07" stroke="#F7B531" stroke-width="{7*scale:.1f}"/>
  </pattern>
  <radialGradient id="vig" cx="0.5" cy="0.45" r="0.72">
    <stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0A0502" stop-opacity="0.85"/>
  </radialGradient>
  <linearGradient id="bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0.68" stop-color="#0E0803" stop-opacity="0"/><stop offset="1" stop-color="#0E0803" stop-opacity="0.9"/></linearGradient>
  <filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{6*scale:.1f}"/></filter>
  <filter id="blur20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{20*scale:.1f}"/></filter>
  <filter id="blur60" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="{60*scale:.1f}"/></filter>
  <filter id="softglow" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="{5*scale:.1f}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="{18*scale:.0f}" stdDeviation="{18*scale:.0f}" flood-color="#000" flood-opacity="0.6"/>
  </filter>
  {DEFS}
</defs>'''

def bee(x, y, s, angle=-15, flip=False, lit=1, uid="a", hat=False):
    """A real looking cartoon bee, side view, flying. s = scale (1 = about 300 px long)."""
    sx = -1 if flip else 1
    g = [f'<g transform="translate({x} {y}) rotate({angle}) scale({sx*s} {s})">']
    # legs
    g.append('<g fill="none" stroke="#2A1606" stroke-width="7" stroke-linecap="round">'
             '<path d="M-20,40 q-10,30 -34,46"/><path d="M10,42 q-4,34 -22,52"/><path d="M40,36 q6,34 -10,56"/>'
             '<path d="M-40,34 q-16,24 -44,30"/><path d="M-5,44 q-12,30 -40,44"/><path d="M60,30 q14,28 4,52"/></g>')
    # back wings
    g.append('<ellipse cx="-20" cy="-70" rx="78" ry="30" transform="rotate(-38 -20 -70)" fill="url(#wing)" stroke="#FFF1C2" stroke-width="3" opacity="0.8"/>')
    # abdomen (striped)
    g.append(f'<clipPath id="ab{uid}"><ellipse cx="-95" cy="12" rx="110" ry="62" transform="rotate(8 -95 12)"/></clipPath>')
    g.append('<ellipse cx="-95" cy="12" rx="110" ry="62" transform="rotate(8 -95 12)" fill="url(#abdomen)"/>')
    g.append(f'<g clip-path="url(#ab{uid})">'
             '<path d="M-60,-70 l-28,0 l-6,160 l28,0 Z" fill="#2A1606"/><path d="M-110,-70 l-30,0 l-6,160 l30,0 Z" fill="#2A1606"/>'
             '<path d="M-160,-70 l-26,0 l-6,160 l26,0 Z" fill="#2A1606"/><path d="M-205,-70 l-22,0 l-6,160 l22,0 Z" fill="#2A1606"/>'
             '<ellipse cx="-95" cy="40" rx="110" ry="40" fill="#3A1A04" opacity="0.45"/>'
             '<ellipse cx="-80" cy="-22" rx="70" ry="16" fill="#FFF1C2" opacity="0.35"/>'
             '</g>')
    g.append('<ellipse cx="-95" cy="12" rx="110" ry="62" transform="rotate(8 -95 12)" fill="none" stroke="#2A1606" stroke-width="6"/>')
    # stinger
    g.append('<path d="M-200,26 l-34,10 l32,10 Z" fill="#2A1606"/>')
    # thorax (fuzzy)
    g.append('<ellipse cx="10" cy="4" rx="64" ry="54" fill="url(#thorax)" stroke="#2A1606" stroke-width="6"/>')
    for i in range(16):
        a = math.radians(i * 22.5 + 10); r = 56
        g.append(f'<path d="M{10+r*math.cos(a):.0f},{4+r*math.sin(a):.0f} l{12*math.cos(a):.0f},{12*math.sin(a):.0f}" stroke="#C98A2A" stroke-width="5" stroke-linecap="round" opacity="0.7"/>')
    g.append('<ellipse cx="0" cy="-16" rx="30" ry="16" fill="#E9B45A" opacity="0.5"/>')
    # head
    g.append('<circle cx="86" cy="-6" r="42" fill="#3A2006" stroke="#2A1606" stroke-width="6"/>'
             '<ellipse cx="80" cy="-20" rx="18" ry="10" fill="#8A5A1A" opacity="0.6"/>')
    # compound eye
    g.append('<ellipse cx="104" cy="-8" rx="17" ry="24" fill="#120A02" stroke="#2A1606" stroke-width="3"/>'
             '<ellipse cx="108" cy="-16" rx="5" ry="7" fill="#FFF1C2" opacity="0.9"/>')
    # mouth: small smile
    g.append('<path d="M96,18 q10,8 20,0" fill="none" stroke="#120A02" stroke-width="4" stroke-linecap="round"/>')
    # antennae
    g.append('<path d="M100,-44 q10,-40 44,-50" fill="none" stroke="#2A1606" stroke-width="6" stroke-linecap="round"/>'
             '<path d="M84,-46 q-6,-40 14,-66" fill="none" stroke="#2A1606" stroke-width="6" stroke-linecap="round"/>')
    # front wings
    g.append('<ellipse cx="30" cy="-74" rx="100" ry="34" transform="rotate(-28 30 -74)" fill="url(#wing)" stroke="#FFF1C2" stroke-width="3"/>'
             '<path d="M-40,-30 q50,-70 120,-110 M-20,-40 q40,-30 90,-60" fill="none" stroke="#FFF1C2" stroke-width="2" opacity="0.5"/>')
    # rim light toward flame
    side = lit * (-1 if flip else 1)
    g.append(f'<path d="M{86+34*side},-40 a42,42 0 0 {1 if side>0 else 0} 0,70" fill="none" stroke="#FFF1C2" stroke-width="7" opacity="0.8" filter="url(#blur6)"/>'
             f'<path d="M{-95+90*side},-40 a110,62 0 0 {1 if side>0 else 0} 0,100" fill="none" stroke="#FFE08A" stroke-width="8" opacity="0.55" filter="url(#blur6)"/>')
    if hat:
        g.append('<g transform="translate(78 -48) rotate(-10)">'
                 '<path d="M-28,10 L0,-56 L28,10 Z" fill="#C94A2E" stroke="#2A1606" stroke-width="5" stroke-linejoin="round"/>'
                 '<path d="M-18,-12 L18,-12" stroke="#FFD866" stroke-width="6"/>'
                 '<circle cx="0" cy="-58" r="9" fill="#FFD866" stroke="#2A1606" stroke-width="4"/></g>')
    g.append('</g>')
    return "\n".join(g)

def drips(rng, x0, x1, ytop, base_len, var, fill="url(#honeydrip)", n=None):
    """Organic honey drips hanging from a straight edge, with rounded bulbs."""
    out = []
    x = x0
    while x < x1:
        w = rng.uniform(26, 54)
        L = base_len + rng.uniform(0, var) * (rng.random() ** 1.6) * 3
        bulb = w * 0.55
        out.append(f'<path d="M{x:.0f},{ytop} L{x+w:.0f},{ytop} L{x+w*0.78:.0f},{ytop+L:.0f} A{bulb/2:.0f},{bulb/2:.0f} 0 0 1 {x+w*0.22:.0f},{ytop+L:.0f} Z" fill="{fill}"/>')
        if L > base_len + 50:
            out.append(f'<ellipse cx="{x+w*0.4:.0f}" cy="{ytop+L-6:.0f}" rx="{w*0.09:.0f}" ry="{w*0.2:.0f}" fill="#FFF1C2" opacity="0.8"/>')
        x += w * rng.uniform(0.92, 1.12)
    return "\n".join(out)

def candle_and_cake(rng):
    out = []
    # plate
    out.append('<ellipse cx="0" cy="44" rx="600" ry="160" fill="#1A0E04" opacity="0.8" filter="url(#blur20)"/>'
               '<ellipse cx="0" cy="24" rx="580" ry="150" fill="#4A3018"/>'
               '<ellipse cx="0" cy="14" rx="560" ry="140" fill="#7A5430"/>'
               '<ellipse cx="0" cy="14" rx="470" ry="112" fill="#5A3A1C"/>'
               '<path d="M-520,-10 a540,130 0 0 1 300,-110" fill="none" stroke="#D9B07A" stroke-width="10" opacity="0.35" stroke-linecap="round"/>')
    # tier 1: layered sponge
    out.append('<rect x="-440" y="-250" width="880" height="260" fill="url(#cakeside)"/>'
               '<ellipse cx="0" cy="10" rx="440" ry="110" fill="url(#cakeside)"/>')
    out.append('<clipPath id="t1"><rect x="-440" y="-250" width="880" height="260"/></clipPath><g clip-path="url(#t1)">'
               '<rect x="-440" y="-170" width="880" height="28" fill="url(#honey)" opacity="0.9"/><rect x="-440" y="-90" width="880" height="28" fill="url(#honey)" opacity="0.9"/>'
               '<rect x="-440" y="-250" width="880" height="260" fill="url(#cyl)"/></g>')
    out.append(drips(rng, -440, 440, -244, 40, 70))
    out.append('<ellipse cx="0" cy="-250" rx="440" ry="110" fill="url(#honeytop)"/>'
               '<ellipse cx="0" cy="-250" rx="440" ry="110" fill="none" stroke="#FFE08A" stroke-width="6" opacity="0.5"/>')
    # tier 2
    out.append('<rect x="-300" y="-460" width="600" height="220" fill="url(#cakeside)"/>'
               '<ellipse cx="0" cy="-240" rx="300" ry="78" fill="url(#cakeside)"/>')
    out.append('<clipPath id="t2"><rect x="-300" y="-460" width="600" height="220"/></clipPath><g clip-path="url(#t2)">'
               '<rect x="-300" y="-380" width="600" height="24" fill="url(#honey)" opacity="0.9"/><rect x="-300" y="-310" width="600" height="24" fill="url(#honey)" opacity="0.9"/>'
               '<rect x="-300" y="-460" width="600" height="220" fill="url(#cyl)"/></g>')
    out.append(drips(rng, -300, 300, -454, 36, 60))
    out.append('<ellipse cx="0" cy="-460" rx="300" ry="78" fill="url(#honeytop)"/>'
               '<ellipse cx="0" cy="-460" rx="300" ry="78" fill="none" stroke="#FFE08A" stroke-width="6" opacity="0.5"/>')
    # honeycomb chunk resting on the top tier, honey pooling off it
    out.append('<g transform="translate(-190 -470) rotate(-8)">'
               + "".join(f'<path d="{hexpath(cx, cy, 28)}" fill="#B86A08" stroke="#5A2E04" stroke-width="4"/><path d="{hexpath(cx, cy, 17)}" fill="url(#honeytop)"/>' for cx, cy in [(0,0),(49,0),(24,42),(-25,42),(73,42)])
               + '<ellipse cx="30" cy="70" rx="90" ry="14" fill="#F7B531" opacity="0.8"/></g>')
    # one long drip off the top tier edge, wet bead
    out.append('<path d="M232,-452 L262,-452 L256,-330 Q258,-250 250,-200 A16,16 0 0 1 222,-200 Q226,-260 232,-330 Z" fill="url(#honeydrip)"/>'
               '<circle cx="236" cy="-150" r="13" fill="#F7B531"/><ellipse cx="231" cy="-158" rx="4" ry="7" fill="#FFF1C2" opacity="0.9"/>'
               '<ellipse cx="238" cy="-300" rx="4" ry="40" fill="#FFF1C2" opacity="0.6"/>')
    # gloss on tops
    out.append('<ellipse cx="-140" cy="-492" rx="100" ry="14" fill="#FFF1C2" opacity="0.45"/>'
               '<ellipse cx="-210" cy="-282" rx="130" ry="18" fill="#FFF1C2" opacity="0.4"/>')
    # wax pool around the candle base
    out.append('<ellipse cx="8" cy="-468" rx="140" ry="38" fill="#E9B23A"/><ellipse cx="-16" cy="-474" rx="84" ry="18" fill="#FFF1B0" opacity="0.75"/>'
               '<path d="M110,-470 q40,10 30,40 a12,12 0 0 1 -24,0 q4,-20 -6,-40 Z" fill="#E9B23A"/>')
    # candle: cylinder
    out.append('<rect x="-105" y="-1120" width="210" height="660" fill="url(#wax)"/>'
               '<clipPath id="candleclip"><rect x="-105" y="-1120" width="210" height="660"/></clipPath>')
    out.append('<g clip-path="url(#candleclip)"><rect x="-105" y="-1120" width="210" height="660" fill="url(#hexwax2)"/>')
    # helix stripe: curved bands following a cylinder
    for i in range(6):
        y0 = -1080 + i*112
        out.append(f'<path d="M-105,{y0} C-40,{y0-18} 40,{y0-52} 105,{y0-72} L105,{y0-40} C40,{y0-20} -40,{y0+14} -105,{y0+32} Z" fill="url(#stripe)" opacity="0.92"/>'
                   f'<path d="M-105,{y0} C-40,{y0-18} 40,{y0-52} 105,{y0-72}" stroke="#3A0C06" stroke-width="5" fill="none" opacity="0.5"/>'
                   f'<path d="M-105,{y0+32} C-40,{y0+14} 40,{y0-20} 105,{y0-40}" stroke="#F0A07A" stroke-width="3" fill="none" opacity="0.45"/>')
    out.append('<rect x="-105" y="-1120" width="210" height="660" fill="url(#cyl)"/>'
               '<rect x="-105" y="-1120" width="210" height="660" fill="url(#waxlit)"/>'
               '</g>')
    # top of candle: melted cup
    out.append('<ellipse cx="0" cy="-1118" rx="105" ry="28" fill="#C98A1A"/><ellipse cx="0" cy="-1116" rx="88" ry="20" fill="#FFE68A"/><ellipse cx="-6" cy="-1116" rx="60" ry="12" fill="#FFF8D0"/>')
    # drips down the right side, organic
    out.append('<path d="M60,-1112 L104,-1112 L100,-980 Q104,-900 96,-840 Q92,-790 102,-740 A18,18 0 0 1 66,-740 Q60,-800 70,-860 Q76,-930 64,-1000 Z" fill="#F2C24A"/>'
               '<path d="M84,-1060 q6,80 -2,160" stroke="#FFFBE0" stroke-width="6" stroke-linecap="round" opacity="0.8" fill="none"/>'
               '<path d="M22,-1108 L54,-1108 L50,-1030 Q52,-980 44,-940 A12,12 0 0 1 22,-944 Q28,-1000 22,-1060 Z" fill="#FFD866" opacity="0.9"/>'
               '<path d="M-70,-1110 L-40,-1110 L-44,-1050 A10,10 0 0 1 -66,-1050 Z" fill="#FFD866" opacity="0.9"/>')
    # wet drip about to fall off the right side
    out.append('<path d="M98,-760 Q108,-740 108,-700 A14,14 0 0 1 80,-700 Q80,-740 90,-760 Z" fill="#F2A81C" stroke="#8A4A08" stroke-width="2"/>'
               '<ellipse cx="101" cy="-730" rx="5" ry="12" fill="#FFFFFF" opacity="0.9"/><circle cx="94" cy="-662" r="8" fill="#F2A81C"/>')
    # wick with ember
    out.append('<path d="M0,-1118 q6,-50 -10,-80 q-10,-18 4,-30" fill="none" stroke="#120808" stroke-width="12" stroke-linecap="round"/>'
               '<circle cx="-6" cy="-1230" r="9" fill="#FF3A1A" filter="url(#softglow)"/>')
    # flame, no blue
    out.append('<g transform="translate(0 -1225) rotate(9) scale(1.6)">'
               '<path d="M0,-520 C150,-330 190,-180 110,-50 C70,20 -70,20 -110,-50 C-190,-180 -150,-330 0,-520 Z" fill="#FF7A1F" opacity="0.5" filter="url(#blur60)"/>'
               '<path d="M0,-420 C120,-270 150,-150 95,-40 C60,18 -60,18 -95,-40 C-150,-150 -120,-270 0,-420 Z" fill="url(#flameOuter)"/>'
               '<path d="M4,-300 C80,-200 100,-110 60,-30 C40,12 -40,12 -60,-30 C-100,-110 -80,-200 4,-300 Z" fill="url(#flameMid)"/>'
               '<path d="M2,-190 C45,-130 55,-80 32,-30 C20,-4 -20,-4 -32,-30 C-55,-80 -45,-130 2,-190 Z" fill="url(#flameCore)"/>'
               '</g>')
    for i in range(10):
        sx = rng.uniform(-200, 260); sy = -1600 - rng.uniform(0, 600); r = rng.uniform(4, 12)
        out.append(f'<circle cx="{sx:.0f}" cy="{sy:.0f}" r="{r:.0f}" fill="{rng.choice(["#FFE38A","#FFB13A","#FF7A1F"])}" opacity="{rng.uniform(0.4,0.9):.2f}" filter="url(#softglow)"/>')
    return "\n".join(out)

def motes(rng, W, H, fx, fy, n):
    out = []
    for _ in range(n):
        x = rng.uniform(0, W); y = rng.uniform(0, H*0.75)
        d = math.hypot(x-fx, y-fy) / (W*0.5)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rng.uniform(3,9):.0f}" fill="#FFD866" opacity="{max(0.08, 0.7-d):.2f}" filter="url(#softglow)"/>')
    return "\n".join(out)

def scene_cake(W, H, gx, gy, scale, seed):
    rng = random.Random(seed)
    fx, fy = gx, gy - 1260*scale
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">', common_defs(W, H, fx, fy, scale, W*0.36)]
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    o.append(f'<g mask="url(#hexmask)" opacity="0.55"><rect width="{W}" height="{H}" fill="url(#hexwall)"/></g>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#flameglow)"/>')
    o.append(motes(rng, W, H, fx, fy, 60))
    o.append(f'<g transform="translate({gx} {gy}) scale({scale})" filter="url(#shadow)">{candle_and_cake(rng)}</g>')
    # one bee, hovering by the flame, lit from it
    o.append(bee(gx + 520*scale, gy - 1180*scale, 1.15*scale, angle=-18, flip=True, lit=1, uid="a", hat=True))
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/><rect width="{W}" height="{H}" fill="url(#bot)"/>')
    o.append('</svg>')
    return "\n".join(o)

def scene_bees(W, H, scale, seed):
    """Bees on honeycomb with honey dripping; a candle glow from the far left edge is the light. Group sits left of center."""
    rng = random.Random(seed)
    fx, fy = W*0.06, H*0.35
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">', common_defs(W, H, fx, fy, scale, W*0.5)]
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    # big honeycomb slab, left two fifths, filled cells with honey, some dripping
    r = 150*scale
    cells = []
    cols = int(W*0.5 / (r*1.74)) + 2
    rows = int(H*0.8 / (r*1.5)) + 2
    for row in range(rows):
        for col in range(cols):
            cx = col*r*1.74 + (r*0.87 if row % 2 else 0) - r
            cy = row*r*1.5 + r*0.4
            d = math.hypot(cx - fx, cy - fy) / (W*0.42)
            if d > 1.15: continue
            full = rng.random() < max(0.05, 0.8 - d*0.7)
            op = max(0.12, 1 - d*0.85)
            cells.append(f'<path d="{hexpath(cx, cy, r*0.95)}" fill="#3A2008" stroke="#C77A0E" stroke-width="{12*scale:.0f}" opacity="{op:.2f}"/>')
            if full:
                cells.append(f'<path d="{hexpath(cx, cy, r*0.78)}" fill="url(#honeytop)" opacity="{op:.2f}"/>'
                             f'<ellipse cx="{cx - r*0.25:.0f}" cy="{cy - r*0.3:.0f}" rx="{r*0.3:.0f}" ry="{r*0.12:.0f}" fill="#FFF1C2" opacity="{op*0.55:.2f}"/>')
                if rng.random() < 0.3 and cy < H*0.6:
                    L = rng.uniform(r*1.0, r*3.0); w = r*0.5
                    cells.append(f'<path d="M{cx-w/2:.0f},{cy+r*0.55:.0f} L{cx+w/2:.0f},{cy+r*0.55:.0f} L{cx+w*0.3:.0f},{cy+r*0.55+L:.0f} A{w*0.3:.0f},{w*0.3:.0f} 0 0 1 {cx-w*0.3:.0f},{cy+r*0.55+L:.0f} Z" fill="url(#honeydrip)" opacity="{min(1,op+0.2):.2f}"/>'
                                 f'<ellipse cx="{cx-w*0.1:.0f}" cy="{cy+r*0.55+L*0.6:.0f}" rx="{w*0.08:.0f}" ry="{L*0.3:.0f}" fill="#FFF1C2" opacity="{min(1,op+0.2)*0.6:.2f}"/>')
    o.append("\n".join(cells))
    o.append(f'<rect width="{W}" height="{H}" fill="url(#flameglow)"/>')
    o.append(motes(rng, W, H, fx, fy, 50))
    # three bees: one landed on the comb, two flying in. The flying ones are the story.
    o.append(bee(W*0.16, H*0.64, 1.7*scale, angle=-8, flip=False, lit=-1, uid="b"))          # landed, facing right
    o.append(bee(W*0.40, H*0.38, 2.4*scale, angle=-22, flip=True, lit=1, uid="c", hat=True))  # lead bee, biggest, flying in from right toward the comb
    o.append(bee(W*0.55, H*0.70, 1.3*scale, angle=-30, flip=True, lit=1, uid="d"))              # trailing bee
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/><rect width="{W}" height="{H}" fill="url(#bot)"/>')
    o.append('</svg>')
    return "\n".join(o)

if __name__ == "__main__":
    which = sys.argv[1]
    if which == "cake15":
        W, H = 3840, 2560
        s = H / 2950 * 1.08
        svg = scene_cake(W, H, W*0.5, H*0.69, s, 7)
    elif which == "cake":
        W, H = 5244, 2950
        s = H / 2950 * 1.08
        svg = scene_cake(W, H, W*0.5, H*0.69, s, 7)
    else:
        W, H = 3840, 1646
        s = H / 2950 * 1.0
        svg = scene_bees(W, H, s, 11)
    open(sys.argv[2], "w").write(svg)
