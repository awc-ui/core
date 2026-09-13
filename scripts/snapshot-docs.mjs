#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { archiveFile, assertVersion, checkArchives, compareStableVersions, encodeBundle, isStableVersion, sha256, validateBundle, validateManifest, verifyArchives } from './lib/docs-versions.mjs';

const defaultRepository = fileURLToPath(new URL('../', import.meta.url));
const guideRoot = 'apps/docs/src/content/docs/';
const guideDirectories = ['getting-started', 'frameworks', 'theming', 'behaviour', 'guides', 'recipes'];
function git(repository, args) {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function taggedFile(repository, commit, path) {
  try { return git(repository, ['show', `${commit}:${path}`]); }
  catch { throw new Error(`Missing release source: ${path} at ${commit}`); }
}
function guideTitle(text, source) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const title = frontmatter?.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  if (!title) throw new Error(`Missing guide title: ${source}`);
  if (title.startsWith('"') && title.endsWith('"')) return JSON.parse(title);
  if (title.startsWith("'") && title.endsWith("'")) return title.slice(1, -1).replaceAll("''", "'");
  return title;
}

export async function createSnapshot({ repository = defaultRepository, ref, packageDirectory } = {}) {
  // A named release tag is required: HEAD/main can contain unreleased APIs
  // while package.json retains the previous version. All reads use one commit.
  const sourceRef = typeof ref === 'string' ? ref.replace(/^refs\/tags\//, '') : '';
  if (!sourceRef.startsWith('v')) throw new Error('Use --ref v<version> for an existing release tag');
  const version = assertVersion(sourceRef.slice(1));
  let sourceCommit;
  try { sourceCommit = git(repository, ['rev-parse', '--verify', '--end-of-options', `refs/tags/${sourceRef}^{commit}`]).trim(); }
  catch { throw new Error(`Release tag does not exist: ${sourceRef}`); }
  const sourcePackage = JSON.parse(taggedFile(repository, sourceCommit, 'packages/core/package.json'));
  if (sourcePackage.name !== '@awc-ui/core' || sourcePackage.version !== version) throw new Error(`Release tag ${sourceRef} must contain @awc-ui/core@${version}`);
  let manifest;
  if (packageDirectory) {
    if (!isAbsolute(packageDirectory)) throw new Error('--package must be an absolute extracted package directory');
    const publishedPackage = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
    if (publishedPackage.name !== '@awc-ui/core' || publishedPackage.version !== version) throw new Error(`Published package must be @awc-ui/core@${version}`);
    manifest = JSON.parse(await readFile(join(packageDirectory, 'custom-elements.json'), 'utf8'));
    let taggedManifest;
    try { taggedManifest = JSON.parse(git(repository, ['show', `${sourceCommit}:packages/core/custom-elements.json`])); }
    catch { /* Older tags may not contain this generated artifact. */ }
    if (taggedManifest && !isDeepStrictEqual(taggedManifest, manifest)) throw new Error(`Published API does not match release tag ${sourceRef}`);
  } else {
    manifest = JSON.parse(taggedFile(repository, sourceCommit, 'packages/core/custom-elements.json'));
  }
  if (!Array.isArray(manifest.modules)) throw new Error('Core custom-elements manifest has no modules');
  const components = [];
  for (const module of manifest.modules) {
    for (const api of module.declarations ?? []) {
      if (!api.customElement || !api.tagName) continue;
      if (!/^md-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(api.tagName)) throw new Error(`Unsafe component tag: ${api.tagName}`);
      const source = `packages/core/src/components/${api.tagName}/readme.md`;
      const taggedManual = taggedFile(repository, sourceCommit, source);
      const manual = packageDirectory ? await readFile(join(packageDirectory, 'src/components', api.tagName, 'readme.md'), 'utf8') : taggedManual;
      if (manual !== taggedManual) throw new Error(`Published manual does not match release tag: ${api.tagName}`);
      components.push({ tag: api.tagName, summary: api.summary ?? api.description ?? '', manual, api });
    }
  }
  components.sort((a, b) => a.tag.localeCompare(b.tag, 'en'));
  const sources = git(repository, ['ls-tree', '-r', '--name-only', sourceCommit, '--', ...guideDirectories.map(dir => `${guideRoot}${dir}/`)])
    .split('\n').filter(path => /\.mdx?$/.test(path)).sort();
  const guides = sources.map(source => {
    const text = taggedFile(repository, sourceCommit, source);
    const slug = source.slice(guideRoot.length).replace(/\.mdx?$/, '').replace(/\/index$/, '');
    return { slug, title: guideTitle(text, source), source, text };
  });
  return validateBundle({ schemaVersion: 1, version, sourceRef, sourceCommit, components, guides });
}

export async function saveSnapshot(directory, bundle) {
  const bytes = encodeBundle(bundle);
  const entry = { version: bundle.version, ref: bundle.sourceRef, commit: bundle.sourceCommit, sha256: sha256(bytes), file: archiveFile(bundle.version) };
  const { manifest, bundles } = await verifyArchives(directory, { allowMissing: true });
  const index = manifest.versions.findIndex(item => item.version === entry.version);
  if (index !== -1) {
    // Compare source content, not the compressor implementation's output. A
    // future zlib update must not rewrite or invalidate an existing archive.
    if (!isDeepStrictEqual(bundles[index], bundle)) throw new Error(`Refusing to overwrite immutable documentation version ${entry.version}`);
    return { entry: manifest.versions[index], created: false };
  }
  await mkdir(directory, { recursive: true });
  const file = join(directory, entry.file);
  try { await writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!(await readFile(file)).equals(bytes)) throw new Error(`Refusing to overwrite existing archive file ${entry.file}`);
  }
  const updated = { ...manifest, versions: [...manifest.versions, entry] };
  await writeManifest(directory, updated);
  return { entry, created: true };
}
async function writeManifest(directory, manifest) {
  validateManifest(manifest);
  const temporary = join(directory, `.manifest-${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n');
  await rename(temporary, join(directory, 'manifest.json'));
}
export function assertLtsTarget(manifest, version, { requireArchived = true } = {}) {
  if (!isStableVersion(version)) throw new Error('LTS can only designate a stable SemVer release, without a prerelease suffix');
  if (requireArchived && !manifest.versions.some(entry => entry.version === version)) throw new Error(`Cannot designate unarchived version ${version} as LTS`);
  const current = manifest.channels?.lts;
  if (current && compareStableVersions(version, current) < 0) throw new Error(`Refusing to downgrade documentation LTS from ${current} to ${version}`);
}
export async function promoteLts(directory, version) {
  // Promotion changes only the pointer. Verify every immutable archive first,
  // and never infer an LTS designation from the newest stable/beta release.
  const { manifest } = await checkArchives(directory);
  assertLtsTarget(manifest, version);
  if (manifest.channels?.lts === version) return { version, changed: false, manifest };
  const updated = { ...manifest, channels: { ...manifest.channels, lts: version } };
  await writeManifest(directory, updated);
  return { version, changed: true, manifest: updated };
}
export async function snapshotDocs(options = {}) {
  const repository = options.repository ?? defaultRepository;
  const directory = options.output ?? join(repository, 'apps/docs/versions');
  const bundle = await createSnapshot({ ...options, repository });
  if (options.lts) {
    // Reject a beta or downgrade before creating any new snapshot files.
    const { manifest } = await verifyArchives(directory, { allowMissing: true });
    assertLtsTarget(manifest, bundle.version, { requireArchived: false });
  }
  const result = { ...await saveSnapshot(directory, bundle), bundle };
  if (options.lts) result.lts = await promoteLts(directory, bundle.version);
  return result;
}
export function parseArguments(args) {
  const options = {};
  const flags = { '--ref': 'ref', '--package': 'packageDirectory', '--repository': 'repository', '--output': 'output', '--promote-lts': 'promoteLts' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--check' || arg === '--help' || arg === '--lts') {
      if (options[arg.slice(2)]) throw new Error(`Repeated option: ${arg}`);
      options[arg.slice(2)] = true; continue;
    }
    if (!flags[arg] || !args[i + 1] || args[i + 1].startsWith('--') || options[flags[arg]]) throw new Error(`Unknown, repeated, or incomplete option: ${arg}`);
    options[flags[arg]] = args[++i];
  }
  if (options.check && (options.ref || options.packageDirectory || options.lts || options.promoteLts)) throw new Error('--check cannot be combined with snapshot or LTS promotion options');
  if (options.promoteLts && (options.ref || options.packageDirectory || options.lts)) throw new Error('--promote-lts cannot be combined with --ref, --package, or --lts');
  if (options.lts && !options.ref) throw new Error('--lts requires --ref v<stable-version>');
  if (options.promoteLts) assertVersion(options.promoteLts);
  if (!options.check && !options.help && !options.ref && !options.promoteLts) throw new Error('Provide --ref v<version>, --promote-lts <version>, or --check');
  if (options.repository) options.repository = resolve(options.repository);
  if (options.output) options.output = resolve(options.output);
  return options;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/snapshot-docs.mjs --ref v<version> [--package /absolute/extracted/package] [--lts]\n       node scripts/snapshot-docs.mjs --promote-lts <archived-stable-version>\n       node scripts/snapshot-docs.mjs --check\n\nArchives released Core manuals, APIs, and guides. Existing snapshots are immutable.\nLTS is designated explicitly; --lts captures a stable release and sets its channel.');
    } else if (options.check) {
      const directory = options.output ?? join(options.repository ?? defaultRepository, 'apps/docs/versions');
      const { manifest } = await checkArchives(directory);
      console.log(`Verified ${manifest.versions.length} immutable documentation archive(s).`);
    } else if (options.promoteLts) {
      const directory = options.output ?? join(options.repository ?? defaultRepository, 'apps/docs/versions');
      const { version, changed } = await promoteLts(directory, options.promoteLts);
      console.log(`${changed ? 'Designated' : 'Verified existing'} documentation LTS: ${version}.`);
    } else {
      const { entry, created, bundle, lts } = await snapshotDocs(options);
      console.log(`${created ? 'Archived' : 'Verified existing'} ${entry.version}: ${bundle.components.length} components, ${bundle.guides.length} guides, source ${entry.commit}.`);
      if (lts) console.log(`${lts.changed ? 'Designated' : 'Verified existing'} documentation LTS: ${lts.version}.`);
    }
  } catch (error) {
    console.error(`[docs:versions] ${error.message}`);
    process.exitCode = 1;
  }
}
