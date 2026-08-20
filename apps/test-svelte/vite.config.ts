import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Pin a stable, distinct port so this playground can run in parallel with
// the other framework playgrounds (HTML=5170, React=5171, Vue=5172,
// Svelte=5173, Angular=4200). See the React playground's vite.config for
// the rationale; `strictPort: true` here for the same reason.
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
});
