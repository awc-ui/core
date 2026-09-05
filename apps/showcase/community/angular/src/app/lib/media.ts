/**
 * Media queries as signals — the Angular twin of the React build's
 * `lib/media.ts`, with the same three constants.
 *
 * WHY THIS EXISTS AT ALL. Most responsive work in this app is CSS, and should
 * be — a grid that reflows needs no JavaScript. This covers the cases where the
 * two layouts are DIFFERENT MARKUP rather than the same markup arranged
 * differently: the holdings table and the holdings list are not one tree with
 * different rules on it, and rendering both and hiding one would put a 1040px
 * table in the accessibility tree of every phone.
 *
 * Starts `false` and settles in an effect, so the first render is the same on
 * every machine and nothing reads the viewport during construction.
 * `DestroyRef` tears the listener down with the injecting component.
 */

import { DestroyRef, inject, signal, type Signal } from '@angular/core';

export function mediaQuery(query: string): Signal<boolean> {
  const matches = signal(false);

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia(query);
    const update = () => matches.set(mq.matches);
    update();
    mq.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', update));
  }

  return matches.asReadonly();
}

/** The width below which markup decisions change. A CSS fact, quoted. */
export const PHONE = '(max-width: 719px)';

/** The width below which the navigation RAIL is replaced by the navigation BAR. */
export const COMPACT_NAV = '(max-width: 899px)';

/** A finger rather than a mouse — a touch laptop is wide AND coarse. */
export const COARSE = '(pointer: coarse)';
