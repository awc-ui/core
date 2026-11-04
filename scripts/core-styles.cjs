/**
 * Core's external stylesheet, shared by Stencil builds and the manual emitter.
 * Keep this outside globalStyle: that embeds the tokens in custom-element JS.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const defaultRepository = path.resolve(__dirname, '..');

function coreStyleInputs(repository = defaultRepository) {
  return {
    tokens: path.join(repository, 'packages/tokens/src/tokens.css'),
    layout: path.join(repository, 'packages/core/src/pre-hydration.css'),
    components: path.join(repository, 'packages/core/src/components'),
  };
}

function componentTags(componentsDirectory) {
  const tags = fs.readdirSync(componentsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('md-'))
    .map(entry => entry.name)
    .sort();
  if (!tags.length) throw new Error('core-styles: no md-* components found');
  return tags;
}

function generateCoreStyles(repository = defaultRepository) {
  const inputs = coreStyleInputs(repository);
  const tags = componentTags(inputs.components);
  const requireCore = createRequire(path.join(defaultRepository, 'packages/core/package.json'));
  const { transformSync } = requireCore('esbuild');
  const source = [
    fs.readFileSync(inputs.tokens, 'utf8'),
    fs.readFileSync(inputs.layout, 'utf8'),
    // A definition can exist while its lazy render is still pending. On hosts
    // with a box, opacity also covers descendants that set visibility:visible.
    // Release at Stencil's completed-render marker, leaving the component's
    // own hidden states and the application's styles in control afterward.
    `${tags.map(tag => `${tag}:not(.hydrated)`).join(',')}{visibility:hidden!important;opacity:0!important}`,
    // display:contents hosts have no box to apply opacity to. Conceal authored
    // light-DOM descendants too, including those overriding inherited visibility.
    `:is(${tags.join(',')}):not(.hydrated) *{visibility:hidden!important}`,
  ].join('\n');
  const { code } = transformSync(source, { loader: 'css', minify: true });
  return { css: code, tags, sourceBytes: Buffer.byteLength(source), inputs };
}

function coreStylesOutputTarget({ repository = defaultRepository, additionalFiles = [] } = {}) {
  return {
    type: 'custom',
    name: 'awc-core-styles',
    // Omit taskShouldRun: Stencil's default runs during both build and watch.
    // In the installed compiler, explicitly setting "always" skips plain builds.
    async generator(config, compilerCtx) {
      const { css, inputs } = generateCoreStyles(repository);
      compilerCtx.addWatchFile(inputs.tokens);
      compilerCtx.addWatchFile(inputs.layout);
      compilerCtx.addWatchDir(inputs.components, true);

      // Stencil normalizes www/dist into concrete dist-global-styles targets
      // even without globalStyle. This respects custom output directories,
      // namespaces and isolated coverage builds.
      const files = new Set([
        ...config.outputTargets
          .filter(target => target.type === 'dist-global-styles')
          .map(target => target.file),
        ...additionalFiles,
      ]);
      if (!files.size) throw new Error('core-styles: no stylesheet output paths configured');
      await Promise.all([...files].map(file => compilerCtx.fs.writeFile(file, css)));
    },
  };
}

module.exports = { componentTags, coreStyleInputs, generateCoreStyles, coreStylesOutputTarget };
