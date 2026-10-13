import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { coverageReports, executionReports, parseLCOV, parseIstanbul, parseExecutionReport, executionSummary } from './coverage-reports.mjs';

const configurations = [
  'packages/core/jest.coverage.config.cjs', 'packages/core/stencil.config.ts', 'packages/core/stencil.config.coverage.ts',
  'apps/storybook/vitest.config.mts', 'apps/storybook/.storybook/preview.ts', 'apps/storybook/.storybook/vitest.setup.ts',
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
  if (configurations.includes(relative) || [...coverageReports, ...executionReports].some(report => report.path === relative) || relative === 'packages/core/coverage-snapshot.json') return true;
  if (relative.split('/').some(segment => segment.startsWith('.'))) return false;
  return /^packages\/core\/src\/components\/md-[a-z0-9]+(?:-[a-z0-9]+)*\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:spec|e2e)\.tsx?$/.test(relative)
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
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node)) return resolve(node.expression, seen);
    if (ts.isIdentifier(node) && variables.has(node.text) && !seen.has(node.text)) return resolve(variables.get(node.text), new Set([...seen, node.text]));
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

function inspectTests(text, file) {
  const document = staticDocument(text, file), { source } = document;
  const tests = [], stories = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(source);
      if (/^(?:it|test)(?:\.(?:only|skip|todo|concurrent|each))*\s*(?:\([\s\S]*\))?$/.test(expression)
        && !/\.(?:each)$/.test(expression) && node.arguments.length
        && (ts.isStringLiteralLike(node.arguments[0]) || ts.isTemplateExpression(node.arguments[0]))) {
        const body = node.getText(source);
        tests.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          title: ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : undefined,
          accessibility: /\b(?:axe|AxeBuilder|toHaveNoViolations|accessib\w*|a11y|aria-[\w-]+|keyboard|tabindex|focus)\b/i.test(body),
          skipped: /\.(?:skip|todo)\b/.test(expression) });
      }
    }
    if (ts.isVariableStatement(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) {
        if (/\bStory(?:Obj)?\b/.test(declaration.type?.getText(source) || '')) stories.push({ line: source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1, node: declaration.initializer });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { tests, stories, document };
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
  const files = (await Promise.all(['packages/core/src/components', 'apps/storybook/src/stories', ...['react', 'vue', 'svelte', 'angular'].map(framework => `apps/test-${framework}/e2e`)].map(directory => walk(root, directory)))).flat().sort();
  for (const file of files) {
    const source = await safeRead(root, file); if (!source) continue;
    const story = file.includes('/stories/'), framework = /^apps\/test-(react|vue|svelte|angular)\//.exec(file)?.[1];
    const categoryID = story || framework && framework !== 'angular' ? 'component' : file.includes('.e2e.') || framework === 'angular' ? 'e2e' : 'unit';
    const parsed = inspectTests(source.text, file), declarations = story ? parsed.stories : parsed.tests;
    const owner = story ? storyOwner(file, parsed.document, tags) : /^packages\/core\/src\/components\/(md-[a-z0-9-]+)\//.exec(file)?.[1];
    const references = owner ? [owner] : story ? [] : [...new Set(source.text.match(/\bmd-[a-z0-9]+(?:-[a-z0-9]+)*\b/g) || [])];
    ownership.set(file, { category: categoryID, tags: references.filter(tag => tags.has(tag)), shared: !owner,
      accessibilityTitles: new Set(parsed.tests.filter(item => item.accessibility && item.title).map(item => item.title)) });
    const evidence = { path: file, kind: story ? 'storybook-story' : framework ? `playwright-${framework === 'angular' ? 'e2e' : 'component'}` : categoryID === 'unit' ? 'stencil-spec' : 'stencil-e2e', testCount: declarations.length,
      countKind: story ? 'static-story-exports' : 'static-test-declarations', skippedDeclarations: parsed.tests.filter(item => item.skipped).length,
      line: declarations[0]?.line || 1, notes: owner ? [] : ['Shared source file: counts describe the file, not assertions attributable exclusively to this tag.'] };
    for (const tag of references.filter(tag => tags.has(tag))) {
      const result = inventory.get(tag); addEvidence(result, categoryID, evidence);
      const related = parsed.tests.filter(item => item.accessibility);
      if (related.length) addEvidence(result, 'accessibility', { ...evidence, testCount: related.length, line: related[0]?.line || 1, kind: 'accessibility-related-tests', notes: [...evidence.notes, 'Static accessibility-related declarations (axe, ARIA, keyboard or focus); not a WCAG conformance result.'] });
      const storyAccessibility = story && accessibilityConfiguration(parsed.document, parsed.document.metadata, storybookAccessibility);
      if (story && parsed.stories.some(item => accessibilityConfiguration(parsed.document, item.node, storyAccessibility))) addEvidence(result, 'accessibility', { ...evidence, testCount: 0, kind: 'storybook-a11y-configuration', notes: [...evidence.notes, 'Configuration only: accessibility parameters apply to this component’s own stories. This is not a recorded audit or a count of accessibility assertions.'] });
    }
  }
  for (const descriptor of coverageReports) {
    const report = await safeRead(root, descriptor.path, 32 * 1024 * 1024); if (!report) continue;
    try {
      const parsed = descriptor.format === 'lcov' ? parseLCOV(report.text, tags) : parseIstanbul(report.text, tags, descriptor.format === 'istanbul-summary');
      for (const [tag, data] of parsed) {
        if (!['lines', 'branches', 'functions', 'statements'].some(name => data[name]?.total > 0)) continue;
        inventory.get(tag).categories[descriptor.category].measurements.push({ path: descriptor.path, format: descriptor.format,
          reportedAt: report.modifiedAt, timestampSource: 'file-mtime', scope: 'component', ...data,
          notes: ['Coverage measures executed source locations; it does not establish test success. Timestamp is report modification time, not a verified test-run time.', 'Alternative report formats and runs are separate measurements; do not add their totals together.'] });
      }
    } catch { /* A malformed or partially written report supplies no measured evidence. */ }
  }
  for (const descriptor of executionReports) {
    const report = await safeRead(root, descriptor.path, 32 * 1024 * 1024); if (!report) continue;
    try {
      const grouped = new Map();
      const add = (tag, categoryID, record) => {
        const key = `${tag}:${categoryID}`;
        if (!grouped.has(key)) grouped.set(key, { tag, categoryID, records: [] });
        grouped.get(key).records.push(record);
      };
      for (const suite of parseExecutionReport(report.text, descriptor)) {
        const source = ownership.get(suite.file);
        if (!source || source.category !== descriptor.category) continue;
        for (const tag of source.tags) {
          add(tag, descriptor.category, { ...suite, shared: source.shared });
          const related = suite.tests.filter(item => source.accessibilityTitles.has(item.title)
            || /\b(?:axe|AxeBuilder|toHaveNoViolations|accessib\w*|a11y|aria-[\w-]+|keyboard|tabindex|focus)\b/i.test(item.name));
          if (related.length) add(tag, 'accessibility', { ...suite, tests: related, failedSuite: false, shared: source.shared });
        }
      }
      for (const { tag, categoryID, records } of grouped.values()) {
        const summary = executionSummary(records);
        if (!summary.total && !summary.failedSuites) continue;
        const notes = ['Outcomes describe only the test cases recorded in this report, not every source declaration or a current rerun. Timestamp is report modification time.'];
        if (records.some(record => record.shared)) notes.push('Shared test-file results are not assertions attributable exclusively to this component.');
        if (categoryID === 'accessibility') {
          notes.push(`This ${descriptor.framework} report is filtered to individual accessibility-related cases using suite/test names or matching source declarations. Other tests in the same file are excluded.`);
          notes.push('Passing axe, keyboard or ARIA checks is not a WCAG conformance or accessibility coverage percentage. Results from separate runs are not combined.');
        }
        if (summary.flaky) notes.push(`${summary.flaky} test cases passed after a retry.`);
        inventory.get(tag).categories[categoryID].executions.push({ path: descriptor.path, framework: descriptor.framework,
          reportedAt: report.modifiedAt, timestampSource: 'file-mtime', scope: records.some(record => record.shared) ? 'shared-test-files' : 'component-tests',
          sourceFiles: [...new Set(records.map(record => record.file))].sort(), ...summary, notes });
      }
    } catch { /* Incomplete test output must never become a passing run. */ }
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
    for (const framework of ['react', 'vue', 'svelte']) if (result.categories.component.files.some(file => file.path.startsWith(`apps/test-${framework}/`))) result.categories.component.commands.push(command(`Run ${framework} component tests`, `pnpm --filter @awc-ui/test-${framework} test:ct`));
    if (result.categories.e2e.files.some(file => file.path.startsWith('apps/test-angular/'))) result.categories.e2e.commands.push(command('Run Angular E2E tests', 'pnpm --filter @awc-ui/test-angular test:e2e'));
    result.categories.accessibility.commands = [command('Run configured Storybook accessibility tests (requires running Storybook)', 'pnpm test:a11y')];
    const browserSources = new Set([
      ...result.categories.e2e.files.filter(file => file.path.startsWith(`packages/core/src/components/${result.tag}/`)),
      ...result.categories.component.files.filter(file => file.path.startsWith('apps/test-react/e2e/')
        && [`${result.tag}.spec.tsx`, `${result.tag.slice(3)}.spec.tsx`].includes(path.basename(file.path))),
    ].map(file => file.path));
    for (const id of ['component', 'e2e', 'accessibility']) if (result.categories[id].files.some(file => browserSources.has(file.path))) {
      result.categories[id].commands.unshift(command('Measure browser and accessibility tests', `node apps/native-playground/scripts/coverage/run-browser.mjs ${result.tag}`));
    }
    result.categories.unit.configuration = ['packages/core/jest.coverage.config.cjs'];
    result.categories.component.configuration = ['apps/storybook/vitest.config.mts'];
    result.categories.e2e.configuration = ['packages/core/stencil.config.coverage.ts'];
    result.categories.accessibility.configuration = ['apps/storybook/.storybook/preview.ts', 'apps/storybook/.storybook/vitest.setup.ts'];
    for (const entry of Object.values(result.categories)) {
      const newestFirst = (a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || a.path.localeCompare(b.path);
      entry.measurements.sort(newestFirst); entry.executions.sort(newestFirst);
      entry.executionStatus = entry.executions[0]?.status || 'unknown';
      entry.status = entry.measurements.length ? 'measured' : entry.files.length ? 'evidence-only' : 'unavailable';
      if (!entry.measurements.length) entry.notes.push('No component-specific measured coverage report is available in this checkout.');
      if (!entry.executions.length) entry.notes.push('No matching execution report is available; the last execution result is unknown.');
      if (!entry.files.length) entry.notes.push('No matching source test evidence was found in the indexed test directories.');
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
