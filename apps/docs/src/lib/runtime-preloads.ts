/**
 * Resolve critical custom-element chunks from Stencil's emitted ESM exports.
 * This runs only in Astro's frontmatter; no manifest parser ships to browsers.
 * Reading exports avoids baking build hashes or bundle groupings into markup.
 */
export function getHeroRuntimePreloads(
  modules: Record<string, string>,
  heroMarkup: string,
): string[] {
  const sources = new Map(Object.entries(modules).map(([path, source]) => [path.split('/').pop()!, source]));
  const tags = new Set(Array.from(heroMarkup.matchAll(/<(md-[a-z0-9-]+)\b/g), (match) => match[1]));
  const entries = new Map<string, string>();

  for (const [file, source] of sources) {
    if (!file.endsWith('.entry.js')) continue;
    for (const exported of source.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
      for (const declaration of exported[1].split(',')) {
        const name = declaration.trim().split(/\s+as\s+/).pop()!;
        if (/^md_[a-z0-9_]+$/.test(name)) entries.set(name.replace(/_/g, '-'), file);
      }
    }
  }

  const files = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    const source = sources.get(file);
    if (source === undefined) throw new Error(`[awc-ui] Missing critical runtime module: ${file}`);
    files.add(file);
    // Emitted static imports / re-exports only. Dynamic imports belong to the
    // normal lazy loader and must not pull below-the-fold components eagerly.
    for (const dependency of source.matchAll(/\b(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g)) {
      visit(dependency[1]);
    }
  };

  visit('md3.esm.js');
  for (const tag of tags) {
    const entry = entries.get(tag);
    if (!entry) throw new Error(`[awc-ui] No built runtime entry for hero component: ${tag}`);
    visit(entry);
  }
  return Array.from(files, (file) => `/awc-runtime/md3/${file}`);
}
