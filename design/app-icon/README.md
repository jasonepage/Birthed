# App icon

The mark is a honey cake with one lit candle on it: a birthday cake and honey
in one picture, for an app that now speaks bee. Big shapes and few details: one
cream block, two brown fillings, a honey glaze with five drips, and a cream
candle with pink stripes, the one pink left in the app.

Chosen on September 22, 2026, when the app moved from pink to the hive's honey
(`notes/ios-honey-brief.md`). Three directions were drawn and compared at home
screen size: a beeswax candle on honey, a candle in one honeycomb cell, and
this. Before that the icon was a single large candle on a pink ground, the
pink straw from the founding observation in `docs/specs/PRD.md` section 2.

The candle on the cake is the same object as `CandleMark` in the app. Its
width, how far the flame sits over its top and its stripes are written against
the flame's height with the ratios `CandleMark.swift` uses, so change them here
and there together.

`make-icon.py` is the source of truth. `birthed-icon.svg` is written out by it
for reference, and the three PNGs in the asset catalog are its output. To
change the icon, change the script, do not hand edit the PNGs.

```
pip install cairosvg pillow
cd design/app-icon
python3 make-icon.py ../../Birthed/Assets.xcassets/AppIcon.appiconset
```

Three variants, which is what iOS 18 expects in the asset catalog:

- `AppIcon.png` is the light appearance, full colour on a honey to amber
  ground, and **flattened**. The App Store rejects an icon carrying an alpha
  channel, so the script composites before writing. Do not remove that step.
- `AppIcon-Dark.png` is the same cake on a dark brown ground, the website
  hive's ground.
- `AppIcon-Tinted.png` is greyscale with transparency. The system tints by
  luminance and supplies its own backdrop, so the flame is the brightest thing
  in the file and there is no background in it at all.

`docs/readme/icon.png` is `AppIcon.png` at 200 pixels. Write it again after
changing the icon.

No bee character or mascot, and nothing that looks like an existing brand.
