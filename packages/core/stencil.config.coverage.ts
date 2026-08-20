import type { Config } from '@stencil/core';
import { config as baseConfig } from './stencil.config';

// E2E build + test config that layers V8 coverage collection on top of the base
// config. Used by `pnpm test:e2e:coverage`. The base config already emits source
// maps (`sourceMap: true`), which the collector remaps back to .tsx. Coverage is
// gated behind this separate config so the normal `test:e2e` run stays fast.
export const config: Config = {
  ...baseConfig,
  testing: {
    ...baseConfig.testing,
    globalSetup: './test/coverage/global-setup.js',
    globalTeardown: './test/coverage/global-teardown.js',
    setupFilesAfterEnv: [
      ...(baseConfig.testing?.setupFilesAfterEnv ?? []),
      './test/coverage/setup-after-env.js',
    ],
  },
};
