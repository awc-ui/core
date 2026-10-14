import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { coverageReports, executionReports, reportDirectories, reportDirectoryDescriptor, scopedReportDirectories, scopedReportDescriptor, parseScopedRun, reportBelongsToRun, parseLCOV, parseIstanbul, parseExecutionReport, executionSummary } from './coverage-reports.mjs';
import { MAX_TEST_REPORT_BYTES, readTestRunEvidence } from './test-run-evidence.mjs';

const configurations = [
  'packages/core/jest.coverage.config.cjs', 'packages/core/stencil.config.ts', 'packages/core/stencil.config.coverage.ts',
  'apps/storybook/vitest.config.mts', 'apps/storybook/vitest.laboratory.config.mts', 'apps/storybook/.storybook/preview.ts', 'apps/storybook/.storybook/vitest.setup.ts',
  'apps/native-playground/scripts/measure-tests.mjs', 'apps/storybook/scripts/laboratory-coverage.mjs',
  'apps/native-playground/scripts/coverage/stencil.config.ts', 'apps/native-playground/scripts/coverage/playwright.config.ts',
  ...['react', 'vue', 'svelte'].map(framework => `apps/test-${framework}/playwright-ct.config.ts`),
  'apps/test-angular/playwright.config.ts',
];
const cache = new Map();
const within = (root, file) => file.startsWith(root + path.sep);
const tagPattern = /^md-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const labels = { unit: 'Unit', component: 'Component', e2e: 'End-to-end', accessibility: 'Accessibility' };

/** A finite set of evidence families; the server must also retain realpath containment checks. */
export function isCoverageEvidencePath(relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.includes('\0') || relative.split('/').includes('..')) return false;
  if (configurations.includes(relative) || [...coverageReports, ...executionReports].some(report => report.path === relative) || scopedReportDescriptor(relative) || reportDirectories.some(item => relative === `${item.directory}/run-evidence.json`) || relative === 'packages/core/coverage-snapshot.json') return true;
  if (relative.split('/').some(segment => segment.startsWith('.'))) return false;
  return /^packages\/core\/src\/(?:components|utils)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:spec|e2e)\.tsx?$/.test(relative)
    || /^apps\/test-(?:react|vue|svelte|angular)\/e2e\/[a-zA-Z0-9_.-]+\.spec\.tsx?$/.test(relative)
    || /^apps\/storybook\/src\/stories\/[a-zA-Z0-9_-]+\.stories\.tsx?$/.test(relative);
}

async function safeRead(root, relative, maxBytes = 2 * 1024 * 1024) {
  try {
    const absolute = await realpath(path.join(root, relative));
    if (!within(root, absolute)) return null;
    const info = await stat(absolute);
    if (!info.isFile() || info.size > maxBytes) return null;
    return { text: await readFile(absolute, 'utf8'), modifiedAt: info.mtime.toISOString() };
  } catch { return null; }
}
async function walk(root, relative, depth = 0) {
  if (depth > 5) return [];
  try {
    const absolute = await realpath(path.join(root, relative));
    if (!within(root, absolute)) return [];
    const entries = await readdir(absolute, { withFileTypes: true });
    const found = [];
    for (const entry of entries.slice(0, 1500)) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) found.push(...await walk(root, child, depth + 1));
      else if (entry.isFile() && isCoverageEvidencePath(child)) found.push(child);
    }
    return found;
  } catch { return []; }
}

function staticDocument(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const variables = new Map();
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) variables.set(declaration.name.text, declaration.initializer);
  }
  function resolve(node, seen = new Set()) {
    if (!node) return undefined;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) return resolve(node.expression, seen);
    if (ts.isIdentifier(node) && variables.has(node.text) && !seen.has(node.text)) return resolve(variables.get(node.text), new Set([...seen, node.text]));
    if (ts.isElementAccessExpression(node) && ts.isNumericLiteral(node.argumentExpression)) {
      const array = resolve(node.expression, seen);
      if (array && ts.isArrayLiteralExpression(array)) return resolve(array.elements[Number(node.argumentExpression.text)], seen);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const object = resolve(node.expression, seen);
      if (object && ts.isObjectLiteralExpression(object)) {
        const property = object.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(source).replace(/^['"]|['"]$/g, '') === node.name.text);
        if (property) return resolve(property.initializer, seen);
      }
    }
    return node;
  }
  function property(node, name) {
    const object = resolve(node);
    if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
    const member = object.properties.find(item => ts.isPropertyAssignment(item) && (ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name)) && item.name.text === name);
    return resolve(member?.initializer);
  }
  const exported = source.statements.find(statement => ts.isExportAssignment(statement) && !statement.isExportEquals);
  return { source, resolve, property, metadata: resolve(exported?.expression) };
}

function accessibilityConfiguration(document, node, inherited = false) {
  const settings = document.property(document.property(node, 'parameters'), 'a11y');
  if (!settings || !ts.isObjectLiteralExpression(settings)) return inherited;
  const disabled = document.property(settings, 'disable'), mode = document.property(settings, 'test');
  return disabled?.kind !== ts.SyntaxKind.TrueKeyword && !(mode && ts.isStringLiteralLike(mode) && mode.text === 'off');
}

