#!/usr/bin/env node
/**
 * Write the whole application out as static HTML.
 *
 * 95 screens × 3 locales = 285 files, plus one client bundle and two
 * stylesheets. There is no dev server and no bundler in the page's critical
 * path: every route is a directory with an `index.html`, which is the only
 * shape a static host can serve without a redirect it cannot perform, and is
 * what the other five builds produce too.
 *
 * The client bundle IS built with esbuild, and that is not a contradiction. It
 * carries the dock and the four progressive enhancements, all of which improve
 * a page that is already complete — nothing in the markup waits on it. The
 * component runtime is not bundled at all; `sync-runtime.mjs` copies Stencil's
 * lazy build into `public/` and explains at length why bundling it breaks it.
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

import {
  getCounterparties,
  getFacilities,
  getSectors,
} from '@awc-ui/showcase-kit/data';
import { route } from '@awc-ui/showcase-kit/credit-risk';

import { LOCALE_CODES, outputPath, useT } from '../src/lib/i18n.mjs';
import { document_ } from '../src/components/document.mjs';
import { overviewScreen } from '../src/screens/overview.mjs';
import { sectorScreen } from '../src/screens/sector.mjs';
import { counterpartyScreen } from '../src/screens/counterparty.mjs';
import { facilityScreen } from '../src/screens/facility.mjs';
import { watchlistScreen } from '../src/screens/watchlist.mjs';
import { stressScreen } from '../src/screens/stress.mjs';

const require_ = createRequire(import.meta.url);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');

/**
 * Every screen, as `{ path, render }`. The lists come from the fixture rather
 * than a hard-coded table, so adding a counterparty to the kit adds a page here
 * without a second edit — the same contract `generateStaticParams` gives the
 * React build.
 */
function routes() {
  return [
    { path: route.overview(), render: (t, locale) => overviewScreen(t, locale) },
    { path: route.watchlist(), render: (t, locale) => watchlistScreen(t, locale) },
    { path: route.stress(), render: (t, locale) => stressScreen(t, locale) },
    ...getSectors().map((sector) => ({
      path: route.sector(sector.id),
      render: (t, locale) => sectorScreen(t, locale, sector.id),
    })),
    ...getCounterparties().map((cp) => ({
      path: route.counterparty(cp.id),
      render: (t, locale) => counterpartyScreen(t, locale, cp.id),
    })),
    ...getFacilities().map((facility) => ({
      path: route.facility(facility.id),
      render: (t, locale) => facilityScreen(t, locale, facility.id),
    })),
  ];
}

function writePage(relative, contents) {
  const full = join(dist, relative);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

async function main() {
  const started = Date.now();
  if (existsSync(dist)) rmSync(dist, { recursive: true });
  mkdirSync(dist, { recursive: true });

  /* ------------------------------------------------------------- the pages */

  const screens = routes();
  let pages = 0;
  let bytes = 0;

  for (const locale of LOCALE_CODES) {
    const t = useT(locale);
    for (const screen of screens) {
      const body = screen.render(t, locale);
      const page = String(document_({ locale, path: screen.path, body }));
      writePage(outputPath(locale, screen.path), page);
      pages += 1;
      bytes += Buffer.byteLength(page);
    }
  }

  /* -------------------------------------------------------------- the CSS */

  // Both stylesheets are plain custom properties and page furniture with no
  // runtime, so they are copied rather than processed. The app sheet lives in
  // the kit because all six framework builds share the same grid.
  mkdirSync(join(dist, 'styles'), { recursive: true });
  cpSync(require_.resolve('@awc-ui/core/css/tokens.css'), join(dist, 'styles/tokens.css'));
  cpSync(
    require_.resolve('@awc-ui/showcase-kit/credit-risk/app.css'),
    join(dist, 'styles/app.css'),
  );

  /* ----------------------------------------------------- the client bundle */

  const bundle = await esbuild({
    entryPoints: [join(appRoot, 'src/client/index.mjs')],
    outfile: join(dist, 'client.js'),
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: true,
    // The component runtime is NEVER bundled — it resolves its own lazy chunks
    // by URL relative to its own location, and a bundler rewrites those to
    // paths the export never wrote. It arrives from `public/awc-runtime/`
    // instead. Nothing in `src/client` imports it; this is the guard that says
    // so out loud if something ever starts to.
    external: ['@awc-ui/core', '@awc-ui/core/*'],
    metafile: true,
  });
  const clientBytes = Object.values(bundle.metafile.outputs)[0]?.bytes ?? 0;

  /* ------------------------------------------------------ the static files */

  // `public/awc-runtime/` is Stencil's lazy build, put there by sync-runtime.
  const publicDir = join(appRoot, 'public');
  if (!existsSync(join(publicDir, 'awc-runtime'))) {
    console.error(
      '[build] public/awc-runtime is missing — run `pnpm sync-runtime` first\n' +
        '        (which needs packages/core/dist: pnpm --filter @awc-ui/core build)',
    );
    process.exit(1);
  }
  cpSync(publicDir, dist, { recursive: true });

  console.log(
    `[build] dist/ — ${pages} pages across ${LOCALE_CODES.length} locales, ` +
      `${(bytes / 1024 / 1024).toFixed(1)} MB of HTML, ` +
      `${(clientBytes / 1024).toFixed(1)} kB client bundle, ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
