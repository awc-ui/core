/**
 * Nothing prerenders. Every screen renders on the server, per request.
 *
 * `prerender = false` is SvelteKit's default, so this line is not load-bearing
 * — it is a statement of intent in the one place a future `prerender = true`
 * would be tempting. This build's entire claim is that the HTML you receive was
 * produced for YOUR request: `src/hooks.server.ts` stamps the moment it ran
 * into the document, and `scripts/verify-ssr.mjs` fetches a page twice and
 * fails the build if the two stamps match. Prerendering any route here would
 * turn that route back into a file on disk and the claim into a lie, silently.
 *
 * `ssr` stays on, and now matters twice over. The screens read the fixture
 * through pure, synchronous selectors, so the HTML carries real rows and real
 * numbers rather than a loading state — and the hook can only inject shadow
 * DOM into markup that already exists when the response is assembled.
 *
 * `csr` stays on too: the component runtime adopts the server's shadow roots
 * rather than rebuilding them, and the dock switches locale, theme and density
 * in place afterwards, with no navigation.
 *
 * `trailingSlash: 'always'` is not cosmetic. It is what the dock's framework
 * switcher preserves when it swaps `sveltekit` for another segment, and it is
 * how every other build in the vertical spells a path.
 */
export const prerender = false;
export const ssr = true;
export const csr = true;
export const trailingSlash = 'always';
