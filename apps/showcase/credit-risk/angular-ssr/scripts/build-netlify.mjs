#!/usr/bin/env node
/**
 * Package an already-built `dist/` as the two things Netlify can actually run.
 *
 * This does NOT build the app. `ng build` produces one output and both targets
 * use it unchanged — same `baseHref`, same `deployUrl`, same `src/server.ts`
 * compiled into the same `dist/server/server.mjs` — which is the strongest
 * guarantee available that the deployed build and the one
 * `scripts/verify-ssr.mjs` drives are the same build. There is no second
 * `angular.json` target and no second config file to drift.
 *
 *   pnpm build            # ng build, unchanged, and what `pnpm start` runs
 *   pnpm netlify:package  # this file, over the output of that
 *   pnpm build:netlify    # both, in order
 *
 * WHAT IT WRITES, and why each one is not something the function could do for
 * itself at runtime:
 *
 *   dist/netlify/static/showcase/credit-risk/angular-ssr/
 *     Every file `dist/browser/` holds — `main.js`, the lazy chunks, the two
 *     stylesheets, `awc-runtime/md3/` — under the prefix the app is compiled
 *     against. Netlify serves the publish directory from the site root, and
 *     this build emits ABSOLUTE asset URLs beginning
 *     `/showcase/credit-risk/angular-ssr/` (angular.json's `deployUrl`), so
 *     the files have to sit at that path inside the publish directory or every
 *     one of them 404s while the HTML looks perfect. That prefix is the single
 *     most likely thing to get wrong here, so it is read from the kit rather
 *     than typed: `createRoutes('angular-ssr').basePath` is the same call
 *     `src/app/lib/routes.ts` makes to produce the base the server mounts on.
 *
 *   dist/netlify/document.mjs
 *     `index.server.html`, as an ES module exporting a string.
 *     `CommonEngine` reads that file with `fs` and there is no `dist/server/`
 *     in a bundled Lambda to read it from. `included_files` plus a
 *     `process.cwd()`-relative read would also work and is one more thing that
 *     can be true on a laptop and false in a deploy; a static import cannot be.
 *     `@netlify/angular-runtime` inlines the same file into its edge function
 *     for the same reason.
 *
 * The function itself is NOT generated — `netlify/functions/ssr.mjs` is checked
 * in and Netlify bundles it in place. Nothing here writes JavaScript that
 * anyone has to read a build script to see.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** `/showcase/credit-risk/angular-ssr`, from the kit, with no trailing slash. */
const BASE_PATH = createRoutes('angular-ssr').basePath;

const browserDir = join(appRoot, 'dist/browser');
const serverDir = join(appRoot, 'dist/server');
const indexServerHtml = join(serverDir, 'index.server.html');
const outDir = join(appRoot, 'dist/netlify');
const staticDir = join(outDir, 'static');
/** Where the browser build has to land for its own asset URLs to resolve. */
const staticAppDir = join(staticDir, BASE_PATH.replace(/^\//, ''));

function fail(message) {
  console.error(`[build-netlify] ${message}`);
  process.exit(1);
}

for (const [what, path] of [
  ['dist/browser', browserDir],
  ['dist/server/index.server.html', indexServerHtml],
]) {
  if (!existsSync(path)) {
    fail(`${what} does not exist — build first:\n              pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr build`);
  }
}

if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(staticAppDir, { recursive: true });

/*
 * THE ONE FILE THAT MUST NOT BE DEPLOYED.
 *
 * With SSR on and prerendering off the builder still writes a single
 * `index.html` into `dist/browser/` — the client-side-render shell, an empty
 * `<awc-root>`. `src/server.ts` refuses to serve it (`express.static(…, {
 * index: false })`) and the reason applies twice as hard here: Netlify resolves
 * a directory request to `index.html` on its own, before any function runs, so
 * deploying it would make the CDN answer `/showcase/credit-risk/angular-ssr/`
 * with an empty document — no components, no `<template shadowrootmode>`, no
 * render markers — and `scripts/verify-ssr.mjs` would fail against a page that
 * still looks correct in a browser once `main.js` has run. The filter drops it;
 * the assertion below proves it stayed dropped.
 */
const excluded = new Set([join(browserDir, 'index.html')]);
cpSync(browserDir, staticAppDir, { recursive: true, filter: (src) => !excluded.has(src) });

const strays = [];
(function findHtml(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findHtml(full);
    else if (entry.name.endsWith('.html')) strays.push(relative(staticDir, full));
  }
})(staticDir);

if (strays.length) {
  fail(
    `${strays.length} HTML file(s) in the publish directory (e.g. ${strays[0]}).\n` +
      '              Netlify would serve them instead of rendering. Every document this\n' +
      '              build answers with comes from the function.',
  );
}

/*
 * The assets the rendered page names, checked by name rather than by count so
 * the failure reads as "the runtime is missing" instead of "42 files, expected
 * 43". `md3.esm.js` is the module `src/server.ts` writes an import for into
 * every head it sends; the others are what `index.server.html` links.
 */
for (const required of ['main.js', 'styles.css', 'polyfills.js', 'awc-runtime/md3/md3.esm.js']) {
  if (!existsSync(join(staticAppDir, required))) {
    fail(
      `${BASE_PATH}/${required} is missing from the publish directory.\n` +
        (required.startsWith('awc-runtime')
          ? '              Run `pnpm sync-runtime` (or `pnpm build`, which does) first.'
          : '              dist/browser looks incomplete — rebuild.'),
    );
  }
}

/*
 * U+2028 and U+2029 are legal in a JSON string and, before ES2019, were line
 * terminators in a JavaScript one. Node 20 does not care; escaping them costs
 * nothing and means this file cannot emit a module that fails to parse because
 * a translation picked up an exotic separator.
 */
const document = readFileSync(indexServerHtml, 'utf8');
writeFileSync(
  join(outDir, 'document.mjs'),
  '// Generated by scripts/build-netlify.mjs from dist/server/index.server.html.\n' +
    '// Not checked in. See that file for why the document is inlined at all.\n' +
    `export const DOCUMENT = ${JSON.stringify(document).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};\n`,
);

function bytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? bytes(full) : statSync(full).size;
  }
  return total;
}

console.log(
  `[build-netlify] publish  dist/netlify/static${BASE_PATH}/ — ` +
    `${(bytes(staticAppDir) / 1024 / 1024).toFixed(1)} MB, no HTML\n` +
    `[build-netlify] document dist/netlify/document.mjs — ${(document.length / 1024).toFixed(1)} kB inlined\n` +
    `[build-netlify] function netlify/functions/ssr.mjs — wraps dist/server/server.mjs`,
);
