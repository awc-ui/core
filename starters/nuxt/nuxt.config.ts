// AWC UI × Nuxt 3 — SSR with Declarative Shadow DOM.
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  // Server + client Vue compilers must accept the `md-*` custom elements.
  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => tag.startsWith('md-'),
    },
  },
  // Global MD3 tokens (--md-sys-*) referenced by the components' shadow styles.
  css: ['@awc-ui/tokens/tokens.css'],
  // The hydrate module is a large Node-only bundle; keep it external to the
  // server build so Nitro requires it at runtime instead of inlining it.
  nitro: {
    externals: { inline: [], external: ['@awc-ui/core/hydrate'] },
  },
});
