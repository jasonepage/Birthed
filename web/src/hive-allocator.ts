// The pie allocator, as the live hive page runs it in the browser.
//
// docs/the-wall.md section 21. The worker bakes the board with
// worker/src/wall/allocator.ts on every tick and at the seal. The live hive
// page, the one page on this site that runs a script, lays the board out
// itself between ticks from the buzz counts as they arrive, so a tile moves
// the instant a buzz lands rather than a quarter hour later. For that to be
// honest the page has to cut the pie exactly the way the worker does, or the
// board would jump every time the tick re-baked it.
//
// So this is a copy of the pie in plain JavaScript, held to the worker's
// TypeScript by a test in worker/test/wall-allocator-web.test.ts that reads
// this file off disk, evaluates the string below and runs both engines on a
// few hundred generated boards, the same way worker/src/wall/points.ts is
// held to the panel's formula in web/src/admin.ts. The site inlines
// everything and has no bundler, which is why the port is a string and not
// an import: the string is written into the page as it is.
//
// Only the pie is ported. A date carrying a story stamped false is laid out
// by the older growth engine on the worker, section 18, and for that date
// the page keeps the rectangles the worker stored and moves nothing: the
// port answers null and the page reads that as "not mine to cut".
//
// Nothing in this file may cost anything at import. serve.ts imports it.

