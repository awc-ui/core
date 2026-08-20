import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/experimental-ct-react';
import { sourcemapChain } from './vite-plugin-sourcemap-chain';

const coreDistComponents = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../packages/core/dist/components',
);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [
    ['list'],
    ['monocart-reporter', {
      name: 'md-button Coverage Report',
      outputFile: './coverage/report.html',
      coverage: {
        reports: ['v8', 'console-details'],
        entryFilter: (entry: any) => true,
        sourceFilter: (sourcePath: string) => {
          return sourcePath.includes('md-button');
        },
      },
    }],
  ],
  use: {
    ctViteConfig: {
      resolve: {
        alias: [
          {
            find: /^@awc-ui\/core\/components\/(.+)$/,
            replacement: `${coreDistComponents}/$1.js`,
          },
        ],
      },
      build: {
        sourcemap: true,
        minify: false,
      },
      plugins: [
        sourcemapChain(['@awc-ui/core', 'packages/core/dist']),
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
