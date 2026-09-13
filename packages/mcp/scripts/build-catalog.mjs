#!/usr/bin/env node
// Bundle only Core's public documentation. No filesystem or network tools run
// in the server; the installed tarball is independent of the source checkout.
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAbsolute, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const defaultRepository = fileURLToPath(new URL('../../../', import.meta.url));
const defaultOutput = fileURLToPath(new URL('../dist/', import.meta.url));
const definitions = [
  ['build-director', 'AWC UI build director', 'main-llm.md'],
  ['installation', 'Installation', 'getting-started/installation.mdx'],
  ['react', 'React and Next.js', 'frameworks/react.mdx'],
  ['vue', 'Vue and Nuxt', 'frameworks/vue.mdx'],
  ['angular', 'Angular', 'frameworks/angular.mdx'],
  ['svelte', 'Svelte and SvelteKit', 'frameworks/svelte.mdx'],
  ['web-components', 'HTML and custom elements', 'frameworks/web-components.mdx'],
  ['ssr', 'Server rendering', 'frameworks/ssr.mdx'],
  ['theming', 'Theme customization', 'theming/customization.mdx'],
  ['tokens', 'Design tokens', 'theming/tokens.mdx'],
  ['accessibility', 'Accessibility', 'guides/accessibility.mdx'],
];

export async function buildCatalog({ repository = defaultRepository, output = defaultOutput, env = process.env } = {}) {
  const releasedPackage = env.AWC_MCP_CORE_PACKAGE;
  const guidesRef = env.AWC_MCP_GUIDES_REF;
  if (Boolean(releasedPackage) !== Boolean(guidesRef)) {
    throw new Error('Set AWC_MCP_CORE_PACKAGE and AWC_MCP_GUIDES_REF together for a released documentation build.');
  }
  if (releasedPackage && !isAbsolute(releasedPackage)) {
    throw new Error('AWC_MCP_CORE_PACKAGE must be an absolute path to an extracted @awc-ui/core package.');
  }

  const core = releasedPackage || join(repository, 'packages/core');
  const pkg = JSON.parse(await readFile(join(core, 'package.json'), 'utf8'));
  if (pkg.name !== '@awc-ui/core' || typeof pkg.version !== 'string' || !pkg.version) {
    throw new Error('Documentation source must be an @awc-ui/core package with a version.');
  }
  let guidesCommit;
  if (releasedPackage) {
    // Resolve once so every guide comes from the same immutable commit. Arguments
    // are passed directly to git, never through a shell or an untrusted pathspec.
    guidesCommit = execFileSync('git', ['-C', repository, 'rev-parse', '--verify', '--end-of-options', `${guidesRef}^{commit}`], { encoding: 'utf8' }).trim();
    const guidePackage = JSON.parse(execFileSync('git', ['-C', repository, 'show', `${guidesCommit}:packages/core/package.json`], { encoding: 'utf8' }));
    if (guidePackage.name !== '@awc-ui/core' || guidePackage.version !== pkg.version) {
      throw new Error(`Guide ref ${guidesRef} must contain @awc-ui/core version ${pkg.version}; found ${guidePackage.name}@${guidePackage.version}.`);
    }
  } else {
    // Source builds regenerate the public API. Released builds must preserve the
    // exact npm artifact instead of including newer, unpublished Core features.
    execFileSync(process.execPath, [join(repository, 'scripts/generate-docs.mjs')], { stdio: 'inherit' });
    execFileSync(process.execPath, [join(repository, 'scripts/generate-custom-elements-manifest.mjs')], { stdio: 'inherit' });
  }

  const manifest = JSON.parse(await readFile(join(core, 'custom-elements.json'), 'utf8'));
  const components = [];
  for (const module of manifest.modules) {
    for (const api of module.declarations ?? []) {
      if (!api.customElement || !api.tagName) continue;
      const source = `packages/core/src/components/${api.tagName}/readme.md`;
      components.push({
        tag: api.tagName,
        summary: api.summary ?? api.description ?? '',
        source,
        url: `https://awc-ui.dev/components/${api.tagName.replace(/^md-/, '')}/readme.md`,
        api,
        manual: await readFile(join(core, 'src/components', api.tagName, 'readme.md'), 'utf8'),
      });
    }
  }
  components.sort((a, b) => a.tag.localeCompare(b.tag));
  if (!components.length) throw new Error('Core manifest contains no components');

  const guides = [];
  for (const [id, title, path] of definitions) {
    const source = id === 'build-director' ? path : `apps/docs/src/content/docs/${path}`;
    const text = releasedPackage
      ? id === 'build-director'
        ? await readFile(join(core, path), 'utf8')
        : execFileSync('git', ['-C', repository, 'show', `${guidesCommit}:${source}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      : await readFile(join(repository, source), 'utf8');
    guides.push({ id, title, source, text });
  }
  const catalog = { schemaVersion: 1, coreVersion: pkg.version, components, guides };
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  await copyFile(join(releasedPackage || repository, 'LICENSE'), join(output, '../LICENSE'));
  console.log(`Bundled ${components.length} Core component manuals and ${guides.length} guides (Core ${pkg.version}${guidesCommit ? `, guides ${guidesCommit}` : ''}).`);
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildCatalog();
}
