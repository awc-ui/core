import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const { build, transform } = createRequire(new URL('../packages/core/package.json', import.meta.url))('esbuild');

const runtimeDirectory = fileURLToPath(new URL('../packages/core/dist/esm/', import.meta.url));
const loaderModule = '\0awc-playground-lazy-loader';

export async function staticModuleImports(source, name) {
  const result = await build({ stdin: { contents: source, sourcefile: name },
    bundle: false, write: false, metafile: true, format: 'esm', logLevel: 'silent' });
  return Object.values(result.metafile.outputs).flatMap(output => output.imports)
    .filter(entry => entry.kind === 'import-statement' && entry.path.startsWith('.')).map(entry => entry.path);
}

/** Keep Stencil's lazy loader and its computed entry imports in one runtime.
 * Bundling the loader loses those entry files; copying only entries creates a
 * second runtime. Preserve module boundaries/import names while minifying each
 * production module independently. The browser still gets exactly one runtime.
 */
export function awcLazyRuntime() {
  let loaderReference;
  let config;
  let preloadFiles = [];
  return {
    name: 'awc-playground-lazy-runtime',
    apply: 'build',
    enforce: 'pre',
    configResolved(resolved) { config = resolved; },
    async buildStart() {
      loaderReference = undefined;
      preloadFiles = [];
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
            if (name === 'loader.js') loaderReference = reference;
          }
        }
      };
      await emitDirectory(runtimeDirectory);
      if (!loaderReference) this.error('Build @awc-ui/core before building a playground.');
      // Fetch the small bootstrap graph with the document, eliminating the
      // app -> loader -> runtime waterfall without executing registration early.
      const visited = new Set();
      const visit = async name => {
        if (visited.has(name) || !sources.has(name)) return;
        visited.add(name);
        for (const dependency of await staticModuleImports(sources.get(name), name)) {
          await visit(posix.normalize(posix.join(posix.dirname(name), dependency)));
        }
      };
      await visit('loader.js');
      preloadFiles = [...visited].map(name => `awc-esm/${name}`);
    },
    resolveId(source) {
      if (source === '@awc-ui/core/loader') return loaderModule;
    },
    load(id) {
      if (id !== loaderModule) return;
      // Rollup resolves this emitted asset relative to the importing chunk,
      // including deployments with a nested or relative Vite base.
      return `export async function defineCustomElements(win, options) {
        const loader = await import(/* @vite-ignore */ import.meta.ROLLUP_FILE_URL_${loaderReference});
        return loader.defineCustomElements(win, options);
      }`;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        return preloadFiles.map(file => ({
          tag: 'link', injectTo: 'head',
          attrs: { rel: 'modulepreload', crossorigin: '',
            href: config.base === './' || config.base === ''
              ? './' + posix.relative(posix.dirname(context.path), '/' + file)
              : config.base + file },
        }));
      },
    },
  };
}
