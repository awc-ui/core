import { defineConfig } from 'astro/config';

export default defineConfig({
  // The custom-element package is prebuilt; don't let Vite pre-bundle it.
  vite: { optimizeDeps: { exclude: ['@awc-ui/core'] } },
});
