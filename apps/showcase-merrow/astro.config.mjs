import { defineConfig } from 'astro/config';

// PHASE 0 SPIKE: prove this app builds to static output mountable at a subpath
// under the docs site. `base` prefixes every emitted asset URL (/_astro/...);
// in-app links must be prefixed manually via `withBase()` (src/lib/base.ts).
export default defineConfig({
  base: '/showcase/SPIKE/astro/',
  // 'ignore' (the default) emits directory-format pages and links without a
  // trailing slash, which Netlify's static server resolves to index.html.
  // Pin it explicitly so the subpath behaviour is not host-dependent.
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // The custom-element package is prebuilt; don't let Vite pre-bundle it.
  vite: { optimizeDeps: { exclude: ['@awc-ui/core'] } },
});
