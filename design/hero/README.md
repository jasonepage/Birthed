# Birthed hero art

Made October 18, 2026. Honey palette, Fraunces wordmark in the site's pink, tagline "Every date has a hive."

Final files:
- birthed-appstore-5244x2950.png, birthed-appstore-3840x2560.png, birthed-appstore-1920x1280.png: the cake moment with wordmark and tagline, in the three sizes App Store Connect accepts for the Header and Search Results slots. Upload the PNG as is.
- birthed-hero-cake.png: same scene at 5244 by 2950 with no text.
- birthed-hero-bees.png and birthed-hero-bees-titled.png: bees on honeycomb at 3840 by 1646, text space on the right. For the website or social, not an App Store size.
- cake.svg and bees.svg: editable vector sources.

To regenerate (needs Python 3 with Playwright and Pillow, and fraunces-latin-wght-normal.woff2 copied in as fraunces.woff2 from web/static/fonts):
    python3 hero2.py cake cake.svg && python3 render.py cake.svg birthed-hero-cake.png 5244 2950
    python3 compose.py birthed-hero-cake.png birthed-appstore-5244x2950.png 5244 2950 bottom
