/**
 * THE NETLIFY TARGET'S SEAM. A Node route handler that does what `server.mjs`
 * does for the Node target: take a finished HTML document and expand every
 * `md-*` element into declarative shadow DOM before it reaches the browser.
 *
 * WHY A ROUTE HANDLER AND NOT THE OBVIOUS THINGS
 *
 * `@netlify/plugin-nextjs` turns `next build` into Netlify's Next runtime: the
 * pages are served by a serverless function that Netlify owns, and `server.mjs`
 * is never loaded. Something else has to run the transform, and on Netlify the
 * candidates are short:
 *
 *  - A NETLIFY EDGE FUNCTION wrapping `context.next()`. This is the documented
 *    way to rewrite an origin response, and it cannot be used: edge functions
 *    are Deno with a 50 ms CPU budget per request, and hydrating this app's
 *    overview screen — 206 shadow roots — measures ~140 ms of pure CPU. It
 *    would be killed, and killed only on the big pages.
 *  - NEXT MIDDLEWARE DOING THE WORK ITSELF. Next 14 compiles middleware for the
 *    Edge runtime, where `import { Readable } from 'stream'` — the hydrate
 *    app's first line — does not build. Node middleware landed in 15.2 and this
 *    app is on 14.2.
 *  - A ROUTE HANDLER, which is this. `runtime = 'nodejs'`, so the hydrate app
 *    loads unchanged; Netlify runs it inside the same server function as the
 *    pages, so its dependencies are traced by `next build` and there is no
 *    second bundler to satisfy. `middleware.ts` — which only has to REWRITE,
 *    which is cheap and edge-safe — points document requests here.
 *
 * WHAT IT COSTS: one extra request. The handler cannot ask Next to render a
 * page for it, so it fetches the page over HTTP from this same app, marked so
 * that `middleware.ts` lets it through untouched. Two function invocations per
 * document instead of one. Nothing streams either way — see the note in
 * `server.mjs` — so no first byte is lost, only a round trip.
 *
 * ON THE NODE TARGET this route is built and reachable and simply never used:
 * `middleware.ts` is inert unless `AWC_DSD_MIDDLEWARE` is `1`, which only
 * `AWC_TARGET=netlify` sets. It stays in the Node build on purpose — it is how
 * `scripts/verify-netlify-target.mjs` proves the Netlify seam locally, against
 * a plain `next start`, which is what Netlify's runtime actually runs.
 */

export const runtime = 'nodejs';
/** Never prerendered, never cached: the whole point is a fresh render marker. */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import {
  DSD_HEADER,
  DSD_HEADER_VALUE,
  PATH_HEADER,
  PATH_PARAM,
  RAW_HEADER,
  RAW_PARAM,
  RSC_HEADERS,
  injectShadowRoots,
  needsShadowRoots,
} from '@/lib/dsd-transform.mjs';
import { BASE_PATH } from '@/lib/routes';

/**
 * `no-store` twice, to two different caches. `Cache-Control` is the browser's
 * and Next's; `Netlify-CDN-Cache-Control` is the edge's, and Netlify's Next
 * runtime decides what to cache at the CDN from headers of its own. A cached
 * document is a frozen `awc-rendered-at`, which is precisely what
 * `scripts/verify-ssr.mjs` fails a build for.
 */
const NO_STORE = {
  'cache-control': 'no-store, max-age=0, must-revalidate',
  'netlify-cdn-cache-control': 'no-store',
};

/**
 * Which page was actually asked for. Three answers, tried in order, because the
 * two targets deliver it differently and getting it wrong 400s every page.
 *
 *  1. THE HEADER `middleware.ts` set on the rewritten request. Verified working
 *    under `next start`, which is what Netlify's Next runtime runs.
 *  2. THE QUERY PARAM on the rewrite target. Invisible under `next start` — the
 *    route handler is given the ORIGINAL request, not the URL it was rewritten
 *    to — but the natural survivor if Netlify's edge middleware materialises the
 *    rewrite as a real URL instead of replaying Next's header protocol.
 *  3. THE REQUEST URL ITSELF, base path re-attached, for the case where the
 *    rewrite is transparent and this handler is simply looking at the page that
 *    was asked for. Rejected by `resolveTarget` when it resolves back to this
 *    route, which is what stops a self-fetch loop.
 */
