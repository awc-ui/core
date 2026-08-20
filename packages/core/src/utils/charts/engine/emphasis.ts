/*
 * Chart engine — hover emphasis
 * ===========================================================
 * When the pointer is near one series, that series stays vivid and
 * the others fade back so the focused line reads clearly. A pure
 * scene→scene transform (like animate.ts) so both renderer backends
 * dim identically; the engine animates the `t` factor over a short
 * MD3 transition and redraws emphasizeScene(scene, focus, t).
 * ===========================================================
 */

import { withAlpha } from './color';
import type { RenderScene } from './scene';

/** How faded a non-focused series gets at full emphasis (alpha multiplier). */
const DIM = 0.22;
/** Emphasis fade duration in ms. */
export const EMPHASIS_MS = 260;

/**
 * How much nearer (px) a rival series must be before the emphasis leaves the
 * series it is on. Sized just under a typical "close lines" gap: enough of a
 * deadband to stop the two trading focus at their midpoint, small enough that
 * moving onto the other line still takes the focus with it.
 */
export const FOCUS_STICK = 4;

/**
 * How far the cursor is (px) from a series' drawn line.
 *
 * `points` are that series' samples as `[main, value]` pixel pairs ordered
 * along the main axis (x for a normal chart, y for an inverted one). The line
 * is interpolated between the two samples bracketing the cursor, which is what
 * makes this work for series sampled at *different* x: with irregular data a
 * series usually has no sample exactly at the hovered position, and comparing
 * only exact samples hands the emphasis to whichever series happens to own
 * that slot. Past either end of the series the distance is measured to its
 * endpoint, so a line that has already finished reads as far away.
 */
export function distanceToLine(
  points: readonly (readonly [number, number])[],
  cursorMain: number,
  cursorValue: number,
): number {
  const n = points.length;
  if (!n) return Infinity;
  const first = points[0];
  const last = points[n - 1];
  if (cursorMain <= first[0]) return Math.hypot(first[0] - cursorMain, first[1] - cursorValue);
  if (cursorMain >= last[0]) return Math.hypot(last[0] - cursorMain, last[1] - cursorValue);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= cursorMain) lo = mid;
    else hi = mid;
  }
  const [aMain, aValue] = points[lo];
  const [bMain, bValue] = points[hi];
  const t = bMain === aMain ? 0 : (cursorMain - aMain) / (bMain - aMain);
  return Math.abs(aValue + (bValue - aValue) * t - cursorValue);
}

/**
 * Which series the hover should emphasise, given each candidate's distance to
 * the cursor and the one currently held (`-1` for none).
 *
 * Plain "nearest wins" flickers: between two lines a few pixels apart the
 * winner flips on every pointer move, and because the emphasis is already
 * fully faded in, each flip swaps vivid and dimmed instantly. Holding the
 * current series until a rival is clearly nearer turns the midpoint into a
 * deadband. A held series that isn't a candidate any more (it was hidden, or
 * the pointer left the plot) has no distance, so the focus moves on.
 */
export function pickFocusSeries(
  candidates: readonly { seriesIndex: number; distance: number }[],
  held: number,
  stick: number = FOCUS_STICK,
): number {
  let best = -1;
  let bestD = Infinity;
  let heldD = Infinity;
  for (const c of candidates) {
    if (c.seriesIndex === held) heldD = c.distance;
    if (c.distance < bestD) {
      bestD = c.distance;
      best = c.seriesIndex;
    }
  }
  if (held >= 0 && bestD > heldD - stick) return held;
  return best;
}

/**
 * How long (ms) a rival has to stay the nearest before the emphasis moves to
 * it. The px deadband alone can't settle two lines running close together: a
 * hand held roughly still while the lines wander across the cursor makes the
 * nearest genuinely alternate, by the full gap each time. Requiring the rival
 * to *stay* nearest ignores that alternation while still following a
 * deliberate move onto the other line within a frame or three.
 */
export const FOCUS_DWELL_MS = 140;

/**
 * Chooses the emphasised series over time: {@link pickFocusSeries} for the
 * geometry, plus a dwell so a contested choice has to settle before it moves.
 *
 * Owns the held series, so the engine just feeds it distances and a clock.
 */
export class HoverFocus {
  private held = -1;
  private candidate = -1;
  private since = 0;

  constructor(
    private readonly stick: number = FOCUS_STICK,
    private readonly dwellMs: number = FOCUS_DWELL_MS,
  ) {}

  /** The series to emphasise now, given each one's distance to the cursor. */
  pick(candidates: readonly { seriesIndex: number; distance: number }[], now: number): number {
    const wanted = pickFocusSeries(candidates, this.held, this.stick);
    if (wanted !== this.candidate) {
      this.candidate = wanted;
      this.since = now;
    }
    // Nothing focused yet (first hover, or after the pointer left): adopt
    // immediately, so arriving on a line reads as instant.
    if (this.held < 0) {
      this.held = wanted;
    } else if (wanted !== this.held && now - this.since >= this.dwellMs) {
      this.held = wanted;
    }
    return this.held;
  }

  /** Pointer left the plot, or the scene changed — drop the held series. */
  reset(): void {
    this.held = -1;
    this.candidate = -1;
    this.since = 0;
  }
}

/**
 * The scene with every series except `focusIndex` dimmed by progress `t`
 * (0 = no dimming, 1 = fully faded). Glyph markers and chrome are untouched.
 * Series without an index are treated as focused (never dimmed).
 */
export function emphasizeScene(scene: RenderScene, focusIndex: number, t: number): RenderScene {
  if (focusIndex < 0 || t <= 0) return scene;
  const factor = 1 - (1 - DIM) * Math.min(1, t);
  const dim = (si: number | undefined): boolean => si != null && si !== focusIndex;
  return {
    ...scene,
    lines: scene.lines.map((l) => (dim(l.seriesIndex) ? { ...l, color: withAlpha(l.color, factor) } : l)),
    areas: scene.areas.map((a) =>
      dim(a.seriesIndex) ? { ...a, colorTop: withAlpha(a.colorTop, factor), colorBottom: withAlpha(a.colorBottom, factor) } : a,
    ),
    markers: scene.markers.map((m) => (dim(m.seriesIndex) ? { ...m, color: withAlpha(m.color, factor) } : m)),
  };
}
