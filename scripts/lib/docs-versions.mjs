import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

export const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const TAG_PATTERN = /^md-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const GUIDE_PATTERN = /^(?:getting-started|frameworks|theming|behaviour|guides|recipes)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const GUIDE_SOURCE_PATTERN = /^apps\/docs\/src\/content\/docs\/(?:getting-started|frameworks|theming|behaviour|guides|recipes)\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.mdx?$/;

export function assertVersion(version) {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) throw new Error(`Invalid documentation version: ${String(version)}`);
  return version;
}
export function isStableVersion(version) {
  return typeof version === 'string' && VERSION_PATTERN.test(version) && !version.split('+')[0].includes('-');
}
export function compareVersions(left, right) {
  assertVersion(left);
  assertVersion(right);
  function parts(version) {
    const [core, ...prerelease] = version.split('+')[0].split('-');
    return { core: core.split('.').map(BigInt), pre: prerelease.length ? prerelease.join('-').split('.') : null };
  }
  const a = parts(left);
  const b = parts(right);
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  if (!a.pre || !b.pre) return a.pre ? -1 : b.pre ? 1 : 0;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    if (a.pre[i] === b.pre[i]) continue;
    const aNumeric = /^\d+$/.test(a.pre[i]);
    const bNumeric = /^\d+$/.test(b.pre[i]);
    if (aNumeric && bNumeric) return BigInt(a.pre[i]) > BigInt(b.pre[i]) ? 1 : -1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a.pre[i] > b.pre[i] ? 1 : -1;
  }
  return 0;
}
export function compareStableVersions(left, right) {
  if (!isStableVersion(left) || !isStableVersion(right)) throw new Error('LTS versions must be stable SemVer releases');
  return compareVersions(left, right);
}
export function archiveFile(version) { return `${assertVersion(version)}.json.gz`; }
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.versions)) throw new Error('Invalid documentation versions manifest');
  const seen = new Set();
  for (const entry of manifest.versions) {
    assertVersion(entry.version);
    if (seen.has(entry.version)) throw new Error(`Duplicate documentation version: ${entry.version}`);
    seen.add(entry.version);
    if (entry.file !== archiveFile(entry.version)) throw new Error(`Invalid archive path for ${entry.version}`);
    if (entry.ref !== `v${entry.version}` || !COMMIT_PATTERN.test(entry.commit)) throw new Error(`Invalid source provenance for ${entry.version}`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid archive hash for ${entry.version}`);
  }
  if (manifest.channels !== undefined) {
    const channels = manifest.channels;
    if (!channels || typeof channels !== 'object' || Array.isArray(channels) || !Object.hasOwn(channels, 'lts')) throw new Error('Invalid documentation channels: expected an lts value');
    if (channels.lts !== null && (!isStableVersion(channels.lts) || !seen.has(channels.lts))) throw new Error('Documentation LTS channel must point to an archived stable release');
  }
  return manifest;
}

export function validateBundle(bundle, entry) {
  assertVersion(bundle?.version);
  if (bundle.schemaVersion !== 1 || bundle.sourceRef !== `v${bundle.version}` || !COMMIT_PATTERN.test(bundle.sourceCommit) || !Array.isArray(bundle.components) || !bundle.components.length || !Array.isArray(bundle.guides) || !bundle.guides.length) throw new Error(`Invalid documentation archive: ${bundle.version}`);
  if (entry && (bundle.version !== entry.version || bundle.sourceRef !== entry.ref || bundle.sourceCommit !== entry.commit)) throw new Error(`Archive provenance does not match manifest: ${entry.version}`);
  const tags = new Set();
  for (const component of bundle.components) {
    if (!TAG_PATTERN.test(component.tag) || tags.has(component.tag) || typeof component.summary !== 'string' || typeof component.manual !== 'string' || !component.manual.trim() || component.api?.tagName !== component.tag || component.api.customElement !== true) throw new Error(`Invalid archived component: ${String(component.tag)}`);
    tags.add(component.tag);
  }
  const slugs = new Set();
  for (const guide of bundle.guides) {
    if (!GUIDE_PATTERN.test(guide.slug) || slugs.has(guide.slug) || typeof guide.title !== 'string' || !guide.title.trim() || !GUIDE_SOURCE_PATTERN.test(guide.source) || typeof guide.text !== 'string' || !guide.text.trim()) throw new Error(`Invalid archived guide: ${String(guide.slug)}`);
    slugs.add(guide.slug);
  }
  return bundle;
}

export function encodeBundle(bundle) {
  validateBundle(bundle);
  // Stable JSON order; gzip adds neither a filename nor a wall-clock mtime.
  return gzipSync(Buffer.from(JSON.stringify(bundle) + '\n'), { level: 9, mtime: 0 });
}
export function decodeBundle(bytes, entry) {
  if (entry && sha256(bytes) !== entry.sha256) throw new Error(`Archive hash mismatch: ${entry.version}`);
  let bundle;
  try { bundle = JSON.parse(gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8')); }
  catch (error) { throw new Error(`Cannot decode documentation archive: ${error.message}`); }
  return validateBundle(bundle, entry);
}
export async function readManifest(directory, { allowMissing = false } = {}) {
  try { return validateManifest(JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))); }
  catch (error) {
    if (allowMissing && error.code === 'ENOENT') return { schemaVersion: 1, versions: [] };
    throw error;
  }
}
export async function readVersion(directory, entry) {
  validateManifest({ schemaVersion: 1, versions: [entry] });
  return decodeBundle(await readFile(join(directory, entry.file)), entry);
}
export async function verifyArchives(directory, { allowMissing = false } = {}) {
  const manifest = await readManifest(directory, { allowMissing });
  const bundles = await Promise.all(manifest.versions.map(entry => readVersion(directory, entry)));
  return { manifest, bundles };
}
export async function checkArchives(directory) {
  const result = await verifyArchives(directory);
  if (!result.manifest.versions.length) throw new Error('No documentation versions have been archived');
  const listed = new Set(result.manifest.versions.map(entry => entry.file));
  for (const file of await readdir(directory)) {
    if (file.endsWith('.json.gz') && !listed.has(file)) throw new Error(`Unlisted documentation archive: ${file}`);
  }
  return result;
}
