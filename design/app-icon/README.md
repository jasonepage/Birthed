# App icon

The mark is a birthday candle: the pink straw from the founding observation in
`PRD.md` section 2, lit. The candle runs off the bottom edge so the icon reads
as a composition rather than a sticker centred on a square.

`make-icon.py` is the source of truth. `birthed-icon.svg` is written out by it
for reference, and the three PNGs in the asset catalog are its output. To
change the icon, change the script, do not hand edit the PNGs.

```
pip install cairosvg pillow
cd design/app-icon
python3 make-icon.py ../../Birthed/Assets.xcassets/AppIcon.appiconset
```

Three variants, which is what iOS 18 expects in the asset catalog:

- `AppIcon.png` is the light appearance, full colour and **flattened onto the
  background pink**. The App Store rejects an icon carrying an alpha channel,
  so the script composites before writing. Do not remove that step.
- `AppIcon-Dark.png` is the same mark on a deeper ground.
- `AppIcon-Tinted.png` is greyscale with transparency. The system tints by
  luminance and supplies its own backdrop, so the flame is the brightest thing
  in the file and there is no background in it at all.

The accent, `#EF5680`, is the same pink as `Theme.accent` in the app and the
share card. If one changes they all change.
