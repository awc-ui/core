import { FunctionalComponent, h } from '@stencil/core';

/**
 * Lazily registered <md-loading-indicator> for host components.
 *
 * A literal `<md-loading-indicator>` JSX tag makes the Stencil compiler add
 * the spinner to the consumer's STATIC dependency graph, so every app using
 * md-button/md-select/... shipped its ~3 kB gz eagerly even though the tag
 * only renders while `loading`/`searching` is active. This wrapper renders
 * the tag through a computed string the compiler cannot trace, and registers
 * the element on first actual render via a dynamic import — the bundler emits
 * it as its own async chunk, fetched only when a loading state first engages.
 *
 * Behavior by build:
 * - dist-custom-elements (bundlers): the element is usually NOT defined yet —
 *   the import lands, defineCustomElement() runs, the already-in-DOM tag
 *   upgrades. One frame of unstyled (invisible) spinner on first engage.
 * - lazy/loader build and `define` users: everything is registered at boot,
 *   the customElements.get() guard short-circuits, no import happens.
 * - hydrate (SSR): renders in Node with its own full registry; the guard
 *   also prevents the import from running server-side.
 *
 * KNOWN COUPLING: this deliberately bypasses Stencil's tag-graph analysis.
 * If a future Stencil version changes how dist-custom-elements modules expose
 * `defineCustomElement`, the import callback below is the single place to fix.
 */

// Computed, not a literal, so no compiler string-scan can re-add the edge.
const TAG = 'md-loading-' + 'indicator';

let requested = false;

export function ensureLoadingIndicator(): void {
  if (requested) return;
  requested = true;
  if (typeof customElements === 'undefined' || customElements.get(TAG)) return;
  import('../components/md-loading-indicator/md-loading-indicator').then(
    (m: Record<string, unknown>) => {
      if (customElements.get(TAG)) return;
      const define = m.defineCustomElement;
      if (typeof define === 'function') {
        define();
      } else if (typeof m.MdLoadingIndicator === 'function') {
        // Fallback for a Stencil that stops exporting the per-module helper:
        // the transformed class itself is a valid custom-element constructor.
        customElements.define(TAG, m.MdLoadingIndicator as CustomElementConstructor);
      }
    },
    () => {
      // Import failed (offline chunk fetch, exotic env): allow a retry on the
      // next render instead of latching a broken state.
      requested = false;
    },
  );
}

/**
 * Drop-in replacement for a literal <md-loading-indicator> tag: forwards all
 * props/children and kicks off the lazy registration on first render.
 */
export const LazyLoadingIndicator: FunctionalComponent<Record<string, unknown>> = (
  props,
  children,
) => {
  ensureLoadingIndicator();
  const Tag = TAG as unknown as 'div';
  return <Tag {...props}>{children}</Tag>;
};
