import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const navigationSources = ['apps/docs/astro.config.mjs', 'apps/docs/src/data/components.json'];

/** Read the literal exclusion policy without importing or executing Astro config. */
export function docsSidebarExclusions(source) {
  const ast = ts.createSourceFile('astro.config.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let declaration;
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    declaration ||= statement.declarationList.declarations.find(node => ts.isIdentifier(node.name) && node.name.text === 'MERGED_INTO_PARENT');
  }
  const initializer = declaration?.initializer;
  const list = initializer && ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression) && initializer.expression.text === 'Set'
    && initializer.arguments?.length === 1 && initializer.arguments[0];
  if (!list || !ts.isArrayLiteralExpression(list) || list.elements.some(node => !ts.isStringLiteral(node))) {
    throw new Error('Astro component sidebar exclusion policy is unavailable.');
  }
  return new Set(list.elements.map(node => node.text));
}

/** Same category insertion order, exclusions and title sorting as buildComponentSidebar(). */
export function buildDocumentationNavigation(manifest, excluded) {
  if (!Array.isArray(manifest?.categories) || !Array.isArray(manifest?.components)) throw new Error('Invalid docs component manifest.');
  const groups = new Map();
  const validText = value => typeof value === 'string' && value.trim().length > 0;
  for (const category of manifest.categories) {
    if (!validText(category)) throw new Error('Invalid docs category.');
    groups.set(category, []);
  }
  const seen = new Set();
  for (const component of manifest.components) {
    if (typeof component.slug !== 'string' || typeof component.tag !== 'string'
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(component.slug) || !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(component.tag)
      || !validText(component.title) || !validText(component.category) || seen.has(component.tag)) throw new Error('Invalid docs component.');
    seen.add(component.tag);
    if (excluded.has(component.slug)) continue;
    if (!groups.has(component.category)) groups.set(component.category, []);
    groups.get(component.category).push({ tag: component.tag, title: component.title, slug: component.slug });
  }
  const result = [...groups].filter(([, items]) => items.length).map(([title, items]) => ({ title, items: items.sort((a, b) => a.title.localeCompare(b.title)) }));
  return { groups: result, total: result.reduce((sum, group) => sum + group.items.length, 0), sources: navigationSources };
}

export async function readDocumentationNavigation(repository) {
  const root = await realpath(repository);
  const content = await Promise.all(navigationSources.map(async relative => {
    const absolute = await realpath(path.join(root, relative));
    if (!absolute.startsWith(root + path.sep)) throw new Error('Docs source must stay inside the repository.');
    return readFile(absolute, 'utf8');
  }));
  return buildDocumentationNavigation(JSON.parse(content[1]), docsSidebarExclusions(content[0]));
}
