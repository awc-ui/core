#!/usr/bin/env node
/**
 * Prove the NETLIFY target still server-renders — without Netlify.
 *
 * `scripts/verify-ssr.mjs` at the repository root drives `pnpm start`, which is
 * `server.mjs`: the long-lived Node server that buffers each response and pipes
 * it through `@awc-ui/core/hydrate`. Netlify never runs that file. There, the
 * pages are served by `@netlify/plugin-nextjs` — which is Next's own request
 * handler in a serverless function, i.e. exactly what `next start` runs — and
 * the hydrate pass has to be reached another way: `middleware.ts` rewrites
 * every document request into `app/awc-dsd/route.ts`.
 *
 * That second seam is invisible to the root harness. A build with the seam
 * broken passes `verify-ssr` (because `server.mjs` transforms regardless) and
 * ships bare custom elements. It also looks perfect in a browser, because the
 * components upgrade themselves once Stencil's runtime loads — which is why
 * this script reads the RESPONSE BODY and counts `shadowrootmode`, and never
 * opens a page.
 *
 * So: build the way Netlify builds, serve the way Netlify serves, and ask the
 * same two questions the root harness asks.
 *
 *   1. RENDERED WITHOUT A BROWSER — `<template shadowrootmode="open">` is
 *      already in the bytes `fetch` returns.
 *   2. RENDERED FOR THIS REQUEST — two requests carry different
 *      `awc-rendered-at` markers, so nothing along the way cached a document.
 *
 * Plus the two failure modes specific to this seam:
 *
 *   3. THE MOUNT SURVIVES. The rewrite goes through `NextURL`, which carries
 *      `basePath` beside the path; build it with `new URL()` instead and the
 *      mount is dropped and every page 404s. So the probe only ever asks for
 *      base-path-prefixed URLs, and a 404 fails the run.
 *   4. RSC PAYLOADS ARE LEFT ALONE. A client-side <Link> navigation re-fetches
 *      the same URL for a flight stream. If the middleware rewrites that too,
 *      the router is handed a full HTML document and client-side navigation
 *      breaks — silently, and only after hydration.
 *
 * Usage: pnpm --filter @awc-ui/showcase-credit-risk-next verify:netlify
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PATH = '/showcase/credit-risk/next';
const PORT = Number(process.env.PORT ?? 4619);
const ORIGIN = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DSD = /shadowrootmode/g;
const META = /<meta[^>]+name="awc-rendered-at"[^>]+content="([^"]+)"/i;
const MODE = /<meta[^>]+name="awc-render-mode"[^>]+content="([^"]+)"/i;

const failures = [];
const fail = (message) => failures.push(message);

console.log('==> building with AWC_TARGET=netlify');
const build = spawnSync('pnpm', ['run', 'build:netlify'], { cwd: appRoot, stdio: 'inherit', shell: false });
if (build.status !== 0) {
  console.error('    FAIL — build failed');
  process.exit(1);
}

console.log(`==> next start (what @netlify/plugin-nextjs runs) on :${PORT}`);
const server = spawn(join(appRoot, 'node_modules/.bin/next'), ['start', '-p', String(PORT)], {
  cwd: appRoot,
  stdio: 'ignore',
  shell: false,
  detached: true,
});
const stop = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
};

try {
  const deadline = Date.now() + 60_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    try {
      up = (await fetch(`${ORIGIN}${BASE_PATH}/`)).ok;
    } catch {
      /* not up yet */
    }
    if (!up) await sleep(500);
  }
  if (!up) {
    console.error(`    FAIL — server did not answer on :${PORT}`);
    stop();
    process.exit(1);
  }

  // 1 + 2 — the overview screen, the heaviest page and the one the root
  // harness measures, so the two numbers are directly comparable.
  const first = await fetch(`${ORIGIN}${BASE_PATH}/`);
  const firstBody = await first.text();
  await sleep(1100);
  const second = await fetch(`${ORIGIN}${BASE_PATH}/`);
  const secondBody = await second.text();

  const dsdCount = (firstBody.match(DSD) ?? []).length;
  console.log(`    declarative shadow DOM templates: ${dsdCount}`);
  if (dsdCount === 0) {
    fail(
      'no declarative shadow DOM in the response — the middleware never reached ' +
        'app/awc-dsd/route.ts, so the deployed site would ship bare custom elements',
    );
  }
  if (first.headers.get('x-awc-ssr') !== 'declarative-shadow-dom') {
    fail('no x-awc-ssr response header — the route handler did not produce this body');
  }

  const a = firstBody.match(META)?.[1];
  const b = secondBody.match(META)?.[1];
  console.log(`    render marker: ${a ?? '(none)'} then ${b ?? '(none)'}`);
  if (!a || !b) fail('no <meta name="awc-rendered-at"> in the response');
  else if (a === b) fail(`identical render marker across two requests (${a}) — something cached the document`);

  const mode = firstBody.match(MODE)?.[1];
  if (mode !== 'ssr') fail(`render mode reports "${mode ?? '(none)'}", expected "ssr"`);

  // 3 — every route, under the mount, with its own shadow roots.
  for (const path of ['/watchlist/', '/stress/', '/counterparties/cp-01/', '/sectors/energy/']) {
    const res = await fetch(`${ORIGIN}${BASE_PATH}${path}`);
    const body = await res.text();
    const count = (body.match(DSD) ?? []).length;
    console.log(`    ${BASE_PATH}${path} → ${res.status}, ${count} templates`);
    if (!res.ok) fail(`${path} answered ${res.status} — the base path did not survive the rewrite`);
    else if (count === 0) fail(`${path} carries no declarative shadow DOM`);
  }

  // 4 — the flight stream must not come back as a document.
  const rsc = await fetch(`${ORIGIN}${BASE_PATH}/watchlist/`, { headers: { RSC: '1' } });
  const rscType = rsc.headers.get('content-type') ?? '';
  console.log(`    RSC request → ${rsc.status} ${rscType}`);
  if (rscType.includes('text/html')) {
    fail('an RSC request was answered with HTML — the middleware rewrote a flight request');
  }

  if (failures.length) {
    for (const f of failures) console.error(`    FAIL — ${f}`);
    console.error('\n[verify-netlify-target] the Netlify seam is broken\n');
    process.exitCode = 1;
  } else {
    console.log('\n[verify-netlify-target] PASS — server-rendered, per request, under the base path\n');
  }
} finally {
  stop();
}
