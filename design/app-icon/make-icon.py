#!/usr/bin/env python3
"""Renders the Birthed app icon, all three appearance variants, from one source.

    pip install cairosvg pillow
    python3 make-icon.py ../../Birthed/Assets.xcassets/AppIcon.appiconset

The mark is a birthday candle: the pink straw from the founding observation in
PRD.md section 2, lit. The candle runs off the bottom edge so the icon reads as
a composition rather than a sticker centred on a square.

Three files come out, which is what the asset catalog expects on iOS 18:

  AppIcon.png          light, full colour, flattened. The App Store rejects an
                       icon with an alpha channel, so this one is composited
                       onto the background colour before it is written.
  AppIcon-Dark.png     the same mark on a deeper ground for dark mode.
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

CANDLE_X, CANDLE_Y, CANDLE_W, CANDLE_H = 437, 556, 150, 520
FLAME_TIP, FLAME_H = 148, 424

PALETTES = {
    "AppIcon.png": {
        "background": [("0", "#FF88A8"), ("0.48", "#EF5680"), ("1", "#A8265A")],
        "sheen": [("0", "#FFD9A8", "0.55"), ("0.55", "#FFB48A", "0.12"), ("1", "#FFB48A", "0")],
        "wax": [("0", "#241031"), ("0.3", "#3A1B45"), ("1", "#1B0B24")],
        "stripe": "#FFF3E2", "stripe_opacity": "0.94",
        "flame": [("0", "#FFE08A"), ("0.45", "#FFC24A"), ("1", "#FF8A3D")],
        "core": [("0", "#FFFFFF"), ("1", "#FFF0C2")],
        "flatten": (239, 86, 128),
    },
    "AppIcon-Dark.png": {
        "background": [("0", "#8A2050"), ("0.5", "#4E1132"), ("1", "#20081A")],
        "sheen": [("0", "#FFB07A", "0.30"), ("0.55", "#FF8A6A", "0.08"), ("1", "#FF8A6A", "0")],
        "wax": [("0", "#160821"), ("0.3", "#2A1233"), ("1", "#0E0517")],
        "stripe": "#F3E3D3", "stripe_opacity": "0.92",
        "flame": [("0", "#FFE9A4"), ("0.45", "#FFC85A"), ("1", "#FF934A")],
        "core": [("0", "#FFFFFF"), ("1", "#FFF4D4")],
        "flatten": (40, 12, 30),
    },
    "AppIcon-Tinted.png": {
        "background": None,
        "sheen": None,
        "wax": [("0", "#6E6E6E"), ("0.3", "#8A8A8A"), ("1", "#5E5E5E")],
        "stripe": "#D8D8D8", "stripe_opacity": "1",
        "flame": [("0", "#FFFFFF"), ("0.45", "#F2F2F2"), ("1", "#D0D0D0")],
        "core": [("0", "#FFFFFF"), ("1", "#FFFFFF")],
        "flatten": None,
    },
}


def cylinder(x, y, w, h, rtop, rbot):
    return (f"M {x + rtop} {y} H {x + w - rtop} A {rtop} {rtop} 0 0 1 {x + w} {y + rtop} "
            f"V {y + h - rbot} A {rbot} {rbot} 0 0 1 {x + w - rbot} {y + h} H {x + rbot} "
            f"A {rbot} {rbot} 0 0 1 {x} {y + h - rbot} V {y + rtop} "
            f"A {rtop} {rtop} 0 0 1 {x + rtop} {y} Z")


def stops(entries):
    out = []
    for entry in entries:
        offset, color = entry[0], entry[1]
        opacity = f' stop-opacity="{entry[2]}"' if len(entry) > 2 else ""
        out.append(f'<stop offset="{offset}" stop-color="{color}"{opacity}/>')
    return "".join(out)


def svg_for(palette):
    body = cylinder(CANDLE_X, CANDLE_Y, CANDLE_W, CANDLE_H, 28, 0)
    scale = FLAME_H / 95.0
    stripes = "".join(
        f'<rect x="-500" y="{y}" width="2100" height="54" fill="{palette["stripe"]}" '
        f'opacity="{palette["stripe_opacity"]}"/>'
        for y in range(-200, 1100, 126)
    )
    ground = ""
    if palette["background"]:
        ground += f'<rect width="1024" height="1024" fill="url(#bg)"/>'
    if palette["sheen"]:
        ground += '<ellipse cx="512" cy="300" rx="520" ry="440" fill="url(#sheen)"/>'

    defs = ""
    if palette["background"]:
        defs += ('<linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">'
                 + stops(palette["background"]) + "</linearGradient>")
    if palette["sheen"]:
        defs += ('<radialGradient id="sheen" cx="50%" cy="24%" r="62%">'
                 + stops(palette["sheen"]) + "</radialGradient>")

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  {defs}
  <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">{stops(palette["wax"])}</linearGradient>
  <linearGradient id="flame" x1="0.2" y1="0" x2="0.8" y2="1">{stops(palette["flame"])}</linearGradient>
  <linearGradient id="hot" x1="0" y1="0" x2="0" y2="1">{stops(palette["core"])}</linearGradient>
  <clipPath id="body"><path d="{body}"/></clipPath>
</defs>
{ground}
<path d="{body}" fill="url(#wax)"/>
<g clip-path="url(#body)"><g transform="rotate(-36 512 790)">{stripes}</g></g>
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
