/**
 * Media queries as reactive state — the Vue twin of the React build's
 * `lib/media.ts`, and the same three constants.
 *
 * WHY A COMPOSABLE AND NOT JUST CSS. Most responsive work in this app is CSS,
 * and should be — a grid that reflows needs no JavaScript. This exists for the
 * cases where the two layouts are DIFFERENT MARKUP rather than the same markup
 * arranged differently: the holdings table and the holdings list are not one
 * tree with different rules on it, and rendering both and hiding one would put
 * a 1040px table in the accessibility tree of every phone.
 *
 * Starts `false` and settles in `onMounted`, so the first render is the same on
 * every machine and nothing reads the viewport during setup.
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue';

export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  let mq: MediaQueryList | undefined;
  const update = () => {
    matches.value = mq?.matches ?? false;
  };

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    mq = window.matchMedia(query);
    update();
    mq.addEventListener('change', update);
  });

  onUnmounted(() => mq?.removeEventListener('change', update));

  return matches;
}

/**
 * The width below which markup decisions change. Quoted from `app.css` rather
 * than imported because it is a CSS fact, and the two are checked together in
 * the browser.
 */
export const PHONE = '(max-width: 719px)';

/** The width below which the navigation RAIL is replaced by the navigation BAR. */
export const COMPACT_NAV = '(max-width: 899px)';

/** A finger rather than a mouse. Separate from width: a touch laptop is both
 *  wide and coarse, and wants the larger tap targets without the phone layout. */
export const COARSE = '(pointer: coarse)';