const literalTags = text => [...new Set(text.match(/\bmd-[a-z0-9]+(?:-[a-z0-9]+)*\b/g) || [])];
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const storyKey = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function accessibilityKinds(node, title = '') {
  const kinds = new Set();
  function tokens(current) {
    if (ts.isIdentifier(current) || ts.isStringLiteralLike(current)) {
      const value = current.text;
      if (/^(?:axe|AxeBuilder|toHaveNoViolations|violations)$/.test(value)) kinds.add('axe-assertions');
      if (/^(?:.*(?:keyboard|focus|tabindex).*|activeElement|Arrow(?:Up|Down|Left|Right)|Tab|Escape)$/i.test(value)) kinds.add('keyboard-or-focus');
      if (/^(?:aria-[\w-]+|role|accessibleName|toHaveAccessibleName|toHaveAccessibleDescription|toHaveRole)$/i.test(value)) kinds.add('aria-or-semantics');
    }
    ts.forEachChild(current, tokens);
  }
  function visit(current) {
    // Only assertion expressions supply body evidence. Markup, setup calls and
    // comments containing ARIA/focus words cannot turn another check into a11y.
    if (ts.isCallExpression(current) && /^(?:expect|assert)(?:\.|\(|$)/.test(current.expression.getText())) tokens(current);
    ts.forEachChild(current, visit);
  }
  if (node) visit(node);
  if (!kinds.size && /\b(?:axe|accessib\w*|a11y|aria-[\w-]+|keyboard|tabindex|focus)\b/i.test(title)) kinds.add('named-related');
  return [...kinds].sort();
}
function inspectTests(text, file, defaultOwner, knownTags) {
  const document = staticDocument(text, file), { source } = document;
  const tests = [], stories = [];
  const htmlArguments = new Map();
  const componentImports = new Map(), localFunctions = new Map();
  for (const statement of source.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
    const imported = statement.moduleSpecifier.text;
    if (!imported.startsWith('.')) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), imported));
    const tag = /^packages\/core\/src\/components\/(md-[a-z0-9-]+)\/\1(?:\.tsx?)?$/.exec(target)?.[1];
    const bindings = statement.importClause?.namedBindings;
    if (tag && knownTags.has(tag) && bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) componentImports.set(element.name.text, tag);
  }
  function localDeclarations(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      if (!localFunctions.has(node.name.text)) localFunctions.set(node.name.text, []);
      localFunctions.get(node.name.text).push(node);
    }
    ts.forEachChild(node, localDeclarations);
  }
  localDeclarations(source);
  function directHTML(call) {
    const expression = call.expression;
    return ts.isPropertyAccessExpression(expression) && expression.name.text === 'setContent' ? call.arguments[0]
      : ts.isIdentifier(expression) && ['newE2EPage', 'newSpecPage'].includes(expression.text) ? document.property(call.arguments[0], 'html') : null;
  }
  // Recognize local fixture helpers only where a parameter directly supplies
  // setContent/new*Page HTML. Never execute a helper or guess from its name.
  for (const statement of source.statements) if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
    const indexes = new Set();
    function findHTML(node) {
      if (ts.isCallExpression(node)) {
        const html = directHTML(node);
        if (html) {
          function references(current) {
            if (ts.isIdentifier(current)) statement.parameters.forEach((parameter, index) => {
              if (ts.isIdentifier(parameter.name) && parameter.name.text === current.text) indexes.add(index);
            });
            ts.forEachChild(current, references);
          }
          references(html);
        }
      }
      ts.forEachChild(node, findHTML);
    }
    findHTML(statement.body); if (indexes.size) htmlArguments.set(statement.name.text, indexes);
  }
  function literalMarkup(node) {
    const resolved = document.resolve(node);
    if (!resolved) return null;
    if (ts.isStringLiteralLike(resolved)) return resolved.text;
    if (ts.isTemplateExpression(resolved)) {
      let value = resolved.head.text;
      for (const span of resolved.templateSpans) {
        const text = literalMarkup(span.expression); if (text === null) return null;
        value += text + span.literal.text;
      }
      return value;
    }
    return null;
  }
  function primaryMarkupTags(html) {
    const tags = new Set(), stack = [];
    const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
      const name = match[2].toLowerCase();
      if (match[1]) { const index = stack.lastIndexOf(name); if (index >= 0) stack.splice(index); continue; }
      if (knownTags.has(name) && !stack.some(tag => knownTags.has(tag))) tags.add(name);
      if (!voids.has(name) && !match[0].endsWith('/>')) stack.push(name);
    }
    return [...tags];
  }
  function helperFixtureTags(node) {
    const found = new Set(), visited = new Set();
    function visit(current, depth) {
      if (depth > 4 || ts.isFunctionDeclaration(current)) return;
      if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
        if (current.expression.text === 'newSpecPage') {
          const components = document.property(current.arguments[0], 'components'), html = document.property(current.arguments[0], 'html');
          const registered = components && ts.isArrayLiteralExpression(components) ? components.elements.filter(ts.isIdentifier).map(item => componentImports.get(item.text)).filter(Boolean) : [];
          // Only an imported real component registered in newSpecPage proves a
          // helper fixture. Fake createElement hosts and string mentions do not.
          const markup = literalMarkup(html) ?? (html && ts.isTemplateExpression(html) ? html.head.text + html.templateSpans.map(span => span.literal.text).join('') : null);
          if (markup !== null) primaryMarkupTags(markup).filter(tag => registered.includes(tag)).forEach(tag => found.add(tag));
        }
        const candidates = localFunctions.get(current.expression.text) || [];
        const scopes = []; for (let parent = current.parent; parent; parent = parent.parent) scopes.push(parent);
        const callable = candidates.filter(declaration => scopes.includes(declaration.parent)).sort((a, b) => scopes.indexOf(a.parent) - scopes.indexOf(b.parent))[0];
        if (callable && !visited.has(callable)) { visited.add(callable); visit(callable.body, depth + 1); }
      }
      ts.forEachChild(current, child => visit(child, depth));
    }
    // Exclude declarations nested in a case unless that helper is called.
    node.arguments.slice(1).forEach(argument => visit(argument, 0));
    return [...found];
  }
  function parameterTags(expression) {
    if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'each') return [];
    let array = document.resolve(expression.arguments[0]);
    if (array && ts.isCallExpression(array) && ts.isPropertyAccessExpression(array.expression) && array.expression.name.text === 'map') array = document.resolve(array.expression.expression);
    if (!array || !ts.isArrayLiteralExpression(array)) return [];
    return [...new Set(array.elements.flatMap(element => {
      let item = document.resolve(element);
      if (item && ts.isObjectLiteralExpression(item)) item = document.property(item, 'tag');
      if (item && ts.isArrayLiteralExpression(item)) item = document.resolve(item.elements[0]);
      return item && ts.isStringLiteralLike(item) && knownTags.has(item.text) ? [item.text] : [];
    }))];
  }
  function caseReferences(node, seen = new Set()) {
    const tags = new Set();
    const locals = new Set();
    function localBindings(current) {
      if ((ts.isVariableDeclaration(current) || ts.isParameter(current)) && ts.isIdentifier(current.name)) locals.add(current.name.text);
      ts.forEachChild(current, localBindings);
    }
    localBindings(node);
    function collect(current) {
      // An indexed fixture refers to that object, not every sibling in its
      // source table. Resolve it before walking identifiers such as controls.
      if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        const resolved = document.resolve(current);
        if (resolved && resolved !== current) { collect(resolved); return; }
      }
      if (ts.isStringLiteralLike(current)) literalTags(current.text).forEach(tag => tags.add(tag));
      if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) literalTags(current.tagName.getText(source)).forEach(tag => tags.add(tag));
      if (ts.isIdentifier(current) && !locals.has(current.text) && !seen.has(current.text)) {
        const resolved = document.resolve(current);
        if (resolved && resolved !== current) { seen.add(current.text); collect(resolved); }
      }
      ts.forEachChild(current, collect);
    }
    collect(node); return [...tags];
  }
  function mountedTags(node) {
    const mounted = new Set();
    function visit(current) {
      if (ts.isCallExpression(current)) {
        const expression = current.expression, direct = directHTML(current);
        const html = direct ? [direct] : ts.isIdentifier(expression) ? [...(htmlArguments.get(expression.text) || [])].map(index => current.arguments[index]) : [];
        for (const value of html) { const markup = literalMarkup(value); if (markup !== null) primaryMarkupTags(markup).forEach(tag => mounted.add(tag)); }
      }
      ts.forEachChild(current, visit);
    }
    visit(node); return [...mounted];
  }
  function visit(node, ancestors = []) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(source);
      if (/^(?:test\.)?describe(?:\.(?:only|skip|serial|parallel))*$/.test(expression) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
        ts.forEachChild(node, child => visit(child, [...ancestors, node.arguments[0].text]));
        return;
      }
      if (/^(?:it|test)(?:\.(?:only|skip|todo|concurrent|each))*\s*(?:\([\s\S]*\))?$/.test(expression)
        && !/\.(?:each)$/.test(expression) && node.arguments.length
        && (ts.isStringLiteralLike(node.arguments[0]) || ts.isTemplateExpression(node.arguments[0]))) {
        const titleNode = node.arguments[0];
        const relatedKinds = accessibilityKinds(node, [...ancestors, ts.isStringLiteralLike(titleNode) ? titleNode.text : titleNode.head.text].join(' '));
        const titlePattern = ts.isStringLiteralLike(titleNode) ? escapePattern(titleNode.text).replace(/%[sdifjo#]/g, '.+?')
          : escapePattern(titleNode.head.text) + titleNode.templateSpans.map(span => '.+?' + escapePattern(span.literal.text)).join('');
        const declaredTags = [...ancestors].reverse().map(literalTags).find(tags => tags.length) || literalTags(ts.isStringLiteralLike(titleNode) ? titleNode.text : titleNode.head.text);
        const mounted = defaultOwner ? mountedTags(node) : [];
        const parameters = parameterTags(node.expression);
        const runtimeTag = parameters.length > 0 && (ts.isTemplateExpression(titleNode) || /%[sdifjo#]/.test(titleNode.text));
        const leadingSubject = /^\s*(md-[a-z0-9]+(?:-[a-z0-9]+)*)\b/.exec(ts.isStringLiteralLike(titleNode) ? titleNode.text : titleNode.head.text)?.[1];
        const outerSubject = /^\s*(md-[a-z0-9]+(?:-[a-z0-9]+)*)\b/.exec(ancestors[0] || '')?.[1];
        const mountedSubject = leadingSubject && mounted.includes(leadingSubject) ? [leadingSubject] : [];
        const helpers = !defaultOwner && !declaredTags.length ? helperFixtureTags(node) : [];
        const caseTags = runtimeTag ? parameters : defaultOwner
          ? mountedSubject.length ? mountedSubject
            : mounted.includes(defaultOwner) || caseReferences(node).includes(defaultOwner) ? [defaultOwner]
              : mounted.length ? declaredTags.some(tag => mounted.includes(tag)) ? declaredTags.filter(tag => mounted.includes(tag)) : mounted
                : knownTags.has(outerSubject) ? [outerSubject] : [defaultOwner]
          : declaredTags.length ? declaredTags : helpers.length ? helpers : caseReferences(node);
        tests.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          title: ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : undefined,
          pattern: new RegExp(`(?:^|\\s)${[...ancestors.map(escapePattern), titlePattern].join(' ')}$`),
          tags: caseTags, runtimeTag,
          accessibility: relatedKinds.length > 0, accessibilityKinds: relatedKinds,
          skipped: /\.(?:skip|todo)\b/.test(expression) });
      }
    }
    if (ts.isVariableStatement(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) {
        if (/\bStory(?:Obj)?\b/.test(declaration.type?.getText(source) || '')) stories.push({ line: source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1, node: declaration.initializer, exportName: declaration.name.getText(source) });
      }
    }
    ts.forEachChild(node, child => visit(child, ancestors));
  }
  visit(source);
  for (const story of stories) {
    const play = document.property(story.node, 'play') || document.property(document.metadata, 'play');
    const relatedKinds = accessibilityKinds(play);
    if (!relatedKinds.length) continue;
    const name = document.property(story.node, 'name');
    tests.push({ line: story.line, title: story.exportName, tags: [], accessibility: true, accessibilityKinds: relatedKinds, skipped: false,
      storyKeys: [storyKey(story.exportName), ...(name && ts.isStringLiteralLike(name) ? [storyKey(name.text)] : [])] });
  }
  return { tests, stories, document };
}

