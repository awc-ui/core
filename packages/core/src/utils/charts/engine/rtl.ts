/*
 * Chart engine — RTL mirroring
 * ===========================================================
 * A finished frame, flipped about the canvas' vertical centre:
 * the value axis and its gutter move to the right, the category
 * axis runs right-to-left, and the title/labels anchor from the
 * other side. A pure scene→scene transform (like emphasis.ts and
 * animate.ts), so the whole geometry pipeline — scales, curves,
 * decimation, stacking — stays in one direction and cannot grow
 * an RTL branch per feature. Text is repositioned, never
 * reversed: the glyphs themselves are the browser's business.
 * ===========================================================
 */

import type { Pt } from './geometry';
import type { EndLabel, GlyphMarker, HoverSeries, RenderScene, SceneArea, SceneBar, SceneMarker, SceneSegment, ScenePolyline, TextItem } from './scene';

/**
 * A legend anchor mirrored for a right-to-left chart.
 *
 * `start` / `end` are logical and have to resolve to the other physical side;
 * `left` / `right` are mirrored too, because everything else about the chart
 * already is — its title anchors from the right, its legend chips run
 * right-to-left — and a legend that stayed put would be the one piece of the
 * layout that did not turn round. `top` / `bottom` have no side to swap.
 *
 * Applied to the SPEC, before layout: the gutter reserved for the legend and
 * the chips placed into it both read this, and they have to agree.
 */
export function mirrorLegend(pos: string | undefined): string | undefined {
  switch (pos) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'top-start':
      return 'top-end';
    case 'top-end':
      return 'top-start';
    case 'bottom-start':
      return 'bottom-end';
    case 'bottom-end':
      return 'bottom-start';
    default:
      return pos;
  }
}

/** `start` and `end` swap sides; `center` is unmoved. */
function flipAlign(a: TextItem['align']): TextItem['align'] {
  return a === 'start' ? 'end' : a === 'end' ? 'start' : 'center';
}

/**
 * The scene mirrored horizontally about the canvas centre.
 *
 * Mirroring about the CANVAS (not the plot) is what moves the gutters: a wide
 * y-axis gutter on the left becomes a wide gutter on the right, carrying its
 * tick labels with it, while the plot rect lands where the old right margin
 * was. Every x is `width - x`; anything with a width (rects) mirrors its far
 * edge instead, and text flips which side it anchors from.
 *
 * Point ORDER is left alone. Consumers that need monotonic input — the line
 * hit-test, the hover distance — normalise it themselves, so a mirrored scene
 * stays a plain data structure rather than a special case.
 */
