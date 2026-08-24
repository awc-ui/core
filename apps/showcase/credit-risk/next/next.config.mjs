/**
 * A RUNTIME server, mounted under a base path.
 *
 * This build used to be a static export served at
 * `/showcase/credit-risk/react/`, which made the showcase advertise "React"
 * while shipping a Next.js `output: 'export'` — six static builds, no SSR
 * anywhere. It now renders per request and lives at
 * `/showcase/credit-risk/next/`; the genuine React SPA takes `/react/`.
 *
 * WHAT WENT, AND WHY
 *
 * - `output: 'export'` — the whole point of the change. Every route now
 *   declares `dynamic = 'force-dynamic'` and is rendered on demand.
 * - `images: { unoptimized: true }` — only ever present because the Image
 *   Optimization API is a server route and `output: 'export'` refuses to build
 *   with it enabled. Nothing here uses `next/image`, and there is a server now
 *   either way.
 * - `assetPrefix` — an export served from a sub-path still asks for
 *   `/_next/...` at the site root, so the prefix had to be written twice. A
 *   running server with `basePath` set already serves and emits
 *   `${basePath}/_next/...`; the second declaration is now noise.
 *
 * WHAT STAYED
 *
 * - `basePath` — the builds are siblings under
 *   `awc-ui.dev/showcase/credit-risk/<framework>/`, so the router still has to
 *   carry the mount. It is also what puts `public/` under the mount, which is
 *   how `awc-runtime/md3/md3.esm.js` keeps the absolute URL Stencil's lazy
 *   runtime needs.
 * - `trailingSlash: true` — the kit's `route.*` all end in `/`, and the dock's
 *   `buildFrameworkUrl` preserves the shape when it swaps the framework
 *   segment. Changing it would desynchronise this build from the others.
 *
 * NOTE: `@awc-ui/core` is deliberately NOT in `transpilePackages`. Only the
 * token stylesheet is imported from it in the browser graph; the components
 * arrive through Stencil's own lazy runtime, loaded from a static URL so no
 * bundler ever sees it. The SERVER additionally loads `@awc-ui/core/hydrate`
 * in `server.mjs`, outside the bundle entirely. See `app/layout.tsx`.
 */

/** Keep in sync with BASE_PATH in lib/routes.ts. */
const BASE_PATH = '/showcase/credit-risk/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: BASE_PATH,
  trailingSlash: true,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AWC_BASE_PATH: BASE_PATH,
  },
};

export default nextConfig;
