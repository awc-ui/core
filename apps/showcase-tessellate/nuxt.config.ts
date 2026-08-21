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
  },
});