export function mirrorScene(scene: RenderScene): RenderScene {
  const W = scene.width;
  const mx = (x: number) => W - x;
  const mPts = (pts: Pt[]): Pt[] => pts.map((p) => ({ ...p, x: mx(p.x) }));
  const mSeg = (s: SceneSegment): SceneSegment => ({ ...s, x1: mx(s.x1), x2: mx(s.x2) });

  return {
    ...scene,
    plot: { ...scene.plot, x: mx(scene.plot.x + scene.plot.width) },
    bands: scene.bands?.map((b) => ({ ...b, x: mx(b.x + b.w) })),
    gridlines: scene.gridlines.map(mSeg),
    axisLines: scene.axisLines.map(mSeg),
    areas: scene.areas.map(
      (a): SceneArea => ({ ...a, points: mPts(a.points), basePoints: a.basePoints ? mPts(a.basePoints) : undefined }),
    ),
    bars: scene.bars.map((b): SceneBar => ({ ...b, x: mx(b.x + b.w) })),
    // The value baseline the intro grows a bar from. For a HORIZONTAL chart it is
    // an x (the value axis) and mirrors; for a vertical one it is a y and stays.
    // (barLabels aren't mirrored here — they're re-derived from the bars above.)
    barBaseline: scene.barBaseline != null && scene.bars[0]?.horizontal ? mx(scene.barBaseline) : scene.barBaseline,
    slices: scene.slices.map((s) => ({
      ...s,
      cx: mx(s.cx),
      // A mirrored arc sweeps the other way: reflect both ends across the
      // vertical, which swaps their roles (start becomes end).
      startAngle: Math.PI - s.endAngle,
      endAngle: Math.PI - s.startAngle,
    })),
    lines: scene.lines.map((l): ScenePolyline => ({ ...l, points: mPts(l.points) })),
    markers: scene.markers.map((m): SceneMarker => ({ ...m, x: mx(m.x) })),
    glyphs: scene.glyphs?.map((g): GlyphMarker => ({ ...g, x: mx(g.x) })),
    // A mirrored line ends on the LEFT, so its label has to extend leftward —
    // mirroring the anchor x alone would leave the text lying back across the
    // plot, on top of the data it labels.
    endLabels: scene.endLabels?.map((e): EndLabel => ({ ...e, x: mx(e.x), side: e.side === 'end' ? 'start' : 'end' })),
    // Rotation mirrors with everything else: a -45° tick label tilts the other
    // way (it must lean along the reading direction, and its anchor has just
    // swapped sides), and the y-axis title reads top-to-bottom on the right
    // instead of bottom-to-top — the convention for an axis title on that side.
    texts: scene.texts.map((t): TextItem => ({ ...t, x: mx(t.x), align: flipAlign(t.align), rotate: t.rotate ? -t.rotate : t.rotate })),
    legend: scene.legend.map((l) => ({ ...l, x: mx(l.x) })),
    xPositions: scene.xPositions.map(mx),
    hoverPoints: scene.hoverPoints.map(
      (hp): HoverSeries => ({
        ...hp,
        byIndex: Object.fromEntries(Object.entries(hp.byIndex).map(([k, p]) => [k, { ...p, x: mx(p.x) }])),
      }),
    ),
  };
}

/**
 * Is this host laid out right-to-left? Reads the COMPUTED direction, so it
 * follows `dir` on any ancestor (or the document) rather than only an attribute
 * on the chart itself — the same test md-slider, md-tabs and md-tooltip use.
 */
export function isRtl(el: Element | null | undefined): boolean {
  if (!el || typeof getComputedStyle !== 'function') return false;
  try {
    return getComputedStyle(el).direction === 'rtl';
  } catch {
    return false; // no layout engine (mock-doc / SSR)
  }
}

export interface DirectionWatcher {
  dispose(): void;
}

/**
 * Subscribers to a `dir` change anywhere in the document, sharing ONE observer.
 *
 * A chart resolves its direction while laying out, so unlike a CSS-driven
 * component it cannot just react to the cascade — flipping `dir` after mount
 * (the Storybook toolbar, an app-level locale switch) has to re-render it.
 * `dir` can be set on any ancestor, so the observer watches the whole document;
 * one shared instance keeps that to a single observer no matter how many charts
 * are on the page (the same shape as watchDevicePixelRatio).
 */
const dirListeners = new Set<() => void>();
let dirObserver: MutationObserver | null = null;

export function watchDirection(onChange: () => void): DirectionWatcher {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return { dispose: () => undefined };
  }
  dirListeners.add(onChange);
  if (!dirObserver) {
    dirObserver = new MutationObserver(() => {
      for (const fn of dirListeners) fn();
    });
    dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'], subtree: true });
  }
  return {
    dispose: () => {
      dirListeners.delete(onChange);
      if (!dirListeners.size) {
        dirObserver?.disconnect();
        dirObserver = null;
      }
    },
  };
}

/**
 * A polyline's samples in ascending main-axis order.
 *
 * The mirror leaves point order alone, so a mirrored series descends in x. The
 * distance-to-line search bisects on that axis and needs it ascending; reverse
 * a copy rather than making every caller aware of direction.
 */
export function ascending<T extends readonly [number, number]>(points: T[]): T[] {
  const n = points.length;
  if (n < 2 || points[0][0] <= points[n - 1][0]) return points;
  return [...points].reverse();
}
