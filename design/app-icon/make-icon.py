#!/usr/bin/env python3
"""Renders the Birthed app icon, all three appearance variants, from one source.

    pip install cairosvg pillow
    python3 make-icon.py ../../Birthed/Assets.xcassets/AppIcon.appiconset

The mark is a honey cake with one lit candle on it: a birthday cake and honey
in one picture. Chosen on September 22, 2026 from three honey directions (a
beeswax candle, a candle in a honeycomb cell, and this), when the app moved
from pink to the hive's honey. Big shapes and few details, because at 60
points on a home screen anything finer is a smear.

The candle is the same object as `CandleMark` in the app. Its width, the way
the flame sits over its top edge and its stripes are all written against the
flame's height with the ratios `CandleMark.swift` uses, so the candle on the
home screen and the candle on the Mine panel are one drawing. Change a ratio
here and it changes there, in the same commit.

Three files come out, which is what the asset catalog expects on iOS 18:

  AppIcon.png          light, full colour, flattened. The App Store rejects an
                       icon with an alpha channel, so this one is composited
                       onto the background colour before it is written.
  AppIcon-Dark.png     the same cake on a dark brown ground for dark mode.
  AppIcon-Tinted.png   greyscale with transparency. The system tints by
                       luminance and supplies its own backdrop, so the flame is
                       the brightest thing in the file and there is no
                       background at all.
"""
import os
import sys

import cairosvg
from PIL import Image

FLAME = ("M 50 3 C 53 20, 63 28, 68 40 C 73 51, 73 58, 73 65 C 73 81, 63 95, 50 95 "
         "C 37 95, 27 81, 27 65 C 27 55, 33 47, 39 39 C 41 43, 43 46, 46 48 "
         "C 46 34, 46 17, 50 3 Z")
CORE = ("M 50 40 C 52 52, 60 58, 60 68 C 60 80, 55 87, 49 87 C 43 87, 38 80, 38 69 "
        "C 38 59, 47 52, 50 40 Z")

# The flame, a 100 by 95 box scaled to FLAME_H tall, its tip FLAME_TIP from the top.
FLAME_TIP, FLAME_H = 20, 250

# The candle, in CandleMark's ratios against the flame's height:
# body width 0.376, flame over the top edge by 0.039, top corners 0.1867 of
# the width, stripes a step of 0.84 of the width and 0.4286 of the step,
# turned 36 degrees.
CANDLE_W = round(FLAME_H * 0.376)                          # 94
CANDLE_X = 512 - CANDLE_W / 2
CANDLE_Y = FLAME_TIP + FLAME_H - round(FLAME_H * 0.039)    # 260
CANDLE_RADIUS = CANDLE_W * 0.1867
STRIPE_STEP = round(CANDLE_W * 0.84)                       # 79
STRIPE_H = round(STRIPE_STEP * 0.4286)                     # 34

# The cake: one block, two fillings, a honey glaze with five drips.
CAKE_W, CAKE_TOP, CAKE_BOTTOM, CAKE_RADIUS = 620, 520, 900, 64
FILLINGS = ((150, 56), (270, 56))       # offset from the top, height
GLAZE_H, DRIP_R = 70, 32
DRIPS = ((80, 120), (200, 70), (330, 135), (460, 85), (560, 110))  # x from the left, length

FLAME_STOPS = [("0", "#FFE08A"), ("0.45", "#FFC24A"), ("1", "#FF8A3D")]
CORE_STOPS = [("0", "#FFFFFF"), ("1", "#FFF3E0")]

PALETTES = {
    "AppIcon.png": {
        "background": [("0", "#F6B444"), ("0.5", "#DD8A1C"), ("1", "#9A4E08")],
        "glow": [("0", "#FFE9A4", "0.55"), ("0.5", "#FFD27A", "0.18"), ("1", "#FFD27A", "0")],
        "sponge": "#FFF3E0", "filling": "#8A4A12",
        "glaze": [("0", "#FFD27A"), ("1", "#F4B740")],
        "candle": "#FFF3E0", "stripe": "#EF5680",
        "flame": FLAME_STOPS, "core": CORE_STOPS,
        "flatten": (221, 138, 28),
    },
    "AppIcon-Dark.png": {
        "background": [("0", "#1E1710"), ("1", "#0B0805")],
        "glow": [("0", "#FFB347", "0.45"), ("0.5", "#F4B740", "0.10"), ("1", "#F4B740", "0")],
        "sponge": "#F3E3C8", "filling": "#6E3A0C",
        "glaze": [("0", "#F4B740"), ("1", "#D98A1C")],
        "candle": "#F3E3C8", "stripe": "#EF5680",
        "flame": FLAME_STOPS, "core": CORE_STOPS,
        "flatten": (18, 13, 8),
    },
    "AppIcon-Tinted.png": {
        "background": None,
        "glow": None,
        "sponge": "#9A9A9A", "filling": "#4E4E4E",
        "glaze": [("0", "#C4C4C4"), ("1", "#AEAEAE")],
        "candle": "#D4D4D4", "stripe": "#7A7A7A",
        "flame": [("0", "#FFFFFF"), ("0.45", "#F2F2F2"), ("1", "#D6D6D6")],
        "core": [("0", "#FFFFFF"), ("1", "#FFFFFF")],
        "flatten": None,
    },
}


