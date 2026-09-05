/**
 * A single-page application, mounted under a base path.
 *
 * The framework builds of this vertical are siblings under
 * `/showcase/music/<framework>/`, so every asset URL, every link and the
 * component runtime's own import specifier have to carry the mount. `base` does
 * the first two; the `awc-showcase-head` plugin below does the third.
 *
 * WHY THE MOUNT IS DERIVED FROM THE KIT rather than written down: `src/lib/routes.ts`
 * derives it the same way, and the two have to agree or `withBase()` produces
 * links to a path Vite never emitted. It cannot simply IMPORT that module — the
 * `$lib` alias this config declares does not exist yet while this config is
 * being loaded — so both read `SHOWCASE_BASE` from `@awc-ui/showcase-kit/music`
 * and append the same framework id. One source, two short derivations.
 *
 * `outDir` is Vite's default `dist/`, which is what `scripts/build-showcase.mjs`
 * stages into `apps/docs/public/showcase/music/svelte/`.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { en } from '@awc-ui/showcase-kit/i18n';
import { FRAMEWORKS, REPORTING_DATE, SHOWCASE_BASE } from '@awc-ui/showcase-kit/music';
import { serveSiblingFrameworks } from '../../../../scripts/lib/serve-sibling-frameworks.mjs';

/** Keep in sync with `createRoutes(...)` in src/lib/routes.ts. */
const FRAMEWORK = 'svelte';
const BASE_PATH = `${SHOWCASE_BASE}/${FRAMEWORK}`;

/**
 * Fill in the parts of `index.html` that belong to the kit.
 *
 * There is no server to compose the document, so `<head>` is literal markup —
 * but five of the things in it are facts the kit owns, and a copy here would
 * rot against it silently. This substitutes them at build time and in dev, so
 * `index.html` stays a template: the preboot IIFE, the reporting date, the
 * document title and description from the English dictionary, and the mount
 * path the component runtime is imported from.
 *
 * `order: 'pre'` so this runs before Vite rewrites asset URLs — the tokens sit
 * inside an inline script and a `<title>`, neither of which Vite touches, but
 * substituting first keeps the ordering out of the question entirely.
 */
function showcaseHead(): Plugin {
  const tokens: Record<string, string> = {
    __AWC_REPORTING_DATE__: REPORTING_DATE,
    __AWC_TITLE__: `${en['music.app.brand']} — ${en['music.app.title']}`,
    __AWC_DESCRIPTION__: en['music.screen.home.subtitle'],
    __AWC_BASE__: BASE_PATH,
  };
  return {
    name: 'awc-showcase-head',
    transformIndexHtml: {
      order: 'pre',
      // A function replacer, so nothing in the substituted text is read as a
      // `$1`-style backreference.
      handler: (html) => html.replace(/__AWC_[A-Z_]+__/g, (match) => tokens[match] ?? match),
    },
  };
}

/**
 * Drop the HTML comments from the shipped document.
 *
 * `index.html` carries several kilobytes of why — the head ordering, the
 * `display: contents` mount, why the runtime is loaded by a classic script —
 * and all of it is for whoever edits that file, none of it for the browser.
 * Vite does not minify HTML, so without this every visitor downloads the
 * rationale, on every route the fan-out copies it into. Svelte's own markup
 * comments never reach the output, so this is the only place the problem
 * arises.
 *
 * `order: 'post'` so this runs last, after Vite has injected the entry script
 * and the stylesheet link. Build only — in dev the comments are worth having in
 * the elements panel.
 */
function stripHtmlComments(): Plugin {
  return {
    name: 'awc-strip-html-comments',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          // NON-greedy, so two adjacent comments do not collapse into one match
          // that swallows the markup between them. There is no comment inside a
          // `<script>` here to protect — the runtime injector uses JS comments,
          // which this pattern cannot see.
          .replace(/<!--[\s\S]*?-->/g, '')
          // The comments sat on their own lines; removing them leaves the blank
          // lines behind.
          .replace(/\n\s*\n+/g, '\n'),
    },
  };
}

/**
 * Serve the vertical's OTHER builds from their staged output, so the dock's
 * framework switcher works from this dev server instead of dead-ending on
 * Vite's "public base URL" page. Only `svelte` live-reloads here; see the
 * plugin's own header for why that trade is the right way round.
 */
const siblings = () =>
  serveSiblingFrameworks({
    repoRoot: fileURLToPath(new URL('../../../../', import.meta.url)),
    vertical: 'social',
    framework: FRAMEWORK,
    siblings: FRAMEWORKS,
  });

/**
 * Emit the head scripts as EXTERNAL files, after Vite has finished with the
 * document. An inline `<script>` is refused by `script-src 'self'`, and the one
 * that was blocked here loads the component runtime — so under an enterprise
 * policy nothing upgraded at all. `order: 'post'` keeps the runtime tag away
 * from Vite's HTML pass, which would otherwise treat it as an entry to bundle
 * and send Stencil's lazy loader hunting for chunks under `/assets/`.
 */
function externalHeadScripts(): Plugin {
  return {
    name: 'awc-external-head-scripts',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace('<!--__AWC_PREBOOT_SCRIPT__-->', `<script src="${BASE_PATH}/preboot.js"></script>`)
          .replace(
            '<!--__AWC_RUNTIME_SCRIPT__-->',
            `<script type="module" src="${BASE_PATH}/awc-runtime/md3/md3.esm.js"></script>`,
          ),
    },
  };
}

export default defineConfig({
  base: `${BASE_PATH}/`,
  plugins: [showcaseHead(), externalHeadScripts(), stripHtmlComments(), svelte(), siblings()],
  resolve: {
    // The `$lib` alias the credit-risk Svelte build uses, kept so the two
    // Svelte apps read identically file for file.
    alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) },
  },
  // The component package is prebuilt and resolves its own lazy chunks at
  // runtime by URL. Letting Vite pre-bundle it rewrites those URLs to /@fs/…
  // paths that do not exist in the build output. Only the token stylesheets are
  // imported from it in the browser graph; the components arrive from
  // `public/awc-runtime/`.
  optimizeDeps: { exclude: ['@awc-ui/core'] },
  server: {
    // The credit-risk Svelte build owns 4330; this one sits ten above it (the
    // wealth convention: credit-risk sibling's port + 10) so both verticals can
    // run at once during a comparison.
    port: 4380,
  },
  build: {
    /* No `data:` asset URIs — Vite inlines small files by default, and an
       enterprise `font-src 'self'` refuses the font subsets that produced. */
    assetsInlineLimit: 0,
    // One entry, one chunk — Vite's default, and left alone deliberately. The
    // six screens share almost every import (the kit's fixture and selectors,
    // the frame, the tables, the chart wrappers), so splitting them per route
    // would trade one request for six heavily overlapping ones, and each
    // in-app navigation would then wait on a network round trip that it does
    // not wait on now.
    //
    // No source maps: `dist/` is staged into the docs site's `public/`, where
    // they would be published alongside it. `pnpm dev` has them.
    sourcemap: false,
  },
});
