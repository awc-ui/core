import { Config } from '@stencil/core';
import path from 'node:path';
import { coreStylesOutputTarget } from '../../scripts/core-styles.cjs';

/**
 * CSR-only custom-elements build -> dist/components-csr.
 *
 * Stencil hard-wires the runtime's `hydrateClientSide` build conditional to
 * "does the project have a dist-hydrate-script output target?" — there is no
 * config knob. Because the MAIN config ships hydrate/ (SSR), every client app
 * pays ~9.6 kB min / 3.3 kB gz of Declarative-Shadow-DOM claiming code it
 * never runs unless it actually server-renders.
 *
 * This config compiles the same 56 components and their nested parts with NO
 * hydrate target, so that code is compiled out. Output is identical in shape to
 * dist/components (same entry names, auto-define behavior, bundled runtime) —
 * only smaller.
 *
 * Packaging contract:
 *   - dist/components      (main config) stays the DEFAULT — safe for every
 *     consumer including SSR/Next.js apps that hydrate DSD markup.
 *   - dist/components-csr  is the opt-in for pure client-rendered apps, via
 *     the "./components-csr/*" export or a one-line bundler alias:
 *       '@awc-ui/core/dist/components' -> '@awc-ui/core/dist/components-csr'
 *     (rewrites the framework wrappers' imports too).
 *
 * Type declarations are not regenerated: the public types are identical, and
 * the package exports map points the csr subpaths at dist/components/*.d.ts.
 *
 * Runs as a second `stencil build` in the core "build" script, AFTER the main
 * build (which starts with `rm -rf dist`).
 */
export const config: Config = {
  namespace: 'md3',
  sourceMap: true,
  minifyJs: true,
  minifyCss: true,
  invisiblePrehydration: false,
  outputTargets: [
    // A custom-elements-only build has no normalized global CSS target.
    // Keep the package's public CSS export available when this runs alone.
    coreStylesOutputTarget({ additionalFiles: [path.join(__dirname, 'dist/md3/md3.css')] }),
    {
      type: 'dist-custom-elements',
      dir: 'dist/components-csr',
      customElementsExportBehavior: 'auto-define-custom-elements',
      generateTypeDeclarations: false,
      externalRuntime: false,
    },
  ],
  testing: {
    browserHeadless: 'new',
  },
};
