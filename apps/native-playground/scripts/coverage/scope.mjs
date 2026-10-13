import fs from 'node:fs/promises';
import path from 'node:path';

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name))
    : entry.isFile() ? [path.join(directory, entry.name)] : []));
  return files.flat().sort();
}

export async function discoverScope(repository, tag = 'md-button') {
  if (tag !== 'all' && !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw new Error(`Invalid component tag: ${tag}`);
  const components = path.join(repository, 'packages/core/src/components');
  const sources = await filesIn(components);
  const tags = sources.filter(file => path.basename(file) === `${path.basename(path.dirname(file))}.tsx`)
    .map(file => path.basename(path.dirname(file))).filter(value => /^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
  if (tag !== 'all' && !tags.includes(tag)) throw new Error(`Unknown source component: ${tag}`);
  const selected = tag === 'all' ? tags : [tag];
  const pascal = value => value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('');
  const references = source => selected.some(value => new RegExp(`(?:<|["'\x60])${value}(?=[\\s/>"'\x60])|\\b${pascal(value)}\\b`).test(source));
  const e2eTests = [];
  for (const file of sources.filter(file => file.endsWith('.e2e.ts'))) {
    if (tag === 'all' || selected.some(value => file.startsWith(path.join(components, value) + path.sep))
      || references(await fs.readFile(file, 'utf8'))) e2eTests.push(file);
  }
  const componentTests = [];
  for (const file of await filesIn(path.join(repository, 'apps/test-react/e2e'))) {
    if (!/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)) continue;
    // Grouped suites need not share a component's basename. In --all mode every
    // existing suite is included; a scoped run also recognizes literal custom
    // element use and framework wrapper references in that suite's source.
    const source = tag === 'all' ? '' : await fs.readFile(file, 'utf8');
    if (tag === 'all' || selected.some(value => new RegExp(`^(?:${value}|${value.slice(3)})\\.(?:spec|test)\\.[cm]?[jt]sx?$`).test(path.basename(file)))
      || references(source)) componentTests.push(file);
  }
  if (!e2eTests.length && !componentTests.length) throw new Error(`No existing browser suites found for ${tag}`);
  return { tag, scopeId: tag, tags: selected.sort(), e2eTests, componentTests };
}

/** Each scope owns its reports; later single-component runs cannot erase --all. */
export function scopeDirectories(repository, scopeId) {
  if (scopeId !== 'all' && !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scopeId)) throw new Error(`Invalid coverage scope: ${scopeId}`);
  return {
    e2e: path.join(repository, 'packages/core/coverage-e2e/scopes', scopeId),
    component: path.join(repository, 'apps/test-react/coverage-native/scopes', scopeId),
  };
}

export async function prepareScopeReports(repository, scopeId) {
  const directories = scopeDirectories(repository, scopeId);
  for (const directory of Object.values(directories)) {
    await fs.mkdir(directory, { recursive: true });
    for (const filename of ['results.json', 'test-results.json', 'lcov.info', 'coverage-final.json', 'coverage-summary.json', 'run.json', 'run-evidence.json', 'build-evidence.json']) await fs.rm(path.join(directory, filename), { force: true });
    for (const name of ['raw', 'report', 'test-results', 'www', 'components']) await fs.rm(path.join(directory, name), { recursive: true, force: true });
  }
  return directories;
}

export async function writeScopeManifest(directories, manifest) {
  for (const directory of Object.values(directories)) {
    const filename = path.join(directory, 'run.json');
    await fs.writeFile(`${filename}.tmp`, JSON.stringify(manifest, null, 2));
    await fs.rename(`${filename}.tmp`, filename);
  }
}