function frameworkOwner(file, tags) {
  const name = path.basename(file).replace(/\.spec\.tsx?$/, '');
  return [name, `md-${name}`].find(tag => tags.has(tag));
}

function matchingDeclarations(source, test) {
  const named = source.tests.filter(item => item.storyKeys
    ? item.storyKeys.includes(storyKey(test.title || test.name || '')) || !!test.storyId && item.storyKeys.includes(storyKey(test.storyId.split('--').at(-1)))
    : item.pattern.test(test.name || '') || item.pattern.test(test.title || ''));
  if (named.length) return named;
  return test.line ? source.tests.filter(item => item.line === test.line) : [];
}

function testsForTag(source, tests, tag) {
  if (source.owner) return source.tags.includes(tag) ? tests : [];
  return tests.filter(test => {
    const declarations = matchingDeclarations(source, test);
    return declarations.length ? declarations.some(declaration => {
      if (!declaration.tags.includes(tag)) return false;
      if (!declaration.runtimeTag) return true;
      const namedTags = literalTags(test.title || test.name || '').filter(value => declaration.tags.includes(value));
      return namedTags.length === 1 && namedTags[0] === tag;
    }) : source.fallbackOwner === tag;
  });
}

function storyOwner(file, document, tags) {
  const component = document.property(document.metadata, 'component');
  // Explicit metadata wins over filenames. Incidental controls rendered inside a
  // story do not make every exported story a test of those controls.
  if (component && ts.isStringLiteralLike(component)) return tags.has(component.text) ? component.text : undefined;
  const basename = path.basename(file).replace(/\.stories\.tsx?$/, '').toLowerCase();
  return [...tags].find(tag => tag.replaceAll('-', '') === basename);
}

