const fs = require('node:fs');
const path = require('node:path');

// Stencil makes sources relative to its project root, even when the artifact
// lives in an isolated output tree. Resolve only exact, verified source content;
// never relabel an arbitrary generated path as the original component.
function canonicalSourceMap(map, repository, mapFile) {
  map.sources = map.sources.map((source, index) => {
    const normalized = source.replace(/\\/g, '/');
    const match = /(?:^|\/)src\/(.+)$/.exec(normalized);
    if (match && !match[1].split('/').includes('..')) {
      const original = path.join(repository, 'packages/core/src', match[1]);
      if (fs.existsSync(original) && typeof map.sourcesContent?.[index] === 'string' && fs.readFileSync(original, 'utf8') === map.sourcesContent[index]) return original;
    }
    return path.resolve(path.dirname(mapFile), source);
  });
  return map;
}
module.exports = { canonicalSourceMap };
