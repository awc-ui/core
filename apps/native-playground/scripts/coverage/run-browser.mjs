import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { discoverScope, prepareScopeReports, writeScopeManifest } from './scope.mjs';
import { collectStencilReport } from './stencil-report.mjs';
import { beginTestRun, finishTestRun, beginIsolatedBuild, finishIsolatedBuild, verifyIsolatedBuild } from '../../test-run-evidence.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../../..');
function browserTools(core, react) {
  const requireCore = createRequire(path.join(core, 'package.json'));
  const requireReact = createRequire(path.join(react, 'package.json'));
  return {
    executable: process.env.PUPPETEER_EXECUTABLE_PATH || requireReact('@playwright/test').chromium.executablePath(),
    stencil: path.join(path.dirname(requireCore.resolve('@stencil/core/compiler')), '../bin/stencil'),
    playwright: requireReact.resolve('@playwright/test/cli'),
  };
}

export async function runBrowserCoverage({ root = repository, scope, resolveTools = browserTools, runProcess, collectReport = collectStencilReport } = {}) {
  const core = path.join(root, 'packages/core');
  const react = path.join(root, 'apps/test-react');
  const all = scope.scopeId === 'all';
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
  const evidence = {}, builds = {}, categoryErrors = { e2e: [], component: [] };
  const relative = value => path.relative(root, value).split(path.sep).join('/');
  console.log(`Collecting ${scope.e2eTests.length} Stencil E2E suites and ${scope.componentTests.length} React suites for ${scope.tags.length} source components (${scope.scopeId}).`);

  try {
    for (const [category, files, framework, label] of [
      ['e2e', manifest.e2eTests, 'jest', 'Existing Stencil browser tests'],
      ['component', manifest.componentTests, 'playwright', 'Existing React component tests'],
    ]) if (files.length) evidence[category] = await beginTestRun({ root, directory: path.relative(root, directories[category]).split(path.sep).join('/'),
      category, framework, label, command: manifest.command, testFiles: files, tags: scope.tags });
    const { executable, stencil, playwright } = resolveTools(core, react);
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
      if (runProcess) return runProcess(executable, args, cwd, env);
      return await new Promise((resolve, reject) => {
        const child = spawn(executable, args, { cwd, env, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
          if (signal) manifest.errors.push(`${path.basename(executable)} terminated by ${signal}.`);
          resolve(code ?? 1);
        });
      });
    }
    async function collect(category, label, work) {
      try { await work(); }
      catch (error) { const message = `${label}: ${error.message}`; manifest.errors.push(message); categoryErrors[category].push(message); console.error(message); }
    }
    const generatedConfig = path.join(e2e, 'stencil.config.ts');
    await fs.copyFile(path.join(directory, 'stencil.config.ts'), generatedConfig);
    const building = await beginIsolatedBuild({ root, directory: relative(e2e) });
    let built;
    manifest.buildExit = 1;
    try { manifest.buildExit = await run(process.execPath, [stencil, 'build', '--config', generatedConfig, '--maxWorkers=2'], core); }
    finally { built = await finishIsolatedBuild(building, { exitCode: manifest.buildExit }); }
    manifest.buildCompleted = manifest.buildExit === 0 && built.source.stableDuringBuild;
    await writeScopeManifest(directories, manifest);
    if (!manifest.buildCompleted) throw new Error(`Isolated component build failed or its inputs changed (exit ${manifest.buildExit}); browser suites were not started.`);
    for (const [category, name] of [['e2e', 'www/build'], ['component', 'components']]) builds[category] = await verifyIsolatedBuild({ root, runtimeDirectory: relative(path.join(e2e, name)) });
    console.log(`Isolated component build complete: ${path.join(e2e, 'www/build')}`);
    if (scope.e2eTests.length) {
      manifest.stencilExit = 1;
      await collect('e2e', 'Stencil execution', async () => { manifest.stencilExit = await run(process.execPath, [stencil, 'test', '--e2e', '--build=false', '--config', generatedConfig, '--maxWorkers=2', '--json', '--outputFile', path.join(e2e, 'results.json')], core); });
    }
    // Failed assertions still produce useful measured coverage. A malformed or
    // missing payload must not prevent the independent React run.
    if (scope.e2eTests.length) await collect('e2e', 'Stencil coverage report', async () => {
      const lcov = await collectReport({ repository: root, output: e2e, tags: scope.tags, name: `${scope.tag} existing Stencil browser tests` });
      await fs.copyFile(lcov, path.join(e2e, 'lcov.info'));
    });
    await writeScopeManifest(directories, manifest);
    if (scope.componentTests.length) {
      if (!(await fs.stat(path.join(e2e, 'components')).catch(() => null))?.isDirectory()) {
        const message = 'React suites were not started because the isolated component build is unavailable.';
        manifest.errors.push(message); categoryErrors.component.push(message);
      } else {
        manifest.componentExit = 1;
        await collect('component', 'React execution', async () => { manifest.componentExit = await run(process.execPath, [playwright, 'test', '-c', path.join(directory, 'playwright.config.ts')], react); });
        await collect('component', 'React coverage report', () => fs.copyFile(path.join(component, 'report/lcov.info'), path.join(component, 'lcov.info')));
      }
    } else console.log(`No existing React component suite for ${scope.tag}; no React result is generated.`);
  } catch (error) {
    const message = error.stack || error.message;
    manifest.errors.push(message);
    for (const errors of Object.values(categoryErrors)) errors.push(message);
    console.error(error);
  } finally {
    for (const [category, build] of Object.entries(builds)) {
      try { await verifyIsolatedBuild({ root, runtimeDirectory: build.runtimeDirectory }); }
      catch (error) {
        categoryErrors[category].push(error.message); manifest.errors.push(error.message);
        builds[category] = { ...build, verified: false, error: error.message };
      }
    }
    manifest.completedAt = new Date().toISOString();
    manifest.status = manifest.buildExit || manifest.stencilExit || manifest.componentExit || manifest.errors.length ? 'failed' : 'passed';
    await writeScopeManifest(directories, manifest);
    console.log(JSON.stringify({ scopeId: manifest.scopeId, status: manifest.status, stencilExit: manifest.stencilExit, componentExit: manifest.componentExit, errors: manifest.errors, directories }, null, 2));
    for (const [category, handle] of Object.entries(evidence)) {
      const exit = category === 'e2e' ? manifest.stencilExit : manifest.componentExit;
      await finishTestRun(handle, { exitCode: exit ?? 1, errors: categoryErrors[category], build: builds[category] });
    }
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), listOnly = args.includes('--list'), all = args.includes('--all');
  const tags = args.filter(argument => !['--list', '--all'].includes(argument));
  if (tags.length > 1 || all && tags.length || tags.some(tag => tag.startsWith('-'))) throw new Error('Usage: node apps/native-playground/scripts/coverage/run-browser.mjs [--all | md-component] [--list]');
  const scope = await discoverScope(repository, all ? 'all' : tags[0]);
  if (listOnly) console.log(JSON.stringify(scope, null, 2));
  else {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (!(major >= 24 || major === 22 && minor >= 13)) throw new Error('Browser coverage requires the repository-supported Node ^22.13.0 or >=24.0.0.');
    const manifest = await runBrowserCoverage({ scope });
    process.exitCode = manifest.status === 'failed' ? 1 : 0;
  }
}
