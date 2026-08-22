import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// SPIKE: static output mounted at a subpath under the docs site.
// - `paths.base` rewrites every emitted asset/link URL to the mount path.
// - adapter-static runs in full-prerender mode (pages + assets, strict) so every
//   route emits real HTML containing the Declarative Shadow DOM injected by
//   hooks.server.ts. A `fallback` SPA shell would ship an empty document instead.
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      precompress: false,
      strict: true,
    }),
    paths: {
      base: '/showcase/SPIKE/sveltekit',
      relative: false,
    },
    prerender: {
      entries: ['*'],
    },
  },
};
