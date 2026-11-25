import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { awcLazyRuntime } from '../../scripts/vite-awc-runtime.mjs';

// Pin a stable, distinct port so this playground can run in parallel with
// the other framework playgrounds (HTML=5170, React=5171, Vue=5172,
// Svelte=5173, Angular=4200). `strictPort` makes Vite fail loudly instead
// of silently hopping to the next free port, which would defeat the point
// of having a predictable URL per framework.
export default defineConfig({
  plugins: [react(), awcLazyRuntime({ initialTags: ['md-button', 'md-checkbox', 'md-text-field', 'md-select', 'md-loading-indicator'] })],
  server: {
    port: 5171,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 5171,
    strictPort: true,
    host: '127.0.0.1',
  },
});
