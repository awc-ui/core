import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

/**
 * WHICH BUILD THIS IS — the one local fact, declared once.
 *
 * `createRoutes` is typed against the kit's `Framework` union, so this line
 * only compiles while `nuxt` is registered in `FRAMEWORKS`. That is worth
 * keeping: renaming this segment without registering it centrally becomes a
 * type error, rather than a build that quietly serves itself at a path the
 * dock does not offer and nothing links to.
 */
const FRAMEWORK = 'nuxt';

const { basePath } = createRoutes(FRAMEWORK);

/**
 * A RUNTIME SERVER, mounted under a sub-path.
 *
 * This build used to be `nuxi generate`: `ssr: true`, but with a
 * `nitro.prerender` block that rendered all 95 routes to files at build time
 * and shipped them. The HTML it produced was real and complete — and
 * indistinguishable from a live render, because a file on disk answers "was
 * this rendered on the server?" exactly the way a running process does. It is
 * now a Nitro `node-server`: each of the six screens is rendered when it is
 * asked for, and `scripts/verify-ssr.mjs` at the repo root proves it by asking
 * twice and comparing.
 *
 * WHAT WENT
 *
 * - `nitro.prerender` — the whole point of the change. No route list, no
 *   `crawlLinks`, no `failOnError`, and no `@awc-ui/showcase-kit/data` import
 *   here to enumerate 95 paths: nothing is rendered ahead of time, so nothing
 *   can be stale and nothing can be served twice from the same bytes.
 * - `nuxi generate` → `nuxi build`. `generate` forces `nitro.static` on and
 *   emits `.output/public/` only; `build` emits `.output/server/index.mjs`,
 *   which is what `pnpm start` runs.
 *
 * WHAT STAYED, AND WHY
 *
 * - `app.baseURL`. The builds are siblings under
 *   `awc-ui.dev/showcase/credit-risk/<framework>/`, so the router still carries
 *   the mount, and Nuxt derives both the build-asset URLs (`…/nuxt/_nuxt/…`)
 *   and the `public/` mount from it — which is what keeps the absolute URL
 *   Stencil's lazy runtime needs pointing at a file that exists. It must agree
 *   with `createRoutes(FRAMEWORK).basePath`; Nuxt wants the trailing slash and
 *   the kit's `basePath` does not carry one, so it is appended here rather than
 *   the path being written out a second time.
 * - `ssr: true`, which now means what it says.
 * - The `md-*` / `awc-*` custom-element compiler option: without it Vue warns
 *   on every tag at compile time and tries to resolve them as components at
 *   runtime, on the server as well as in the browser.
 *
 * NO ROUTE RULES. Not `prerender`, not `swr`, not `isr`, not `cache` — every
 * screen is dynamic, and a full-page cache would make the second request return
 * the first request's document, which is precisely the thing this build exists
 * to stop doing. `server/plugins/awc-ssr-dsd.ts` additionally stamps
 * `cache-control: no-store` on every rendered document, so nothing downstream
 * keeps one either.
 */
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: true,
  devtools: { enabled: false },
  telemetry: false,

  app: {
    baseURL: `${basePath}/`,
    head: {
      htmlAttrs: { lang: 'en', dir: 'ltr' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap',
        },
      ],
    },
  },

  /**
   * `md-*` and `awc-*` are custom elements, not Vue components. Without this
   * Vue warns on every single one at compile time and tries to resolve them as
   * components at runtime.
   */
  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => tag.startsWith('md-') || tag.startsWith('awc-'),
    },
  },

  css: ['@awc-ui/core/css/tokens.css', '@awc-ui/showcase-kit/credit-risk/app.css'],

  nitro: {
    /**
     * A real Node process. `.output/server/index.mjs` listens on
     * `NITRO_PORT || PORT || 3000`; `server.mjs` at the app root is the thin
     * wrapper that defaults that to 4611 — the port `scripts/verify-ssr.mjs`
     * expects — while still honouring `$PORT`.
     */
    preset: 'node-server',

    /*
     * NO `externals` BLOCK, and that is deliberate rather than forgotten.
     *
     * `starters/nuxt` and `apps/example-nuxt` both carry
     * `externals: { external: ['@awc-ui/core/hydrate'] }` to keep that large
     * Node-only bundle — a whole DOM implementation plus every component's
     * server render — out of the Nitro chunk. It does nothing here, and it was
     * measured rather than assumed: the built `chunks/nitro/nitro.mjs` is 4.03
     * MB with the line and 4.03 MB without it. In those two packages
     * `@awc-ui/core` is an installed dependency; here it is a `workspace:*`
     * link that resolves to `packages/core/`, outside any `node_modules`, so
     * Nitro's externals tracing cannot treat it as a package to leave behind
     * and inlines it either way. The result is a self-contained
     * `.output/server/` that needs nothing from the workspace at run time,
     * which for a server that gets copied to a host is the better end anyway.
     */
  },

  vite: {
    // The component package is prebuilt and resolves its own lazy chunks at
    // runtime by URL. Letting Vite pre-bundle it rewrites those URLs to /@fs/…
    // paths that do not exist in the output. Only the token stylesheet is used
    // from it; the components arrive from `public/awc-runtime/`.
    optimizeDeps: { exclude: ['@awc-ui/core'] },
  },
});
