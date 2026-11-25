import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const { build, transform } = createRequire(new URL('../packages/core/package.json', import.meta.url))('esbuild');

const runtimeDirectory = fileURLToPath(new URL('../packages/core/dist/esm/', import.meta.url));
const loaderModule = '\0awc-playground-lazy-loader';

export async function moduleMetadata(source, name) {
  const result = await build({ stdin: { contents: source, sourcefile: name },
    bundle: false, write: false, metafile: true, format: 'esm', logLevel: 'silent' });
  const [output] = Object.values(result.metafile.outputs);
  return {
    imports: output.imports.filter(entry => entry.kind === 'import-statement' && entry.path.startsWith('.'))
      .map(entry => entry.path),
    exports: output.exports,
  };
}

/** Keep Stencil's lazy loader and its computed entry imports in one runtime.
 * Bundling the loader loses those entry files; copying only entries creates a
 * second runtime. Preserve module boundaries/import names while minifying each
 * production module independently. The browser still gets exactly one runtime.
 */
export function awcLazyRuntime({ initialEntries = [], initialTags = [] } = {}) {
  let loaderReference;
  let config;
  let preloadReferences = [];
  return {
    name: 'awc-playground-lazy-runtime',
    apply: 'build',
    enforce: 'pre',
    configResolved(resolved) { config = resolved; },
    async buildStart() {
      loaderReference = undefined;
      preloadReferences = [];
      const references = new Map();
      const sources = new Map();
      const minify = config.build.minify !== false;
      const sourceMaps = config.build.sourcemap;
      const emitDirectory = async (directory, prefix = '') => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          const name = `${prefix}${entry.name}`;
          if (entry.isDirectory()) {
            await emitDirectory(path, `${name}/`);
          } else {
            // Copied maps refer outside the copied runtime and become invalid
            // after minification. Emit fresh maps only when requested by Vite.
            if (name.endsWith('.map')) continue;
            this.addWatchFile(path);
            let source = await readFile(path);
            if (/\.m?js$/.test(name)) {
              const original = source.toString().replace(/^\/\/# sourceMappingURL=.*$/gm, '');
              sources.set(name, original);
              if (minify || sourceMaps) {
                const output = await transform(original, {
                  loader: 'js', format: 'esm', target: config.build.target || 'es2020',
                  minify, keepNames: true, legalComments: 'eof',
                  sourcefile: name, sourcemap: sourceMaps ? 'external' : false,
                });
                source = output.code;
                if (sourceMaps) {
                  if (sourceMaps === 'inline') {
                    source += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(output.map).toString('base64')}\n`;
                  } else {
                    this.emitFile({ type: 'asset', fileName: `awc-esm/${name}.map`, source: output.map });
                    if (sourceMaps !== 'hidden') source += `\n//# sourceMappingURL=${posix.basename(name)}.map\n`;
                  }
                }
              } else source = original;
            }
            const reference = this.emitFile({
              type: 'asset',
              fileName: `awc-esm/${name}`,
              source,
            });
            references.set(name, reference);
            if (name === 'loader.js') loaderReference = reference;
          }
        }
      };
      await emitDirectory(runtimeDirectory);
      if (!loaderReference) this.error('Build @awc-ui/core before building a playground.');
      // Warm the bootstrap and explicitly requested initial components
      // when the app starts. Document-time preloads compete with the app entry
      // that renders the first content; waiting for a nested component to render
      // instead adds avoidable loader -> entry -> implementation round trips.
      const metadata = new Map();
      const describe = name => {
        if (!metadata.has(name)) metadata.set(name, moduleMetadata(sources.get(name), name));
        return metadata.get(name);
      };
      const visited = new Set();
      const visit = async name => {
        if (visited.has(name) || !sources.has(name)) return;
        visited.add(name);
        for (const dependency of (await describe(name)).imports) {
          await visit(posix.normalize(posix.join(posix.dirname(name), dependency)));
        }
      };
      await visit('loader.js');
      for (const name of initialEntries) {
        if (!sources.has(name)) this.error(`Missing initial AWC runtime entry: ${name}`);
        await visit(name);
      }
      if (initialTags.length) {
        // Stencil's lazy loader maps tag names to these underscore-separated
        // exports. A generated entry can export several custom elements.
        const entries = [...sources.keys()].filter(name => name.endsWith('.entry.js'));
        const exportsByEntry = await Promise.all(entries.map(async name => [name, (await describe(name)).exports]));
        const entriesByExport = new Map();
        for (const [name, exports] of exportsByEntry) {
          for (const exported of exports) entriesByExport.set(exported, name);
        }
        for (const tag of initialTags) {
          const name = entriesByExport.get(tag.replaceAll('-', '_'));
          if (!name) this.error(`Missing initial AWC runtime tag: ${tag}`);
          await visit(name);
        }
      }
      preloadReferences = [...visited].map(name => references.get(name));
    },
    resolveId(source) {
      if (source === '@awc-ui/core/loader') return loaderModule;
    },
    load(id) {
      if (id !== loaderModule) return;
      // Rollup resolves this emitted asset relative to the importing chunk,
      // including deployments with a nested or relative Vite base.
      return `let warmed = false;
      export async function defineCustomElements(win, options) {
        const doc = win?.document;
        if (!warmed && doc?.head) {
          warmed = true;
          for (const href of [${preloadReferences.map(reference => `import.meta.ROLLUP_FILE_URL_${reference}`).join(',')}]) {
            const link = doc.createElement('link');
            link.rel = 'modulepreload';
            link.crossOrigin = '';
            link.href = href;
            doc.head.appendChild(link);
          }
        }
        const loader = await import(/* @vite-ignore */ import.meta.ROLLUP_FILE_URL_${loaderReference});
        return loader.defineCustomElements(win, options);
      }`;
    },
  };
}
