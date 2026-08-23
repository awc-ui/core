#!/usr/bin/env node
/**
 * Copy Stencil's lazy browser build into this app's `static/awc-runtime/`.
 *
 * WHY THE COMPONENTS ARE NOT BUNDLED
 *
 * `@awc-ui/core/loader` (and `/define`, which wraps it) resolves each
 * component's chunk at RUNTIME by URL, relative to the module's own location.
 * Let Vite bundle it and those URLs are rewritten to paths that only exist in
 * the dev server's module graph, so every element 404s in the export and
 * renders at zero height. `vite.config.js` therefore excludes the package
 * from pre-bundling, and the runtime is served as a plain static file from an
 * absolute URL — the same thing the docs site does.
 *
 * This build prerenders the MARKUP but not the shadow roots, so the runtime is
 * what fills every element in. Until it lands the page is a column of unstyled
 * tags — the trade this build makes in exchange for switching language, theme
 * and density in place, without a navigation. The Astro build next door makes
 * the opposite trade and explains it in its own `src/middleware.ts`.
 *
 * `md3/` is the MINIFIED lazy build meant for browsers. `esm/` is the
 * unminified bundler output and is deliberately not copied. Source maps are
 * excluded (they are two thirds of the payload) and the dangling
 * `sourceMappingURL` comments are stripped with them.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '../../../..');
const distDir = resolve(repoRoot, 'packages/core/dist');
const target = resolve(appRoot, 'static/awc-runtime');

if (!existsSync(join(distDir, 'md3'))) {
  console.error(
    `[sync-runtime] ${join(distDir, 'md3')} does not exist — build core first:\n` +
      '              pnpm --filter @awc-ui/core build',
  );
  process.exit(1);
}

// Refuse a dev build. `stencil.config.dev.ts` emits UNHASHED, unminified entry
// files into the same `md3/` directory and Stencil does not clean between
// configs, so a dev build layered on a prod one leaves both generations there
// and rewrites the manifest to point at the unminified ones. Unhashed entries
// are the fingerprint.
const stale = readdirSync(join(distDir, 'md3')).filter((f) => /\.entry\.js$/.test(f) && !f.startsWith('p-'));
if (stale.length) {
  console.error(
    `[sync-runtime] ${stale.length} unminified dev-build entries in dist/md3 (e.g. ${stale[0]}).\n` +
      '              dist holds two builds at once — rebuild clean:\n' +
      '              rm -rf packages/core/dist && pnpm --filter @awc-ui/core build',
  );
  process.exit(1);
}

if (existsSync(target)) rmSync(target, { recursive: true });
mkdirSync(target, { recursive: true });

// cpSync's filter runs for directories too; returning false there prunes the
// whole subtree, so only files are tested.
cpSync(join(distDir, 'md3'), join(target, 'md3'), { recursive: true, filter: (src) => !src.endsWith('.map') });

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
    const after = before
      .replace(/\n?\/\/# sourceMappingURL=.*$/gm, '')
      .replace(/\n?\/\*# sourceMappingURL=.*?\*\/\s*$/g, '');
    if (after !== before) {
      writeFileSync(full, after);
      touched++;
    }
  }
  return touched;
}

function bytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? bytes(full) : statSync(full).size;
  }
  return total;
}

const stripped = stripMapRefs(target);
console.log(
  `[sync-runtime] static/awc-runtime — ${(bytes(target) / 1024 / 1024).toFixed(1)} MB, ` +
    `${stripped} sourceMappingURL comments stripped`,
);
