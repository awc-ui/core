/**
 * A single-page application, mounted under a base path.
 *
 * The six framework builds of this vertical are siblings under
 * `awc-ui.dev/showcase/credit-risk/<framework>/`, so every asset URL, every
 * link and the component runtime's own import specifier have to carry the
 * mount. `base` does the first two; the `awc-showcase-head` plugin below does
 * the third.
 *
 * WHY THE MOUNT IS DERIVED FROM THE KIT rather than written down: `src/lib/routes.ts`
 * derives it the same way, and the two have to agree or `withBase()` produces
 * links to a path Vite never emitted. It cannot simply IMPORT that module — the
 * `@/*` alias this config declares does not exist yet while this config is
 * being loaded — so both read `SHOWCASE_BASE` from `@awc-ui/showcase-kit/credit-risk`
 * and append the same framework id. One source, two short derivations.
 *
 * `outDir` is Vite's default `dist/`, which is what `scripts/build-showcase.mjs`
 * stages into `apps/docs/public/showcase/credit-risk/react/`.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/data';
import { en } from '@awc-ui/showcase-kit/i18n';
import { SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';

/** Keep in sync with FRAMEWORK in src/lib/routes.ts. */
const FRAMEWORK = 'react';
const BASE_PATH = `${SHOWCASE_BASE}/${FRAMEWORK}`;

/**
 * Fill in the parts of `index.html` that belong to the kit.
 *
 * There is no server to compose the document, so `<head>` is literal markup —
 * but four of the things in it are facts the kit owns, and a copy here would
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
    __AWC_PREBOOT__: PREBOOT_SCRIPT,
    __AWC_REPORTING_DATE__: REPORTING_DATE,
    __AWC_TITLE__: `${en['app.brand']} — ${en['app.title']}`,
    __AWC_DESCRIPTION__: en['app.subtitle'],
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
 * `index.html` carries about four kilobytes of why — the head ordering, the
 * `display: contents` mount, why the runtime is loaded by a classic script —
 * and all of it is for whoever edits that file, none of it for the browser.
 * Vite does not minify HTML, so without this every visitor downloads the
 * rationale, on every one of the 95 routes it is copied into. The build this
 * replaced shipped none of it: JSX comments never reach the output. Measured:
 * 6.04 kB per document before, 2.36 kB after.
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

export default defineConfig({
  base: `${BASE_PATH}/`,
  plugins: [showcaseHead(), stripHtmlComments(), react()],
  resolve: {
    // The same `@/*` alias the Next build used, so every copied screen keeps
    // its import specifiers unchanged.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 4327,
  },
  build: {
    // One entry, one chunk — Vite's default, and left alone deliberately. The
    // six screens share almost every import (the kit's fixture and selectors,
    // the shell, the two tables, the chart wrappers), so splitting them per
    // route would trade one 367 kB request for six heavily overlapping ones,
    // and each in-app navigation would then wait on a network round trip that
    // it does not wait on now.
    //
    // No source maps: `dist/` is staged into the docs site's `public/`, where
    // they would be published alongside it. `pnpm dev` has them.
    sourcemap: false,
  },
});
