import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, realpath, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const execute = promisify(execFile);
export const MAX_TEST_REPORT_BYTES = 256 * 1024 * 1024;
const reportNames = ['test-results.json', 'results.json', 'lcov.info', 'coverage-final.json', 'coverage-summary.json'];
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = files => sha(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))));
const relativePath = value => typeof value === 'string' && value.length < 4096 && !value.includes('\\') && !value.includes('\0') && !path.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
const hashPattern = /^[a-f0-9]{64}$/;
const within = (root, file) => file.startsWith(root + path.sep);

export function evidenceDirectory(directory) {
  if (!relativePath(directory)) return null;
  const match = /^(packages\/core\/coverage-(spec|e2e)|apps\/storybook\/coverage-stories|apps\/test-(react|vue|svelte|angular)\/coverage-native)(?:\/scopes\/(all|md-[a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(directory);
  if (!match) return null;
  return { category: match[2] === 'spec' ? 'unit' : match[2] === 'e2e' || match[3] === 'angular' ? 'e2e' : 'component',
    framework: match[2] ? 'jest' : match[3] ? 'playwright' : 'vitest' };
}

function inputPaths(category, framework) {
  const common = ['package.json', 'tsconfig.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'patches',
    'packages/core/package.json', 'packages/core/tsconfig.json', 'packages/core/src', 'packages/core/test',
    'packages/tokens/package.json', 'packages/tokens/src', 'packages/theme/package.json', 'packages/theme/tsconfig.json', 'packages/theme/src',
    'apps/native-playground/test-run-evidence.mjs', 'apps/native-playground/scripts/coverage'];
  if (category === 'unit') return [...common, 'packages/core/jest.coverage.config.cjs', 'apps/native-playground/scripts/measure-tests.mjs'];
  if (framework === 'vitest') return [...common, 'apps/storybook/package.json', 'apps/storybook/tsconfig.json',
    'apps/storybook/src', 'apps/storybook/.storybook', 'apps/storybook/scripts', 'apps/storybook/vitest.config.mts', 'apps/storybook/vitest.laboratory.config.mts'];
  if (framework === 'playwright') return [...common, ...['react', 'vue', 'svelte', 'angular'].flatMap(name => [
    `apps/test-${name}/package.json`, `apps/test-${name}/src`, `apps/test-${name}/e2e`, `apps/test-${name}/playwright`, `apps/test-${name}/playwright-ct.config.ts`,
    `apps/test-${name}/playwright.config.ts`, `apps/test-${name}/tsconfig.json`, `apps/test-${name}/vite.config.ts`,
    `packages/${name}/src`, `packages/${name}/package.json`,
  ])];
  return [...common, 'packages/core/stencil.config.ts', 'packages/core/stencil.config.coverage.ts'];
}

async function containedFile(root, relative, max = 64 * 1024 * 1024) {
  if (!relativePath(relative)) return null;
  const absolute = await realpath(path.join(root, relative)).catch(() => null);
  if (!absolute || !within(root, absolute)) return null;
  const info = await stat(absolute);
  if (!info.isFile() || info.size > max) return null;
  return { bytes: await readFile(absolute), size: info.size, modifiedAt: info.mtimeMs };
}

async function reportSignature(root, relative) {
  if (!relativePath(relative) || !reportNames.includes(path.posix.basename(relative))) return null;
  const absolute = await realpath(path.join(root, relative)).catch(() => null);
  if (!absolute || !within(root, absolute)) return null;
  const info = await stat(absolute);
  if (!info.isFile()) return null;
  const tooLarge = () => new Error(`Test report exceeds the ${MAX_TEST_REPORT_BYTES}-byte collection limit: ${relative}`);
  if (info.size > MAX_TEST_REPORT_BYTES) throw tooLarge();
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(absolute)) {
    size += chunk.length;
    if (size > MAX_TEST_REPORT_BYTES) throw tooLarge();
    hash.update(chunk);
  }
  if (size !== info.size) throw new Error(`Test report changed while hashing: ${relative}`);
  return { sha256: hash.digest('hex'), size, modifiedAt: info.mtimeMs };
}

async function sourceSnapshot(root, category, framework) {
  const files = {};
  async function visit(relative) {
    const absolute = path.join(root, relative);
    const resolved = await realpath(absolute).catch(() => null);
    if (!resolved) return;
    if (!within(root, resolved)) throw new Error(`Test input escapes repository: ${relative}`);
    const info = await stat(resolved);
    if (info.isDirectory()) {
      for (const entry of await readdir(resolved, { withFileTypes: true })) {
        if (['node_modules', '.git', 'coverage', '.cache'].includes(entry.name)) continue;
        if (entry.isSymbolicLink()) throw new Error(`Test input is a symbolic link: ${relative}/${entry.name}`);
        await visit(`${relative}/${entry.name}`);
      }
    } else if (info.isFile()) {
      if (info.size > 64 * 1024 * 1024 || Object.keys(files).length > 30000) throw new Error('Test input snapshot exceeds safety limits.');
      files[relative] = sha(await readFile(resolved));
    }
  }
  for (const relative of inputPaths(category, framework)) await visit(relative);
  const revision = await execute('git', ['rev-parse', 'HEAD'], { cwd: root }).then(({ stdout }) => stdout.trim()).catch(() => null);
  return { revision, digest: digest(files), files };
}

async function persist(handle, value, filename = 'run-evidence.json') {
  const directory = path.join(handle.root, handle.directory);
  await mkdir(directory, { recursive: true });
  if (!within(handle.root, await realpath(directory))) throw new Error('Evidence output escapes repository.');
  const temporary = path.join(directory, `.run-evidence-${handle.runId}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path.join(directory, filename));
}

/** Call after removing earlier outputs, before starting the build/test process. */
export async function beginTestRun({ root, directory, category, framework, label, command, testFiles = [], tags = [] }) {
  root = await realpath(root);
  const expected = evidenceDirectory(directory);
  if (!expected || expected.category !== category || expected.framework !== framework) throw new Error('Unsupported test evidence directory or runner.');
  if (!Array.isArray(testFiles) || testFiles.some(file => !relativePath(file))) throw new Error('Test files must be repository-relative paths.');
  if (!Array.isArray(tags) || tags.some(tag => !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) throw new Error('Invalid component scope.');
  const source = await sourceSnapshot(root, category, framework);
  const record = { schemaVersion: 1, runId: randomUUID(), directory, category, framework, label, command,
    testFiles: [...new Set(testFiles)].sort(), tags: [...new Set(tags)].sort(), startedAt: new Date().toISOString(), completedAt: null,
    status: 'running', exitCode: null, errors: [], source, artifacts: {} };
  const handle = { root, directory, runId: record.runId, record };
  await persist(handle, record);
  return handle;
}

/** Seals exactly the artifacts produced during this invocation, including failed runs. */
export async function finishTestRun(handle, { exitCode, errors = [], build }) {
  const current = await sourceSnapshot(handle.root, handle.record.category, handle.record.framework);
  const artifacts = {}, collectionErrors = errors.map(String);
  for (const name of reportNames) {
    try {
      const file = await reportSignature(handle.root, `${handle.directory}/${name}`);
      if (file && file.modifiedAt >= Date.parse(handle.record.startedAt) - 1000) artifacts[name] = { sha256: file.sha256, size: file.size };
    } catch (error) { collectionErrors.push(error.message); }
  }
  const record = { ...handle.record, status: 'completed', completedAt: new Date().toISOString(),
    exitCode: Number.isInteger(exitCode) ? exitCode : 1, errors: collectionErrors, artifacts,
    ...(build ? { build } : {}),
    source: { ...handle.record.source, stableDuringRun: current.digest === handle.record.source.digest && build?.verified !== false,
      changedDuringRun: [...new Set([...Object.keys(current.files), ...Object.keys(handle.record.source.files)])]
        .filter(file => current.files[file] !== handle.record.source.files[file]).sort() } };
  await persist(handle, record);
  return record;
}

function buildDirectory(directory) {
  return evidenceDirectory(directory)?.category === 'e2e' && directory.startsWith('packages/core/coverage-e2e');
}

async function runtimeSnapshot(root, directory) {
  if (!relativePath(directory)) throw new Error('Invalid isolated runtime path.');
  const files = {};
  async function visit(relative) {
    const absolute = path.join(root, directory, relative), resolved = await realpath(absolute);
    if (!within(root, resolved) || resolved !== absolute) throw new Error('Isolated runtime contains a symbolic link or escapes the repository.');
    const info = await stat(resolved);
    if (info.isDirectory()) {
      for (const entry of await readdir(resolved)) await visit(relative ? `${relative}/${entry}` : entry);
    } else if (info.isFile()) {
      if (info.size > 64 * 1024 * 1024 || Object.keys(files).length > 30000) throw new Error('Isolated runtime exceeds safety limits.');
      files[relative] = sha(await readFile(resolved));
    }
  }
  await visit('');
  if (!Object.keys(files).length) throw new Error('Isolated runtime is empty.');
  return { directory, digest: digest(files), files };
}

/** Capture inputs before compilation; never backfill this record from an old build. */
export async function beginIsolatedBuild({ root, directory }) {
  root = await realpath(root);
  if (!buildDirectory(directory)) throw new Error('Unsupported isolated build directory.');
  const source = await sourceSnapshot(root, 'e2e', 'jest');
  const buildId = randomUUID(), record = { schemaVersion: 1, buildId, directory, status: 'running', startedAt: new Date().toISOString(),
    completedAt: null, exitCode: null, source, runtimes: {} };
  const handle = { root, directory, runId: buildId, record };
  await persist(handle, record, 'build-evidence.json');
  return handle;
}

export async function finishIsolatedBuild(handle, { exitCode }) {
  const current = await sourceSnapshot(handle.root, 'e2e', 'jest'), runtimes = {};
  if (exitCode === 0) for (const name of ['www/build', 'components']) {
    const directory = `${handle.directory}/${name}`;
    runtimes[directory] = await runtimeSnapshot(handle.root, directory);
  }
  const record = { ...handle.record, status: 'completed', completedAt: new Date().toISOString(), exitCode, runtimes,
    source: { ...handle.record.source, stableDuringBuild: current.digest === handle.record.source.digest } };
  await persist(handle, record, 'build-evidence.json');
  return record;
}

/** Require the exact compiled files and the unchanged inputs that built them. */
export async function verifyIsolatedBuild({ root, runtimeDirectory, copyDirectory }) {
  root = await realpath(root);
  if (!relativePath(runtimeDirectory)) throw new Error('Invalid isolated runtime path.');
  const directory = runtimeDirectory.replace(/\/(?:www\/build|components)$/, '');
  if (directory === runtimeDirectory || !buildDirectory(directory)) throw new Error('Runtime is not a recorded isolated build. Run the browser collector first.');
  const manifestPath = `${directory}/build-evidence.json`, saved = await containedFile(root, manifestPath, 8 * 1024 * 1024);
  if (!saved) throw new Error('Isolated build evidence is missing. Run the browser collector first.');
  const record = JSON.parse(saved.bytes.toString('utf8')), runtime = record.runtimes?.[runtimeDirectory];
  if (record.schemaVersion !== 1 || record.directory !== directory || record.status !== 'completed' || record.exitCode !== 0
    || !/^[a-f0-9-]{36}$/.test(record.buildId || '') || !record.source?.stableDuringBuild
    || !record.source.files || record.source.digest !== digest(record.source.files) || !runtime?.files || runtime.digest !== digest(runtime.files)) {
    throw new Error('Isolated build evidence is incomplete or changed. Rebuild before collecting tests.');
  }
  const current = await sourceSnapshot(root, 'e2e', 'jest');
  if (current.digest !== record.source.digest) throw new Error('Isolated build inputs changed. Rebuild before collecting tests.');
  if ((await runtimeSnapshot(root, runtimeDirectory)).digest !== runtime.digest) throw new Error('Isolated runtime files changed after compilation. Rebuild before collecting tests.');
  if (copyDirectory && (await runtimeSnapshot(root, copyDirectory)).digest !== runtime.digest) throw new Error('Copied runtime does not match the recorded isolated build.');
  return { verified: true, buildId: record.buildId, manifestPath, sourceDigest: record.source.digest, runtimeDirectory, runtimeDigest: runtime.digest };
}

/** Content checks, not filesystem timestamps, establish report correlation. */
export async function readTestRunEvidence(root, directory) {
  try {
    root = await realpath(root);
    const expected = evidenceDirectory(directory);
    if (!expected) return null;
    const manifest = await containedFile(root, `${directory}/run-evidence.json`, 8 * 1024 * 1024);
    if (!manifest) return null;
    const value = JSON.parse(manifest.bytes.toString('utf8'));
    if (value.schemaVersion !== 1 || value.directory !== directory || value.category !== expected.category || value.framework !== expected.framework
      || !/^[a-f0-9-]{36}$/.test(value.runId || '') || !['running', 'completed'].includes(value.status)
      || !Number.isFinite(Date.parse(value.startedAt)) || value.status === 'completed' && (!Number.isFinite(Date.parse(value.completedAt)) || Date.parse(value.completedAt) < Date.parse(value.startedAt))
      || !Array.isArray(value.testFiles) || value.testFiles.some(file => !relativePath(file)) || !Array.isArray(value.tags)
      || value.tags.some(tag => typeof tag !== 'string' || !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))
      || typeof value.label !== 'string' || typeof value.command !== 'string' || !Array.isArray(value.errors) || value.errors.some(error => typeof error !== 'string')
      || value.status === 'completed' && (!Number.isSafeInteger(value.exitCode) || value.exitCode < 0 || value.exitCode > 255 || typeof value.source?.stableDuringRun !== 'boolean')
      || !value.source?.files || Array.isArray(value.source.files) || Object.keys(value.source.files).length > 30000
      || Object.entries(value.source.files).some(([file, hash]) => !relativePath(file) || !hashPattern.test(hash))
      || value.source.digest !== digest(value.source.files) || !value.artifacts || Array.isArray(value.artifacts)) return null;
    const validArtifacts = [];
    if (value.status === 'completed') for (const [name, artifact] of Object.entries(value.artifacts)) {
      if (!reportNames.includes(name) || !hashPattern.test(artifact?.sha256) || !Number.isSafeInteger(artifact.size) || artifact.size < 0) continue;
      const file = await reportSignature(root, `${directory}/${name}`).catch(() => null);
      if (file && file.size === artifact.size && file.sha256 === artifact.sha256) validArtifacts.push(name);
    }
    const current = await sourceSnapshot(root, value.category, value.framework);
    const changedFiles = [...new Set([...Object.keys(current.files), ...Object.keys(value.source.files)])]
      .filter(file => current.files[file] !== value.source.files[file]).sort();
    return { ...value, validArtifacts, source: { ...value.source, matchesCurrent: value.source.stableDuringRun === true && changedFiles.length === 0, changedFiles } };
  } catch { return null; }
}
