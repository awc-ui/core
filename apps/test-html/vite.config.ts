import { defineConfig } from 'vite';

// Pin a stable, distinct port so this playground can run in parallel with
// the framework playgrounds (HTML=5170, React=5171, Vue=5172, Svelte=5173,
// Angular=4200). `strictPort` makes Vite fail loudly instead of silently
// hopping to the next free port — predictable URLs per framework matter
// more here than dev convenience, because the whole point of these apps
// is to inspect each framework on a known address side-by-side.
export default defineConfig({
  server: {
    port: 5170,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 5170,
    strictPort: true,
    host: '127.0.0.1',
  },
});
