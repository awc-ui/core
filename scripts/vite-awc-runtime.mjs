import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDirectory = fileURLToPath(new URL('../packages/core/dist/esm/', import.meta.url));
const loaderModule = '\0awc-playground-lazy-loader';

/** Keep Stencil's lazy loader and its computed entry imports in one runtime.
 * Bundling the loader loses those entry files; copying only entries creates a
 * second runtime. Emit the complete original directory and import its loader.
 */
export function awcLazyRuntime() {
  let loaderReference;
  return {
    name: 'awc-playground-lazy-runtime',
    apply: 'build',
    enforce: 'pre',
    async buildStart() {
      loaderReference = undefined;
      const emitDirectory = async (directory, prefix = '') => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          const name = `${prefix}${entry.name}`;
          if (entry.isDirectory()) {
            await emitDirectory(path, `${name}/`);
          } else {
            this.addWatchFile(path);
            const reference = this.emitFile({
              type: 'asset',
              fileName: `awc-esm/${name}`,
              source: await readFile(path),
            });
            if (name === 'loader.js') loaderReference = reference;
          }
        }
      };
      await emitDirectory(runtimeDirectory);
      if (!loaderReference) this.error('Build @awc-ui/core before building a playground.');
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
  };
}
