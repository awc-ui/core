/**
 * The switch that points document requests at `app/awc-dsd/route.ts`, and
 * nothing else.
 *
 * WHY IT ONLY REWRITES. Next 14 compiles middleware for the EDGE runtime, and
 * on Netlify that becomes a Deno edge function with a 50 ms CPU budget. The
 * hydrate pass costs ~140 ms of CPU on the overview screen and its first import
 * is a Node built-in, so it can neither run here nor build here. What it can do
 * is cheap and portable: decide whether a request is a document, and if so
 * rewrite it to the Node route handler that can. See that file for why the seam
 * is split this way at all.
 *
 * WHY IT IS INERT BY DEFAULT. `AWC_DSD_MIDDLEWARE` is `1` only when
 * `next.config.mjs` was read with `AWC_TARGET=netlify`. On the Node target
 * `server.mjs` already buffers and transforms every response, so rewriting here
 * as well would hydrate a document twice and cost a needless round trip. One
 * `next build`, one seam active — chosen by an environment variable rather than
 * by a second config file, so the base path, the render markers and the hydrate
 * options cannot drift between the two.
 *
 * The matcher keeps this off the hot paths entirely: `_next/*` (the client
 * chunks), `awc-runtime/*` (Stencil's lazy build, hundreds of chunk requests
 * per screen) and the route handler itself never reach the function.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { DSD_ROUTE, PATH_HEADER, PATH_PARAM, RAW_HEADER, RAW_PARAM } from '@/lib/dsd-protocol.mjs';

/**
 * `'/'` IS LISTED SEPARATELY AND MUST BE.
 *
 * The negative-lookahead matcher on its own does not cover the mount root, and
 * the failure is not "the middleware skips it": with only the second entry,
 * `/showcase/credit-risk/next/` answers 200 with an EMPTY BODY and no
 * `content-type` while every other route is fine, and the middleware is never
 * invoked, so nothing logs and nothing throws. Merely having a `middleware.ts`
 * is enough to trigger it — the inert Node-target build does it too. Reproduced
 * on 14.2.35 with `basePath` + `trailingSlash`. The overview screen is the page
 * the whole showcase opens on, so it is the last route to leave to a matcher's
 * edge case.
 */
export const config = {
  matcher: ['/', '/((?!_next/|awc-runtime/|awc-dsd|favicon.ico).*)'],
};

/**
 * `NextResponse.next()`, never a bare `return`. Next 14's edge adapter treats an
 * `undefined` return as a finished response and answers 200 with an empty body
 * and no `content-type` — every page blank, no error anywhere. The TypeScript
 * signature permits `void`; the runtime does not mean by it what it looks like.
 */
const CONTINUE = () => NextResponse.next();

export function middleware(request: NextRequest): NextResponse {
  if (process.env.AWC_DSD_MIDDLEWARE !== '1') return CONTINUE();

  const url = request.nextUrl;

  // The inner fetch from the route handler. Either mark is enough; both are
  // checked because a loop here is an infinite one. See `lib/dsd-protocol.mjs`.
  if (request.headers.get(RAW_HEADER) || url.searchParams.has(RAW_PARAM)) return CONTINUE();

  if (request.method !== 'GET') return CONTINUE();
  if (url.pathname.startsWith('/awc-dsd')) return CONTINUE();

  /**
   * IS THIS A DOCUMENT? `Sec-Fetch-Dest`, and it has to be.
   *
   * A client-side <Link> navigation re-fetches the same URL for its RSC payload
   * and a prefetch does the same speculatively; both must reach the page, not
   * this rewrite, or the router is handed an HTML document where it expects a
   * flight stream. The obvious test is the `RSC` request header — and Next 14
   * STRIPS `RSC`, `Next-Router-Prefetch` and `Next-Router-State-Tree` before
   * middleware runs, so `request.headers.get('rsc')` is null on a real flight
   * request. (Verified against 14.2.35: an arbitrary `X-Test` header arrives;
   * those three do not.) `Sec-Fetch-Dest` does arrive, and a browser sets it to
   * `document` only for a top-level navigation — every `fetch()` the router
   * makes is `empty`.
   *
   * ABSENT means transform. `fetch()` and `curl` send no `Sec-Fetch-*` at all,
   * and they are how anything checks whether this build server-renders — an
   * `Accept: text/html` test, or reading "absent" as "not a document", would
   * serve hydrated pages to browsers and bare custom elements to every harness
   * looking for them. Passing by hand, failing the claim.
   *
   * The route handler forwards any RSC headers it does see and returns the
   * flight stream untouched, so a client that omits `Sec-Fetch-Dest` still
   * navigates correctly. This is the fast path, not the only guard.
   */
  const dest = request.headers.get('sec-fetch-dest');
  if (dest && dest !== 'document') return CONTINUE();

  // `trailingSlash: true` means every real page URL ends in `/` and every asset
  // does not, which makes this the file test as well. Letting the un-slashed
  // form fall through hands it to Next's own 308, so the redirect happens once,
  // at the original URL, instead of being resolved invisibly behind a rewrite
  // that leaves the address bar un-normalised.
  if (!url.pathname.endsWith('/')) return CONTINUE();

  // `NextURL` carries `basePath` beside the path and re-attaches it on
  // serialisation, so `pathname` is assigned WITHOUT the mount and comes back
  // out with it. Building the target with `new URL(..., request.url)` instead
  // would drop the mount and 404.
  const original = `${url.basePath}${url.pathname}${url.search}`;

  const target = url.clone();
  target.pathname = DSD_ROUTE;
  target.search = '';
  target.searchParams.set(PATH_PARAM, original);

  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, original);

  return NextResponse.rewrite(target, { request: { headers } });
}
