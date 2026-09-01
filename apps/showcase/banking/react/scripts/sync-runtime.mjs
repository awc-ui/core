#!/usr/bin/env node
/**
 * Copy Stencil's lazy browser build into this app's `public/awc-runtime/`.
 *
 * Identical, deliberately, to the credit-risk React build's copy of this
 * script: the failure it works around is in the BROWSER graph, so it is the
 * same failure for every vertical and every bundler, and two copies that agree
 * are cheaper to reason about than one shared script with a vertical argument.
 *
 * WHY THE COMPONENTS ARE NOT BUNDLED
 *
 * `apps/docs/src/components/Head.astro` records three failed attempts at
 * getting the components to load through a bundler:
 *
 *   1. `@awc-ui/core/loader` (and `/define`, which wraps it) resolves each
 *      component's chunk at RUNTIME by URL, relative to the module's own
 *      location. Bundle it and the chunks are looked for beside the app bundle
 *      — `/showcase/banking/react/assets/…` here — where nothing was ever
 *      written. Every element 404s and renders at zero height.
 *   2. `@awc-ui/core/dist/components/index.js` looks like the fix (it is the
 *      `dist-custom-elements` output) but exports only utilities; it defines
 *      no elements. Importing all 79 `md-*.js` modules by hand rots instantly
 *      and drags every component into this app's bundle.
 *   3. `@awc-ui/react` wrappers pull `@awc-ui/core` into the module graph, so
 *      they land back in case 1 or case 2. This app therefore renders plain
 *      `md-*` JSX elements and sets object props through refs — see
 *      `src/components/elements.tsx`.
 *
 * What works is what the docs site does: serve Stencil's own minified lazy
 * build from a STATIC url and let it resolve its siblings relative to itself.
 * A `<script type="module">` with an absolute URL in `index.html` does that.
 * Vite copies `public/` into `dist/` verbatim and never rewrites it, so the
 * runtime lands where that URL points. Lazy loading survives — a screen only
 * fetches the elements it renders.
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

/*
 * The preboot script, as a FILE.
 *
 * It used to be interpolated into `index.html` as an inline `<script>`, which an
 * enterprise Content-Security-Policy refuses outright — `script-src 'self'`
 * without `'unsafe-inline'` blocks an inline script whatever it contains. The
 * kit already builds it as a standalone file for exactly this reason; copying it
 * beside the runtime means the document can reference it by URL and carry no
 * executable text of its own.
 *
 * It stays a BLOCKING classic script in the head, because its whole job is to
 * stamp theme, density and direction onto <html> before the first paint. An
 * external one still does that: the parser waits for it.
 */
const prebootSource = resolve(repoRoot, 'packages/showcase-kit/dist/preboot.js');
if (!existsSync(prebootSource)) {
  console.error(
    `[sync-runtime] ${prebootSource} is missing — build the kit first:\n` +
      '               pnpm --filter @awc-ui/showcase-kit build',
  );
  process.exit(1);
}
const prebootTarget = resolve(appRoot, 'public/preboot.js');
cpSync(prebootSource, prebootTarget);

const stripped = stripMapRefs(target);
console.log(
  `[sync-runtime] public/awc-runtime — ${(bytes(target) / 1024 / 1024).toFixed(1)} MB, ` +
    `${stripped} sourceMappingURL comments stripped, preboot.js copied`,
);
