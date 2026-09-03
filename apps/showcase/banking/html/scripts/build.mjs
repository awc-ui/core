#!/usr/bin/env node
/**
 * Write the whole application out as static HTML.
 *
 * Eight screens — but the two drills fan out over the fixture, so it is 6 + 5
 * accounts + 12 instruments = 23 pages per locale, and three locales. There is
 * no dev server and no bundler in the page's critical path: every route is a
 * directory with an `index.html`, which is the only shape a static host can
 * serve without a redirect it cannot perform, and is what the other four
 * builds' fan-out step produces too.
 *
 * The client bundle IS built with esbuild, and that is not a contradiction. It
 * carries the dock and the progressive enhancements, all of which improve a
 * page that is already complete — nothing in the markup waits on it. The
 * component runtime is not bundled at all; `sync-runtime.mjs` copies Stencil's
 * lazy build into `public/` and explains at length why bundling it breaks it.
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

import { LOCALE_CODES, outputPath, useT } from '../src/lib/i18n.mjs';
import { document_ } from '../src/components/document.mjs';
import { routes } from '../src/routes.mjs';

const require_ = createRequire(import.meta.url);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');

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

  // All stylesheets are plain custom properties and page furniture with no
  // runtime, so they are copied rather than processed. The app sheet lives in
  // the kit because all five framework builds share the same grid; the snackbar
  // sheet is the one the React build's cards screen imports (framework-free by
  // design, copied into src/styles/ from the React app).
  mkdirSync(join(dist, 'styles'), { recursive: true });
  cpSync(require_.resolve('@awc-ui/core/css/tokens.css'), join(dist, 'styles/tokens.css'));
  cpSync(require_.resolve('@awc-ui/core/css/pre-upgrade.css'), join(dist, 'styles/pre-upgrade.css'));
  cpSync(require_.resolve('@awc-ui/showcase-kit/banking/app.css'), join(dist, 'styles/app.css'));
  cpSync(join(appRoot, 'src/styles/snackbar.css'), join(dist, 'styles/snackbar.css'));

  /*
   * THE FONTS, from npm rather than fonts.googleapis.com.
   *
   * An enterprise Content-Security-Policy with `style-src 'self'` refuses a
   * cross-origin stylesheet, and a blocked font sheet is not a cosmetic loss:
   * every icon falls back to rendering its ligature text. Each package's CSS
   * refers to its files with a RELATIVE url(), so the font files are copied to
   * sit beside the sheet exactly as they do inside the package — `./files/…` for
   * Roboto, a sibling woff2 for the symbols — and nothing needs rewriting.
   *
   * Only the Outlined symbol cut: `app.css` asks for Rounded first but never wins
   * it (tokens.css sets the property on `:root`, app.css on `html`), so shipping
   * Rounded would copy ~4.9 MB nobody renders.
   */
  const robotoDir = dirname(require_.resolve('@fontsource/roboto/400.css'));
  for (const weight of ['400', '500', '700']) {
    cpSync(join(robotoDir, `${weight}.css`), join(dist, `styles/roboto-${weight}.css`));
  }
  cpSync(join(robotoDir, 'files'), join(dist, 'styles/files'), { recursive: true });
  const symbolsDir = dirname(require_.resolve('material-symbols/outlined.css'));
  cpSync(join(symbolsDir, 'outlined.css'), join(dist, 'styles/material-symbols-outlined.css'));
  cpSync(
    join(symbolsDir, 'material-symbols-outlined.woff2'),
    join(dist, 'styles/material-symbols-outlined.woff2'),
  );

  /*
   * The preboot script, as a file — it was an inline IIFE, which `script-src
   * 'self'` refuses. The kit builds it standalone for exactly this.
   */
  cpSync(require_.resolve('@awc-ui/showcase-kit/preboot.js'), join(dist, 'preboot.js'));

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
