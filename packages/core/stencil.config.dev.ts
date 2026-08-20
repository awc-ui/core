import type { Config } from '@stencil/core';
import { config as baseConfig } from './stencil.config';

// Lean build for the Storybook dev loop.
//
// Storybook loads `@awc-ui/core/define` → loader → dist/esm/loader.js,
// i.e. ONLY the lazy `dist` output. The full build (stencil.config.ts) also
// emits dist-custom-elements (a second full component bundle, ~38s), www, the
// collection, docs-readme and the framework proxies — none of which Storybook
// consumes. Here we drop all of that, turn off source maps, and pair this with
// `--dev` (skips terser minification) so the upfront build + every watch
// rebuild only does the work Storybook actually needs.
//
// The full stencil.config.ts is unchanged and is what publish/CI should run.
export const config: Config = {
  // DEV-ONLY: unhashed chunk names. Stencil's incremental watch rewrites the
  // loader + runtime chunk but skips content-unchanged entries — with hashed
  // names a runtime rotation leaves entries importing the OLD runtime file
  // (still on disk), booting TWO runtimes at once: the recurring
  // createElementNS('[object Object]') empty-canvas corruption. With stable
  // names every generation agrees on '../index.js'.
  hashFileNames: false,
  ...baseConfig,
  sourceMap: false,
  outputTargets: [
    {
      type: 'dist',
    },
  ],
};
