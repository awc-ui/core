/**
 * A single-page application, mounted under a base path.
 *
 * The framework builds of this vertical are siblings under
 * `/showcase/community/<framework>/`, so every asset URL, every link and the
 * component runtime's own import specifier have to carry the mount. `base` does
 * the first two; the `awc-showcase-head` plugin below does the third.
 *
 * WHY THE MOUNT IS DERIVED FROM THE KIT rather than written down: `src/lib/routes.ts`
 * derives it the same way, and the two have to agree or `withBase()` produces
 * links to a path Vite never emitted. It cannot simply IMPORT that module — the
 * `@/*` alias this config declares does not exist yet while this config is
 * being loaded — so both read `SHOWCASE_BASE` from `@awc-ui/showcase-kit/community`
 * and append the same framework id. One source, two short derivations.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { en } from '@awc-ui/showcase-kit/i18n';
import { FRAMEWORKS, REPORTING_DATE, SHOWCASE_BASE } from '@awc-ui/showcase-kit/community';
import { serveSiblingFrameworks } from '../../../../scripts/lib/serve-sibling-frameworks.mjs';

/** Keep in sync with FRAMEWORK in src/lib/routes.ts. */
const FRAMEWORK = 'react';
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
    __AWC_TITLE__: `${en['community.app.brand']} — ${en['community.app.title']}`,
    __AWC_DESCRIPTION__: en['community.screen.feed.subtitle'],
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
 * Emit the two head scripts as EXTERNAL files, after Vite has finished with the
 * document.
 *
 * Both used to be inline, and both are refused outright by an enterprise
 * Content-Security-Policy: `script-src 'self'` without `'unsafe-inline'` blocks
 * an inline `<script>` whatever it contains. Measured under that policy before
 * this change, the blocked script was the one that loads the component runtime,
 * so nothing upgraded at all — the build was not merely non-compliant, it did
 * not run.
 *
 * WHY A POST TRANSFORM AND A COMMENT PLACEHOLDER. The runtime tag is the whole
 * reason the injector existed: Vite treats a `<script type="module" src>` in
 * `index.html` as an entry to resolve and bundle, which sends Stencil's lazy
 * loader hunting for its sibling chunks under `/assets/` where nothing was
 * written. Running at `order: 'post'` puts the tag into the document after
 * Vite's own HTML pass has been and gone, so it is emitted verbatim and the
 * runtime is fetched from `public/` exactly as it always was — the earlier
 * comment's reasoning, satisfied without an inline script.
 *
 * A comment is the placeholder because Vite does not read inside one, and
 * `stripHtmlComments()` below runs after this and clears the rest.
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

/**
 * Drop the HTML comments from the shipped document.
 *
 * `index.html` carries several kilobytes of why — the head ordering, the
 * `display: contents` mount, why the runtime is loaded by a classic script —
 * and all of it is for whoever edits that file, none of it for the browser.
 * Vite does not minify HTML, so without this every visitor downloads the
 * rationale. Build only: in dev the comments are worth having in the elements
 * panel.
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
          // that swallows the markup between them.
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\n\s*\n+/g, '\n'),
    },
  };
}

/**
 * Serve the vertical's OTHER builds from their staged output, so the dock's
 * framework switcher works from this dev server instead of dead-ending on
 * Vite's "public base URL" page. Only `react` live-reloads here; see the
 * plugin's own header for why that trade is the right way round.
 */
const siblings = () =>
  serveSiblingFrameworks({
    repoRoot: fileURLToPath(new URL('../../../../', import.meta.url)),
    vertical: 'social',
    framework: FRAMEWORK,
    siblings: FRAMEWORKS,
  });

export default defineConfig({
  base: `${BASE_PATH}/`,
  plugins: [showcaseHead(), externalHeadScripts(), stripHtmlComments(), react(), siblings()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Ten above Lyra's 4367, which is ten above banking's 4357 — one band per
    // vertical, so every build of every vertical can run at
    // once during a comparison.
    port: 4377,
  },
  build: {
    /*
     * NO ASSET IS INLINED AS A `data:` URI.
     *
     * Vite inlines anything under 4 kB by default, which turned the smaller
     * self-hosted font subsets into `data:` URLs inside the stylesheet — and an
     * enterprise Content-Security-Policy that grants `font-src 'self'` refuses
     * them, 36 violations on a single screen. Emitting every asset as a file
     * costs a handful of requests and keeps the policy free of `data:`.
     */
    assetsInlineLimit: 0,
    // One entry, one chunk — Vite's default, and left alone deliberately. The
    // six screens share almost every import (the kit's fixture and selectors,
    // the shell, the tables, the chart wrappers), so splitting them per route
    // would trade one request for six heavily overlapping ones, and each
    // in-app navigation would then wait on a network round trip that it does
    // not wait on now.
    sourcemap: false,
  },
});
