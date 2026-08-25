/**
 * The Netlify target for the `angular-ssr` showcase build.
 *
 * `pnpm start` runs `dist/server/server.mjs` and it holds port 4613 until you
 * stop it. Netlify has no long-lived process, so this file takes the SAME
 * express app — the compiled `src/server.ts`, imported, not reimplemented — and
 * runs it once per request inside a Netlify Function.
 *
 * WHY NOT `@netlify/angular-runtime`. It is the supported way to put Angular
 * SSR on Netlify and it does not fit this build, for a reason worth writing
 * down so nobody spends an afternoon rediscovering it. The plugin does not run
 * your server; it WRITES ITS OWN. For Angular < 19 (this build is 17.3) it
 * emits a Deno edge function whose entire body is
 *
 *     const html = await renderApplication(bootstrap, { url, document, … });
 *     return new Response(html, { headers: { 'content-type': 'text/html' } });
 *
 * importing `main.server.mjs` directly and never touching `server.ts` at all.
 * That drops every single thing this build is a demonstration OF: no
 * `renderToString` pass, so no declarative shadow DOM and 0 of the overview's
 * 206 `<template shadowrootmode="open">`; no `awc-rendered-at` / `awc-render-mode`
 * meta, so `scripts/verify-ssr.mjs` cannot tell the page from a prerender; no
 * preboot script and no runtime import; and no `APP_BASE_HREF`, so the router
 * matches nothing under `/showcase/credit-risk/angular-ssr/`. The page would
 * still LOOK right in a browser, because the components build their own shadow
 * roots once the runtime loads, which is exactly why this has to be checked in
 * the response body and not in a screenshot. On Angular >= 19 the plugin
 * instead rewrites `src/server.ts` in place with its own template, having
 * hashed the file against a list of known Angular scaffolds first; a customised
 * one like this fails the build with instructions to replace it. Either way the
 * answer is the same: it wants the file this build's whole point lives in.
 *
 * So the express app is wrapped instead, per the task's fallback and per
 * Netlify's own guide for running express. Everything below is transport: turn
 * a `Request` into the event shape `serverless-http` reads, run the app, turn
 * its response back into a `Response`. No rendering decision is made in this
 * file, and that is the property to preserve when editing it.
 */
import './lib/embedded.mjs';
// `lib/embedded.mjs` MUST stay above this import — it sets the flag that stops
// the bundle binding port 4613 as it initialises. It sits in `lib/` rather than
// beside this file because Netlify deploys every top-level file in the
// functions directory AS a function, and that one exports no handler. See it.
import { app } from '../../dist/server/server.mjs';
import { DOCUMENT } from '../../dist/netlify/document.mjs';
import { Buffer } from 'node:buffer';
import serverless from 'serverless-http';

/**
 * Built once per container, not once per request. `app()` mounts routes and
 * constructs nothing expensive; the cost this saves is Angular's, further in —
 * `CommonEngine` caches compiled lazy routes on the instance that
 * `dist/server/server.mjs` holds at module scope, so a warm invocation renders
 * in tens of milliseconds instead of repeating the first one's work.
 *
 * `DOCUMENT` is `index.server.html`, inlined by `scripts/build-netlify.mjs`
 * because the bundled function has no `dist/server/` beside it to read.
 */
const handle = serverless(app({ document: DOCUMENT }));

/**
 * The path this function answers on when it is invoked DIRECTLY rather than
 * through `config.path` below.
 *
 * `config.path` routes the original URL here untouched, which is the whole
 * reason it is used in preference to a `[[redirects]]` rule, so in normal
 * operation this prefix never appears. It does appear if someone opens
 * `/.netlify/functions/ssr` by hand, or if a future redirect rule points at the
 * function — and express, which only answers under
 * `/showcase/credit-risk/angular-ssr`, would 404 a request it should have
 * rendered. Stripping the prefix turns that into the 308 to the mount that the
 * Node server gives anyone who opens `http://localhost:4613/`.
 */
const FUNCTION_PREFIX = '/.netlify/functions/ssr';

/**
 * `Request` -> the API-Gateway-shaped event `serverless-http` expects.
 *
 * Modelled on `@netlify/aws-lambda-compat`'s `withLambda`, which is what the
 * platform itself uses for Lambda-signature functions; done here rather than by
 * depending on it because this needs exactly six fields and the package
 * declares `engines: node >= 22.12`, which is ahead of the repo's Node 20.
 *
 * `serverless-http` fills in `requestContext`, `body` and `headers` if they are
 * missing (`lib/provider/aws/clean-up-event.js`), so the absent
 * `requestContext.identity.sourceIp` costs a `remoteAddress` of `undefined`
 * rather than a crash. Nothing in this app reads it.
 */
