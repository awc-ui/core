import { defineConfig } from 'astro/config';

/**
 * Static export, served from a sub-path on awc-ui.dev.
 *
 * `base` must agree with `createRoutes('astro').basePath` in the kit — that is
 * the single fact this build declares about itself, and every link is derived
 * from it. `trailingSlash: 'always'` matches the other five builds: each route
 * becomes a directory with an `index.html`, which is the only shape a static
 * host can serve without a redirect it cannot perform.
 *
 * `output: 'static'` and the DSD middleware are not in tension. Astro runs
 * middleware for prerendered pages at BUILD time, so `src/middleware.ts` gets
 * to post-process every page's HTML exactly once, during the build, and the
 * deployed artifact is plain HTML with the shadow roots already in it.
 */
export default defineConfig({
  base: '/showcase/credit-risk/astro',
  output: 'static',
  trailingSlash: 'always',
  // No sitemap, no prefetch: this app is a demo inside a docs site, and the
  // docs site publishes its own sitemap covering it.
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  vite: {
    // The component package is prebuilt and resolves its own lazy chunks at
    // runtime by URL. Letting Vite pre-bundle it rewrites those URLs to
    // /@fs/… paths that do not exist in the export.
    optimizeDeps: { exclude: ['@awc-ui/core'] },
  },
});
