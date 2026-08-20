import { computeWindow } from './virtual-window';

describe('computeWindow', () => {
  const ROW = 48;
  const VIEWPORT = 240; // 5 rows visible
  const OVERSCAN = 4;

  it('renders from the top with overscan clamped at 0', () => {
    const w = computeWindow(0, VIEWPORT, ROW, 1000, OVERSCAN);
    expect(w.start).toBe(0);
    expect(w.end).toBe(5 + OVERSCAN); // visibleCount(5) + overscan
    expect(w.topPad).toBe(0);
    expect(w.bottomPad).toBe((1000 - w.end) * ROW);
  });

  it('windows around a mid-list scroll position', () => {
    const scrollTop = 500 * ROW; // row 500 at the top edge
    const w = computeWindow(scrollTop, VIEWPORT, ROW, 1000, OVERSCAN);
    expect(w.start).toBe(500 - OVERSCAN);
    expect(w.end).toBe(500 + 5 + OVERSCAN);
    expect(w.topPad).toBe(w.start * ROW);
    expect(w.bottomPad).toBe((1000 - w.end) * ROW);
    // The total scrollable height is preserved by the spacers + rendered rows.
    expect(w.topPad + (w.end - w.start) * ROW + w.bottomPad).toBe(1000 * ROW);
  });

  it('clamps the end at the bottom of the list', () => {
    const scrollTop = 1000 * ROW; // scrolled past the end
    const w = computeWindow(scrollTop, VIEWPORT, ROW, 1000, OVERSCAN);
    expect(w.end).toBe(1000);
    expect(w.start).toBeLessThanOrEqual(1000);
    expect(w.bottomPad).toBe(0);
  });

  it('renders the whole list when it is shorter than the viewport', () => {
    const w = computeWindow(0, VIEWPORT, ROW, 3, OVERSCAN);
    expect(w.start).toBe(0);
    expect(w.end).toBe(3);
    expect(w.topPad).toBe(0);
    expect(w.bottomPad).toBe(0);
  });

  it('handles a fractional scroll offset', () => {
    const w = computeWindow(ROW * 10 + 17, VIEWPORT, ROW, 1000, OVERSCAN);
    // 17px into row 10 — first visible row is still 10.
    expect(w.start).toBe(10 - OVERSCAN);
  });

  it('returns an empty window for an empty dataset', () => {
    const w = computeWindow(0, VIEWPORT, ROW, 0, OVERSCAN);
    expect(w).toEqual({ start: 0, end: 0, topPad: 0, bottomPad: 0, scrollHeight: 0, scrollTop: 0 });
  });

  it('is defensive against a zero row height', () => {
    const w = computeWindow(0, VIEWPORT, 0, 1000, OVERSCAN);
    expect(w.start).toBe(0);
    expect(w.end).toBe(0);
  });

  it('reports the real scroll height when the list fits under the cap', () => {
    const w = computeWindow(0, VIEWPORT, ROW, 1000, OVERSCAN);
    expect(w.scrollHeight).toBe(1000 * ROW);
  });
});

describe('computeWindow — scaled regime (list taller than the browser cap)', () => {
  const ROW = 48;
  const VIEWPORT = 240; // 5 rows visible
  const OVERSCAN = 8;
  const MAX = 1_500_000;
  const TOTAL = 1_000_000; // 48,000,000px real height ≫ MAX

  /** The rendered block must fully cover the viewport at `scrollTop`. */
  function covers(w: ReturnType<typeof computeWindow>, scrollTop: number): boolean {
    const blockBottom = w.topPad + (w.end - w.start) * ROW;
    return w.topPad <= scrollTop + 1e-6 && blockBottom >= scrollTop + VIEWPORT - 1e-6;
  }

  it('caps the scroll height and keeps the spacer invariant', () => {
    const w = computeWindow(0, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX);
    expect(w.scrollHeight).toBe(MAX);
    expect(w.topPad + (w.end - w.start) * ROW + w.bottomPad).toBe(MAX);
    expect(w.start).toBe(0);
    expect(w.topPad).toBe(0);
  });

  it('covers the viewport at the top, middle, and bottom of the range', () => {
    const maxScrollTop = MAX - VIEWPORT;
    for (const scrollTop of [0, maxScrollTop / 2, maxScrollTop]) {
      const w = computeWindow(scrollTop, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX);
      expect(covers(w, scrollTop)).toBe(true);
      expect(w.topPad + (w.end - w.start) * ROW + w.bottomPad).toBe(MAX);
      expect(w.topPad).toBeGreaterThanOrEqual(0);
      expect(w.bottomPad).toBeGreaterThanOrEqual(0);
    }
  });

  it('reaches the last row at maximum scroll', () => {
    const w = computeWindow(MAX - VIEWPORT, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX);
    expect(w.end).toBe(TOTAL);
    expect(w.bottomPad).toBe(0);
  });

  it('maps the scroll fraction onto the row range', () => {
    const w = computeWindow((MAX - VIEWPORT) / 2, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX);
    const mid = TOTAL / 2;
    expect(w.start).toBeGreaterThan(mid - 1000);
    expect(w.end).toBeLessThan(mid + 1000);
  });

  it('keeps only a small window in play regardless of list size', () => {
    const w = computeWindow((MAX - VIEWPORT) * 0.3, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX);
    expect(w.end - w.start).toBeLessThan(40);
  });

  const maxFirstRow = TOTAL - Math.ceil(VIEWPORT / ROW);
  /** Row the window puts at the viewport top, given the offset it chose. */
  const topRowOf = (w: ReturnType<typeof computeWindow>) =>
    w.start + Math.round((w.scrollTop - w.topPad) / ROW);

  it('places the anchor row at the viewport top, choosing its own scroll offset', () => {
    for (const anchor of [0, 5, 700_000, TOTAL - 1]) {
      const w = computeWindow(0, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX, anchor);
      // Near the end the first row caps at maxFirstRow so the last screenful shows.
      expect(topRowOf(w)).toBe(Math.min(maxFirstRow, anchor));
      expect(w.topPad).toBeGreaterThanOrEqual(0);
      expect(w.bottomPad).toBeGreaterThanOrEqual(0);
      expect(w.topPad + (w.end - w.start) * ROW + w.bottomPad).toBe(MAX);
    }
  });

  it('advances the visible rows by one when the anchor steps by one', () => {
    // The core of the keyboard-nav fix: stepping the anchor must shift what is
    // shown, regardless of whether integer scrollTop could change.
    expect(topRowOf(computeWindow(0, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX, 1))).toBe(1);
    expect(topRowOf(computeWindow(0, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX, 2))).toBe(2);
  });

  it('reveals an anchor near the end at the viewport top (ArrowUp from the end)', () => {
    // The symmetric bottom-boundary case: stepping the anchor up from the last
    // rows must still move the visible window (it used to pin to the bottom).
    const near = maxFirstRow - 1;
    const w = computeWindow(0, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX, near);
    expect(topRowOf(w)).toBe(near);
    expect(w.start).toBeLessThanOrEqual(near);
    expect(w.end).toBeGreaterThan(near);
  });

  it('clamps an anchor past the end of the list', () => {
    const w = computeWindow(0, VIEWPORT, ROW, TOTAL, OVERSCAN, MAX, TOTAL + 100);
    expect(w.end).toBe(TOTAL);
    expect(topRowOf(w)).toBe(maxFirstRow);
    expect(w.bottomPad).toBe(0);
  });
});

