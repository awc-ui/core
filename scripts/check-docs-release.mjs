#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PACKAGES } from './check-publish-auth.mjs';
import { assertVersion, checkArchives, isStableVersion } from './lib/docs-versions.mjs';

const defaultRepository = fileURLToPath(new URL('../', import.meta.url));

/** Production docs must describe an available release, not a version bump awaiting publication. */
export async function checkDocsRelease({
  repository = defaultRepository,
  manifests,
  fetchImpl = globalThis.fetch,
  archiveDirectory = join(repository, 'apps/docs/versions'),
  timeoutMs = 10000,
} = {}) {
  manifests ??= await Promise.all(PACKAGES.map(name =>
    readFile(join(repository, 'packages', name.slice('@awc-ui/'.length), 'package.json'), 'utf8').then(JSON.parse)));
  if (!Array.isArray(manifests) || manifests.length !== PACKAGES.length
    || PACKAGES.some(name => manifests.filter(item => item?.name === name).length !== 1)) {
    throw new Error('Production docs require source manifests for all eight @awc-ui packages');
  }
  const version = assertVersion(manifests.find(item => item.name === '@awc-ui/core').version);
  for (const manifest of manifests) {
    if (manifest.version !== version || manifest.private === true) {
      throw new Error(`Source package ${manifest.name} must be public and match @awc-ui/core@${version}`);
    }
  }
  if (isStableVersion(version)) {
    // Verifies checksums, provenance and every listed archive, including hidden releases.
    const { manifest } = await checkArchives(archiveDirectory);
    if (!manifest.versions.some(entry => entry.version === version && entry.hidden !== true)) {
      throw new Error(`Production docs require a visible documentation archive for ${version}`);
    }
  }
  await Promise.all(PACKAGES.map(async name => {
    try {
      // Fixed public registry; never consult npmrc or send publishing credentials.
      const response = await fetchImpl(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`npm HTTP ${response.status}`);
      const published = await response.json();
      if (published?.name !== name || published?.version !== version) {
        throw new Error(`npm metadata must identify ${name}@${version}`);
      }
    } catch (error) {
      throw new Error(`Cannot verify published ${name}@${version}: ${error.message}`, { cause: error });
    }
  }));
  return { version, packages: [...PACKAGES] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { version, packages } = await checkDocsRelease();
    console.log(`Production docs release verified: ${packages.length} published packages at ${version}.`);
  } catch (error) {
    console.error(`[docs:release] ${error.message}`);
    process.exitCode = 1;
  }
}
