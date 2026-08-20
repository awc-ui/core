import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Pin a stable, distinct port so this playground can run in parallel with
// the other framework playgrounds (HTML=5170, React=5171, Vue=5172,
// Svelte=5173, Angular=4200). See the React playground's vite.config for
// the rationale; `strictPort: true` here for the same reason.
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('md-'),
        },
      },
    }),
  ],
  server: {
    port: 5172,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 5172,
    strictPort: true,
    host: '127.0.0.1',
  },
});
