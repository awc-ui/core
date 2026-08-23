import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  // The component package is prebuilt and resolves its own lazy chunks at
  // runtime by URL. Letting Vite pre-bundle it rewrites those URLs to /@fs/…
  // paths that do not exist in the build output. Only the token stylesheet is
  // imported from it; the components arrive from `static/awc-runtime/`.
  optimizeDeps: { exclude: ['@awc-ui/core'] },
};