export const HIVE_ALLOCATOR_JS = `
var HiveAllocator = (function () {
  "use strict";
  var BOARD_MODULES = 16;
  var MIN_W = 2;
  var MIN_H = 2;
  var MIN_MODULES = MIN_W * MIN_H;
  var MAX_PLACED = 60;
  var UNBACKED_PLACED = 40;
  var WIDTH_PREFERENCE = 1.5;
  var MAX_PER_BAND = Math.floor(BOARD_MODULES / MIN_W);
  var MAX_BANDS = Math.floor(BOARD_MODULES / MIN_H);
  var GROUP_QUOTA = { news: 8, event: 10, person: 10, release: 10, other: 2 };
  var PER_OUTLET_UNBACKED = 3;

  function groupOf(story) {
    var kind = story.subjectKind == null ? null : story.subjectKind;
    if (kind === null) return "news";
    if (kind === "historical_event") return "event";
    if (kind === "person") return "person";
    if (kind === "song" || kind === "album" || kind === "film" || kind === "cultural_event") return "release";
    return "other";
  }

  function toMillis(value) {
    if (typeof value === "number") return value;
    var parsed = Date.parse(value);
    if (isNaN(parsed)) throw new Error("allocator: unreadable placement time " + value);
    return parsed;
  }

  function varied(unbacked, limit) {
    if (limit <= 0 || unbacked.length === 0) return unbacked;
    var taken = {};
    var chosen = [];
    var byGroup = {};
    var byOutlet = {};
    for (var i = 0; i < unbacked.length; i++) {
      var story = unbacked[i];
      if (chosen.length >= limit) break;
      var group = groupOf(story);
      if ((byGroup[group] || 0) >= GROUP_QUOTA[group]) continue;
      if (group === "news") {
        var outlet = story.outlet == null ? story.id : story.outlet;
        if ((byOutlet[outlet] || 0) >= PER_OUTLET_UNBACKED) continue;
        byOutlet[outlet] = (byOutlet[outlet] || 0) + 1;
      }
      byGroup[group] = (byGroup[group] || 0) + 1;
      chosen.push(story);
      taken[story.id] = true;
    }
    var rest = unbacked.filter(function (s) { return !taken[s.id]; });
    var seen = {};
    for (var g in byGroup) seen[g] = byGroup[g];
    var fill = [];
    var used = {};
    while (chosen.length + fill.length < limit) {
      // Reset on every pass: var is function scoped, and a best left over
      // from the last pass would be pushed again once nothing is left.
      var best = undefined;
      var fewest = Infinity;
      for (var j = 0; j < rest.length; j++) {
        var candidate = rest[j];
        if (used[candidate.id]) continue;
        var count = seen[groupOf(candidate)] || 0;
        if (count < fewest) {
          fewest = count;
          best = candidate;
          if (count === 0) break;
        }
      }
      if (best === undefined) break;
      used[best.id] = true;
      fill.push(best);
      seen[groupOf(best)] = (seen[groupOf(best)] || 0) + 1;
    }
    var after = rest.filter(function (s) { return !used[s.id]; });
    return chosen.concat(fill, after);
  }

  function shares(weights, total, floor) {
    var n = weights.length;
    if (n === 0) return [];
    var spare = total - floor * n;
    if (spare < 0) throw new Error("allocator: " + n + " shares cannot each have " + floor + " of " + total);
    var sum = weights.reduce(function (a, b) { return a + Math.max(0, b); }, 0);
    var even = sum <= 0;
    var exact = weights.map(function (w) { return even ? spare / n : (spare * Math.max(0, w)) / sum; });
    var out = exact.map(function (x) { return Math.floor(x); });
    var left = spare - out.reduce(function (a, b) { return a + b; }, 0);
    var order = exact.map(function (x, i) { return { i: i, r: x - Math.floor(x) }; })
      .sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var k = 0; left > 0; k = (k + 1) % n) {
      out[order[k].i] = (out[order[k].i] || 0) + 1;
      left -= 1;
    }
    return out.map(function (x) { return x + floor; });
  }

  function proportional(weights, total, min) {
    var n = weights.length;
    if (n === 0) return [];
    if (min * n > total) throw new Error("allocator: " + n + " parts cannot each have " + min + " of " + total);
    var fixed = {};
    var fixedCount = 0;
    var exact = [];
    for (;;) {
      var freeTotal = total - min * fixedCount;
      var free = weights.map(function (w, i) { return fixed[i] ? 0 : Math.max(0, w); });
      var sum = free.reduce(function (a, b) { return a + b; }, 0);
      var freeCount = n - fixedCount;
      exact = weights.map(function (_, i) { return fixed[i] ? min : sum <= 0 ? freeTotal / freeCount : (freeTotal * free[i]) / sum; });
      var below = -1;
      for (var i = 0; i < n; i++) { if (!fixed[i] && exact[i] < min) { below = i; break; } }
      if (below < 0) break;
      fixed[below] = true;
      fixedCount += 1;
    }
    var out = exact.map(function (x) { return Math.floor(x); });
    var left = total - out.reduce(function (a, b) { return a + b; }, 0);
    var order = exact.map(function (x, i) { return { i: i, r: x - Math.floor(x) }; })
      .sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var k = 0; left > 0; k = (k + 1) % n) {
      out[order[k].i] = (out[order[k].i] || 0) + 1;
      left -= 1;
    }
    return out;
  }

  function partitions(n) {
    var out = [];
    var walk = function (left, sofar) {
      if (left === 0) { out.push(sofar); return; }
      if (sofar.length >= MAX_BANDS) return;
      if (left > (MAX_BANDS - sofar.length) * MAX_PER_BAND) return;
      for (var k = Math.min(MAX_PER_BAND, left); k >= 1; k -= 1) walk(left - k, sofar.concat([k]));
    };
    walk(n, []);
    return out;
  }

  // Past this many tiles, one candidate per band count by a quick estimate,
  // not every partition: the worker's EXHAUSTIVE_UP_TO and bestByBandCount.
  var EXHAUSTIVE_UP_TO = 14;
  function bestByBandCount(areas) {
    var n = areas.length;
    var total = areas.reduce(function (x, y) { return x + y; }, 0) || 1;
    var bandCost = function (i, j) {
      var sum = 0, t;
      for (t = i; t < j; t += 1) sum += areas[t];
      var h = (sum / total) * BOARD_MODULES;
      var cost = 0;
      for (t = i; t < j; t += 1) {
        var w = (areas[t] / sum) * BOARD_MODULES;
        cost += 0.25 * Math.abs(w / Math.max(h, 0.001) - WIDTH_PREFERENCE);
        if (w < MIN_W) cost += (MIN_W - w) * 4;
      }
      if (h < MIN_H) cost += (MIN_H - h) * 4 * (j - i);
      return cost;
    };
    var best = [], from = [], b, i, k;
    for (b = 0; b <= MAX_BANDS; b += 1) {
      best.push([]); from.push([]);
      for (i = 0; i <= n; i += 1) { best[b].push(Infinity); from[b].push(-1); }
    }
    best[0][0] = 0;
    for (b = 1; b <= MAX_BANDS; b += 1) {
      for (i = 1; i <= n; i += 1) {
        for (k = 1; k <= Math.min(MAX_PER_BAND, i); k += 1) {
          var prior = best[b - 1][i - k];
          if (prior === Infinity) continue;
          var c = prior + bandCost(i - k, i);
          if (c < best[b][i]) { best[b][i] = c; from[b][i] = k; }
        }
      }
    }
    var out = [];
    for (b = 1; b <= MAX_BANDS; b += 1) {
      if (best[b][n] === Infinity) continue;
      var bands = [];
      i = n;
      for (var cnt = b; cnt >= 1; cnt -= 1) { k = from[cnt][i]; bands.unshift(k); i -= k; }
      out.push(bands);
    }
    return out;
  }

  function layout(areas, bands) {
    var at = 0;
    var bandAreas = bands.map(function (k) {
      var a = areas.slice(at, at + k).reduce(function (x, y) { return x + y; }, 0);
      at += k;
      return a;
    });
    var heights = proportional(bandAreas, BOARD_MODULES, MIN_H);
    var rects = [];
    var cost = 0;
    var my = 0;
    at = 0;
    bands.forEach(function (k, b) {
      var h = heights[b];
      var tiles = areas.slice(at, at + k);
      var widths = proportional(tiles, BOARD_MODULES, MIN_W);
      var mx = 0;
      tiles.forEach(function (target, i) {
        var w = widths[i];
        rects.push({ mx: mx, my: my, w: w, h: h });
        cost += Math.abs(w * h - target) + 0.25 * Math.abs(w / h - WIDTH_PREFERENCE);
        mx += w;
      });
      at += k;
      my += h;
    });
    return { rects: rects, cost: cost };
  }

  function cutBands(areas) {
    if (areas.length === 0) return [];
    var candidates = areas.length <= EXHAUSTIVE_UP_TO ? partitions(areas.length) : bestByBandCount(areas);
    var best = null;
    for (var p = 0; p < candidates.length; p++) {
      var cut = layout(areas, candidates[p]);
      if (best === null || cut.cost < best.cost) best = cut;
    }
    return best.rects;
  }

  function allocate(stories) {
    for (var f = 0; f < stories.length; f++) {
      if (stories[f].frozen && stories[f].anchor) return null;
    }
    var byArrival = function (a, b) {
      var at = toMillis(a.placedAt) - toMillis(b.placedAt);
      if (at !== 0) return at;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    };
    var sorted = stories.slice().sort(function (a, b) {
      if (b.support !== a.support) return b.support - a.support;
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      return byArrival(a, b);
    });
    var backed = sorted.filter(function (s) { return s.support > 0; });
    var unbacked = varied(sorted.filter(function (s) { return s.support <= 0; }), UNBACKED_PLACED);
    var chosen = [];
    var overflow = [];
    var unbackedPlaced = 0;
    var all = backed.concat(unbacked);
    for (var i = 0; i < all.length; i++) {
      var story = all[i];
      var isBacked = story.support > 0;
      if (chosen.length >= MAX_PLACED || (!isBacked && unbackedPlaced >= UNBACKED_PLACED)) {
        overflow.push(story.id);
        continue;
      }
      chosen.push(story);
      if (!isBacked) unbackedPlaced += 1;
    }
    if (chosen.length === 0) return { placed: [], overflow: overflow };
    var anyBuzz = chosen.some(function (s) { return s.support > 0; });
    var weights = chosen.map(function (s) { return anyBuzz ? Math.max(0, s.support) : Math.max(0, s.score || 0); });
    var areas = shares(weights, BOARD_MODULES * BOARD_MODULES, MIN_MODULES);
    var order = chosen.map(function (s, i) { return { s: s, area: areas[i] }; })
      .sort(function (a, b) { return b.area - a.area || chosen.indexOf(a.s) - chosen.indexOf(b.s); });
    var rects = cutBands(order.map(function (o) { return o.area; }));
    var placed = order.map(function (o, i) {
      var r = rects[i];
      return { id: o.s.id, mx: r.mx, my: r.my, w: r.w, h: r.h };
    });
    return { placed: placed, overflow: overflow };
  }

  return {
    BOARD_MODULES: BOARD_MODULES, MIN_W: MIN_W, MIN_H: MIN_H, MIN_MODULES: MIN_MODULES,
    MAX_PLACED: MAX_PLACED, UNBACKED_PLACED: UNBACKED_PLACED,
    groupOf: groupOf, varied: varied, shares: shares, proportional: proportional, cutBands: cutBands, allocate: allocate,
  };
})();
`;

