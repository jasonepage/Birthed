"""Single pieces of the hero art, cut out for the website: the bee in its
party hat and the candle on its cake, each on a transparent ground with a
tight frame. Same drawing functions as hero2.py, so they match the hero
pictures exactly. Run from design/hero:

    python3 parts.py ../../web/static/hero
"""
import random, sys, os
from hero2 import DEFS, bee, candle_and_cake

FILTERS = '''
  <filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="blur20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
  <filter id="blur60" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="60"/></filter>
  <filter id="softglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
'''

def svg(view, w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="{w}" height="{h}">'
            f'<defs>{DEFS}{FILTERS}</defs>{body}</svg>\n')

out = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(out, exist_ok=True)
# The bee, facing right, a little nose up, with its hat, lit from the left.
open(os.path.join(out, "bee.svg"), "w").write(svg("-258 -176 418 306", 418, 306, bee(0, 0, 1, angle=-8, lit=-1, uid="s", hat=True)))
# The candle on its cake, the flame and the sparks above it.
open(os.path.join(out, "candle.svg"), "w").write(svg("-600 -2080 1200 2290", 1200, 2290, candle_and_cake(random.Random(7))))
