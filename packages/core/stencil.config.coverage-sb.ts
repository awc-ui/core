import type { Config } from '@stencil/core';
import { config as devConfig } from './stencil.config.dev';

// Storybook-coverage build: the lean dev `dist` output (see stencil.config.dev.ts
// for why: unhashed names, single lazy output) but with source maps ON so the
// Storybook test-runner's V8 coverage can be remapped back to the original .tsx
// via monocart-coverage-reports (mirrors test/coverage/ for e2e). Kept separate
// so the normal dev loop stays map-free and fast.
export const config: Config = {
  ...devConfig,
  sourceMap: true,
};