/** The shape the browser hands the allocator. The worker's StoryInput, minus what the pie never reads. */
export interface HiveStoryInput {
  id: string;
  tier: "claimed" | "reported" | "seen_direct";
  support: number;
  score?: number;
  priority?: number;
  placedAt: number | string;
  anchor?: { mx: number; my: number; w: number; h: number } | null;
  frozen?: boolean;
  subjectKind?: string | null;
  outlet?: string;
}

export interface HivePlacement { id: string; mx: number; my: number; w: number; h: number }

export interface HiveAllocatorApi {
  BOARD_MODULES: number;
  MIN_W: number;
  MIN_H: number;
  MIN_MODULES: number;
  MAX_PLACED: number;
  UNBACKED_PLACED: number;
  groupOf(story: { subjectKind?: string | null }): string;
  varied(unbacked: HiveStoryInput[], limit: number): HiveStoryInput[];
  shares(weights: number[], total: number, floor: number): number[];
  proportional(weights: number[], total: number, min: number): number[];
  cutBands(areas: number[]): Array<{ mx: number; my: number; w: number; h: number }>;
  /** The pie, or null for a board the worker's growth engine owns (a story stamped false holds a rectangle). */
  allocate(stories: HiveStoryInput[]): { placed: HivePlacement[]; overflow: string[] } | null;
}

let evaluated: HiveAllocatorApi | null = null;

/**
 * The port, evaluated once, for the tests and for anything on the server
 * that wants the browser's answer. The page never calls this: it runs the
 * string as it is.
 */
export function hiveAllocator(): HiveAllocatorApi {
  if (evaluated === null) {
    evaluated = new Function(`${HIVE_ALLOCATOR_JS}; return HiveAllocator;`)() as HiveAllocatorApi;
  }
  return evaluated;
}
