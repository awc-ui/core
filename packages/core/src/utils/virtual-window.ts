/**
 * Fixed-row-height virtual windowing math, shared by the virtualized selects.
 *
 * Pure and DOM-free so it can be unit-tested directly. Given the scroll offset
 * and viewport size, it returns the slice of rows to render plus the spacer
 * heights that make the scroll container behave as if every row were present.
 *
 * Two regimes:
 *   - Exact: when the full list height fits under `maxScrollHeight`, the spacers
 *     reproduce the real height 1:1 and the offset maps to a row directly.
 *   - Scaled: when the list is taller than a browser can lay out (millions of
 *     rows × row height easily exceeds the ~16–33M px element-height cap), the
 *     spacers reproduce a *capped* height and the scroll offset maps
 *     proportionally onto the row range. The rendered block is always
 *     positioned to cover the viewport, so the list never shows blank rows and
 *     can be scrolled all the way to the end.
 */
export interface WindowCalc {
  /** First filtered index to render (inclusive), overscan applied. */
  start: number;
  /** One past the last filtered index to render (exclusive). */
  end: number;
  /** Spacer height (px) before the first rendered row. */
  topPad: number;
  /** Spacer height (px) after the last rendered row. */
  bottomPad: number;
  /** Total scrollable height the spacers reproduce (topPad + rows + bottomPad). */
  scrollHeight: number;
  /**
   * The scroll offset this window is laid out for. Equal to the input scrollTop
   * for mouse-driven windows; for an anchored (keyboard-nav) window it is the
   * offset the caller should apply so the anchor row lands at the viewport top.
   */
  scrollTop: number;
}

/**
 * Default ceiling on the scrollable height. Comfortably under every major
 * browser's maximum element height (Firefox ~17.9M, Chrome ~33.5M) so the
 * spacers always lay out, while still giving smooth scroll resolution for
 * millions of rows. The controller can lower this further at runtime if it
 * detects the browser clamping even shorter.
 */
export const DEFAULT_MAX_SCROLL_HEIGHT = 1_500_000;

export function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  total: number,
  overscan: number,
  maxScrollHeight: number = DEFAULT_MAX_SCROLL_HEIGHT,
  // In the scaled regime, pin the first rendered row to this index instead of
  // deriving it from the scroll fraction. Keyboard nav uses this because integer
  // scrollTop is too coarse to address individual rows in a multi-million list.
  anchorFirstRow: number = -1,
): WindowCalc {
  if (total <= 0 || rowHeight <= 0 || viewportHeight <= 0) {
    const realHeight = total > 0 && rowHeight > 0 ? total * rowHeight : 0;
    return { start: 0, end: 0, topPad: 0, bottomPad: realHeight, scrollHeight: realHeight, scrollTop: 0 };
  }

  const realHeight = total * rowHeight;
  const visibleCount = Math.ceil(viewportHeight / rowHeight);

  // ── Exact regime: the list fits, spacers mirror the real height. ──
  if (realHeight <= maxScrollHeight) {
    const clamped = Math.min(Math.max(0, scrollTop), Math.max(0, realHeight - viewportHeight));
    const firstVisible = Math.floor(clamped / rowHeight);
    const start = Math.min(total, Math.max(0, firstVisible - overscan));
    const end = Math.min(total, Math.max(start, firstVisible + visibleCount + overscan));
    return {
      start,
      end,
      topPad: start * rowHeight,
      bottomPad: Math.max(0, (total - end) * rowHeight),
      scrollHeight: realHeight,
      scrollTop: clamped,
    };
  }

  // ── Scaled regime: list taller than `maxScrollHeight`. ──
  const scrollHeight = maxScrollHeight;
  const maxScrollTop = Math.max(1, scrollHeight - viewportHeight);
  const maxFirstRow = Math.max(0, total - visibleCount);

  if (anchorFirstRow >= 0) {
    // Keyboard nav: position the anchor row at the viewport top and *derive* the
    // scroll offset to match. Integer scrollTop is too coarse to address single
    // rows near the ends of a multi-million-row list, so we treat the offset as
    // an output (the caller applies `scrollTop`) instead of an input. This is
    // what makes ArrowDown/ArrowUp keep advancing past the rendered window.
    const firstVisibleRow = Math.min(maxFirstRow, anchorFirstRow);
    const aboveRows = Math.min(overscan, firstVisibleRow);
    const start = firstVisibleRow - aboveRows;
    const end = Math.min(total, firstVisibleRow + visibleCount + overscan);
    const blockHeight = (end - start) * rowHeight;
    // Use the SAME proportional row↔offset mapping as the mouse-scroll branch
    // below, so a given offset uniquely identifies the anchor row and re-deriving
    // the window from `scrollTop` (when the anchor is dropped) lands on the same
    // row. We deliberately do NOT pull the offset up to bottom-align the block
    // near the end (an earlier `hi` clamp did): that collapsed many adjacent
    // anchors onto one integer offset, so a single stray scroll event would
    // re-map that offset proportionally and teleport the view thousands of rows
    // (ArrowUp "jumping" near the bottom of a huge list). `lo` still keeps
    // topPad ≥ 0 near the very top. The block may now extend a few hundred px
    // past the nominal cap at the very end; we clamp `bottomPad` to ≥ 0 and let
    // the real content height absorb the remainder — negligible against
    // `scrollHeight`, and the offset stays reachable.
    const lo = aboveRows * rowHeight;
    const proportional = Math.round((firstVisibleRow / Math.max(1, maxFirstRow)) * maxScrollTop);
    const usedScrollTop = Math.max(lo, Math.min(maxScrollTop, proportional));
    const topPad = usedScrollTop - aboveRows * rowHeight;
    const bottomPad = Math.max(0, scrollHeight - topPad - blockHeight);
    return { start, end, topPad, bottomPad, scrollHeight, scrollTop: usedScrollTop };
  }

  // Mouse scroll: the browser's scrollTop is authoritative; map it onto the row
  // range and seat the block so the first visible row lands at the viewport top
  // (overscan above limited to the room the offset leaves, so topPad stays ≥ 0).
  const clamped = Math.min(Math.max(0, scrollTop), maxScrollTop);
  const firstVisibleRow = Math.round((clamped / maxScrollTop) * maxFirstRow);
  const aboveRows = Math.min(overscan, firstVisibleRow, Math.floor(clamped / rowHeight));
  const start = firstVisibleRow - aboveRows;
  const end = Math.min(total, firstVisibleRow + visibleCount + overscan);
  const blockHeight = (end - start) * rowHeight;
  const maxTop = Math.max(0, scrollHeight - blockHeight);
  let topPad = clamped - aboveRows * rowHeight;
  if (topPad < 0) topPad = 0;
  else if (topPad > maxTop) topPad = maxTop;
  const bottomPad = Math.max(0, scrollHeight - topPad - blockHeight);

  return { start, end, topPad, bottomPad, scrollHeight, scrollTop: clamped };
}
