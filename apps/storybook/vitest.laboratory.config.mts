import { mergeConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import base from './vitest.config.mts';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { canonicalSourceMap } = createRequire(import.meta.url)(path.join(root, 'apps/native-playground/scripts/coverage/source-maps.cjs'));
const output = path.join(root, 'apps/storybook/coverage-stories');
const runtime = path.join(output, 'runtime');
const active = new WeakSet();

// Measure the actual existing story tests and their play assertions, against an
// isolated, source-mapped library build. Never instrument the story harness as
// though it were component coverage, or replace the user's running core dist.
export default mergeConfig(base, {
  server: { fs: { allow: [root, fs.realpathSync(path.join(root, 'node_modules'))] } },
  resolve: { alias: [
    // Public utilities used by stories must share the verified isolated build;
    // a bare import otherwise resolves to the unrelated production dist tree.
    { find: /^@awc-ui\/core$/, replacement: path.join(runtime, 'index.esm.js') },
    { find: '@awc-ui/core/define', replacement: path.join(runtime, 'md3.esm.js') },
    { find: '@awc-ui/tokens/tokens.css', replacement: path.join(root, 'packages/tokens/src/tokens.css') },
    { find: '@awc-ui/theme', replacement: path.join(root, 'packages/theme/src/index.ts') },
  ] },
  plugins: [{
    name: 'laboratory-story-source-maps', enforce: 'pre',
    load(id) {
      if (!id.startsWith(runtime + path.sep) || !id.endsWith('.js') || !fs.existsSync(`${id}.map`)) return null;
      return { code: fs.readFileSync(id, 'utf8'), map: canonicalSourceMap(JSON.parse(fs.readFileSync(`${id}.map`, 'utf8')), root, `${id}.map`) };
    },
  }],
  test: {
    // Keep focus-sensitive story interactions and browser coverage sequential.
    maxWorkers: 1,
    reporters: ['default', ['json', { outputFile: path.join(output, 'results.json') }]],
    setupFiles: ['./scripts/laboratory-coverage.setup.ts'],
    browser: {
      commands: {
        async startLibraryCoverage({ page }) {
          if (active.has(page)) throw new Error('Library coverage already active for this page');
          await page.coverage.startJSCoverage({ resetOnNavigation: false });
          active.add(page);
        },
        async saveLibraryCoverage({ page, testPath }) {
          if (!active.has(page)) return;
          active.delete(page);
          const entries = (await page.coverage.stopJSCoverage()).filter(entry => entry.url.includes('/coverage-stories/runtime/'));
          if (!testPath) throw new Error('A story source path is required to persist its browser coverage.');
          const name = createHash('sha256').update(testPath).digest('hex');
          fs.mkdirSync(path.join(output, 'raw'), { recursive: true });
          fs.writeFileSync(path.join(output, 'raw', `${name}.json`), JSON.stringify(entries));
        },
      },
    },
  },
});
