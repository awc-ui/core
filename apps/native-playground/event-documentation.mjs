import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const cache = new Map();
const tagPattern = /^md-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const inside = (root, file) => file.startsWith(root + path.sep);
const propertyName = node => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) ? node.text : undefined;
const description = node => (node.jsDoc || []).map(doc => ts.getTextOfJSDocComment(doc.comment) || '').filter(Boolean).join('\n\n').trim();

// Parse source as data. No test/component module is imported or evaluated, and
// relative type imports cannot leave packages/core/src or follow external links.
async function sourceMetadata(repository, tag) {
  const root = await realpath(repository), sources = path.join(root, 'packages/core/src');
  const documents = new Map();
  let loaded = 0;
  async function load(file) {
    const requested = path.resolve(file);
    if (!inside(sources, requested) || !/\.tsx?$/.test(requested)) return undefined;
    if (documents.has(requested)) return documents.get(requested);
    if (++loaded > 24) return undefined;
    const pending = (async () => {
      try {
        const actual = await realpath(requested);
        if (!inside(sources, actual)) return undefined;
        const info = await stat(actual);
        if (!info.isFile() || info.size > 2 * 1024 * 1024) return undefined;
        const text = await readFile(actual, 'utf8');
        const source = ts.createSourceFile(actual, text, ts.ScriptTarget.Latest, true, actual.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        if (source.parseDiagnostics.length) return undefined;
        const definitions = new Map(), imports = new Map();
        for (const item of source.statements) {
          if ((ts.isInterfaceDeclaration(item) || ts.isTypeAliasDeclaration(item)) && item.name) definitions.set(item.name.text, item);
          if (ts.isImportDeclaration(item) && ts.isStringLiteralLike(item.moduleSpecifier) && item.moduleSpecifier.text.startsWith('.')) {
            const bindings = item.importClause?.namedBindings;
            if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) imports.set(binding.name.text, { name: binding.propertyName?.text || binding.name.text, module: item.moduleSpecifier.text });
          }
        }
        return { source, definitions, imports, file: actual };
      } catch { return undefined; }
    })();
    documents.set(requested, pending);
    return pending;
  }
  async function named(document, name) {
    const local = document.definitions.get(name);
    if (local) return { document, node: local };
    const imported = document.imports.get(name);
    if (!imported) return undefined;
    const base = path.resolve(path.dirname(document.file), imported.module);
    const candidates = /\.tsx?$/.test(base) ? [base] : [base + '.ts', base + '.tsx', path.join(base, 'index.ts')];
    for (const file of candidates) {
      const target = await load(file), node = target?.definitions.get(imported.name);
      if (node) return { document: target, node };
    }
    return undefined;
  }
  async function fields(document, node, seen = new Set(), depth = 0) {
    if (!node || depth > 12) return undefined;
    if (ts.isParenthesizedTypeNode(node)) return fields(document, node.type, seen, depth + 1);
    if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
      // Do not pretend generic type parameters have been instantiated. Nested
      // generic property types remain exact authored text in their field row.
      if (node.typeArguments?.length) return undefined;
      const name = (node.typeName || node.expression).getText(document.source);
      const target = await named(document, name);
      if (!target) return undefined;
      const key = `${target.document.file}:${target.node.name.text}`;
      if (seen.has(key)) return undefined;
      return fields(target.document, target.node, new Set([...seen, key]), depth + 1);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      if (node.typeParameters?.length) return undefined;
      return fields(document, node.type, seen, depth + 1);
    }
    if (ts.isIntersectionTypeNode(node)) {
      const groups = await Promise.all(node.types.map(type => fields(document, type, seen, depth + 1)));
      if (groups.some(group => !group)) return undefined;
      const merged = new Map();
      for (const field of groups.flat()) {
        const previous = merged.get(field.name);
        if (previous && previous.type !== field.type) return undefined;
        merged.set(field.name, previous ? { ...field, optional: previous.optional && field.optional, description: previous.description || field.description } : field);
      }
      return [...merged.values()];
    }
    if (!ts.isInterfaceDeclaration(node) && !ts.isTypeLiteralNode(node)) return undefined;
    if (node.typeParameters?.length) return undefined;
    const result = new Map();
    if (ts.isInterfaceDeclaration(node)) for (const clause of node.heritageClauses || []) for (const base of clause.types) {
      const inherited = await fields(document, base, seen, depth + 1);
      if (!inherited) return undefined;
      for (const field of inherited) result.set(field.name, field);
    }
    for (const member of node.members) {
      const name = propertyName(member.name);
      if (!ts.isPropertySignature(member) || name === undefined || !member.type) continue;
      result.set(name, { name, type: member.type.getText(document.source), description: description(member), optional: Boolean(member.questionToken) });
    }
    return [...result.values()];
  }
  const document = await load(path.join(sources, 'components', tag, `${tag}.tsx`));
  if (!document) return { eventTypes: [], eventPayloads: [] };
  const eventTypes = [], eventPayloads = [];
  for (const [name, node] of document.definitions) {
    const extracted = await fields(document, node);
    const body = ts.isInterfaceDeclaration(node) ? node.members.map(member => member.getFullText(document.source)).join('').trim() : node.type.getText(document.source);
    eventTypes.push({ name, kind: ts.isInterfaceDeclaration(node) ? 'interface' : 'type', body, description: description(node), ...(extracted ? { fields: extracted } : {}) });
  }
  for (const declaration of document.source.statements) if (ts.isClassDeclaration(declaration)) for (const member of declaration.members) {
    const name = propertyName(member.name);
    const decorated = ts.canHaveDecorators(member) && ts.getDecorators(member)?.some(decorator => ts.isCallExpression(decorator.expression) && decorator.expression.expression.getText(document.source) === 'Event');
    if (!name || !decorated || !member.type || !ts.isTypeReferenceNode(member.type) || member.type.typeName.getText(document.source) !== 'EventEmitter') continue;
    const type = member.type.typeArguments?.[0];
    if (!type) continue;
    const extracted = await fields(document, type);
    eventPayloads.push({ name, detail: type.getText(document.source), ...(extracted ? { fields: extracted } : {}) });
  }
  return { eventTypes, eventPayloads };
}

