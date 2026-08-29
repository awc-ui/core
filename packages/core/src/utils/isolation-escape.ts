/**
 * Escape hatch for `position: fixed` popups trapped by an ancestor's
 * `isolation: isolate`.
 *
 * A popup surface is `position: fixed` with `z-index: var(--md-sys-z-index-popup,
 * 1000)`, but a z-index only ranks an element inside its OWN stacking context.
 * Any ancestor with `isolation: isolate` opens a new context, so the popup's
 * 1000 competes with that ancestor's children instead of the page's — it can
 * never outrank the ancestor itself, and anything painted after the ancestor
 * covers the popup. The symptom is a menu that renders behind its surroundings
 * AND stops taking clicks, because hit-testing follows paint order.
 *
 * This is not hypothetical: a select's menu in md-table-toolbar was painted over
 * by the md-table sibling next to it, and md-navigation-rail hit the identical
 * thing and worked around it locally with
 * `:host(.md-navigation-rail--submenu-open) { isolation: auto; }`
 * (md-navigation-rail.css:680-689). That workaround is per-ancestor and has to
 * be written again for every isolating host — md-table-container and md-table
 * both isolate too, and so does arbitrary consumer markup the library never
 * sees. This generalises it: while a popup is open, relax EVERY isolating
 * ancestor, then put every one of them back.
 *
 * Only `isolation` is touched — never `z-index`, `transform` or `opacity`.
 * Isolation is a defensive guard against accidental collisions between
 * unrelated z-indexes, and it is safe to suspend for the moment a popup is
 * open. A numeric z-index is a deliberate rank (md-table-row's sticky head at
 * 2, md-card's state layer at 1) and is left alone; rewriting those is the
 * whack-a-mole md-chip.css:120-131 warns about.
 *
 * A consumer whose isolate genuinely must survive an open popup can pin it with
 * `isolation: isolate !important` — an important author declaration outranks
 * the inline style written here.
 */
import { stepUpFlatTree } from './fixed-position';

/** How many open popups currently hold each ancestor relaxed. */
const holders = new WeakMap<HTMLElement, number>();
/** The inline `isolation` an element had before the first popup relaxed it. */
const priorInline = new WeakMap<HTMLElement, string>();

/**
 * Relax `isolation: isolate` on every flat-tree ancestor of `from`, and return
 * the function that restores them. Call it once per open and call the returned
 * function on close (and on disconnect) — it is idempotent.
 */
export function releaseIsolatingAncestors(from: Element): () => void {
  const noop = () => {};
  if (typeof getComputedStyle !== 'function') return noop;

  const held: HTMLElement[] = [];
  let node: Element | null = stepUpFlatTree(from);

  while (node) {
    const el = node as HTMLElement;
    // The `holders` check matters as much as the computed value: a second popup
    // opening under the same ancestor reads `auto` (the first one already
    // relaxed it) and would take no reference, so the first to close would
    // re-isolate while the second is still open.
    if (holders.get(el) || getComputedStyle(el).isolation === 'isolate') {
      const count = holders.get(el) ?? 0;
      if (count === 0) {
        priorInline.set(el, el.style.isolation);
        // An inline declaration beats the `:host { isolation: isolate }` rule in
        // the ancestor's own shadow stylesheet, and writing '' back removes only
        // this one property — other inline declarations survive untouched.
        el.style.isolation = 'auto';
      }
      holders.set(el, count + 1);
      held.push(el);
    }
    node = stepUpFlatTree(el);
  }

  if (!held.length) return noop;

  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const el of held) {
      const count = (holders.get(el) ?? 1) - 1;
      holders.set(el, count);
      if (count <= 0) el.style.isolation = priorInline.get(el) ?? '';
    }
  };
}
