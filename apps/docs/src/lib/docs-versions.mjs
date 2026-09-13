import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Marked } from 'marked';
import { compareVersions, isStableVersion, validateManifest } from '../../../../scripts/lib/docs-versions.mjs';

export { isStableVersion };

// Astro bundles this module into dist/chunks during a static build. Resolve the
// project ancestor in both source and build locations, rather than assuming the
// emitted module keeps its source-relative path.
function findDocsRoot() {
  let folder = dirname(fileURLToPath(import.meta.url));
  while (dirname(folder) !== folder) {
    if (existsSync(resolve(folder, 'src/content.config.ts'))) return folder;
    folder = dirname(folder);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}
const docsRoot = findDocsRoot();
const defaultDirectory = resolve(docsRoot, 'versions');
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const slugPattern = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const cache = new Map();

export function archivePath(version, slug = '') {
  if (!versionPattern.test(version) || (slug && !slugPattern.test(slug))) throw new Error('Invalid documentation path');
  return `/versions/${version}/${slug ? `${slug}/` : ''}`;
}

export function snapshotPages(snapshot) {
  return [
    ...snapshot.components.map((component) => ({
      slug: `components/${component.tag.replace(/^md-/, '')}`,
      title: component.tag,
      summary: component.summary,
      source: `packages/core/src/components/${component.tag}/readme.md`,
      text: component.manual,
      api: component.api,
      kind: 'component',
    })),
    ...snapshot.guides.map((guide) => ({ ...guide, summary: '', kind: 'guide' })),
  ];
}

/** All archive inputs are local, immutable release artifacts; never fetch during rendering. */
export async function loadDocsVersions({ directory = defaultDirectory } = {}) {
  if (!cache.has(directory)) cache.set(directory, readVersions(directory));
  return cache.get(directory);
}

async function readVersions(directory) {
  const manifest = validateManifest(JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')));
  const seen = new Set();
  return Promise.all(manifest.versions.map(async (entry) => {
    if (!versionPattern.test(entry.version) || seen.has(entry.version)
      || entry.file !== `${entry.version}.json.gz` || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !/^[a-f0-9]{40}$/.test(entry.commit) || typeof entry.ref !== 'string' || !entry.ref) {
      throw new Error('Invalid docs version entry');
    }
    seen.add(entry.version);
    const compressed = await readFile(resolve(directory, entry.file));
    if (createHash('sha256').update(compressed).digest('hex') !== entry.sha256) throw new Error(`Docs snapshot checksum mismatch: ${entry.version}`);
    const snapshot = JSON.parse(gunzipSync(compressed).toString('utf8'));
    if (snapshot.schemaVersion !== 1 || snapshot.version !== entry.version
      || snapshot.sourceCommit !== entry.commit || snapshot.sourceRef !== entry.ref
      || !Array.isArray(snapshot.components) || !Array.isArray(snapshot.guides)) {
      throw new Error(`Invalid docs snapshot: ${entry.version}`);
    }
    for (const component of snapshot.components) {
      if (!/^md-[a-z0-9-]+$/.test(component.tag) || typeof component.manual !== 'string'
        || typeof component.summary !== 'string' || !component.api || typeof component.api !== 'object') {
        throw new Error(`Invalid component snapshot: ${entry.version}`);
      }
    }
    for (const guide of snapshot.guides) {
      if (!slugPattern.test(guide.slug) || typeof guide.title !== 'string'
        || typeof guide.text !== 'string' || typeof guide.source !== 'string'
        || !guide.source || guide.source.startsWith('/') || guide.source.split('/').includes('..')) {
        throw new Error(`Invalid guide snapshot: ${entry.version}`);
      }
    }
    const pages = snapshotPages(snapshot);
    if (new Set(pages.map((page) => page.slug)).size !== pages.length) throw new Error(`Duplicate docs page: ${entry.version}`);
    return { ...entry, snapshot, pages, isLts: entry.version === manifest.channels?.lts };
  }));
}

/** Release availability and LTS support are independent: only promotion sets LTS. */
export function groupDocsVersions(releases) {
  const sorted = [...releases].sort((a, b) => compareVersions(b.version, a.version));
  const lts = sorted.find((release) => release.isLts) ?? null;
  return {
    lts,
    newer: sorted.filter((release) => release !== lts && (!lts || compareVersions(release.version, lts.version) > 0)),
    previous: sorted.filter((release) => release !== lts && lts && compareVersions(release.version, lts.version) <= 0),
  };
}

export async function currentDocSlugs({ directory = resolve(docsRoot, 'src/content/docs') } = {}) {
  const paths = new Set(['']);
  async function walk(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(resolve(folder, entry.name), `${prefix}${entry.name}/`);
      else if (/\.mdx?$/.test(entry.name)) paths.add(`${prefix}${entry.name.replace(/\.mdx?$/, '')}`.replace(/(^|\/)index$/, '').replace(/\/$/, ''));
    }
  }
  await walk(directory);
  paths.add('llm');
  return paths;
}

export function pageSlug(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return ''; }
  const slug = decoded.replace(/^\/versions\/[^/]+\/?/, '/').replace(/^\/+|\/+$/g, '');
  return slugPattern.test(slug) ? slug : '';
}

