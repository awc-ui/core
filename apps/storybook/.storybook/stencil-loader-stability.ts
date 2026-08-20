import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const LOADER_SUFFIX = 'packages/core/dist/esm/loader.js';

/**
 * Stencil watch rebuilds briefly delete dist/esm/loader.js while regenerating
 * output. Without a fallback, Vite's pre-transform of @awc-ui/core/define
 * fails and Storybook renders blank canvases until a manual restart.
 */
export function stencilLoaderStabilityPlugin(): Plugin {
  let cachedLoader: string | null = null;

  return {
    name: 'stencil-loader-stability',
    load(id) {
      if (!id.endsWith(LOADER_SUFFIX)) return null;

      try {
        const content = fs.readFileSync(id, 'utf8');
        cachedLoader = content;
        return content;
      } catch {
        return cachedLoader;
      }
    },
  };
}


/**
 * Stencil watch rebuilds rewrite dist/esm wholesale (hashed runtime chunks
 * rotate, files delete + reappear). Vite's incremental cache cannot stay
 * consistent through that: fresh page loads after a rebuild intermittently
 * mix chunk generations — two live Stencil runtimes whose vnode sentinels
 * don't match, and every shadow root renders empty
 * (createElementNS('[object Object]')). Glob-pinning the loader made it
 * worse; loader-content caching only bridges the deletion window.
 *
 * The durable fix is boring: when the dist rebuild QUIESCES, restart the
 * Vite dev server. A restart rebuilds the module graph from one consistent
 * dist generation and full-reloads clients — a few seconds per core rebuild,
 * but correct every time (the corrupt alternative forced a full manual
 * clean-restart anyway).
 */
export function stencilDistRestartPlugin(): Plugin {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let restarting = false;
  return {
    name: 'stencil-dist-restart',
    configureServer(server) {
      const isDist = (file: string) => file.includes('packages/core/dist/');
      const schedule = (file: string) => {
        if (!isDist(file) || restarting) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          restarting = true;
          healMixedRuntime(server);
          server.config.logger.info('[stencil-dist-restart] dist rebuilt — purging vite cache + restarting for a consistent module graph');
          // The on-disk cache (node_modules/.vite) survives server.restart()
          // and was the final stale layer — a restart alone still served
          // mixed-generation transforms (empty shadow roots) after some
          // rebuilds. Every reliable manual recovery purged it; do the same.
          try {
            fs.rmSync(server.config.cacheDir, { recursive: true, force: true });
          } catch {
            /* cache dir may not exist */
          }
          void server.restart().finally(() => {
            restarting = false;
          });
        }, 900); // quiesce: stencil writes many files per rebuild
      };
      server.watcher.on('change', schedule);
      server.watcher.on('add', schedule);
      server.watcher.on('unlink', schedule);
    },
  };
}

/**
 * Stencil's incremental watch can emit a MIXED dist generation: the loader
 * updated to a freshly-rotated runtime chunk (index-<hash>.js) while
 * content-unchanged entries still import the previous one — two live
 * runtimes, empty shadow roots, createElementNS('[object Object]').
 * Detect the divergence and rewrite the loader's ref to the entries'
 * runtime (the pair that was proven working one generation ago) so the
 * served graph agrees on ONE runtime until the next full rebuild.
 */
function healMixedRuntime(server: { config: { logger: { warn(msg: string): void } } }): void {
  try {
    const esmDir = path.resolve(__dirname, '../../../packages/core/dist/esm');
    const ref = (file: string): string | null => {
      try {
        const m = fs.readFileSync(path.join(esmDir, file), 'utf8').match(/index-[A-Za-z0-9_-]+\.js/);
        return m ? m[0] : null;
      } catch {
        return null;
      }
    };
    const loaderRef = ref('loader.js');
    if (!loaderRef) return;
    const entries = fs.readdirSync(esmDir).filter((f) => f.endsWith('.entry.js'));
    const counts = new Map<string, number>();
    for (const e of entries) {
      const r = ref(e);
      if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    if (!counts.size) return;
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (majority === loaderRef) return;
    const loaderPath = path.join(esmDir, 'loader.js');
    fs.writeFileSync(loaderPath, fs.readFileSync(loaderPath, 'utf8').split(loaderRef).join(majority));
    server.config.logger.warn(
      `[stencil-dist-restart] MIXED runtime generations detected (loader→${loaderRef}, entries→${majority}) — rewrote loader to the entries' runtime`,
    );
  } catch {
    /* best-effort self-heal */
  }
}