describe('computeWindow — scaled regime keyboard-nav offset is round-trip stable', () => {
  // Regression for the ArrowUp "jump" near the bottom of a huge list. The
  // anchored offset used to bottom-align the block (`hi` clamp), collapsing many
  // adjacent anchors onto one integer scrollTop. If the anchor was then dropped
  // (a stray scroll event, browser scroll-anchoring), the scroll-driven branch
  // re-derived that single offset proportionally and landed thousands of rows
  // away. The anchored and scroll-driven branches must now agree.
  const ROW = 48;
  const VIEWPORT = 240; // 5 rows visible
  const OVERSCAN = 8;
  const MAX = 1_500_000;

  const topRowOf = (w: ReturnType<typeof computeWindow>) =>
    w.start + Math.round((w.scrollTop - w.topPad) / ROW);

  it('re-derives a window that still renders the anchor row near the end', () => {
    for (const total of [1_000_000, 10_000_000]) {
      const maxFirstRow = total - Math.ceil(VIEWPORT / ROW);
      for (const offset of [5, 50, 100, 500]) {
        const anchor = maxFirstRow - offset;
        const anchored = computeWindow(0, VIEWPORT, ROW, total, OVERSCAN, MAX, anchor);
        // Drop the anchor: feed the offset it chose through the scroll-driven
        // (no-anchor) path. The re-derived window must still contain the anchor
        // row — i.e. dropping the anchor cannot teleport the view.
        const rederived = computeWindow(anchored.scrollTop, VIEWPORT, ROW, total, OVERSCAN, MAX);
        expect(rederived.start).toBeLessThanOrEqual(anchor);
        expect(rederived.end).toBeGreaterThan(anchor);
      }
    }
  });

  it('moves the chosen offset for every anchor step near the end (no saturation plateau)', () => {
    const total = 10_000_000;
    const maxFirstRow = total - Math.ceil(VIEWPORT / ROW);
    // Stepping the anchor up across the zone that used to saturate must keep the
    // offset strictly decreasing — it used to pin to a single value for thousands
    // of rows, which is what let a dropped anchor jump.
    const near = computeWindow(0, VIEWPORT, ROW, total, OVERSCAN, MAX, maxFirstRow - 1);
    const mid = computeWindow(0, VIEWPORT, ROW, total, OVERSCAN, MAX, maxFirstRow - 1000);
    const far = computeWindow(0, VIEWPORT, ROW, total, OVERSCAN, MAX, maxFirstRow - 2000);
    expect(far.scrollTop).toBeLessThan(mid.scrollTop);
    expect(mid.scrollTop).toBeLessThan(near.scrollTop);
  });

  it('still seats each near-end anchor at the viewport top with valid spacers', () => {
    const total = 10_000_000;
    const maxFirstRow = total - Math.ceil(VIEWPORT / ROW);
    for (const anchor of [maxFirstRow - 1, maxFirstRow - 15, maxFirstRow - 2658]) {
      const w = computeWindow(0, VIEWPORT, ROW, total, OVERSCAN, MAX, anchor);
      expect(topRowOf(w)).toBe(anchor);
      expect(w.topPad).toBeGreaterThanOrEqual(0);
      expect(w.bottomPad).toBeGreaterThanOrEqual(0);
      expect(w.start).toBeLessThanOrEqual(anchor);
      expect(w.end).toBeGreaterThan(anchor);
    }
  });
});