def stops(entries):
    out = []
    for entry in entries:
        offset, color = entry[0], entry[1]
        opacity = f' stop-opacity="{entry[2]}"' if len(entry) > 2 else ""
        out.append(f'<stop offset="{offset}" stop-color="{color}"{opacity}/>')
    return "".join(out)


def candle_body():
    x, y, w, r = CANDLE_X, CANDLE_Y, CANDLE_W, CANDLE_RADIUS
    h = CAKE_TOP - CANDLE_Y + 10   # runs into the glaze, which is drawn over it
    return (f"M {x + r:.1f} {y} H {x + w - r:.1f} A {r:.1f} {r:.1f} 0 0 1 {x + w:.1f} {y + r:.1f} "
            f"V {y + h} H {x:.1f} V {y + r:.1f} A {r:.1f} {r:.1f} 0 0 1 {x + r:.1f} {y} Z")


def glaze_path():
    left = 512 - CAKE_W // 2
    right = left + CAKE_W
    top, r, band = CAKE_TOP, CAKE_RADIUS, CAKE_TOP + GLAZE_H
    path = (f"M {left} {top + r} A {r} {r} 0 0 1 {left + r} {top} H {right - r} "
            f"A {r} {r} 0 0 1 {right} {top + r} V {band} ")
    for x, length in sorted(DRIPS, key=lambda d: -d[0]):
        cx = left + x
        path += (f"L {cx + DRIP_R} {band} V {band + length - DRIP_R} "
                 f"A {DRIP_R} {DRIP_R} 0 0 1 {cx - DRIP_R} {band + length - DRIP_R} V {band} ")
    return path + f"L {left} {band} Z"


def svg_for(palette):
    left = 512 - CAKE_W // 2
    scale = FLAME_H / 95.0
    stripes = "".join(
        f'<rect x="{CANDLE_X - 300:.0f}" y="{y}" width="{CANDLE_W + 600}" height="{STRIPE_H}" '
        f'fill="{palette["stripe"]}"/>'
        for y in range(CANDLE_Y - 300, CAKE_TOP + 300, STRIPE_STEP)
    )
    fillings = "".join(
        f'<rect x="{left}" y="{CAKE_TOP + offset}" width="{CAKE_W}" height="{height}" '
        f'fill="{palette["filling"]}"/>'
        for offset, height in FILLINGS
    )

    defs = ""
    ground = ""
    if palette["background"]:
        defs += ('<linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">'
                 + stops(palette["background"]) + "</linearGradient>")
        ground += '<rect width="1024" height="1024" fill="url(#bg)"/>'
    if palette["glow"]:
        # The bloom sits on the flame, not in the top corner.
        defs += ('<radialGradient id="glow" cx="50%" cy="50%" r="50%">'
                 + stops(palette["glow"]) + "</radialGradient>")
        ground += f'<ellipse cx="512" cy="{FLAME_TIP + FLAME_H * 0.72:.0f}" rx="260" ry="260" fill="url(#glow)"/>'

    body = candle_body()
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  {defs}
  <linearGradient id="glaze" x1="0" y1="0" x2="0" y2="1">{stops(palette["glaze"])}</linearGradient>
  <linearGradient id="flame" x1="0.2" y1="0" x2="0.8" y2="1">{stops(palette["flame"])}</linearGradient>
  <linearGradient id="hot" x1="0" y1="0" x2="0" y2="1">{stops(palette["core"])}</linearGradient>
  <clipPath id="candle"><path d="{body}"/></clipPath>
</defs>
{ground}
<rect x="{left}" y="{CAKE_TOP}" width="{CAKE_W}" height="{CAKE_BOTTOM - CAKE_TOP}" rx="{CAKE_RADIUS}" fill="{palette["sponge"]}"/>
{fillings}
<path d="{body}" fill="{palette["candle"]}"/>
<g clip-path="url(#candle)"><g transform="rotate(-36 512 {CANDLE_Y + 130})">{stripes}</g></g>
<path d="{glaze_path()}" fill="url(#glaze)"/>
<g transform="translate({512 - 50 * scale:.2f} {FLAME_TIP}) scale({scale:.4f})">
  <path d="{FLAME}" fill="url(#flame)"/>
  <path d="{CORE}" fill="url(#hot)"/>
</g>
</svg>'''


def main(target_dir: str, size: int = 1024) -> None:
    os.makedirs(target_dir, exist_ok=True)
    for filename, palette in PALETTES.items():
        svg = svg_for(palette)
        tmp = "/tmp/_birthed_icon.png"
        cairosvg.svg2png(bytestring=svg.encode(), write_to=tmp,
                         output_width=size, output_height=size)
        rendered = Image.open(tmp)
        out = os.path.join(target_dir, filename)
        if palette["flatten"]:
            flat = Image.new("RGB", rendered.size, palette["flatten"])
            alpha = rendered.split()[3] if rendered.mode == "RGBA" else None
            flat.paste(rendered, (0, 0), alpha)
            flat.save(out, "PNG")
            note = "flattened, no alpha"
        else:
            rendered.convert("RGBA").save(out, "PNG")
            note = "alpha kept, the system supplies the backdrop"
        print(f"wrote {out}  ({note})")
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "birthed-icon.svg"), "w") as handle:
        handle.write(svg_for(PALETTES["AppIcon.png"]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
