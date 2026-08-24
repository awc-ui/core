import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  // The component package is prebuilt and resolves its own lazy chunks at
  // runtime by URL. Letting Vite pre-bundle it rewrites those URLs to /@fs/…
  // paths that do not exist in the build output. Only the token stylesheet is
  // imported from it in the browser graph; the components arrive from
  // `static/awc-runtime/`.
  optimizeDeps: { exclude: ['@awc-ui/core'] },
  ssr: {
    /*
     * Keep the hydrate app OUT of the server bundle.
     *
     * `@awc-ui/core/hydrate` is a 3.8 MB single-file Node build of the whole
     * component library, imported by `src/hooks.server.ts` and by nothing else.
     * Vite does not externalise it on its own: it is a workspace-linked
     * dependency, and linked packages are bundled by default so that their
     * source can be processed. Bundling this one buys nothing — it is already
     * built, it runs only on the server, and it would be inlined into the Vite
     * server output and then re-bundled by adapter-node's Rollup pass.
     *
     * The DEEP path is deliberate. Vite matches `ssr.external` entries against
     * the exact import id first, and against the package name second — naming
     * the package would also externalise `@awc-ui/core/css/tokens.css`, which
     * is a real stylesheet that Vite must keep processing. This way the CSS
     * import is untouched and only the Node build is left as a bare import,
     * resolved from `node_modules` at runtime. adapter-node externalises
     * everything in `dependencies` anyway, which is where `@awc-ui/core` is.
     */
    external: ['@awc-ui/core/hydrate'],
  },
};
