// AWC UI × Nuxt 3 — SSR with Declarative Shadow DOM.
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  // Server + client Vue compilers must accept the `md-*` custom elements.
  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => tag.startsWith('md-'),
    },
  },
  app: {
    // Mounted under the docs site at awc-ui.dev/showcase/SPIKE/nuxt/.
    // Nuxt joins buildAssetsDir (default `/_nuxt/`) onto this, so every emitted
    // asset URL becomes /showcase/SPIKE/nuxt/_nuxt/...
    baseURL: '/showcase/SPIKE/nuxt/',
    head: {
      title: 'Tessellate Academy',
      link: [
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap' },
      ],
    },
  },
  // Global MD3 tokens (--md-sys-*) referenced by the components' shadow styles,
  // then the app's own token-based page styles.
  css: ['@awc-ui/core/css/tokens.css', '~/assets/css/app.css'],
  // The hydrate module is a large Node-only bundle; keep it external to the
  // server build so Nitro requires it at runtime instead of inlining it.
  nitro: {
    externals: { inline: [], external: ['@awc-ui/core/hydrate'] },
    // Fully static output: every route is rendered to a real index.html (which is
    // what carries the Declarative Shadow DOM). The dynamic /courses/:slug routes
    // are listed explicitly rather than relying on the crawler, because their
    // links live inside web-component shadow roots.
    prerender: {
      crawlLinks: true,
      failOnError: true,
      routes: [
        '/',
        '/progress',
        '/quiz',
        '/courses/geometric-pattern-design',
        '/courses/svg-data-visualization',
        '/courses/color-theory-in-practice',
        '/courses/typography-systems',
        '/courses/creative-coding-fundamentals',
        '/courses/motion-design-principles',
      ],
    },
  },
});
