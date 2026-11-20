/**
 * Chrome (seen on 153, cold page loads) intermittently builds a freshly
 * rendered `<slot>` into its accessibility tree WITHOUT the slot's assigned
 * nodes: the slot is an ignored node with no children and the slotted text is
 * nowhere in the tree, for good (screen readers never read it). Waiting, a
 * visibility or display change of an ancestor, or a re-render does not bring
 * it back; taking the slot out of its parent and putting it back does
 * (R6-15, work/d6-lab/s52: 5-2-003).
 *
 * `refreshNewSlots` does that for each new slot element twice: on the
 * animation frame after the slot first rendered, and again
 * {@link SLOT_REFRESH_SETTLE_MS} later. The re-insertion is itself a slot
 * insertion and can hit the same race while the page is still hydrating
 * (with cached chunks, md-step's readonly panel lost its text in 7/24 loads
 * when re-inserted on the next frame only; 0/24 with the second pass —
 * 5-2-006). The slot goes back where it was, with the same assignment, so
 * layout and paint are unchanged; the only side effect is a `slotchange`
 * pair per pass. A pass is skipped while focus is inside the slotted content,
 * which a removal would drop.
 */
export const SLOT_REFRESH_SETTLE_MS = 250;
const refreshed = new WeakSet<Element>();

export function refreshNewSlots(root: ShadowRoot | null | undefined, selector = 'slot:not([name])'): void {
  if (!root || typeof requestAnimationFrame !== 'function') return;
  for (const slot of Array.from(root.querySelectorAll(selector))) {
    if (refreshed.has(slot)) continue;
    refreshed.add(slot);
    requestAnimationFrame(() => reinsertSlot(root, slot as HTMLSlotElement));
    setTimeout(() => reinsertSlot(root, slot as HTMLSlotElement), SLOT_REFRESH_SETTLE_MS);
  }
}

/** Takes `slot` out of its parent and puts it back at the same place (exported for tests). */
export function reinsertSlot(root: ShadowRoot, slot: HTMLSlotElement): boolean {
  const parent = slot.parentNode;
  if (!parent || !slot.isConnected) return false;
  const active = root.host?.ownerDocument?.activeElement ?? null;
  if (active && typeof slot.assignedElements === 'function'
    && slot.assignedElements({ flatten: true }).some(el => el === active || el.contains(active))) return false;
  const next = slot.nextSibling;
  parent.removeChild(slot);
  parent.insertBefore(slot, next);
  return true;
}
