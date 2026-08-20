import { readFileSync, existsSync, realpathSync } from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

/**
 * Vite plugin that loads modules together with their external .map files,
 * so the final bundle's source map traces back to the original sources
 * (e.g. Stencil md-button.tsx -> compiled md-button.js -> bundle).
 */
export function sourcemapChain(patterns: string[]): Plugin {
  return {
    name: 'sourcemap-chain',
    enforce: 'pre',
    load(id) {
      if (!patterns.some((p) => id.includes(p))) return null;
      if (!id.endsWith('.js')) return null;

      let resolvedId = id;
      try { resolvedId = realpathSync(id); } catch { /* use original */ }

      const mapFile = resolvedId + '.map';
      if (!existsSync(mapFile)) return null;

      try {
        const code = readFileSync(resolvedId, 'utf-8');
        const rawMap = JSON.parse(readFileSync(mapFile, 'utf-8'));
        const mapDir = path.dirname(resolvedId);

        if (rawMap.sources) {
          rawMap.sources = rawMap.sources.map((s: string) => {
            const clean = s.replace(/\?.*$/, '');
            return path.resolve(mapDir, clean);
          });
        }

        return { code, map: rawMap };
      } catch {
        return null;
      }
    },
  };
}