export function versionDestination(pathname, release, currentSlugs = new Set()) {
  const slug = pageSlug(pathname);
  if (!release) return currentSlugs.has(slug) && slug ? `/${slug}/` : '/';
  return archivePath(release.version, release.pages.some((page) => page.slug === slug) ? slug : '');
}

export function versionSidebar(release) {
  return [
    { label: `v${release.version} overview`, link: archivePath(release.version) },
    { label: 'Guides', items: release.pages.filter((page) => page.kind === 'guide').map((page) => ({ label: page.title, link: archivePath(release.version, page.slug) })) },
    { label: 'Components', collapsed: true, items: release.pages.filter((page) => page.kind === 'component').map((page) => ({ label: page.title, link: archivePath(release.version, page.slug) })) },
    { label: 'Documentation versions', link: '/versions/' },
  ];
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/** MDX is displayed as a reference, never compiled or executed from a historical ref. */
export function referenceMarkdown(text) {
  const lines = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').split('\n');
  let fence = null;
  let importing = false;
  return lines.map((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return line;
    }
    if (fence) return line;
    if (importing) { if (/;\s*$/.test(line)) importing = false; return ''; }
    if (/^import\s/.test(line)) { importing = !/;\s*$/.test(line); return ''; }
    if (/^\s*<\/?Tabs\s*>\s*$/.test(line) || /^\s*<\/TabItem>\s*$/.test(line)) return '';
    const tab = line.match(/^\s*<TabItem\s+label=["']([^"']+)["'][^>]*>\s*$/);
    if (tab) return `### ${tab[1]}`;
    const note = line.match(/^:::([\w-]+)(?:\[([^\]]+)\])?/);
    if (note) return `> **${note[2] || note[1]}**`;
    if (/^:::\s*$/.test(line)) return '';
    return line;
  }).join('\n');
}

export function rewriteArchiveLink(href, release, page) {
  const link = String(href || '').trim();
  if (!link || /^[\u0000-\u0020]*$/.test(link) || /[\u0000-\u001f\u007f]/.test(link)) return '#';
  if (link.startsWith('#')) return link;
  if (/^(https?:|mailto:|tel:)/i.test(link)) return link;
  if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('//') || link.includes('\\')) return '#';
  const match = link.match(/^([^?#]*)([?#].*)?$/);
  const rawPath = match?.[1] || '';
  const suffix = match?.[2] || '';
  const known = new Set(release.pages.map((candidate) => candidate.slug));
  let path;
  try { path = decodeURIComponent(rawPath); } catch { return '#'; }
  const rootSlug = path.replace(/^\/+|\/+$/g, '').replace(/\.mdx?$/, '').replace(/\/index$/, '');
  if (path.startsWith('/') && known.has(rootSlug)) return archivePath(release.version, rootSlug) + suffix;
  if (!path.startsWith('/')) {
    const relativeSlug = posix.normalize(posix.join(posix.dirname(page.slug), path)).replace(/\/$/, '').replace(/\.mdx?$/, '');
    if (known.has(relativeSlug)) return archivePath(release.version, relativeSlug) + suffix;
    const sourcePath = posix.normalize(posix.join(posix.dirname(page.source), path));
    const target = release.pages.find((candidate) => candidate.source === sourcePath);
    if (target) return archivePath(release.version, target.slug) + suffix;
    if (!sourcePath.startsWith('../') && !sourcePath.startsWith('/')) {
      return `https://github.com/awc-ui/core/blob/${release.commit}/${sourcePath.split('/').map(encodeURIComponent).join('/')}${suffix}`;
    }
  }
  // A root documentation link absent in this release returns to its archive index.
  return archivePath(release.version);
}

export function renderReferenceMarkdown(text, release, page) {
  const headings = [];
  const counts = new Map();
  const parser = new Marked({
    gfm: true,
    renderer: {
      html({ text: html }) { return html.startsWith('<!--') ? '' : escapeHtml(html); },
      heading({ tokens, depth, text: title }) {
        const stem = title.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
        const count = counts.get(stem) || 0;
        counts.set(stem, count + 1);
        const slug = `${stem}${count ? `-${count}` : ''}`;
        if (depth >= 2 && depth <= 3) headings.push({ depth, slug, text: title.replace(/[`*_]/g, '') });
        return `<h${depth} id="${escapeHtml(slug)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const destination = rewriteArchiveLink(href, release, page);
        return `<a href="${escapeHtml(destination)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text: alt }) {
        return `<a href="${escapeHtml(rewriteArchiveLink(href, release, page))}">${escapeHtml(alt || 'View image in the release source')}</a>`;
      },
      table(token) { return `<div class="archive-table">${Object.getPrototypeOf(this).table.call(this, token)}</div>`; },
    },
  });
  const html = parser.parse(referenceMarkdown(text)).replace(/^<h1\b[^>]*>.*?<\/h1>\s*/s, '');
  return { html, headings };
}
