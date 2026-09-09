import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@stencil/react-output-target/runtime',
        replacement: local('./node_modules/@stencil/react-output-target/dist/runtime.js'),
      },
      {
        find: '@awc-ui/core/dist/components',
        replacement: local('../../packages/core/dist/components'),
      },
    ],
  },
  server: { fs: { allow: ['../..'] } },
});