function category(id) {
  return { id, label: labels[id], status: 'unavailable', executionStatus: 'unknown', files: [], testCount: 0, countKind: 'static-declarations', commands: [], measurements: [], executions: [], audits: [], runs: [], notes: [
    'Source declarations show available test coverage, not a passed test run. Parameterized cases and loops are not expanded.',
  ] };
}
const command = (label, command) => ({ label, command });
function addEvidence(result, categoryID, evidence) {
  const entry = result.categories[categoryID]; entry.files.push(evidence); entry.testCount += evidence.testCount;
}

function runMetadata(descriptor, modifiedAt) {
  const evidence = descriptor.evidence;
  const directory = reportDirectoryDescriptor(path.posix.dirname(descriptor.path));
  return { parentCategory: descriptor.category, framework: evidence?.framework || descriptor.framework || directory?.framework,
    label: directory?.label || (typeof evidence?.label === 'string' ? evidence.label : descriptor.framework),
    recordedLabel: typeof evidence?.label === 'string' ? evidence.label : null,
    runnerKey: `${descriptor.category}:${directory?.runnerKey || path.posix.dirname(descriptor.path)}`,
    reportedAt: evidence?.completedAt || modifiedAt, timestampSource: evidence?.completedAt ? 'run-completedAt' : 'file-mtime',
    verified: !!evidence, state: evidence?.status || null, ...(descriptor.scopeId ? { scopeId: descriptor.scopeId } : {}),
    ...(evidence ? { runId: evidence.runId, runPath: descriptor.manifestPath, command: typeof evidence.command === 'string' ? evidence.command : null,
      startedAt: evidence.startedAt, completedAt: evidence.completedAt,
      source: { revision: evidence.source.revision, digest: evidence.source.digest,
        stableDuringRun: evidence.source.stableDuringRun, matchesCurrent: evidence.source.matchesCurrent,
        ...(evidence.build ? { buildInputsMatchCurrent: evidence.build.inputsMatchCurrent } : {}),
        changedFiles: evidence.source.changedFiles } } : descriptor.run ? { legacyManifestPath: descriptor.manifestPath } : {}),
  };
}

function artifactMatches(descriptor, report) {
  if (!descriptor.evidence) return !descriptor.run || reportBelongsToRun(report.modifiedAt, descriptor.run);
  const name = path.posix.basename(descriptor.path), expected = descriptor.evidence.artifacts[name];
  return descriptor.evidence.status === 'completed' && descriptor.evidence.validArtifacts.includes(name)
    && expected?.size === Buffer.byteLength(report.text) && expected.sha256 === createHash('sha256').update(report.text).digest('hex');
}

function groupedRuns(entry) {
  const groups = new Map();
  for (const [kind, records] of [['measurements', entry.measurements], ['executions', entry.executions], ['audits', entry.audits]]) for (const record of records) {
    const key = record.verified && record.runId ? `${record.runPath}:${record.runId}` : `artifact:${record.path}`;
    if (!groups.has(key)) groups.set(key, { key, runId: record.runId || null, runPath: record.runPath || null,
      category: record.parentCategory, viewCategory: entry.id, framework: record.framework, label: record.label, recordedLabel: record.recordedLabel,
      runnerKey: record.runnerKey, command: record.command || null, reportedAt: record.reportedAt,
      timestampSource: record.timestampSource, verified: !!record.verified, source: record.source || null,
      state: record.state || null,
      startedAt: record.startedAt || null, completedAt: record.completedAt || null,
      measurements: [], executions: [], audits: [], notes: record.verified ? [] : ['Saved artifact without verified run identity. It is not paired with another report.'] });
    groups.get(key)[kind].push(record);
  }
  return [...groups.values()].map(group => {
    // Alternative formats describe one run. Select an artifact, never add them.
    group.measurement = [...group.measurements].sort((a, b) => ({ lcov: 0, istanbul: 1, 'istanbul-summary': 2 }[a.format] ?? 3) - ({ lcov: 0, istanbul: 1, 'istanbul-summary': 2 }[b.format] ?? 3))[0] || null;
    group.execution = group.measurement
      ? group.executions.find(record => record.path === group.measurement.attribution.componentExecutionPath) || group.executions[0] || null
      : group.executions[0] || null;
    group.axeAudit = group.audits[0] || null;
    const statuses = [group.execution?.status, group.axeAudit?.status].filter(Boolean);
    group.status = statuses.includes('failed') ? 'failed' : statuses.includes('unknown') || !statuses.length ? 'unknown' : statuses.includes('passed') ? 'passed' : 'skipped';
    if (group.state === 'running') group.notes.push('The run is still in progress; final artifact and input checks are not yet sealed.');
    else if (group.source && !group.source.matchesCurrent) group.notes.push('The captured test inputs differ from this checkout or changed during the run; these are recorded outcomes for the captured inputs.');
    return group;
  }).sort((a, b) => Number(b.verified) - Number(a.verified) || Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || a.key.localeCompare(b.key));
}

function latestRunnerStatus(runs) {
  const latest = new Map();
  const newestFirst = [...runs].sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || Number(b.verified) - Number(a.verified));
  for (const run of newestFirst) if ((run.execution || run.axeAudit) && !latest.has(run.runnerKey)) latest.set(run.runnerKey, run.status);
  const states = [...latest.values()];
  return states.includes('failed') ? 'failed' : states.includes('unknown') || !states.length ? 'unknown'
    : states.includes('passed') ? 'passed' : 'skipped';
}