async function toEvent(request) {
  const url = new URL(request.url);

  let path = url.pathname;
  if (path === FUNCTION_PREFIX || path.startsWith(`${FUNCTION_PREFIX}/`)) {
    path = path.slice(FUNCTION_PREFIX.length) || '/';
  }

  const queryStringParameters = {};
  const multiValueQueryStringParameters = {};
  for (const [key, value] of url.searchParams) {
    queryStringParameters[key] = value;
    (multiValueQueryStringParameters[key] ??= []).push(value);
  }

  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // Base64 for every method that can carry one, because this has no business
  // guessing at a charset: `serverless-http` decodes it back to the exact bytes
  // express would have read off the socket. These screens are all GET, so in
  // practice this branch never runs.
  let body = null;
  let isBase64Encoded = false;
  if (request.body) {
    body = Buffer.from(await request.arrayBuffer()).toString('base64');
    isBase64Encoded = true;
  }

  return {
    rawUrl: url.toString(),
    rawQuery: url.search.replace(/^\?/, ''),
    path,
    httpMethod: request.method,
    headers,
    multiValueHeaders: {},
    queryStringParameters: Object.keys(queryStringParameters).length ? queryStringParameters : null,
    multiValueQueryStringParameters: Object.keys(multiValueQueryStringParameters).length
      ? multiValueQueryStringParameters
      : null,
    body,
    isBase64Encoded,
  };
}

/**
 * …and back again.
 *
 * `serverless-http` reports a text response as a utf-8 string and a binary one
 * base64-encoded, deciding by content-type. Both are handled: a page that came
 * back as a string is passed through as one, so `content-length` — which
 * express set from `Buffer.byteLength` of the same string — still describes the
 * body the platform will send.
 *
 * `sanitizeHeaders` puts every repeated header into `multiValueHeaders` AND a
 * comma-joined copy into `headers`, except `set-cookie`, which it deliberately
 * leaves out of `headers` because joining cookies corrupts them. So: `set` from
 * `headers`, then `append` the cookies. This app sets none, and the loop is
 * here so that a later one is not silently dropped.
 */
function toResponse(result) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    headers.set(name, String(value));
  }
  for (const value of result.multiValueHeaders?.['set-cookie'] ?? []) {
    headers.append('set-cookie', String(value));
  }

  let body = null;
  if (result.body !== undefined && result.body !== null && result.body !== '') {
    body = result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body;
  }

  return new Response(body, { status: result.statusCode, headers });
}

export default async function handler(request) {
  return toResponse(await handle(await toEvent(request), {}));
}

/**
 * ROUTING, AND WHY IT IS DECLARED HERE RATHER THAN AS A `[[redirects]]` RULE.
 *
 * `path` is what the platform matches the incoming URL against, so the request
 * arrives with the URL the reader typed — `/showcase/credit-risk/angular-ssr/watchlist`
 * — and `toEvent` hands express that path unchanged. A redirect to
 * `/.netlify/functions/ssr` would route the same requests, but what the
 * function then sees for `event.path` depends on how the platform rewrites it,
 * and this build cannot afford to be wrong about that: express only answers
 * under the mount, so a path that arrived stripped of its prefix would 404
 * every screen while the build itself looked fine. `config.path` removes the
 * question.
 *
 * `preferStatic` is the other half. Without it a function claiming `/*` is
 * invoked for EVERY request, including `main.js`, `styles.css` and the 1.8 MB
 * of `awc-runtime/` chunks that `scripts/build-netlify.mjs` stages into the
 * publish directory. With it, a request matching a deployed file is served from
 * the CDN and the function runs only when there is no such file — which is the
 * same division of labour as `express.static` followed by the render route in
 * `src/server.ts`, moved one layer out.
 *
 * The publish directory deliberately contains no `index.html` ANYWHERE, which
 * is what keeps `preferStatic` from turning against us: Angular's builder emits
 * one — the empty client-side-render shell — and if it were deployed, the CDN
 * would answer `/showcase/credit-risk/angular-ssr/` with a document containing
 * no components, no render markers and no shadow roots, and every check in
 * `scripts/verify-ssr.mjs` would fail against a page that renders correctly in
 * a browser a moment later. `scripts/build-netlify.mjs` excludes it and then
 * asserts it is gone. `src/server.ts` makes the same exclusion for the same
 * reason, with `index: false`.
 */
export const config = {
  path: '/*',
  excludedPath: '/.netlify/*',
  preferStatic: true,
};