/** Supplement existing docs; preserve their raw declarations and unrelated data. */
export async function enrichEventDocumentation(repository, tag, documentation) {
  if (!tagPattern.test(tag)) throw new TypeError('Invalid component tag.');
  if (!documentation || typeof documentation !== 'object' || Array.isArray(documentation)) return documentation;
  const root = await realpath(repository), key = `${root}:${tag}`;
  let cached = cache.get(key);
  if (!cached || Date.now() - cached.time > 5000) {
    cached = { time: Date.now(), promise: sourceMetadata(root, tag) }; cache.set(key, cached);
    while (cache.size > 128) cache.delete(cache.keys().next().value);
    cached.promise.catch(() => { if (cache.get(key) === cached) cache.delete(key); });
  }
  const metadata = await cached.promise;
  const result = structuredClone(documentation);
  const types = new Map(metadata.eventTypes.map(item => [item.name, item]));
  result.eventTypes = (result.eventTypes || []).map(item => {
    const source = types.get(item.name);
    return source ? { ...item, ...(source.description ? { description: source.description } : {}), ...(source.fields ? { fields: source.fields } : {}) } : item;
  });
  // Only actual @Event declarations participate; never infer field semantics
  // from prose, method bodies, or references to unrelated DOM events.
  const payloads = new Map((result.eventPayloads || []).map(item => [item.name, item]));
  for (const source of metadata.eventPayloads) payloads.set(source.name, { ...payloads.get(source.name), ...source });
  result.eventPayloads = [...payloads.values()];
  return structuredClone(result);
}
