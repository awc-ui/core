import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { discoverScope } from './scope.mjs';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const core = path.join(root, 'packages/core');
const react = path.join(root, 'apps/test-react');
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const tags = args.filter(argument => argument !== '--list');
if (tags.length > 1) throw new Error('Usage: node apps/native-playground/scripts/coverage/run-browser.mjs [md-component] [--list]');
const scope = await discoverScope(root, tags[0]);
if (listOnly) {
  console.log(JSON.stringify(scope, null, 2));
  process.exit(0);
}
const requireCore = createRequire(path.join(core, 'package.json'));
const requireReact = createRequire(path.join(react, 'package.json'));
const { chromium } = requireReact('@playwright/test');
const { CoverageReport } = requireCore('monocart-coverage-reports');
const e2e = path.join(core, 'coverage-e2e');
const component = path.join(react, 'coverage-native');
const env = { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`, AWC_COVERAGE_REPO: root,
  AWC_COVERAGE_COMPONENT: scope.tag, AWC_COVERAGE_COMPONENT_TESTS: JSON.stringify(scope.componentTests),
  PUPPETEER_EXECUTABLE_PATH: chromium.executablePath() };
async function run(executable, args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
  });
}
await fs.mkdir(e2e, { recursive: true });
await fs.mkdir(component, { recursive: true });
// Failed infrastructure must never leave a previous run's passing measurements.
for (const directory of [e2e, component]) {
  for (const filename of ['results.json', 'lcov.info', 'run.json']) await fs.rm(path.join(directory, filename), { force: true });
  await fs.rm(path.join(directory, 'report'), { recursive: true, force: true });
}
await fs.rm(path.join(e2e, 'raw'), { recursive: true, force: true });
const startedAt = new Date().toISOString();
const generatedConfig = path.join(e2e, 'stencil.config.ts');
await fs.copyFile(path.join(directory, 'stencil.config.ts'), generatedConfig);
const stencilArgs = scope.e2eTests.length
  ? ['test', '--e2e', '--config', generatedConfig, '--maxWorkers=2', '--json', '--outputFile', path.join(e2e, 'results.json')]
  : ['build', '--config', generatedConfig];
const stencilExit = await run(process.execPath, [path.join(path.dirname(requireCore.resolve('@stencil/core/compiler')), '../bin/stencil'), ...stencilArgs], core);
if (scope.e2eTests.length) {
  const report = new CoverageReport({ name: `${scope.tag} existing Stencil browser tests`, outputDir: path.join(e2e, 'report'),
    reports: ['v8', 'console-summary', 'lcovonly'], logging: 'error',
    sourceFilter: source => source.includes(`/src/components/${scope.tag}/`) && /\.tsx?$/.test(source),
  });
  for (const name of await fs.readdir(path.join(e2e, 'raw')).catch(() => [])) {
    await report.add(JSON.parse(await fs.readFile(path.join(e2e, 'raw', name), 'utf8')));
  }
  await report.generate();
  await fs.copyFile(path.join(e2e, 'report/lcov.info'), path.join(e2e, 'lcov.info'));
} else if (stencilExit) throw new Error('Isolated component build failed');
const componentExit = scope.componentTests.length ? await run(process.execPath, [requireReact.resolve('@playwright/test/cli'), 'test', '-c', path.join(directory, 'playwright.config.ts')], react) : null;
if (componentExit !== null) {
  await fs.copyFile(path.join(component, 'report/lcov.info'), path.join(component, 'lcov.info'));
} else console.log(`No existing React component suite for ${scope.tag}; no React component or accessibility result is generated.`);
await fs.writeFile(path.join(e2e, 'run.json'), JSON.stringify({ startedAt, completedAt: new Date().toISOString(), stencilExit, componentExit,
  command: `node apps/native-playground/scripts/coverage/run-browser.mjs ${scope.tag}`, ...scope,
  scope: 'Existing Stencil E2E and React component tests only; axe cases retain their existing rules and assertions.' }, null, 2));
process.exitCode = stencilExit || componentExit || 0;
