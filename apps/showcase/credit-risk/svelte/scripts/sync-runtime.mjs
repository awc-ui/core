#!/usr/bin/env node
/**
 * Copy Stencil's lazy browser build into this app's `public/awc-runtime/`.
 *
 * WHY THE COMPONENTS ARE NOT BUNDLED
 *
 * `apps/docs/src/components/Head.astro` records three failed attempts at
 * getting the components to load through a bundler. They applied to the docs
 * site, then to every framework build in this vertical, and they apply here
 * unchanged — the failure is in the BROWSER graph, so which bundler produced it
 * makes no difference:
 *
 *   1. `@awc-ui/core/loader` (and `/define`, which wraps it) resolves each
 *      component's chunk at RUNTIME by URL, relative to the module's own
 *      location. Bundle it and the chunks are looked for beside the app bundle
 *      — `/showcase/credit-risk/svelte/assets/…` here, `_app/immutable/…` in
 *      the SvelteKit twin — where nothing was ever written. Every element 404s
 *      and renders at zero height.
 *   2. `@awc-ui/core/dist/components/index.js` looks like the fix (it is the
 *      `dist-custom-elements` output) but exports only utilities; it defines
 *      no elements. Importing all 79 `md-*.js` modules by hand rots instantly
 *      and drags every component into this app's bundle.
 *   3. A wrapper package pulls `@awc-ui/core` into the module graph, so it
 *      lands back in case 1 or case 2. This app therefore renders plain `md-*`
 *      tags and assigns object props through a Svelte action — see
 *      `src/lib/elements.ts`.
 *
 * What works is what the docs site does: serve Stencil's own minified lazy
 * build from a STATIC url and let it resolve its siblings relative to itself.
 * A module `<script>` with an absolute URL in `index.html` does that.
 * Vite copies `public/` into `dist/` verbatim and never rewrites it, so the
 * runtime lands where that URL points. Lazy loading survives — a screen only
 * fetches the elements it renders.
 *
 * THE RUNTIME MATTERS MORE HERE THAN IN THE SSR TWIN. There, the hook painted
 * every component's shadow DOM into the response, so a page was readable before
 * any script ran and the runtime only added behaviour. In this build nothing is
 * rendered until JavaScript runs at all, and the components are rendered by the
 * runtime itself — if this copy is missing, every screen is a tree of unknown
 * tags at zero height.
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
const target = resolve(appRoot, 'public/awc-runtime');

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
  `[sync-runtime] public/awc-runtime — ${(bytes(target) / 1024 / 1024).toFixed(1)} MB, ` +
    `${stripped} sourceMappingURL comments stripped`,
);
