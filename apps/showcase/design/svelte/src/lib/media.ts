/**
 * Media queries as Svelte stores — the twin of the React build's `lib/media.ts`
 * and the Vue build's `lib/media.ts`, with the same three constants.
 *
 * WHY A STORE AND NOT JUST CSS. Most responsive work in this app is CSS, and
 * should be. This exists for the cases where the two layouts are DIFFERENT
 * MARKUP rather than the same markup arranged differently: the holdings table
 * and the holdings list are not one tree with different rules on it, and
 * rendering both and hiding one would put a 1040px table in the accessibility
 * tree of every phone.
 *
 * Starts `false` and settles on subscribe, so the first render is the same on
 * every machine. `readable` tears the listener down when the last subscriber
 * goes, which is what a component-scoped `$store` gives for free.
 */

import { readable, type Readable } from 'svelte/store';

export function mediaQuery(query: string): Readable<boolean> {
  return readable(false, (set) => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const update = () => set(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
}

/** The width below which markup decisions change. A CSS fact, quoted. */
export const PHONE = '(max-width: 719px)';

/** The width below which the navigation RAIL is replaced by the navigation BAR. */
export const COMPACT_NAV = '(max-width: 899px)';

/** A finger rather than a mouse — a touch laptop is wide AND coarse. */
export const COARSE = '(pointer: coarse)';

export const phone = mediaQuery(PHONE);
export const compactNav = mediaQuery(COMPACT_NAV);
