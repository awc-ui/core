import { defineConfig } from 'astro/config';

export default defineConfig({
  // Preserve the existing spacing between inline elements after the Astro 7 upgrade.
  compressHTML: true,
  // The custom-element package is prebuilt; don't let Vite pre-bundle it.
  vite: { optimizeDeps: { exclude: ['@awc-ui/core'] } },
});
