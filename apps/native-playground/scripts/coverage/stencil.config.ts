import path from 'node:path';

const repository = process.env.AWC_COVERAGE_REPO || path.resolve(__dirname, '../../../..');
const core = path.join(repository, 'packages/core');
const output = process.env.AWC_COVERAGE_E2E_OUTPUT || path.join(core, 'coverage-e2e');
const tag = process.env.AWC_COVERAGE_COMPONENT || 'md-button';
if (tag !== 'all' && !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw new Error('Invalid coverage component tag');
const tests = process.env.AWC_COVERAGE_E2E_TESTS ? JSON.parse(process.env.AWC_COVERAGE_E2E_TESTS) : null;
if (tests && (!Array.isArray(tests) || tests.some(file => typeof file !== 'string' || !file.startsWith(path.join(core, 'src/components') + path.sep) || !file.endsWith('.e2e.ts')))) throw new Error('Invalid coverage E2E test paths');
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Isolated build outputs: collecting coverage never rewrites the user's live dist
// or generated framework wrappers. The existing component/test source is unchanged.
export const config = {
  rootDir: core,
  tsconfig: path.join(core, 'tsconfig.json'),
  srcDir: path.join(core, 'src'),
  namespace: 'md3',
  devMode: true,
  buildDist: true,
  hashFileNames: false,
  validateTypes: false,
  sourceMap: true,
  minifyJs: false,
  minifyCss: false,
  invisiblePrehydration: false,
  devServer: { port: 5337, openBrowser: false },
  outputTargets: [
    { type: 'www', dir: path.join(output, 'www'), serviceWorker: null,
      copy: [{ src: path.join(repository, 'packages/tokens/src/tokens.css'), dest: 'build/md3.css' }] },
    { type: 'dist-custom-elements', dir: path.join(output, 'components'),
      customElementsExportBehavior: 'auto-define-custom-elements', externalRuntime: false, generateTypeDeclarations: false },
  ],
  testing: {
    roots: [path.join(core, 'src')],
    browserHeadless: 'shell',
    testRegex: tests?.length ? `(?:${tests.map(escapeRegex).join('|')})$` : tag === 'all' ? '/components/.*\\.e2e\\.ts$' : `/${tag}/.*\\.e2e\\.ts$`,
    setupFilesAfterEnv: [path.join(repository, 'apps/native-playground/scripts/coverage/stencil-coverage.cjs')],
  },
};
