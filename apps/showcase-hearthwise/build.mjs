#!/usr/bin/env node
/**
 * Static build for the Hearthwise showcase (plain HTML, no bundler).
 *
 * Two jobs:
 *
 * 1. SUBPATH SAFETY. The dev page loads its stylesheet and the Stencil loader
 *    straight out of `node_modules/`, which only resolves when the app dir
 *    itself is the web root. The build copies those assets into `dist/` and
 *    rewrites every reference to a `./`-relative URL, so the output works at
 *    ANY mount path (here: /showcase/SPIKE/html/) with zero absolute-root URLs
 *    and no base-path configuration to keep in sync.
 *
 *    The runtime is Stencil's MINIFIED lazy build (`dist/md3`), not `dist/esm`
 *    — the latter is unminified bundler input and is ~2x the bytes. Source maps
 *    are excluded for the same reason `scripts/sync-docs-runtime.mjs` excludes
 *    them: they are the bulk of the payload and nothing serves them.
 *
 * 2. DECLARATIVE SHADOW DOM. Plain HTML has no server, so the page shipped
 *    inert `<md-*>` tags that stayed zero-height until the loader booted. The
 *    emitted HTML is run through `@awc-ui/core/hydrate` with
 *    `serializeShadowRoot: 'declarative-shadow-dom'` — the same primitive the
 *    Astro middleware and the SvelteKit/Nuxt server hooks use — so the file on
 *    disk already contains each component's shadow tree.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToString } from '@awc-ui/core/hydrate';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, '../..');
const outDir = resolve(appDir, 'dist');

/** Mount path this build is verified against. Only used for the report — the
 *  output is deliberately path-agnostic, so changing it needs no rebuild. */
const MOUNT = process.env.BASE_PATH ?? '/showcase/SPIKE/html/';

const coreDist = resolve(repoRoot, 'packages/core/dist/md3');
const tokensCss = resolve(repoRoot, 'packages/tokens/src/tokens.css');
for (const p of [coreDist, tokensCss]) {
  if (!existsSync(p)) {
    console.error(`[hearthwise] missing ${p} — build core first: pnpm --filter @awc-ui/core build`);
    process.exit(1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Stencil resolves its lazy chunks against the loader module's own URL, so a
// relative `./awc/md3/md3.esm.js` keeps working under any mount path.
cpSync(coreDist, resolve(outDir, 'awc/md3'), {
  recursive: true,
  filter: (src) => !src.endsWith('.map'),
});
cpSync(tokensCss, resolve(outDir, 'tokens.css'));
cpSync(resolve(appDir, 'app.css'), resolve(outDir, 'app.css'));
cpSync(resolve(appDir, 'app.js'), resolve(outDir, 'app.js'));

let html = readFileSync(resolve(appDir, 'index.html'), 'utf8');

const rewrites = [
  ['node_modules/@awc-ui/tokens/src/tokens.css', './tokens.css'],
  // The `loader/` entry re-exports the unminified `dist/esm` build; point at the
  // minified lazy bundle that was actually copied instead.
  [
    /<script type="module">\s*import \{ defineCustomElements \}[\s\S]*?<\/script>/,
    '<script type="module" src="./awc/md3/md3.esm.js"></script>',
  ],
  ['href="app.css"', 'href="./app.css"'],
  ['src="app.js"', 'src="./app.js"'],
];
for (const [from, to] of rewrites) {
  if (typeof from === 'string' ? !html.includes(from) : !from.test(html)) {
    console.error(`[hearthwise] rewrite target not found in index.html: ${from}`);
    process.exit(1);
  }
  html = html.replace(from, to);
}

const { html: hydrated, diagnostics } = await renderToString(html, {
  fullDocument: true,
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
});

const errors = (diagnostics ?? []).filter((d) => d.level === 'error');
if (errors.length) {
  for (const d of errors) console.error(`[hearthwise] hydrate error: ${d.messageText}`);
  process.exit(1);
}

writeFileSync(resolve(outDir, 'index.html'), hydrated);

const dsd = (hydrated.match(/shadowrootmode/g) ?? []).length;
console.log(`[hearthwise] dist/ built for mount ${MOUNT}`);
console.log(`[hearthwise] index.html: ${(hydrated.length / 1024).toFixed(1)} kB, ${dsd} shadowrootmode roots`);
if (dsd === 0) {
  console.error('[hearthwise] no declarative shadow DOM emitted — hydrate step did nothing');
  process.exit(1);
}
