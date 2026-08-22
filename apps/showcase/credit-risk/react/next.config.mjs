/**
 * Static export, mounted under a base path.
 *
 * The showcase ships as six sibling builds under
 * `awc-ui.dev/showcase/credit-risk/<framework>/`, so every asset URL and every
 * `<Link>` has to carry `/showcase/credit-risk/react`. `basePath` handles the
 * router; `assetPrefix` handles `_next/*`. Both are needed — with only
 * `basePath`, an export served from a sub-path still requests `/_next/...` from
 * the site root. `trailingSlash: true` makes every route a directory with an
 * `index.html`, which is what a plain static file server needs (and what the
 * dock's `buildFrameworkUrl` preserves when it swaps the framework segment).
 *
 * `images.unoptimized` is mandatory: the default Image Optimization API is a
 * server route and `output: 'export'` refuses to build without it.
 *
 * NOTE: `@awc-ui/core` is deliberately NOT in `transpilePackages`. Only the
 * token stylesheet is imported from it; the components arrive through Stencil's
 * own lazy runtime, loaded from a static URL so no bundler ever sees it. See
 * `app/layout.tsx`.
 */

/** Keep in sync with BASE_PATH in lib/routes.ts. */
const BASE_PATH = '/showcase/credit-risk/react';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AWC_BASE_PATH: BASE_PATH,
  },
};

export default nextConfig;
