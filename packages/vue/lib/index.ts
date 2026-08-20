import type { App } from 'vue';
import { defineCustomElements } from '@awc-ui/core/loader';

/**
 * AwcUiVue plugin
 *
 * Install in your Vue 3 app:
 *
 * @example
 * // main.ts
 * import { createApp } from 'vue'
 * import App from './App.vue'
 * import { AwcUiVue } from '@awc-ui/vue'
 *
 * const app = createApp(App)
 * app.use(AwcUiVue)
 * app.mount('#app')
 */
export const AwcUiVue = {
  install(app: App) {
    // `install` runs on the server too (e.g. Nuxt `app.use`), where `window` is
    // undefined — guard so it doesn't throw ReferenceError. Registration is a
    // client-only step; for SSR markup use `@awc-ui/core/hydrate`. NB: under Nuxt
    // also set `isCustomElement` in the build's vue compiler options
    // (`vue.compilerOptions.isCustomElement`) so the server compiler accepts `md-*`.
    if (typeof window !== 'undefined') {
      defineCustomElements(window);
    }

    app.config.compilerOptions = app.config.compilerOptions || {};
    app.config.compilerOptions.isCustomElement = (tag: string) =>
      tag.startsWith('md-');
  },
};

export * from './components.js';
