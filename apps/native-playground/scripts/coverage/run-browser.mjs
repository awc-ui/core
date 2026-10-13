import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { discoverScope, prepareScopeReports, writeScopeManifest } from './scope.mjs';
import { collectStencilReport } from './stencil-report.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const core = path.join(root, 'packages/core');
const react = path.join(root, 'apps/test-react');
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const all = args.includes('--all');
const tags = args.filter(argument => !['--list', '--all'].includes(argument));
if (tags.length > 1 || all && tags.length || tags.some(tag => tag.startsWith('-'))) throw new Error('Usage: node apps/native-playground/scripts/coverage/run-browser.mjs [--all | md-component] [--list]');
const scope = await discoverScope(root, all ? 'all' : tags[0]);
if (listOnly) { console.log(JSON.stringify(scope, null, 2)); process.exit(0); }
const [major, minor] = process.versions.node.split('.').map(Number);
if (!(major >= 24 || major === 22 && minor >= 13)) throw new Error('Browser coverage requires the repository-supported Node ^22.13.0 or >=24.0.0.');

const directories = await prepareScopeReports(root, scope.scopeId);
const { e2e, component } = directories;
const manifest = {
  schemaVersion: 1, scopeId: scope.scopeId, tag: scope.tag, tags: scope.tags,
  e2eTests: scope.e2eTests.map(file => path.relative(root, file).split(path.sep).join('/')),
  componentTests: scope.componentTests.map(file => path.relative(root, file).split(path.sep).join('/')),
  startedAt: new Date().toISOString(), completedAt: null,
  buildExit: null, buildCompleted: false, stencilExit: null, componentExit: null, status: 'running', errors: [],
  command: `node apps/native-playground/scripts/coverage/run-browser.mjs ${all ? '--all' : scope.tag}`,
  scope: 'Existing Stencil E2E and React component tests only; axe cases retain their existing rules and assertions.',
};
await writeScopeManifest(directories, manifest);
console.log(`Collecting ${scope.e2eTests.length} Stencil E2E suites and ${scope.componentTests.length} React suites for ${scope.tags.length} source components (${scope.scopeId}).`);

try {
  const requireCore = createRequire(path.join(core, 'package.json'));
  const requireReact = createRequire(path.join(react, 'package.json'));
  const { chromium } = requireReact('@playwright/test');
  const executable = process.env.PUPPETEER_EXECUTABLE_PATH || chromium.executablePath();
  await fs.access(executable);
  const env = {
    ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
    AWC_COVERAGE_REPO: root, AWC_COVERAGE_COMPONENT: scope.tag,
    AWC_COVERAGE_TAGS: JSON.stringify(scope.tags),
    AWC_COVERAGE_E2E_TESTS: JSON.stringify(scope.e2eTests),
    AWC_COVERAGE_COMPONENT_TESTS: JSON.stringify(scope.componentTests),
    AWC_COVERAGE_E2E_OUTPUT: e2e, AWC_COVERAGE_REACT_OUTPUT: component,
    PUPPETEER_EXECUTABLE_PATH: executable,
  };
  async function run(executable, args, cwd) {
    return await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { cwd, env, stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal) manifest.errors.push(`${path.basename(executable)} terminated by ${signal}.`);
        resolve(code ?? 1);
      });
    });
  }
  async function collect(label, work) {
    try { await work(); }
    catch (error) { manifest.errors.push(`${label}: ${error.message}`); console.error(`${label}: ${error.message}`); }
  }
  const generatedConfig = path.join(e2e, 'stencil.config.ts');
  await fs.copyFile(path.join(directory, 'stencil.config.ts'), generatedConfig);
  const stencil = path.join(path.dirname(requireCore.resolve('@stencil/core/compiler')), '../bin/stencil');
  manifest.buildExit = await run(process.execPath, [stencil, 'build', '--config', generatedConfig, '--maxWorkers=2'], core);
  manifest.buildCompleted = manifest.buildExit === 0;
  await writeScopeManifest(directories, manifest);
  if (!manifest.buildCompleted) throw new Error(`Isolated component build failed (exit ${manifest.buildExit}); browser suites were not started.`);
  console.log(`Isolated component build complete: ${path.join(e2e, 'www/build')}`);
  if (scope.e2eTests.length) manifest.stencilExit = await run(process.execPath, [stencil, 'test', '--e2e', '--build=false', '--config', generatedConfig, '--maxWorkers=2', '--json', '--outputFile', path.join(e2e, 'results.json')], core);
  // Failed assertions still produce useful measured coverage. A malformed or
  // missing payload must not prevent the independent React run.
  if (scope.e2eTests.length) await collect('Stencil coverage report', async () => {
    const lcov = await collectStencilReport({ repository: root, output: e2e, tags: scope.tags, name: `${scope.tag} existing Stencil browser tests` });
    await fs.copyFile(lcov, path.join(e2e, 'lcov.info'));
  });
  await writeScopeManifest(directories, manifest);
  if (scope.componentTests.length) {
    if (!(await fs.stat(path.join(e2e, 'components')).catch(() => null))?.isDirectory()) {
      manifest.errors.push('React suites were not started because the isolated component build is unavailable.');
    } else {
      manifest.componentExit = await run(process.execPath, [requireReact.resolve('@playwright/test/cli'), 'test', '-c', path.join(directory, 'playwright.config.ts')], react);
      await collect('React coverage report', () => fs.copyFile(path.join(component, 'report/lcov.info'), path.join(component, 'lcov.info')));
    }
  } else console.log(`No existing React component suite for ${scope.tag}; no React result is generated.`);
} catch (error) {
  manifest.errors.push(error.stack || error.message);
  console.error(error);
} finally {
  manifest.completedAt = new Date().toISOString();
  manifest.status = manifest.buildExit || manifest.stencilExit || manifest.componentExit || manifest.errors.length ? 'failed' : 'passed';
  await writeScopeManifest(directories, manifest);
  console.log(JSON.stringify({ scopeId: manifest.scopeId, status: manifest.status, stencilExit: manifest.stencilExit, componentExit: manifest.componentExit, errors: manifest.errors, directories }, null, 2));
  process.exitCode = manifest.status === 'failed' ? 1 : 0;
}
