/**
 * The names the two SSR targets agree on, and NOTHING that only one of them can
 * load.
 *
 * WHY THIS FILE IS SEPARATE FROM `dsd-transform.mjs`
 *
 * `middleware.ts` is compiled for Next 14's EDGE runtime. `dsd-transform.mjs`
 * imports `@awc-ui/core/hydrate`, whose very first line is
 * `import { Readable } from 'stream'` — a Node built-in. Put the constants in
 * that module and the middleware bundle drags the whole 3.8 MB hydrate app in
 * with them, and `next build` fails on the Node import before it ever gets to
 * the size. So the strings live here, with no imports at all, and both runtimes
 * can read them.
 *
 * They are strings shared across a process boundary — the middleware stamps
 * them, the route handler reads them back — which is exactly the kind of thing
 * that is written twice and then drifts. Hence one file.
 */

/** Route that performs the hydrate pass. Trailing slash: `trailingSlash: true`. */
export const DSD_ROUTE = '/awc-dsd/';

/**
 * Carries the ORIGINAL, base-path-prefixed path from the middleware to the
 * route handler. TWO channels, because the two targets disagree about which one
 * survives and neither is guessable from the other side.
 *
 * Under `next start` — which is what `@netlify/plugin-nextjs` runs inside its
 * server function — a rewrite does not change what the route handler sees:
 * `request.url` is the ORIGINAL request, base path stripped, and everything
 * appended to the rewrite TARGET is gone. Request headers set through
 * `rewrite(url, { request: { headers } })` do arrive; that is the documented
 * channel and it is verified working on 14.2.35.
 *
 * On Netlify the middleware is a Deno edge function and the rewrite is
 * materialised by the runtime rather than by Next's own router, so the header
 * override may not be re-applied while the rewritten URL — query string
 * included — certainly is. Sending both costs one short string and removes an
 * unverifiable single point of failure from a path that fails as a 400 on every
 * page.
 */
export const PATH_HEADER = 'x-awc-path';
export const PATH_PARAM = 'p';

/**
 * Loop breakers. The route handler fetches the page it was asked to transform
 * from this same app, so that second request MUST NOT be rewritten back into
 * the route handler. Two independent marks, because one of them travelling
 * through a CDN unchanged is an assumption and the failure mode is an infinite
 * request loop billed by the invocation:
 *
 *  - a request header, which is what a same-process server sees, and
 *  - a query parameter, which survives any proxy that rewrites headers.
 *
 * Either one present means "this is the inner request; leave it alone".
 */
export const RAW_HEADER = 'x-awc-raw';
export const RAW_PARAM = '__awc_raw';

/**
 * Set on any response whose components were expanded to declarative shadow DOM.
 * Makes "did the transform run?" a question curl can answer without reading the
 * body — and, on the Node target, tells `server.mjs` the work is already done so
 * it does not hydrate an already-hydrated document.
 */
export const DSD_HEADER = 'x-awc-ssr';
export const DSD_HEADER_VALUE = 'declarative-shadow-dom';

/**
 * The headers that make a request a React Server Components request rather than
 * a document request, forwarded verbatim so the flight stream comes back as a
 * flight stream.
 *
 * `middleware.ts` cannot see these — Next 14 strips them before the middleware
 * runs, which is why the document test there is `Sec-Fetch-Dest` — but the route
 * handler can, and being right in two places beats being right in one.
 */
export const RSC_HEADERS = ['rsc', 'next-router-prefetch', 'next-router-state-tree', 'next-url'];

/**
 * The cheap test for "is this worth handing to Stencil?". Every screen in this
 * app renders `md-*` elements; a 404, a redirect or an RSC payload does not.
 */
export function needsShadowRoots(html) {
  return html.includes('<md-');
}
