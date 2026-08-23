/**
 * Everything prerenders, and every route is a directory with an `index.html`.
 *
 * `trailingSlash: 'always'` is not cosmetic here: it is what the dock's
 * framework switcher preserves when it swaps `svelte` for another segment, and
 * what a static host needs in order to serve a route without issuing a redirect
 * it cannot perform.
 *
 * `ssr` stays on. The screens read the fixture through pure, synchronous
 * selectors, so the prerendered HTML carries real rows and real numbers rather
 * than a loading state — the same guarantee the React build makes with its
 * client components.
 */
export const prerender = true;
export const trailingSlash = 'always';
