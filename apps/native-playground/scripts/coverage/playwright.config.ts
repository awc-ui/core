import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { canonicalSourceMap } from './source-maps.cjs';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(repository, 'apps/test-react/package.json'));
const { defineConfig } = require('@playwright/experimental-ct-react');
const output = process.env.AWC_COVERAGE_REACT_OUTPUT || path.join(repository, 'apps/test-react/coverage-native');
const build = process.env.AWC_COVERAGE_E2E_OUTPUT || path.join(repository, 'packages/core/coverage-e2e');
const tag = process.env.AWC_COVERAGE_COMPONENT || 'md-button';
if (tag !== 'all' && !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw new Error('Invalid coverage component tag');
const tags = JSON.parse(process.env.AWC_COVERAGE_TAGS || JSON.stringify([tag]));
if (!Array.isArray(tags) || !tags.every(value => /^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))) throw new Error('Invalid coverage component tags');
const matches = JSON.parse(process.env.AWC_COVERAGE_COMPONENT_TESTS || '["button.spec.tsx"]');

export default defineConfig({
  testDir: path.join(repository, 'apps/test-react/e2e'),
  testMatch: matches,
  timeout: 30_000,
  workers: 2,
  outputDir: path.join(output, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(output, 'results.json') }],
    [require.resolve('monocart-reporter'), {
      name: `${tag} existing React component tests`, outputFile: path.join(output, 'report/report.html'),
      coverage: {
        outputDir: path.join(output, 'report'),
        entryFilter: (entry: any) => /\.js(?:[?#]|$)/.test(entry.url),
        reports: ['v8', 'console-summary', 'lcovonly'],
        sourceFilter: (source: string) => tags.some(tag => source.includes(`/src/components/${tag}/`)) && /\.tsx?$/.test(source),
      },
    }],
  ],
  use: {
    ctPort: 5338,
    ctTemplateDir: '../../../test-react/playwright',
    ctCacheDir: path.join(output, '.cache'),
    ctViteConfig: {
      resolve: { alias: [
        { find: /^@awc-ui\/core\/components\/(.+)$/, replacement: path.join(build, 'components/$1.js') },
        { find: '@awc-ui/tokens/tokens.css', replacement: path.join(repository, 'packages/tokens/src/tokens.css') },
      ] },
      build: { sourcemap: true, minify: false },
      plugins: [{
        name: 'verified-native-coverage-source-maps', enforce: 'pre',
        load(id: string) {
          if (!id.includes('packages/core/coverage-e2e/') || !id.endsWith('.js') || !fs.existsSync(`${id}.map`)) return null;
          return { code: fs.readFileSync(id, 'utf8'), map: canonicalSourceMap(JSON.parse(fs.readFileSync(`${id}.map`, 'utf8')), repository, `${id}.map`) };
        },
      }],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
