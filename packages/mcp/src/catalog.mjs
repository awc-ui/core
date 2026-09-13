import { readFile } from 'node:fs/promises';

export async function loadCatalog() {
  try {
    return JSON.parse(await readFile(new URL('../dist/catalog.json', import.meta.url), 'utf8'));
  } catch (error) {
    throw new Error('AWC UI documentation bundle is missing or invalid. Build @awc-ui/mcp from the Core checkout or reinstall the package.', { cause: error });
  }
}

export function componentSummary(component) {
  return {
    tag: component.tag,
    summary: component.summary,
    url: component.url,
    manualUri: `awc://components/${component.tag}/manual`,
    apiUri: `awc://components/${component.tag}/api`,
  };
}

export function searchComponents(catalog, { query = '', limit = 20, offset = 0 } = {}) {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? [];
  const matches = catalog.components.map((component) => {
    const tag = component.tag.toLowerCase();
    const summary = component.summary.toLowerCase();
    const manual = component.manual.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (tag === term || tag === `md-${term}`) score += 100;
      else if (tag.includes(term)) score += 25;
      else if (summary.includes(term)) score += 10;
      else if (manual.includes(term)) score += 1;
      else return null;
    }
    return { component, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.component.tag.localeCompare(b.component.tag));
  return {
    coreVersion: catalog.coreVersion,
    total: matches.length,
    offset,
    nextOffset: offset + limit < matches.length ? offset + limit : null,
    components: matches.slice(offset, offset + limit).map(({ component }) => componentSummary(component)),
  };
}

export function getComponent(catalog, tag) {
  const component = catalog.components.find((item) => item.tag === tag);
  if (!component) throw new Error(`Unknown Core component: ${tag}. Use search_components to find an exact tag.`);
  return component;
}

export function getGuide(catalog, id) {
  const guide = catalog.guides.find((item) => item.id === id);
  if (!guide) throw new Error(`Unknown Core guide: ${id}. Use list_guides to discover guide IDs.`);
  return guide;
}
