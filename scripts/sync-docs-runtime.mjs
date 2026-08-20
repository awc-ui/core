#!/usr/bin/env node
/**
 * Copy the built Stencil runtime into the docs site's `public/awc-runtime/`.
 *
 * The docs do NOT import @awc-ui/core. They load the lazy loader from a static
 * URL (`/awc-runtime/esm/loader.js`, see Head.astro) so Vite never bundles it —
 * bundling defeats Stencil's own lazy chunk loading. That means the runtime has
 * to be physically copied into `public/`, and nothing re-runs this copy on its
 * own: whenever `packages/core/dist` is rebuilt, the chunk hashes rotate and a
 * stale copy 404s on a SHARED chunk, which fails every lazy element at once and
 * renders the whole page at zero height.
 *
 * Source maps are deliberately EXCLUDED. They are 5.7 MB of the 9 MB runtime —
 * roughly two thirds of the payload — and everything under `public/` is copied
 * verbatim into `dist/`, so they were being deployed (and committed) for a site
 * that never needs them. Core still publishes maps to npm for consumers; this
 * only trims what the docs site carries. The `sourceMappingURL` comments are
 * stripped alongside them so devtools doesn't 404 chasing files that aren't
 * there.
 *
 * IMPORTANT: this copies whatever core last built and cannot tell which config
 * produced it. `stencil.config.dev.ts` is the lean Storybook config (no Terser
 * under `--dev`), so a production docs build MUST be preceded by a production
 * core build — `pnpm --filter @awc-ui/core build`, not `build:dev`.
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'packages/core/dist');
const target = resolve(repoRoot, 'apps/docs/public/awc-runtime');

if (!existsSync(distDir)) {
  console.error(
    `[sync-runtime] ${distDir} does not exist — build core first:\n` +
      '              pnpm --filter @awc-ui/core build',
  );
  process.exit(1);
}

/** Total bytes under a directory, for the before/after report. */
function bytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? bytes(full) : statSync(full).size;
  }
  return total;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
const withMaps = bytes(join(distDir, 'md3'));

// Refuse to ship a dev build. `stencil.config.dev.ts` emits UNHASHED,
// unminified entry files into the same `md3/` dir, and Stencil does not clean
// between configs — so a dev build layered over a prod one leaves both
// generations there AND rewrites md3.esm.js's manifest to point at the
// unminified ones. The result looks like a normal build and silently serves
// component source. Unhashed entries are the fingerprint.
const stale = readdirSync(join(distDir, 'md3')).filter(
  (f) => /\.entry\.js$/.test(f) && !f.startsWith('p-'),
);
if (stale.length) {
  console.error(
    `[sync-runtime] ${stale.length} unminified dev-build entries in dist/md3 (e.g. ${stale[0]}).\n` +
      '              dist holds two builds at once — rebuild clean:\n' +
      '              rm -rf packages/core/dist && pnpm --filter @awc-ui/core build',
  );
  process.exit(1);
}

if (existsSync(target)) rmSync(target, { recursive: true });

// cpSync's filter runs for directories too — returning false there would prune
// the whole subtree, so only files are tested.
const skipMaps = (src) => !src.endsWith('.map');
// `md3/` (the namespace dir) is Stencil's MINIFIED lazy browser build — the
// one meant to be served to browsers. `esm/` is the unminified ESM output that
// exists for BUNDLERS to process, and shipping it meant the docs served
// component source with every comment intact: 3.03 MB raw / 0.67 MB brotli,
// against 1.59 MB / 0.36 MB for the same components minified.
for (const sub of ['md3']) {
  cpSync(join(distDir, sub), join(target, sub), { recursive: true, filter: skipMaps });
}

/** Drop the trailing sourceMappingURL comment from every emitted file. */
function stripMapRefs(dir) {
  let touched = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      touched += stripMapRefs(full);
      continue;
    }
    if (!/\.(js|mjs|css)$/.test(entry.name)) continue;
    const before = readFileSync(full, 'utf8');
    const after = before.replace(/\n?\/\/# sourceMappingURL=.*$/gm, '').replace(/\n?\/\*# sourceMappingURL=.*?\*\/\s*$/g, '');
    if (after !== before) {
      writeFileSync(full, after);
      touched++;
    }
  }
  return touched;
}

const stripped = stripMapRefs(target);
const shipped = bytes(target);

console.log(
  `[sync-runtime] ${target.replace(repoRoot + '/', '')}\n` +
    `               ${mb(shipped)} shipped (${mb(withMaps - shipped)} of source maps excluded)\n` +
    `               ${stripped} files had a sourceMappingURL comment stripped`,
);
