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
  if (!/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw new Error(`Invalid component tag: ${tag}`);
  const directory = path.join(repository, 'packages/core/src/components', tag);
  const source = path.join(directory, `${tag}.tsx`);
  if (!(await fs.stat(source).catch(() => null))?.isFile()) throw new Error(`Unknown source component: ${tag}`);
  const e2eTests = (await filesIn(directory)).filter(file => file.endsWith('.e2e.ts'));
  const names = new Set([`${tag}.spec.tsx`, `${tag.slice(3)}.spec.tsx`]);
  const componentTests = (await filesIn(path.join(repository, 'apps/test-react/e2e')))
    .filter(file => names.has(path.basename(file)));
  if (!e2eTests.length && !componentTests.length) throw new Error(`No existing browser suites found for ${tag}`);
  return { tag, e2eTests, componentTests };
}
