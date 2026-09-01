/**
 * Media queries as React state.
 *
 * WHY A HOOK AND NOT JUST CSS. Most responsive work in this app is CSS, and
 * should be — a grid that reflows needs no JavaScript. This exists for the
 * cases where the two layouts are DIFFERENT MARKUP rather than the same markup
 * arranged differently: the holdings table and the holdings list are not one
 * tree with different rules on it, and rendering both and hiding one would put
 * a 1040px table in the accessibility tree of every phone.
 *
 * Starts `false` and settles in an effect, so the first frame is the same on
 * every machine and nothing is read during render.
 */

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/**
 * The one breakpoint this app makes markup decisions at.
 *
 * It is quoted here rather than imported from CSS because it is a CSS fact,
 * and the two are checked together in the browser. It matches the width below
 * which `app.css` stacks `.grid-2` to a single column — a table that needs
 * 1040px has nothing to gain from a 719px viewport either.
 */
export const PHONE = '(max-width: 719px)';

/**
 * Whether the pointer is coarse — a finger rather than a mouse.
 *
 * Separate from width on purpose: a touch laptop is wide AND coarse, and it
 * wants the larger tap targets without wanting the phone layout.
 */
export const COARSE = '(pointer: coarse)';