function originalPath(request: Request): string {
  const url = new URL(request.url);
  return (
    request.headers.get(PATH_HEADER) ??
    url.searchParams.get(PATH_PARAM) ??
    `${BASE_PATH}${url.pathname}${url.search}`
  );
}

/**
 * Resolve a path to a URL on THIS origin, under THIS base path, that is not
 * this handler.
 *
 * The path can arrive from a header an outside caller set, and this handler is
 * a fetcher, so it is treated as hostile. `//evil.example/`,
 * `https://evil.example/` and `../../..` all resolve to something outside the
 * mount once `new URL` is done with them, which is why the check is on the
 * RESULT and not on the input string. The last clause is the important one for
 * uptime rather than security: without it, a direct request to this route with
 * no header resolves to this route, which fetches this route, forever.
 */
function resolveTarget(raw: string, origin: string): URL | null {
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.pathname !== BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) return null;
  if (url.pathname.startsWith(`${BASE_PATH}/awc-dsd`)) return null;
  url.searchParams.set(RAW_PARAM, '1');
  return url;
}

/**
 * The inner request's headers: our loop breaker, plus anything that makes this
 * a flight request rather than a document request.
 *
 * Forwarding the RSC headers is what makes over-matching in the middleware
 * harmless. If a client-side navigation gets rewritten here anyway — a browser
 * that omits `Sec-Fetch-Dest`, a proxy that drops it — the upstream still sees
 * an RSC request, still answers `text/x-component`, and the passthrough below
 * returns it unchanged instead of replacing the router's flight stream with an
 * HTML document.
 */
function upstreamHeaders(request: Request): Headers {
  const headers = new Headers({ [RAW_HEADER]: '1', accept: request.headers.get('accept') ?? '*/*' });
  for (const name of RSC_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url);
  const target = resolveTarget(originalPath(request), origin);
  if (!target) {
    return new Response('Bad Request', { status: 400, headers: NO_STORE });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: upstreamHeaders(request),
      cache: 'no-store',
      redirect: 'follow',
    });
  } catch (error) {
    console.error('[awc-ssr] upstream render failed:', error);
    return new Response('Bad Gateway', { status: 502, headers: NO_STORE });
  }

  const contentType = upstream.headers.get('content-type') ?? 'text/html; charset=utf-8';
  const body = await upstream.text();
  const headers: Record<string, string> = { ...NO_STORE, 'content-type': contentType };
  // `Vary` is the router's, not ours: the same URL answers with a document or a
  // flight stream depending on these, and dropping it lets a shared cache serve
  // one where the other was asked for.
  const vary = upstream.headers.get('vary');
  if (vary) headers.vary = vary;

  // Anything that is not a page full of components goes back byte for byte: a
  // 404, a redirect body, an RSC payload that reached here despite the
  // middleware's document test.
  if (!contentType.includes('text/html') || !needsShadowRoots(body)) {
    return new Response(body, { status: upstream.status, headers });
  }

  try {
    const hydrated = await injectShadowRoots(body);
    return new Response(hydrated, {
      status: upstream.status,
      headers: { ...headers, [DSD_HEADER]: DSD_HEADER_VALUE },
    });
  } catch (error) {
    // A failed transform must not cost the user the page. The untransformed
    // HTML is still a working document — the components just build their shadow
    // roots client-side, exactly as they did before any of this existed.
    console.error('[awc-ssr] shadow-root injection failed, serving raw HTML:', error);
    return new Response(body, { status: upstream.status, headers });
  }
}
