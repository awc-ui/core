#!/usr/bin/env node
/**
 * Drive the Netlify function locally, and check the RESPONSE BODY.
 *
 *   pnpm build:netlify && pnpm verify:netlify
 *
 * WHY THIS EXISTS. `scripts/verify-ssr.mjs` proves the Node target renders on
 * the server, per request, by starting `pnpm start` and fetching it. Nothing
 * proved the same of the second target, and the way that target fails is
 * invisible: a function that skips the `renderToString` pass returns a page
 * with no `<template shadowrootmode="open">` in it, the components build their
 * own shadow roots as soon as the runtime loads, and the result is
 * indistinguishable from a correct render in a screenshot and wrong in every
 * way that matters. So this asks the same two questions `verify-ssr.mjs` asks,
 * of the handler rather than of a port, plus the two the handler is the only
 * place that can get wrong: the base path, and whether the app got mounted at
 * all.
 *
 * WHAT IT CANNOT TELL YOU. It runs the handler in this Node process, so it says
 * nothing about how Netlify bundles it, whether `config.path` and
 * `preferStatic` route the way they are documented to, or how long a cold start
 * takes in a Lambda. Those need a deploy. What it does cover is everything
 * between `Request` in and `Response` out, which is all of the code in
 * `netlify/functions/ssr.mjs` and all of the render path in `src/server.ts`.
 */
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const BASE_PATH = createRoutes('angular-ssr').basePath;
const BASE_HREF = `${BASE_PATH}/`;
const ORIGIN = 'https://awc-credit-risk-angular-ssr.netlify.app';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Imported dynamically, and after the message above is printed, because the
 * import is where a missing `dist/` or a missing `serverless-http` shows up and
 * a bare module-resolution stack is a poor way to be told to run the build.
 */
console.log(`[verify-netlify] loading netlify/functions/ssr.mjs`);
let handler;
try {
  ({ default: handler } = await import('../netlify/functions/ssr.mjs'));
} catch (error) {
  console.error(
    `[verify-netlify] could not load the handler: ${error.message}\n` +
      '                 `pnpm build:netlify` writes dist/server/ and dist/netlify/document.mjs,\n' +
      '                 and `serverless-http` has to be installed.',
  );
  process.exit(1);
}

/**
 * The flag `netlify/functions/lib/embedded.mjs` sets. If it is missing, the import
 * above also bound port 4613 — harmless here, fatal to nothing, and a sign that
 * a bundler reordered or dropped that import. Worth failing on while it is
 * cheap to notice.
 */
if (process.env.AWC_SSR_EMBEDDED !== '1') {
  console.error('[verify-netlify] FAIL — AWC_SSR_EMBEDDED was not set before the server bundle initialised');
  process.exit(1);
}

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

async function get(path) {
  const response = await handler(new Request(`${ORIGIN}${path}`, { redirect: 'manual' }));
  return { response, body: await response.text() };
}

// ---------------------------------------------------------------------------
// 1. The overview renders, on the server, as declarative shadow DOM.
const first = await get(BASE_HREF);
const dsd = (first.body.match(/shadowrootmode/g) ?? []).length;
console.log(`[verify-netlify] ${BASE_HREF} — ${first.response.status}, ${dsd} shadow roots, ${first.body.length} bytes`);

check(first.response.status === 200, `${BASE_HREF} answered ${first.response.status}, expected 200`);
check(
  dsd > 0,
  'no declarative shadow DOM in the body — the renderToString pass did not run, so the ' +
    'function is serving Angular output the components will have to rebuild in the browser',
);
check(
  first.response.headers.get('content-type')?.startsWith('text/html'),
  `content-type was "${first.response.headers.get('content-type')}"`,
);
check(
  first.response.headers.get('cache-control') === 'no-store',
  `cache-control was "${first.response.headers.get('cache-control')}" — a cached page makes the render marker lie`,
);
check(
  first.response.headers.get('x-awc-ssr') === 'declarative-shadow-dom',
  'x-awc-ssr header missing — src/server.ts sets it only when the hydrate pass succeeded',
);

// ---------------------------------------------------------------------------
// 2. Rendered for THIS request. Same test scripts/verify-ssr.mjs makes: two
//    responses a second apart must carry different timestamps, and a response
//    with no timestamp fails rather than being given the benefit of the doubt.
const META = /<meta[^>]+name="awc-rendered-at"[^>]+content="([^"]+)"/i;
const MODE = /<meta[^>]+name="awc-render-mode"[^>]+content="([^"]+)"/i;

await sleep(1100);
const second = await get(BASE_HREF);
const a = first.body.match(META)?.[1];
const b = second.body.match(META)?.[1];
console.log(`[verify-netlify] render marker: ${a ?? '(none)'} then ${b ?? '(none)'}`);

check(Boolean(a && b), 'no <meta name="awc-rendered-at"> — nothing distinguishes this from a prerendered file');
check(a !== b, `identical render marker across two requests (${a})`);
check(first.body.match(MODE)?.[1] === 'ssr', `<meta name="awc-render-mode"> was "${first.body.match(MODE)?.[1]}"`);

// ---------------------------------------------------------------------------
// 3. THE BASE PATH. The proxy forwards the whole prefixed path, so the function
//    has to answer under it and every asset URL in the body has to carry it.
//    This is the failure that looks like a working build right up until the
//    deploy 404s.
check(
  first.body.includes(`<base href="${BASE_HREF}">`),
  `no <base href="${BASE_HREF}"> in the document — the browser would resolve every relative URL against the site root`,
);
check(
  first.body.includes(`src="${BASE_HREF}main.js"`) || first.body.includes(`src='${BASE_HREF}main.js'`),
  `main.js is not referenced as ${BASE_HREF}main.js — angular.json's deployUrl did not survive`,
);
check(
  first.body.includes(`${BASE_HREF}awc-runtime/md3/md3.esm.js`),
  'the component runtime import is missing or not prefixed',
);

const deep = await get(`${BASE_PATH}/watchlist`);
const deepDsd = (deep.body.match(/shadowrootmode/g) ?? []).length;
console.log(`[verify-netlify] ${BASE_PATH}/watchlist — ${deep.response.status}, ${deepDsd} shadow roots`);
check(deep.response.status === 200, `${BASE_PATH}/watchlist answered ${deep.response.status}`);
check(deepDsd > 0, `${BASE_PATH}/watchlist rendered no shadow roots — the router did not match under APP_BASE_HREF`);

// ---------------------------------------------------------------------------
// 4. The front door, and the door that is not one. Same behaviour as the Node
//    server: the bare root and the mount without its trailing slash redirect,
//    anything else outside the mount is a genuine wrong address.
for (const [path, expected] of [
  ['/', 308],
  [BASE_PATH, 308],
  ['/.netlify/functions/ssr', 308],
  ['/somewhere-else', 404],
]) {
  const { response } = await get(path);
  console.log(`[verify-netlify] ${path} — ${response.status}${response.headers.get('location') ? ` -> ${response.headers.get('location')}` : ''}`);
  check(response.status === expected, `${path} answered ${response.status}, expected ${expected}`);
  if (expected === 308) {
    check(response.headers.get('location') === BASE_HREF, `${path} redirected to "${response.headers.get('location')}"`);
  }
}

// ---------------------------------------------------------------------------
if (failures.length) {
  for (const failure of failures) console.error(`[verify-netlify] FAIL — ${failure}`);
  console.error(`\n[verify-netlify] ${failures.length} check(s) failed\n`);
  process.exit(1);
}

console.log('\n[verify-netlify] PASS — the function renders on the server, per request, under the base path\n');
process.exit(0);
