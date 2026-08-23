import { getCounterparties, getFacilities, getSectors } from '@awc-ui/showcase-kit/data';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath, route } = createRoutes('vue');

/**
 * Every screen, read from the fixture rather than a hard-coded list — so adding
 * a counterparty to the kit adds a page here without a second edit. Nitro could
 * also find most of these by crawling links, but crawling silently emits 94
 * routes instead of 95 when one loses its last inbound link, and an explicit
 * list fails loudly instead.
 */
const routes = [
  route.overview(),
  route.watchlist(),
  route.stress(),
  ...getSectors().map((sector) => route.sector(sector.id)),
  ...getCounterparties().map((cp) => route.counterparty(cp.id)),
  ...getFacilities().map((facility) => route.facility(facility.id)),
];

/**
 * Static generation, mounted under a sub-path.
 *
 * `app.baseURL` must agree with `createRoutes('vue').basePath` in the kit —
 * that is the single fact this build declares about itself, and every link is
 * derived from it. Nuxt wants the trailing slash; the kit's `basePath` does not
 * carry one, which is why it is appended here rather than written out again.
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
    prerender: {
      // Every route is declared, so crawling would only ever re-find them.
      crawlLinks: false,
      routes,
      failOnError: true,
    },
  },

  vite: {
    // The component package is prebuilt and resolves its own lazy chunks at
    // runtime by URL. Letting Vite pre-bundle it rewrites those URLs to /@fs/…
    // paths that do not exist in the output. Only the token stylesheet is used
    // from it; the components arrive from `public/awc-runtime/`.
    optimizeDeps: { exclude: ['@awc-ui/core'] },
  },
});
