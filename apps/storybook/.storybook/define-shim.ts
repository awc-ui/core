/**
 * Build-only replacement for `@awc-ui/core/define` (aliased in main.ts).
 *
 * Loads the COPIED Stencil lazy runtime (assets/awc-esm/, shipped by the
 * awc-copy-stencil-lazy-runtime plugin) entirely at runtime, so nothing of
 * Stencil is bundled: exactly one runtime executes, and the entry chunks it
 * fetches are its own siblings. Bundling the loader instead splits
 * registration and entry execution across two runtimes and every shadow
 * root renders empty.
 *
 * The dynamic import URL is computed, so Rollup cannot inline it; custom
 * elements upgrade whenever definition lands — Stencil handles the late
 * upgrade, matching how the dev path behaves.
 */
const base = new URL('awc-esm/', import.meta.url);

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('md3.css', base).href;
document.head.append(css);

import(/* @vite-ignore */ new URL('loader.js', base).href)
  .then((m) => m.defineCustomElements(window))
  .catch((err) => console.error('[AWC UI] runtime loader failed:', err));

export {};
