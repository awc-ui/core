const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { canonicalSourceMap } = require('./source-maps.cjs');

/** Monocart's documented `all` API analyzes real compiled JavaScript at zero
 * hits, then maps it back to verified sources. Raw TypeScript cannot provide
 * the same executable denominator and must not be used as empty coverage. */
function completeSourceCoverage({ repository, runtime, tags, observedEntries = [] }) {
  const root = fs.realpathSync(repository), directory = fs.realpathSync(runtime);
  if (!directory.startsWith(root + path.sep)) throw new Error('The coverage runtime must be inside the repository.');
  if (!Array.isArray(tags) || !tags.length || tags.some(tag => !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) throw new Error('Component tags are required for the coverage denominator.');
  const selected = new Set(tags), mapped = new Set(), entries = new Map();
  const relative = file => path.relative(root, file).split(path.sep).join('/');
  const identities = map => new Map((map?.sources || []).flatMap((source, index) => {
    const match = /(?:^|\/)src\/(components\/md-[a-z0-9-]+\/[^?]+\.tsx?)$/.exec(source.replaceAll('\\', '/'));
    return match && !match[1].split('/').includes('..') && typeof map.sourcesContent?.[index] === 'string' ? [[match[1], map.sourcesContent[index]]] : [];
  }));
  let observedByName;
  function alreadyObserved(file, verified) {
    // Resolve at generation time, after callers have collected their real V8
    // entries. This also supports a collector appending via Monocart onEntry.
    if (!observedByName) {
      observedByName = new Map();
      for (const entry of observedEntries) {
        if (!Array.isArray(entry.functions) || !entry.functions.length) continue;
        let name; try { name = path.basename(new URL(entry.url).pathname); } catch { continue; }
        if (!observedByName.has(name)) observedByName.set(name, []);
        observedByName.get(name).push(entry);
      }
    }
    return (observedByName.get(path.basename(file)) || []).some(entry => {
      let map = entry.sourceMap;
      if (!map) {
        const inline = /sourceMappingURL=data:application\/json[^,]*;base64,([A-Za-z0-9+/=]+)/.exec(entry.source || '');
        if (inline) { try { map = JSON.parse(Buffer.from(inline[1], 'base64').toString('utf8')); } catch { return false; } }
      }
      const observed = identities(map);
      return [...identities(verified.map)].every(([source, content]) => observed.get(source) === content);
    });
  }
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.js')).sort()) {
    const file = path.join(directory, name), mapFile = `${file}.map`;
    // Stencil can hoist a component implementation into a shared p-*.js chunk.
    // Select by verified source-map ownership, not the entry filename alone.
    if (!fs.existsSync(mapFile) && !name.endsWith('.entry.js')) continue;
    if (!fs.statSync(file).isFile() || fs.realpathSync(file) !== file) throw new Error(`Coverage entry must be a regular local file: ${name}`);
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    const componentTags = new Set();
    for (const [index, source] of (map.sources || []).entries()) {
      const match = /(?:^|\/)src\/(components\/(md-[a-z0-9-]+)\/[^?]+\.tsx?)$/.exec(source.replaceAll('\\', '/'));
      if (!match || match[1].split('/').includes('..') || /\.(?:spec|e2e|d)\.tsx?$/.test(match[1])) continue;
      const original = path.join(root, 'packages/core/src', match[1]);
      const current = fs.existsSync(original) ? fs.readFileSync(original, 'utf8') : null;
      if (current === null || current !== map.sourcesContent?.[index]) throw new Error(`Stale or missing component source map: ${match[1]}`);
      componentTags.add(match[2]);
      if (selected.has(match[2])) mapped.add(match[2]);
    }
    if ([...componentTags].some(tag => selected.has(tag))) entries.set(file, { source: fs.readFileSync(file, 'utf8'), map: canonicalSourceMap(map, root, mapFile) });
  }
  const missing = [...selected].filter(tag => !mapped.has(tag));
  if (missing.length) throw new Error(`No verified compiled coverage entry for: ${missing.join(', ')}`);
  const entryPaths = new Set([...entries.keys()].map(relative));
  return {
    baseDir: root,
    all: {
      dir: directory,
      filter: file => entries.has(file) && !alreadyObserved(file, entries.get(file)),
      transformer(entry) {
        const file = fileURLToPath(entry.url), verified = entries.get(file);
        if (!verified || entry.source !== verified.source) throw new Error('Coverage runtime changed after source-map verification.');
        entry.sourceMap = structuredClone(verified.map);
      },
    },
    sourceFilter(source) {
      const normalized = source.replaceAll('\\', '/');
      // Monocart filters an untested compiled entry before calling transformer.
      // Its mapped original sources are filtered again during conversion.
      if (entryPaths.has(normalized)) return true;
      const match = /(?:^|\/)packages\/core\/src\/components\/(md-[a-z0-9-]+)\/.+\.tsx?$/.exec(normalized);
      return !!match && selected.has(match[1]) && !/\.(?:spec|e2e|d)\.tsx?$/.test(normalized);
    },
  };
}

module.exports = { completeSourceCoverage };