async function buildInventory(root) {
  const manifest = await safeRead(root, 'packages/core/custom-elements.json');
  if (!manifest) throw new Error('The component manifest is unavailable.');
  const json = JSON.parse(manifest.text);
  const tags = new Set((json.modules || []).flatMap(module => module.declarations || []).map(item => item.tagName).filter(tag => tagPattern.test(tag)));
  const generatedAt = new Date().toISOString();
  const inventory = new Map([...tags].map(tag => [tag, { schemaVersion: 1, tag, generatedAt, categories: Object.fromEntries(Object.keys(labels).map(id => [id, category(id)])) }]));
  const ownership = new Map();
  const previewSource = await safeRead(root, 'apps/storybook/.storybook/preview.ts');
  const preview = previewSource && staticDocument(previewSource.text, 'preview.ts');
  const storybookAccessibility = preview ? accessibilityConfiguration(preview, preview.metadata) : false;
  const files = (await Promise.all(['packages/core/src/components', 'packages/core/src/utils', 'apps/storybook/src/stories', ...['react', 'vue', 'svelte', 'angular'].map(framework => `apps/test-${framework}/e2e`)].map(directory => walk(root, directory)))).flat().sort();
  for (const file of files) {
    const source = await safeRead(root, file); if (!source) continue;
    const story = file.includes('/stories/'), framework = /^apps\/test-(react|vue|svelte|angular)\//.exec(file)?.[1];
    const categoryID = story || framework && framework !== 'angular' ? 'component' : file.includes('.e2e.') || framework === 'angular' ? 'e2e' : 'unit';
    const coreOwner = /^packages\/core\/src\/components\/(md-[a-z0-9-]+)\//.exec(file)?.[1];
    const fallbackOwner = framework ? frameworkOwner(file, tags) : undefined;
    const parsed = inspectTests(source.text, file, coreOwner || fallbackOwner, tags), declarations = story ? parsed.stories : parsed.tests;
    const owner = story ? storyOwner(file, parsed.document, tags) : coreOwner && parsed.tests.every(item => item.tags.length === 1 && item.tags[0] === coreOwner && !item.runtimeTag) ? coreOwner : undefined;
    const references = owner ? [owner] : story ? [] : [...new Set([...(fallbackOwner ? [fallbackOwner] : []), ...parsed.tests.flatMap(item => item.tags)])];
    const shared = !owner && !fallbackOwner;
    ownership.set(file, { category: categoryID, tags: references.filter(tag => tags.has(tag)), shared, owner, fallbackOwner, story, tests: parsed.tests });
    const evidence = { path: file, kind: story ? 'storybook-story' : framework ? `playwright-${framework === 'angular' ? 'e2e' : 'component'}` : categoryID === 'unit' ? 'stencil-spec' : 'stencil-e2e', testCount: declarations.length,
      countKind: story ? 'static-story-exports' : 'static-test-declarations', skippedDeclarations: parsed.tests.filter(item => item.skipped).length,
      line: declarations[0]?.line || 1, notes: shared ? ['Shared source file: only declarations naming this component or referencing it in that case are counted. A joint assertion is shared evidence, not an independent component-only test.'] : [] };
    for (const tag of references.filter(tag => tags.has(tag))) {
      const owned = owner ? declarations : parsed.tests.filter(item => item.tags.includes(tag));
      const result = inventory.get(tag); addEvidence(result, categoryID, { ...evidence, testCount: owned.length, line: owned[0]?.line || 1, skippedDeclarations: owned.filter(item => item.skipped).length });
      const related = parsed.tests.filter(item => item.accessibility && (owner || item.tags.includes(tag)));
      if (related.length) addEvidence(result, 'accessibility', { ...evidence, testCount: related.length, line: related[0]?.line || 1, kind: 'accessibility-related-tests', notes: [...evidence.notes, 'Static accessibility-related declarations (axe, ARIA, keyboard or focus); not a WCAG conformance result.'] });
      const storyAccessibility = story && accessibilityConfiguration(parsed.document, parsed.document.metadata, storybookAccessibility);
      if (story && parsed.stories.some(item => accessibilityConfiguration(parsed.document, item.node, storyAccessibility))) addEvidence(result, 'accessibility', { ...evidence, testCount: 0, kind: 'storybook-a11y-configuration', notes: [...evidence.notes, 'Configuration only: accessibility parameters apply to this component’s own stories. This is not a recorded audit or a count of accessibility assertions.'] });
    }
  }
  const scopedFiles = (await Promise.all(scopedReportDirectories.map(directory => walk(root, directory)))).flat();
  const scopedRuns = new Map();
  for (const file of scopedFiles.filter(file => file.endsWith('/run.json'))) {
    const descriptor = scopedReportDescriptor(file), report = await safeRead(root, file);
    if (!descriptor || !report) continue;
    try {
      const run = parseScopedRun(report.text, descriptor, tags);
      if (run) scopedRuns.set(file, { ...descriptor, run, modifiedAt: report.modifiedAt });
    } catch { /* A partial manifest cannot authorize saved outcomes from another run. */ }
  }
  const evidenceDirectories = new Set([...reportDirectories.map(item => item.directory), ...scopedFiles.map(file => path.posix.dirname(file))]);
  const evidenceFiles = new Set(), evidenceByDirectory = new Map();
  for (const directory of evidenceDirectories) {
    const saved = await safeRead(root, `${directory}/run-evidence.json`, 8 * 1024 * 1024);
    if (!saved) continue;
    evidenceFiles.add(directory);
    const evidence = await readTestRunEvidence(root, directory);
    const metadata = reportDirectoryDescriptor(directory);
    if (!evidence || !metadata || evidence.category !== metadata.category || evidence.framework !== metadata.framework
      || evidence.tags.some(tag => !tags.has(tag))) continue;
    evidenceByDirectory.set(directory, evidence);
  }
  // A newer content manifest is authoritative even when its output is incomplete
  // or corrupt. Its old adjacent run.json must not resurrect a saved pass.
  for (const [file] of scopedRuns) if (evidenceFiles.has(path.posix.dirname(file))) scopedRuns.delete(file);
  for (const [directory, evidence] of evidenceByDirectory) {
    const metadata = reportDirectoryDescriptor(directory), file = `${directory}/run-evidence.json`;
    scopedRuns.set(file, { ...metadata, path: file, manifestPath: file, evidence,
      run: { tags: evidence.tags.length ? evidence.tags : [...tags], files: evidence.testFiles, startedAt: evidence.startedAt,
        completedAt: evidence.completedAt, status: evidence.status === 'running' ? 'running' : evidence.exitCode === 0 ? 'passed' : 'failed',
        exitCode: evidence.exitCode, errors: Array.isArray(evidence.errors) ? evidence.errors.filter(error => typeof error === 'string') : [] } });
  }
  function reportDescriptor(descriptor) {
    const directory = path.posix.dirname(descriptor.path), metadata = reportDirectoryDescriptor(directory);
    if (!metadata) return null;
    if (evidenceFiles.has(directory)) {
      const evidence = evidenceByDirectory.get(directory), manifestPath = `${directory}/run-evidence.json`;
      if (!evidence || !evidence.validArtifacts.includes(path.posix.basename(descriptor.path))) return null;
      return { ...metadata, ...descriptor, evidence, manifestPath, run: scopedRuns.get(manifestPath).run };
    }
    if (descriptor.scopeId) {
      const saved = scopedRuns.get(descriptor.manifestPath);
      return saved ? { ...metadata, ...descriptor, run: saved.run } : null;
    }
    return { ...metadata, ...descriptor };
  }
  const scopedDescriptors = scopedFiles.map(scopedReportDescriptor).filter(Boolean);
  const measurements = [...coverageReports, ...scopedDescriptors.filter(descriptor => descriptor.kind === 'measurement')].map(reportDescriptor).filter(Boolean);
  const executions = [...executionReports, ...scopedDescriptors.filter(descriptor => descriptor.kind === 'execution')].map(reportDescriptor).filter(Boolean);
  for (const descriptor of measurements) {
    const report = await safeRead(root, descriptor.path, 32 * 1024 * 1024); if (!report) continue;
    if (!artifactMatches(descriptor, report)) continue;
    try {
      const parsed = descriptor.format === 'lcov' ? parseLCOV(report.text, tags) : parseIstanbul(report.text, tags, descriptor.format === 'istanbul-summary');
      for (const [tag, data] of parsed) {
        if (descriptor.run && !descriptor.run.tags.includes(tag)) continue;
        if (!['lines', 'branches', 'functions', 'statements'].some(name => data[name]?.total > 0)) continue;
        inventory.get(tag).categories[descriptor.category].measurements.push({ path: descriptor.path, format: descriptor.format,
          ...runMetadata(descriptor, report.modifiedAt), scope: 'component', ...data,
          notes: ['Coverage measures executed source locations; it does not establish test success.', descriptor.evidence ? 'Artifact contents match the recorded run; timestamp comes from its completion record.' : 'Timestamp is report modification time, not a verified test-run time.', 'Alternative report formats and runs are separate measurements; do not add their totals together.'] });
      }
    } catch { /* A malformed or partially written report supplies no measured evidence. */ }
  }
  const scopedExecutionFiles = new Map();
  const scopedExecutionContexts = new Map();
  for (const descriptor of executions) {
    const report = await safeRead(root, descriptor.path, MAX_TEST_REPORT_BYTES); if (!report) continue;
    if (!artifactMatches(descriptor, report)) continue;
    try {
      const grouped = new Map(), auditGroups = new Map();
      const add = (tag, categoryID, record) => {
        const key = `${tag}:${categoryID}`;
        if (!grouped.has(key)) grouped.set(key, { tag, categoryID, records: [] });
        grouped.get(key).records.push(record);
      };
      const suites = parseExecutionReport(report.text, descriptor).filter(suite => {
        const source = ownership.get(suite.file);
        return source?.category === descriptor.category && (!descriptor.run || descriptor.run.files.includes(suite.file));
      });
      if (descriptor.evidence) {
        const summary = executionSummary(suites);
        if (summary.total || summary.failedSuites) scopedExecutionContexts.set(descriptor.manifestPath, {
          path: descriptor.path, ...runMetadata(descriptor, report.modifiedAt), scope: 'report',
          sourceFileCount: new Set(suites.map(suite => suite.file)).size, ...summary,
        });
      }
      for (const suite of suites) {
        const source = ownership.get(suite.file);
        if (!source || source.category !== descriptor.category) continue;
        if (descriptor.run && !descriptor.run.files.includes(suite.file)) continue;
        // Per-case ownership comes from test source. Do not apply today's AST
        // to a report captured before that test definition changed.
        const changedTests = descriptor.evidence && [...descriptor.evidence.source.changedFiles, ...(descriptor.evidence.source.changedDuringRun || [])];
        if (changedTests?.includes(suite.file)) continue;
        for (const tag of source.tags) {
          if (descriptor.run && !descriptor.run.tags.includes(tag)) continue;
          const tests = testsForTag(source, suite.tests, tag);
          if (!tests.length && !suite.failedSuite) continue;
          add(tag, descriptor.category, { ...suite, tests, shared: source.shared });
          const related = tests.map(item => {
            const declarations = matchingDeclarations(source, item).filter(declaration => declaration.accessibility && (source.owner || declaration.tags.includes(tag)));
            const kinds = [...new Set(declarations.flatMap(declaration => declaration.accessibilityKinds || []))];
            if (!kinds.length && !source.story && /\b(?:axe|accessib\w*|a11y|aria-[\w-]+|keyboard|tabindex|focus)\b/i.test(item.name)) kinds.push('named-related');
            return { ...item, accessibilityKinds: kinds };
          }).filter(item => item.accessibilityKinds.length);
          if (related.length) add(tag, 'accessibility', { ...suite, tests: related, failedSuite: false, shared: source.shared });
          const audits = source.story ? tests.flatMap(item => item.axeAudits || []) : [];
          if (audits.length) {
            if (!auditGroups.has(tag)) auditGroups.set(tag, []);
            auditGroups.get(tag).push({ file: suite.file, audits });
          }
        }
        if (descriptor.run) {
          if (!scopedExecutionFiles.has(descriptor.manifestPath)) scopedExecutionFiles.set(descriptor.manifestPath, new Set());
          if (suite.tests.length || suite.failedSuite) scopedExecutionFiles.get(descriptor.manifestPath).add(suite.file);
        }
      }
      for (const { tag, categoryID, records } of grouped.values()) {
        const summary = executionSummary(records);
        if (!summary.total && !summary.failedSuites) continue;
        const notes = ['Outcomes describe only the test cases recorded in this report, not every source declaration or a current rerun.', descriptor.evidence ? 'Artifact contents match the recorded run; cases are limited to its intended source files and component scope.' : 'Timestamp is report modification time; correlation with another report is unverified.'];
        if (records.some(record => record.shared)) notes.push('Shared test-file outcomes are filtered by individual test/describe titles or source locations. Suite-level failures remain shared-file evidence. A case that checks multiple components can appear under each; per-component case counts are not additive.');
        if (categoryID === 'accessibility') {
          notes.push(descriptor.framework === 'vitest' ? 'Story outcomes are included only when their matching source play function contains accessibility-related assertions. A story title or configured addon alone is not a recorded accessibility audit.' : `This ${descriptor.framework} report is filtered to individual accessibility-related cases using suite/test names or matching source declarations. Other tests in the same file are excluded.`);
          notes.push('Passing axe, keyboard or ARIA checks is not a WCAG conformance or accessibility coverage percentage. Results from separate runs are not combined.');
        }
        if (summary.flaky) notes.push(`${summary.flaky} test cases passed after a retry.`);
        inventory.get(tag).categories[categoryID].executions.push({ path: descriptor.path, ...runMetadata(descriptor, report.modifiedAt),
          scope: records.some(record => record.shared) ? 'shared-test-files' : 'component-tests',
          ...(categoryID === 'accessibility' ? { accessibilityKinds: [...new Set(records.flatMap(record => record.tests.flatMap(item => item.accessibilityKinds || [])))].sort(),
            environment: descriptor.category === 'unit' ? 'mock-dom' : 'browser' } : {}),
          sourceFiles: [...new Set(records.map(record => record.file))].sort(), ...summary, notes });
      }
      for (const [tag, records] of auditGroups) {
        const audits = records.flatMap(record => record.audits), summary = executionSummary([{ tests: audits, failedSuite: false }]);
        inventory.get(tag).categories.accessibility.audits.push({ path: descriptor.path, ...runMetadata(descriptor, report.modifiedAt),
          scope: 'story-axe-audits', engine: 'axe', environment: 'browser', ...summary,
          warning: audits.filter(audit => audit.warning).length, errors: audits.filter(audit => audit.error).length,
          violations: audits.reduce((sum, audit) => sum + (audit.violations || 0), 0),
          incomplete: audits.reduce((sum, audit) => sum + (audit.incomplete || 0), 0),
          sourceFiles: [...new Set(records.map(record => record.file))].sort(),
          notes: ['Only recorded Storybook axe reports are counted. Story outcomes do not substitute for audit outcomes.',
            'Violations fail the audit even when the Storybook configuration reports a nonblocking warning. Incomplete findings need manual review.',
            'Violation and incomplete counts are rule results across the recorded audits, not unique rules or affected nodes. This is not a WCAG conformance percentage.'] });
      }
    } catch { /* Incomplete test output must never become a passing run. */ }
  }
  // A newer attempted run must not leave an old pass looking like its result.
  // Missing case output is reported as infrastructure evidence, never fabricated tests.
  for (const descriptor of scopedRuns.values()) {
    const { run } = descriptor;
    const reported = scopedExecutionFiles.get(descriptor.path) || new Set();
    const missingByTag = new Map();
    for (const file of run.files.filter(file => !reported.has(file))) {
      const source = ownership.get(file);
      if (!source || source.category !== descriptor.category) continue;
      for (const tag of source.tags.filter(tag => run.tags.includes(tag))) {
        if (!missingByTag.has(tag)) missingByTag.set(tag, []);
        missingByTag.get(tag).push(file);
      }
    }
    for (const [tag, missingFiles] of missingByTag) {
      const categories = inventory.get(tag).categories;
      const relatedFiles = missingFiles.filter(file => categories.accessibility.files.some(evidence => evidence.path === file));
      const targets = [[descriptor.category, missingFiles], ...(relatedFiles.length ? [['accessibility', relatedFiles]] : [])];
      for (const [categoryID, sourceFiles] of targets) {
        const entry = categories[categoryID];
        // Partial case reports remain the case result; expose incomplete scope separately in notes.
        const existing = entry.executions.find(execution => execution.runPath === descriptor.path || execution.legacyManifestPath === descriptor.path);
        const changedTestSource = descriptor.evidence && sourceFiles.some(file => descriptor.evidence.source.changedFiles.includes(file) || descriptor.evidence.source.changedDuringRun?.includes(file));
        const message = changedTestSource ? 'Captured test definitions have changed. Their earlier cases cannot be attributed through the current source; consult the recorded report for historical outcomes.'
          : run.status === 'running' ? 'This test run is still in progress; no completed cases are saved for these test files.'
            : 'This test attempt did not save case outcomes for all intended test files. Missing output is not a passing test result.';
        if (existing) { if (existing.status !== 'failed') existing.status = 'unknown'; existing.notes.push(message, ...run.errors); continue; }
        const runnerFailed = Number.isSafeInteger(run.exitCode) && run.exitCode !== 0 || Number.isSafeInteger(run.buildExit) && run.buildExit !== 0 || run.status === 'failed' && run.buildCompleted === false;
        const failed = !changedTestSource && run.status !== 'running' && runnerFailed && !reported.size;
        entry.executions.push({ path: descriptor.path, ...runMetadata(descriptor, descriptor.modifiedAt || run.completedAt || run.startedAt), reportedAt: run.completedAt || run.startedAt,
          timestampSource: run.completedAt ? 'run-completedAt' : 'run-startedAt', scopeId: descriptor.scopeId || run.scopeId, scope: 'runner-attempt',
          sourceFiles, status: failed ? 'failed' : 'unknown', total: 0, passed: 0, failed: 0, skipped: 0, unknown: 0, flaky: 0,
          failedSuites: 0, runnerFailure: !!failed,
          ...(categoryID === 'accessibility' ? { accessibilityKinds: [], environment: descriptor.category === 'unit' ? 'mock-dom' : 'browser' } : {}),
          notes: [message, ...(failed ? ['The test runner failed before recording these cases; this does not identify a failing component assertion or suite.'] : []), ...run.errors] });
      }
    }
  }
  const snapshot = await safeRead(root, 'packages/core/coverage-snapshot.json');
  let librarySnapshot;
  if (snapshot) {
    try {
      const value = JSON.parse(snapshot.text);
      if (Number.isSafeInteger(value.linesFound) && Number.isSafeInteger(value.linesHit) && value.linesFound > 0 && value.linesHit >= 0 && value.linesHit <= value.linesFound && Number.isFinite(Date.parse(value.generatedAt))) {
        librarySnapshot = { path: 'packages/core/coverage-snapshot.json', scope: 'library', reportedAt: value.generatedAt, timestampSource: 'report-generatedAt',
          lines: { total: value.linesFound, covered: value.linesHit, percent: Math.round(value.linesHit * 10000 / value.linesFound) / 100 },
          notes: ['Historical whole-library snapshot. Cannot be attributed to this component or used as a current passing test result.'] };
      }
    } catch { /* A malformed snapshot supplies no measured evidence. */ }
  }
  for (const result of inventory.values()) {
    result.categories.unit.commands = [command('Measure unit tests and coverage', 'node apps/native-playground/scripts/measure-tests.mjs --unit'), command('Run source unit tests', 'pnpm --filter @awc-ui/core test:spec')];
    result.categories.e2e.commands = [command('Run source browser tests', 'pnpm --filter @awc-ui/core test:e2e')];
    result.categories.component.commands = [command('Run stories (requires running Storybook)', 'pnpm --filter @awc-ui/storybook test:stories')];
    if (result.categories.component.files.some(file => file.kind === 'storybook-story')) {
      result.categories.component.commands.unshift(command('Measure existing stories and interactions', 'node apps/storybook/scripts/laboratory-coverage.mjs'));
      result.categories.component.notes.push('The Laboratory story collector uses the isolated browser build; run the browser collector with --all first.');
    }
    for (const framework of ['react', 'vue', 'svelte']) if (result.categories.component.files.some(file => file.path.startsWith(`apps/test-${framework}/`))) result.categories.component.commands.push(command(`Run ${framework} component tests`, `pnpm --filter @awc-ui/test-${framework} test:ct`));
    if (result.categories.e2e.files.some(file => file.path.startsWith('apps/test-angular/'))) result.categories.e2e.commands.push(command('Run Angular E2E tests', 'pnpm --filter @awc-ui/test-angular test:e2e'));
    result.categories.accessibility.commands = [command('Run configured Storybook accessibility tests (requires running Storybook)', 'pnpm test:a11y')];
    const browserSources = new Set([
      ...result.categories.e2e.files.filter(file => file.path.startsWith('packages/core/src/') && /\.e2e\.tsx?$/.test(file.path)),
      ...result.categories.component.files.filter(file => file.path.startsWith('apps/test-react/e2e/')
        && [`${result.tag}.spec.tsx`, `${result.tag.slice(3)}.spec.tsx`].includes(path.basename(file.path))),
    ].map(file => file.path));
    for (const id of ['component', 'e2e', 'accessibility']) if (result.categories[id].files.some(file => browserSources.has(file.path))) {
      result.categories[id].commands.unshift(command('Measure browser and accessibility tests', `node apps/native-playground/scripts/coverage/run-browser.mjs ${result.tag}`));
    }
    result.categories.unit.configuration = ['packages/core/jest.coverage.config.cjs'];
    result.categories.component.configuration = ['apps/storybook/vitest.config.mts', 'apps/storybook/vitest.laboratory.config.mts'];
    if (result.categories.component.files.some(file => file.path.startsWith('apps/test-react/'))) result.categories.component.configuration.push('apps/native-playground/scripts/coverage/playwright.config.ts');
    result.categories.e2e.configuration = ['apps/native-playground/scripts/coverage/stencil.config.ts'];
    result.categories.accessibility.configuration = ['apps/storybook/.storybook/preview.ts', 'apps/storybook/.storybook/vitest.setup.ts'];
    for (const entry of Object.values(result.categories)) {
      entry.commands.unshift(command('Measure all test families', 'node apps/native-playground/scripts/measure-tests.mjs'));
      const newestFirst = (a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || a.path.localeCompare(b.path);
      entry.measurements.sort(newestFirst); entry.executions.sort(newestFirst); entry.audits.sort(newestFirst);
      for (const measurement of entry.measurements) {
        const descriptor = measurement.runPath && scopedRuns.get(measurement.runPath);
        const sameRun = measurement.verified && descriptor?.evidence?.runId === measurement.runId
          && descriptor.category === entry.id && descriptor.run.completedAt === measurement.reportedAt;
        const context = sameRun && scopedExecutionContexts.get(measurement.runPath);
        const matching = context && entry.executions.find(execution => execution.path === context.path
          && execution.verified && execution.runId === measurement.runId && execution.runPath === measurement.runPath
          && execution.reportedAt === measurement.reportedAt && (execution.total > 0 || execution.failedSuites > 0));
        const sourceExecution = ['lines', 'branches', 'functions', 'statements'].some(metric => measurement[metric]?.covered > 0) ? 'observed' : 'zero-hit';
        const runContext = context || (sameRun ? {
          path: descriptor.path, ...runMetadata(descriptor, descriptor.run.completedAt), scope: 'report',
          status: 'unknown', total: null, passed: null, failed: null, skipped: null, sourceFileCount: null,
        } : null);
        measurement.attribution = {
          kind: matching ? 'component-outcomes' : runContext ? 'broader-run' : 'coverage-only', sourceExecution,
          componentExecutionPath: matching?.path || null, componentTestCount: matching?.total ?? (context ? 0 : null), runContext,
          notes: matching
            ? [matching.total > 0 ? 'Component-specific case outcomes are recorded in the same verified run as this source measurement.' : 'A component-attributed suite-level failure is recorded in the same verified run, without case outcomes.']
            : runContext
              ? [sourceExecution === 'observed' ? 'This component’s source executed in a broader run.' : 'This component’s source is included with zero recorded hits in a broader run.',
                context ? 'No component-specific case outcomes are recorded for it in that run.' : 'Component-specific case outcomes could not be verified for that run.',
                'The linked report describes the broader run; its test totals and result are not component-specific outcomes.']
              : ['Saved source coverage is available. No execution report is verified as belonging to this measurement; separately saved component outcomes may describe another run.'],
        };
      }
      entry.runs = groupedRuns(entry);
      entry.executionStatus = latestRunnerStatus(entry.runs);
      entry.status = entry.measurements.length ? 'measured' : entry.files.length ? 'evidence-only' : 'unavailable';
      if (entry.id !== 'accessibility' && !entry.measurements.length) entry.notes.push('No component-specific measured coverage report is available in this checkout.');
      if (!entry.executions.length && !entry.audits.length) entry.notes.push('No component-specific test outcomes are recorded in the indexed reports.');
      if (!entry.files.length) entry.notes.push('No component-specific test declarations were found in the indexed test directories. Source coverage may still be recorded by broader runs.');
    }
    if (librarySnapshot) result.librarySnapshot = librarySnapshot;
  }
  return inventory;
}

/** Read only. Cache shared inventory for 5 seconds; never executes tests or imports test source. */
export async function getComponentCoverage(repoRoot, tag) {
  if (!tagPattern.test(tag)) throw new TypeError('Invalid component tag.');
  const root = await realpath(repoRoot);
  let entry = cache.get(root);
  if (!entry || Date.now() - entry.createdAt > 5000) {
    entry = { createdAt: Date.now(), promise: buildInventory(root) }; cache.set(root, entry);
    while (cache.size > 4) cache.delete(cache.keys().next().value);
    entry.promise.catch(() => { if (cache.get(root) === entry) cache.delete(root); });
  }
  const component = (await entry.promise).get(tag);
  if (!component) throw new RangeError('Unknown component tag.');
  return structuredClone(component);
}
