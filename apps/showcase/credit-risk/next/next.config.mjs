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
 * bundler ever sees it. The SERVER additionally loads `@awc-ui/core/hydrate` —
 * in `server.mjs` on the Node target, and in `app/awc-dsd/route.ts` on the
 * Netlify one. See `app/layout.tsx`.
 *
 * TWO TARGETS, ONE CONFIG
 *
 * `AWC_TARGET=netlify` selects the second build. It is an environment variable
 * read here rather than a `next.config.netlify.mjs`, because everything the two
 * targets MUST agree on — the base path, `trailingSlash`, and the per-request
 * `<meta>` stamped in `app/layout.tsx` — is then physically the same code, and
 * the only difference is the three lines below that genuinely differ:
 *
 *  - `AWC_DSD_MIDDLEWARE` arms `middleware.ts`, which rewrites document
 *    requests into the Node route handler that runs the hydrate pass. The Node
 *    target leaves it disarmed because `server.mjs` already does that job.
 *  - `output: 'standalone'` is what Netlify's Next runtime consumes. The plugin
 *    sets `NEXT_PRIVATE_STANDALONE` for itself, so this is belt and braces —
 *    and it is what makes `pnpm build:netlify` reproduce the deployed artefact
 *    locally.
 *  - `outputFileTracingRoot` because this is a pnpm workspace. Left unset, the
 *    trace root is inferred from the app directory and the traced copy misses
 *    everything resolved through the root `node_modules/.pnpm` store.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Keep in sync with BASE_PATH in lib/routes.ts. */
const BASE_PATH = '/showcase/credit-risk/next';

const NETLIFY_TARGET = process.env.AWC_TARGET === 'netlify';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: BASE_PATH,
  trailingSlash: true,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AWC_BASE_PATH: BASE_PATH,
    AWC_DSD_MIDDLEWARE: NETLIFY_TARGET ? '1' : '0',
  },
  ...(NETLIFY_TARGET
    ? {
        output: 'standalone',
        experimental: { outputFileTracingRoot: REPO_ROOT },
      }
    : {}),
};

export default nextConfig;
