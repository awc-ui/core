import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { coverageReports, executionReports, scopedReportDirectories, scopedReportDescriptor, parseScopedRun, reportBelongsToRun, parseLCOV, parseIstanbul, parseExecutionReport, executionSummary } from './coverage-reports.mjs';

const configurations = [
  'packages/core/jest.coverage.config.cjs', 'packages/core/stencil.config.ts', 'packages/core/stencil.config.coverage.ts',
  'apps/storybook/vitest.config.mts', 'apps/storybook/vitest.laboratory.config.mts', 'apps/storybook/.storybook/preview.ts', 'apps/storybook/.storybook/vitest.setup.ts',
  'apps/native-playground/scripts/measure-tests.mjs', 'apps/storybook/scripts/laboratory-coverage.mjs',
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
  if (configurations.includes(relative) || [...coverageReports, ...executionReports].some(report => report.path === relative) || scopedReportDescriptor(relative) || relative === 'packages/core/coverage-snapshot.json') return true;
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
function accessibilityPlayAssertion(node) {
  let assertion = false, related = false;
  function visit(current) {
    if (ts.isCallExpression(current) && /^(?:expect|assert)(?:\.|\(|$)/.test(current.expression.getText())) assertion = true;
    // Inspect executable tokens, excluding prose comments and render markup.
    if (ts.isIdentifier(current) || ts.isStringLiteralLike(current)) related ||= /\b(?:axe|AxeBuilder|toHaveNoViolations|a11y|aria-[\w-]+|keyboard|tabindex|tabIndex|activeElement|focus)\b/.test(current.text);
    ts.forEachChild(current, visit);
  }
  if (node) visit(node);
  return assertion && related;
}
function inspectTests(text, file, defaultOwner, knownTags) {
  const document = staticDocument(text, file), { source } = document;
  const tests = [], stories = [];
  const htmlArguments = new Map();
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
        const body = node.getText(source);
        const titleNode = node.arguments[0];
        const titlePattern = ts.isStringLiteralLike(titleNode) ? escapePattern(titleNode.text).replace(/%[sdifjo#]/g, '.+?')
          : escapePattern(titleNode.head.text) + titleNode.templateSpans.map(span => '.+?' + escapePattern(span.literal.text)).join('');
        const declaredTags = [...ancestors].reverse().map(literalTags).find(tags => tags.length) || literalTags(ts.isStringLiteralLike(titleNode) ? titleNode.text : titleNode.head.text);
        const mounted = defaultOwner ? mountedTags(node) : [];
        const parameters = parameterTags(node.expression);
        const runtimeTag = parameters.length > 0 && (ts.isTemplateExpression(titleNode) || /%[sdifjo#]/.test(titleNode.text));
        const leadingSubject = /^\s*(md-[a-z0-9]+(?:-[a-z0-9]+)*)\b/.exec(ts.isStringLiteralLike(titleNode) ? titleNode.text : titleNode.head.text)?.[1];
        const outerSubject = /^\s*(md-[a-z0-9]+(?:-[a-z0-9]+)*)\b/.exec(ancestors[0] || '')?.[1];
        const mountedSubject = leadingSubject && mounted.includes(leadingSubject) ? [leadingSubject] : [];
        const caseTags = runtimeTag ? parameters : defaultOwner
          ? mountedSubject.length ? mountedSubject
            : mounted.includes(defaultOwner) || caseReferences(node).includes(defaultOwner) ? [defaultOwner]
              : mounted.length ? declaredTags.some(tag => mounted.includes(tag)) ? declaredTags.filter(tag => mounted.includes(tag)) : mounted
                : knownTags.has(outerSubject) ? [outerSubject] : [defaultOwner]
          : declaredTags.length ? declaredTags : caseReferences(node);
        tests.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          title: ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : undefined,
          pattern: new RegExp(`(?:^|\\s)${[...ancestors.map(escapePattern), titlePattern].join(' ')}$`),
          tags: caseTags, runtimeTag,
          accessibility: /\b(?:axe|AxeBuilder|toHaveNoViolations|accessib\w*|a11y|aria-[\w-]+|keyboard|tabindex|focus)\b/i.test(body),
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
    if (!accessibilityPlayAssertion(play)) continue;
    const name = document.property(story.node, 'name');
    tests.push({ line: story.line, title: story.exportName, tags: [], accessibility: true, skipped: false,
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
  return { id, label: labels[id], status: 'unavailable', executionStatus: 'unknown', files: [], testCount: 0, countKind: 'static-declarations', commands: [], measurements: [], executions: [], notes: [
    'Source declarations show available test coverage, not a passed test run. Parameterized cases and loops are not expanded.',
  ] };
}
const command = (label, command) => ({ label, command });
function addEvidence(result, categoryID, evidence) {
  const entry = result.categories[categoryID]; entry.files.push(evidence); entry.testCount += evidence.testCount;
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
  const scopedDescriptors = scopedFiles.map(scopedReportDescriptor).filter(descriptor => descriptor && scopedRuns.has(descriptor.manifestPath))
    .map(descriptor => ({ ...descriptor, run: scopedRuns.get(descriptor.manifestPath).run }));
  for (const descriptor of [...coverageReports, ...scopedDescriptors.filter(descriptor => descriptor.kind === 'measurement')]) {
    const report = await safeRead(root, descriptor.path, 32 * 1024 * 1024); if (!report) continue;
    if (descriptor.run && !reportBelongsToRun(report.modifiedAt, descriptor.run)) continue;
    try {
      const parsed = descriptor.format === 'lcov' ? parseLCOV(report.text, tags) : parseIstanbul(report.text, tags, descriptor.format === 'istanbul-summary');
      for (const [tag, data] of parsed) {
        if (descriptor.run && !descriptor.run.tags.includes(tag)) continue;
        if (!['lines', 'branches', 'functions', 'statements'].some(name => data[name]?.total > 0)) continue;
        inventory.get(tag).categories[descriptor.category].measurements.push({ path: descriptor.path, format: descriptor.format,
          reportedAt: descriptor.run?.completedAt || report.modifiedAt, timestampSource: descriptor.run ? 'run-completedAt' : 'file-mtime', scope: 'component', ...data,
          ...(descriptor.run ? { scopeId: descriptor.scopeId, runPath: descriptor.manifestPath } : {}),
          notes: ['Coverage measures executed source locations; it does not establish test success.', descriptor.run ? 'Timestamp comes from the matching completed runner manifest.' : 'Timestamp is report modification time, not a verified test-run time.', 'Alternative report formats and runs are separate measurements; do not add their totals together.'] });
      }
    } catch { /* A malformed or partially written report supplies no measured evidence. */ }
  }
  const scopedExecutionFiles = new Map();
  const scopedExecutionContexts = new Map();
  for (const descriptor of [...executionReports, ...scopedDescriptors.filter(descriptor => descriptor.kind === 'execution')]) {
    const report = await safeRead(root, descriptor.path, 32 * 1024 * 1024); if (!report) continue;
    if (descriptor.run && !reportBelongsToRun(report.modifiedAt, descriptor.run)) continue;
    try {
      const grouped = new Map();
      const add = (tag, categoryID, record) => {
        const key = `${tag}:${categoryID}`;
        if (!grouped.has(key)) grouped.set(key, { tag, categoryID, records: [] });
        grouped.get(key).records.push(record);
      };
      const suites = parseExecutionReport(report.text, descriptor).filter(suite => {
        const source = ownership.get(suite.file);
        return source?.category === descriptor.category && (!descriptor.run || descriptor.run.files.includes(suite.file));
      });
      if (descriptor.run) {
        const summary = executionSummary(suites);
        if (summary.total || summary.failedSuites) scopedExecutionContexts.set(descriptor.manifestPath, {
          path: descriptor.path, runPath: descriptor.manifestPath, scope: 'report', framework: descriptor.framework,
          reportedAt: descriptor.run.completedAt, timestampSource: 'run-completedAt',
          sourceFileCount: new Set(suites.map(suite => suite.file)).size, ...summary,
        });
      }
      for (const suite of suites) {
        const source = ownership.get(suite.file);
        if (!source || source.category !== descriptor.category) continue;
        if (descriptor.run && !descriptor.run.files.includes(suite.file)) continue;
        for (const tag of source.tags) {
          if (descriptor.run && !descriptor.run.tags.includes(tag)) continue;
          const tests = testsForTag(source, suite.tests, tag);
          if (!tests.length && !suite.failedSuite) continue;
          add(tag, descriptor.category, { ...suite, tests, shared: source.shared });
          const related = tests.filter(item => matchingDeclarations(source, item).some(declaration => declaration.accessibility && (source.owner || declaration.tags.includes(tag)))
            || !source.story && /\b(?:axe|AxeBuilder|toHaveNoViolations|accessib\w*|a11y|aria-[\w-]+|keyboard|tabindex|focus)\b/i.test(item.name));
          if (related.length) add(tag, 'accessibility', { ...suite, tests: related, failedSuite: false, shared: source.shared });
        }
        if (descriptor.run) {
          if (!scopedExecutionFiles.has(descriptor.manifestPath)) scopedExecutionFiles.set(descriptor.manifestPath, new Set());
          if (suite.tests.length || suite.failedSuite) scopedExecutionFiles.get(descriptor.manifestPath).add(suite.file);
        }
      }
      for (const { tag, categoryID, records } of grouped.values()) {
        const summary = executionSummary(records);
        if (!summary.total && !summary.failedSuites) continue;
        const notes = ['Outcomes describe only the test cases recorded in this report, not every source declaration or a current rerun.', descriptor.run ? 'Timestamp comes from the matching completed runner manifest; cases are limited to its intended source files and component scope.' : 'Timestamp is report modification time.'];
        if (records.some(record => record.shared)) notes.push('Shared test-file outcomes are filtered by individual test/describe titles or source locations. Suite-level setup failures remain shared-file evidence. A case that checks multiple components can appear under each; per-component case counts are not additive.');
        if (categoryID === 'accessibility') {
          notes.push(descriptor.framework === 'vitest' ? 'Story outcomes are included only when their matching source play function contains accessibility-related assertions. A story title or configured addon alone is not a recorded accessibility audit.' : `This ${descriptor.framework} report is filtered to individual accessibility-related cases using suite/test names or matching source declarations. Other tests in the same file are excluded.`);
          notes.push('Passing axe, keyboard or ARIA checks is not a WCAG conformance or accessibility coverage percentage. Results from separate runs are not combined.');
        }
        if (summary.flaky) notes.push(`${summary.flaky} test cases passed after a retry.`);
        inventory.get(tag).categories[categoryID].executions.push({ path: descriptor.path, framework: descriptor.framework,
          reportedAt: descriptor.run?.completedAt || report.modifiedAt, timestampSource: descriptor.run ? 'run-completedAt' : 'file-mtime', scope: records.some(record => record.shared) ? 'shared-test-files' : 'component-tests',
          ...(descriptor.run ? { scopeId: descriptor.scopeId, runPath: descriptor.manifestPath } : {}),
          sourceFiles: [...new Set(records.map(record => record.file))].sort(), ...summary, notes });
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
    for (const [tag, sourceFiles] of missingByTag) {
      const entry = inventory.get(tag).categories[descriptor.category];
      // Partial case reports remain the case result; expose incomplete scope separately in notes.
      const existing = entry.executions.find(execution => execution.runPath === descriptor.path);
      const message = run.status === 'running' ? 'This scoped browser run is still in progress; no completed cases are saved for these test files.'
        : 'This scoped browser attempt did not save case outcomes for all intended test files. Missing output is not a passing test result.';
      if (existing) { if (existing.status !== 'failed') existing.status = 'unknown'; existing.notes.push(message, ...run.errors); continue; }
      const runnerFailed = run.exitCode !== null && run.exitCode !== 0 || run.buildExit !== null && run.buildExit !== 0 || run.status === 'failed' && run.buildCompleted === false;
      const failed = run.status !== 'running' && runnerFailed && !reported.size;
      entry.executions.push({ path: descriptor.path, framework: descriptor.framework, reportedAt: run.completedAt || run.startedAt,
        timestampSource: run.completedAt ? 'run-completedAt' : 'run-startedAt', scopeId: run.scopeId, scope: 'runner-attempt',
        sourceFiles, status: failed ? 'failed' : 'unknown', total: 0, passed: 0, failed: 0, skipped: 0, unknown: 0, flaky: 0,
        failedSuites: failed ? sourceFiles.length : 0, notes: [message, ...(failed ? ['The browser runner failed before recording these cases; this does not identify a failing component assertion.'] : []), ...run.errors] });
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
    result.categories.unit.commands = [command('Run source unit tests', 'pnpm --filter @awc-ui/core test:spec'), command('Generate unit coverage', 'pnpm --filter @awc-ui/core test:spec:coverage')];
    result.categories.e2e.commands = [command('Run source browser tests', 'pnpm --filter @awc-ui/core test:e2e')];
    result.categories.component.commands = [command('Run stories (requires running Storybook)', 'pnpm --filter @awc-ui/storybook test:stories'), command('Generate story coverage', 'pnpm --filter @awc-ui/storybook test:coverage')];
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
    result.categories.e2e.configuration = ['packages/core/stencil.config.coverage.ts'];
    result.categories.accessibility.configuration = ['apps/storybook/.storybook/preview.ts', 'apps/storybook/.storybook/vitest.setup.ts'];
    for (const entry of Object.values(result.categories)) {
      entry.commands.unshift(command('Measure all test families', 'node apps/native-playground/scripts/measure-tests.mjs'));
      const newestFirst = (a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || a.path.localeCompare(b.path);
      entry.measurements.sort(newestFirst); entry.executions.sort(newestFirst);
      for (const measurement of entry.measurements) {
        const descriptor = measurement.runPath && scopedRuns.get(measurement.runPath);
        const sameRun = descriptor?.category === entry.id && descriptor.run.completedAt === measurement.reportedAt;
        const context = sameRun && scopedExecutionContexts.get(measurement.runPath);
        const matching = context && entry.executions.find(execution => execution.path === context.path
          && execution.runPath === measurement.runPath && execution.reportedAt === measurement.reportedAt && (execution.total > 0 || execution.failedSuites > 0));
        const sourceExecution = ['lines', 'branches', 'functions', 'statements'].some(metric => measurement[metric]?.covered > 0) ? 'observed' : 'zero-hit';
        const runContext = context || (sameRun ? {
          path: descriptor.path, runPath: descriptor.path, scope: 'report', framework: descriptor.framework,
          reportedAt: descriptor.run.completedAt, timestampSource: 'run-completedAt',
          status: 'unknown', total: null, passed: null, failed: null, skipped: null, sourceFileCount: null,
        } : null);
        measurement.attribution = {
          kind: matching ? 'component-outcomes' : runContext ? 'broader-run' : 'coverage-only', sourceExecution,
          componentExecutionPath: matching?.path || null, componentTestCount: matching?.total ?? (context ? 0 : null), runContext,
          notes: matching
            ? [matching.total > 0 ? 'Component-specific case outcomes are recorded in the same verified run as this source measurement.' : 'A component-attributed test suite failed in the same verified run before recording case outcomes.']
            : runContext
              ? [sourceExecution === 'observed' ? 'This component’s source executed in a broader run.' : 'This component’s source is included with zero recorded hits in a broader run.',
                context ? 'No component-specific case outcomes are recorded for it in that run.' : 'Component-specific case outcomes could not be verified for that run.',
                'The linked report describes the broader run; its test totals and result are not component-specific outcomes.']
              : ['Saved source coverage is available. No execution report is verified as belonging to this measurement; separately saved component outcomes may describe another run.'],
        };
      }
      entry.executionStatus = entry.executions[0]?.status || 'unknown';
      entry.status = entry.measurements.length ? 'measured' : entry.files.length ? 'evidence-only' : 'unavailable';
      if (!entry.measurements.length) entry.notes.push('No component-specific measured coverage report is available in this checkout.');
      if (!entry.executions.length) entry.notes.push('No component-specific test outcomes are recorded in the indexed reports.');
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
