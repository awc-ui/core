/**
 * Helpers for elements that position themselves with `position: fixed` and
 * measure everything in VIEWPORT coordinates.
 *
 * Two components do this — md-menu for its own surface, md-sub-menu-item for a
 * submenu flyout — and both hit the same trap, so the walk lives here once.
 */

/**
 * One step up the FLATTENED tree — the tree that actually determines layout.
 *
 * `parentElement` alone is wrong here: slotted content keeps its light-DOM
 * parent chain, so walking it from a menu inside a select inside a bottom
 * sheet goes select -> sheet host -> body and never visits the sheet's
 * shadow container, which is the transformed element doing the damage.
 * Following `assignedSlot` first crosses into the shadow tree where the
 * element is really rendered.
 */
export function stepUpFlatTree(node: Element): Element | null {
  const slot = (node as HTMLElement).assignedSlot;
  if (slot) return slot;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * True when this element is the containing block for its `position: fixed`
 * descendants — which also makes it, and everything between it and them, a
 * CLIPPING ancestor. Note what is NOT on this list: `overflow`. An overflow
 * scroller never captures a fixed descendant, which is exactly what lets a
 * flyout escape a scroll-capped menu.
 */
function isFixedContainingBlock(cs: CSSStyleDeclaration): boolean {
  const willChange = cs.willChange || '';
  const contain = cs.contain || '';
  const backdrop = (cs as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter || 'none';
  return (
    cs.transform !== 'none' ||
    cs.perspective !== 'none' ||
    cs.filter !== 'none' ||
    backdrop !== 'none' ||
    /\b(transform|perspective|filter)\b/.test(willChange) ||
    /\b(paint|layout|strict|content)\b/.test(contain)
  );
}

/**
 * Origin of the containing block a `position: fixed` element actually resolves
 * against.
 *
 * `fixed` normally means "relative to the viewport", which is what every
 * measurement in the callers assumes — anchor rects, row rects and the viewport
 * clamp are all in viewport coordinates. But an ancestor with a transform,
 * filter, perspective, backdrop-filter, contain: paint/layout, or a will-change
 * on any of those becomes the containing block for its fixed descendants, and
 * the offsets are then interpreted relative to ITS padding box instead.
 *
 * That is not exotic: md-bottom-sheet keeps `transform: translateY(0)` while
 * open (translateY(0) still counts), and a menu on a select inside an open
 * sheet landed a full sheet-height below its field. Dialogs, side sheets and
 * any app-level animated wrapper do the same.
 *
 * Walks up through shadow boundaries, since the element usually lives inside
 * another component's shadow root. Returns {0,0} when the viewport really is
 * the containing block, making the correction a no-op in the common case.
 *
 * `from` is the element whose PARENT chain is searched — pass the positioned
 * element itself; its own transform is irrelevant to where it lands.
 */
export function fixedContainingBlockOrigin(from: Element): { x: number; y: number } {
  if (typeof getComputedStyle !== 'function') return { x: 0, y: 0 };
  let node: Element | null = stepUpFlatTree(from);

  while (node) {
    const cs = getComputedStyle(node as HTMLElement);
    if (isFixedContainingBlock(cs)) {
      const r = (node as HTMLElement).getBoundingClientRect();
      // The containing block is the PADDING box, so step inside the border.
      return {
        x: r.left + (parseFloat(cs.borderLeftWidth) || 0),
        y: r.top + (parseFloat(cs.borderTopWidth) || 0),
      };
    }
    node = stepUpFlatTree(node);
  }
  return { x: 0, y: 0 };
}
