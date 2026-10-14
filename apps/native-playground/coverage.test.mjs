import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, utimes } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { getComponentCoverage, isCoverageEvidencePath } from './coverage.mjs';
import { beginTestRun, finishTestRun, evidenceDirectory } from './test-run-evidence.mjs';

async function fixture(t, files = {}) {
  const base = await mkdtemp(path.join(tmpdir(), 'awc-coverage-')), root = path.join(base, 'repo');
  t.after(() => rm(base, { recursive: true, force: true }));
  const all = { 'packages/core/custom-elements.json': JSON.stringify({ modules: [{ declarations: [{ tagName: 'md-button' }, { tagName: 'md-chip' }] }] }), ...files };
  for (const [relative, content] of Object.entries(all)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), content);
  }
  return { root, base };
}

test('source evidence counts declarations without executing code or treating it as passed', async t => {
  const { root } = await fixture(t, {
    'packages/core/src/components/md-button/md-button.spec.ts': `throw new Error('must never execute');
      // it('not a test in a comment', () => {});
      const text = "test('not a test in a string', () => {})";
      describe('button', () => {
        it('clicks', () => {});
        it.skip('keyboard focus', () => {});
        it.each([1,2,3])('size %s', () => {});
      });`,
    'packages/core/src/components/md-button/button.e2e.ts': `test('aria-label exists', () => {});`,
    'apps/test-react/e2e/button.spec.tsx': `test('md-button mounts', () => {});`,
    'apps/test-angular/e2e/button.spec.ts': `test('md-button clicks', () => {});`,
    'apps/storybook/src/stories/MdButton.stories.ts': `const meta = { component: 'md-button' }; export default meta;
      export const Primary: Story = {}; export const Disabled: StoryObj = {};`,
  });
  const result = await getComponentCoverage(root, 'md-button');
  assert.equal(result.categories.unit.testCount, 3);
  assert.equal(result.categories.unit.files[0].skippedDeclarations, 1);
  assert.equal(result.categories.e2e.testCount, 2);
  assert.equal(result.categories.component.testCount, 3);
  assert.equal(result.categories.accessibility.testCount, 2);
  for (const category of Object.values(result.categories)) {
    assert.equal(category.status, 'evidence-only');
    assert.equal(category.executionStatus, 'unknown');
    assert.deepEqual(category.measurements, []);
    assert.ok(category.commands.length > 0);
    for (const file of category.files) assert.ok(isCoverageEvidencePath(file.path));
  }
  assert.equal(result.categories.component.files.find(file => file.kind === 'storybook-story').countKind, 'static-story-exports');
});

test('LCOV metrics are measured per component with explicit report modification time', async t => {
  const file = 'packages/core/coverage-spec/lcov.info';
  const { root } = await fixture(t, { [file]: `SF:/another/checkout/packages/core/src/components/md-button/md-button.tsx
DA:1,1
DA:2,0
FNDA:1,activate
FNDA:0,disabled
BRDA:1,0,0,1
BRDA:1,0,1,-
end_of_record
SF:src/components/md-button/md-button.tsx
DA:1,2
end_of_record
SF:src/components/md-chip/md-chip.tsx
DA:1,1
end_of_record
SF:src/components/md-button/fake.spec.ts
DA:1,1
end_of_record
SF:src/components/md-button/../../private.ts
DA:1,1
end_of_record
` });
  const date = new Date('2026-01-02T03:04:05Z'); await utimes(path.join(root, file), date, date);
  const result = await getComponentCoverage(root, 'md-button');
  assert.equal(result.categories.unit.status, 'measured');
  assert.equal(result.categories.unit.executionStatus, 'unknown');
  const measurement = result.categories.unit.measurements[0];
  for (const metric of ['lines', 'branches', 'functions']) assert.deepEqual(measurement[metric], { total: 2, covered: 1, percent: 50 });
  assert.deepEqual(measurement.sourceFiles, ['packages/core/src/components/md-button/md-button.tsx']);
  assert.equal(measurement.reportedAt, date.toISOString());
  assert.equal(measurement.timestampSource, 'file-mtime');
  assert.equal(measurement.scope, 'component');
});

test('Istanbul reports measure distinct source locations and remain separate from older alternative formats', async t => {
  const source = '/another/checkout/packages/core/src/components/md-button/md-button.tsx';
  const fileCoverage = {
    path: source, statementMap: { 0: { start: { line: 10 } }, 1: { start: { line: 10 } }, 2: { start: { line: 11 } } }, s: { 0: 3, 1: 0, 2: 0 },
    fnMap: { 0: {}, 1: {} }, f: { 0: 1, 1: 0 }, branchMap: { 0: { locations: [{}, {}] } }, b: { 0: [2, 0] },
  };
  const jsonPath = 'packages/core/coverage-spec/coverage-final.json', lcovPath = 'packages/core/coverage-spec/lcov.info';
  const { root } = await fixture(t, {
    [jsonPath]: JSON.stringify({ [source]: fileCoverage, '/other/src/harness.ts': fileCoverage,
      '/old/packages/core/src/components/md-chip/md-chip.tsx': { ...fileCoverage, path: '/old/packages/core/src/components/md-chip/md-chip.tsx' },
      '/old/packages/core/src/components/md-button/private.spec.ts': { ...fileCoverage, path: '/old/packages/core/src/components/md-button/private.spec.ts' } }),
    [lcovPath]: 'SF:src/components/md-button/md-button.tsx\nDA:10,0\nDA:11,0\nend_of_record\n',
  });
  await utimes(path.join(root, lcovPath), new Date('2026-01-01'), new Date('2026-01-01'));
  await utimes(path.join(root, jsonPath), new Date('2026-01-02'), new Date('2026-01-02'));
  const { unit } = (await getComponentCoverage(root, 'md-button')).categories;
  assert.equal(unit.measurements.length, 2);
  const measurement = unit.measurements[0];
  assert.equal(measurement.path, jsonPath); assert.equal(measurement.format, 'istanbul');
  assert.deepEqual(measurement.lines, { total: 2, covered: 1, percent: 50 });
  assert.deepEqual(measurement.statements, { total: 3, covered: 1, percent: 33.33 });
  assert.deepEqual(measurement.branches, { total: 2, covered: 1, percent: 50 });
  assert.deepEqual(measurement.functions, { total: 2, covered: 1, percent: 50 });
  assert.deepEqual(measurement.sourceFiles, ['packages/core/src/components/md-button/md-button.tsx']);
  assert.equal(unit.executionStatus, 'unknown', 'Coverage never establishes a passing test execution');
});

test('LCOV retains distinct same-named functions and validated per-file totals without counting test harness code', async t => {
  const { root } = await fixture(t, { 'packages/core/coverage-spec/lcov.info': `SF:src/components/md-button/md-button.tsx
FN:10,20,callback
FN:30,40,callback
FNDA:2,callback
FNDA:0,callback
FNF:2
FNH:1
DA:10,2
DA:30,0
end_of_record
SF:src/components/md-button/helper.ts
FN:5,handler
FN:12,handler
FNDA:0,handler
FNDA:4,handler
DA:5,0
DA:12,4
end_of_record
SF:src/components/md-button/test-utils/axe-spec.ts
FNDA:1,harness
FNF:1
FNH:1
DA:1,1
end_of_record
`, 'packages/core/coverage-spec/coverage-summary.json': JSON.stringify({
    'src/components/md-chip/test-utils/axe-spec.ts': { lines: { total: 20, covered: 20 } },
    'src/components/md-chip/__fixtures__/sample.ts': { lines: { total: 40, covered: 40 } },
  }) });
  const measurement = (await getComponentCoverage(root, 'md-button')).categories.unit.measurements[0];
  assert.deepEqual(measurement.functions, { total: 4, covered: 2, percent: 50 });
  assert.deepEqual(measurement.lines, { total: 4, covered: 2, percent: 50 });
  assert.equal(measurement.sourceFiles.length, 2);
  assert.equal((await getComponentCoverage(root, 'md-chip')).categories.unit.measurements.length, 0);
});

test('per-file coverage summaries recompute percentages and ignore global totals and invalid entries', async t => {
  const { root } = await fixture(t, { 'packages/core/coverage-spec/coverage-summary.json': JSON.stringify({
    total: { lines: { total: 999, covered: 999, pct: 100 } },
    'src/components/md-button/md-button.tsx': { lines: { total: 4, covered: 3, pct: 99 }, branches: { total: 0, covered: 0, pct: 100 } },
    'src/components/md-button/helper.ts': { lines: { total: 2, covered: 0, pct: 100 }, statements: { total: 2, covered: 3 } },
    'src/components/md-button/../md-chip/private.ts': { lines: { total: 100, covered: 100 } },
    'src/components/md-chip/md-chip.tsx': { lines: { total: 10, covered: 10 } },
  }) });
  const report = (await getComponentCoverage(root, 'md-button')).categories.unit.measurements[0];
  assert.deepEqual(report.lines, { total: 6, covered: 3, percent: 50 });
  assert.deepEqual(report.branches, { total: 0, covered: 0, percent: null });
  assert.equal(report.statements, undefined);
});

test('conflicting function summaries and repeated LCOV records supply no invented function metric', async t => {
  for (const records of [
    'FNDA:1,callback\nFNF:2\nFNH:1\nend_of_record\n',
    'FNDA:1,callback\nFNF:1\nFNH:invalid\nend_of_record\n',
    'FNDA:1,callback\nFNF:1\nFNH:1\nend_of_record\nSF:src/components/md-button/md-button.tsx\nFNDA:1,other\nFNF:1\nFNH:1\nend_of_record\n',
  ]) {
    const { root } = await fixture(t, { 'packages/core/coverage-spec/lcov.info': `SF:src/components/md-button/md-button.tsx\nDA:1,1\n${records}` });
    const measurement = (await getComponentCoverage(root, 'md-button')).categories.unit.measurements[0];
    assert.equal(measurement.functions, undefined);
    assert.equal(measurement.lines.percent, 100);
  }
});

test('Jest execution is attributed per source file and accessibility includes only recorded related cases', async t => {
  const spec = 'packages/core/src/components/md-button/md-button.spec.ts';
  const { root } = await fixture(t, {
    [spec]: `it('semantics', () => { expect(axe(button)); }); it('renders', () => {}); it.skip('pending', () => {});`,
    'packages/core/src/components/md-chip/md-chip.spec.ts': `it('renders', () => {});`,
    'packages/core/coverage-spec/test-results.json': JSON.stringify({ success: false, testResults: [
      { name: `C:\\old\\${spec.replaceAll('/', '\\')}`, status: 'failed', assertionResults: [
        { title: 'semantics', fullName: 'button semantics', status: 'passed' },
        { title: 'renders', fullName: 'button renders', status: 'failed' },
        { title: 'pending', status: 'pending' },
      ] },
      { name: '/other/packages/core/src/components/md-chip/md-chip.spec.ts', status: 'passed', assertionResults: [{ title: 'renders', status: 'passed' }] },
    ] }),
  });
  const { categories } = await getComponentCoverage(root, 'md-button');
  assert.equal(categories.unit.executionStatus, 'failed');
  const run = categories.unit.executions[0];
  assert.equal(run.total, 3); assert.equal(run.passed, 1); assert.equal(run.failed, 1); assert.equal(run.skipped, 1);
  assert.deepEqual(run.sourceFiles, [spec]);
  assert.equal(categories.unit.status, 'evidence-only'); assert.deepEqual(categories.unit.measurements, []);
  const accessibility = categories.accessibility.executions[0];
  assert.equal(accessibility.total, 1); assert.equal(accessibility.passed, 1); assert.equal(accessibility.status, 'passed');
  assert.match(accessibility.notes.join(' '), /not a WCAG/);
  assert.equal((await getComponentCoverage(root, 'md-chip')).categories.unit.executionStatus, 'passed', 'Global failures do not taint unrelated component test files');
});

test('newest execution report wins without merging runs and suite setup failures remain failures', async t => {
  const spec = 'packages/core/src/components/md-button/md-button.spec.ts';
  const older = 'packages/core/coverage-spec/results.json', newer = 'packages/core/coverage-spec/test-results.json';
  const { root } = await fixture(t, {
    [spec]: `it('renders', () => {});`,
    [older]: JSON.stringify({ testResults: [{ name: spec, status: 'passed', assertionResults: [{ title: 'renders', status: 'passed' }] }] }),
    [newer]: JSON.stringify({ testResults: [{ name: spec, status: 'failed', assertionResults: [] }] }),
  });
  await utimes(path.join(root, older), new Date('2026-01-01'), new Date('2026-01-01'));
  await utimes(path.join(root, newer), new Date('2026-01-02'), new Date('2026-01-02'));
  const unit = (await getComponentCoverage(root, 'md-button')).categories.unit;
  assert.equal(unit.executions.length, 2); assert.equal(unit.executions[0].path, newer);
  assert.equal(unit.executionStatus, 'failed'); assert.equal(unit.executions[0].failedSuites, 1);
  assert.equal(unit.executions[0].total, 0);
});

test('Playwright reports preserve final retry outcomes and accessibility suite names, but omit unexecuted listings', async t => {
  const spec = 'apps/test-react/e2e/button.spec.tsx';
  const actual = (status, results, expectedStatus = 'passed') => ({ status, expectedStatus, results: results.map(status => ({ status })) });
  const { root } = await fixture(t, {
    [spec]: `test('md-button renders', () => {}); test('md-button accessibility', () => {});`,
    'apps/test-react/coverage-native/results.json': JSON.stringify({ config: { rootDir: '/old/apps/test-react/e2e' }, suites: [{ title: 'button.spec.tsx', file: 'button.spec.tsx', specs: [
      { title: 'mounts', tests: [actual('flaky', ['failed', 'passed'])] },
      { title: 'fails unexpectedly', tests: [actual('unexpected', ['passed'], 'failed')] },
      { title: 'skipped', tests: [actual('skipped', ['skipped'])] },
      { title: 'not executed', tests: [actual('expected', [])] },
    ], suites: [{ title: 'accessibility (axe-core)', file: 'button.spec.tsx', specs: [{ title: 'filled', tests: [actual('expected', ['passed'])] }] }] }] }),
  });
  const { component, accessibility } = (await getComponentCoverage(root, 'md-button')).categories;
  assert.equal(component.executionStatus, 'failed');
  const run = component.executions[0];
  assert.equal(run.total, 4); assert.equal(run.passed, 2); assert.equal(run.failed, 1); assert.equal(run.skipped, 1); assert.equal(run.flaky, 1);
  assert.equal(run.scope, 'component-tests');
  assert.deepEqual(run.sourceFiles, [spec]);
  assert.equal(accessibility.executions[0].total, 1); assert.equal(accessibility.executions[0].passed, 1);
  assert.deepEqual(accessibility.measurements, []);
});

test('incomplete reports and symlinks outside the checkout supply no measurement or execution', async t => {
  const { root, base } = await fixture(t, { 'packages/core/coverage-spec/coverage-final.json': '{"incomplete":', 'packages/core/coverage-spec/test-results.json': '{' });
  await writeFile(path.join(base, 'private-lcov'), 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n');
  await symlink(path.join(base, 'private-lcov'), path.join(root, 'packages/core/coverage-spec/lcov.info'));
  const unit = (await getComponentCoverage(root, 'md-button')).categories.unit;
  assert.deepEqual(unit.measurements, []); assert.deepEqual(unit.executions, []);
  assert.equal(unit.executionStatus, 'unknown');
  assert.equal(isCoverageEvidencePath('packages/core/coverage-spec/test-results.json'), true);
  assert.equal(isCoverageEvidencePath('apps/test-react/coverage-native/results.json'), true);
  assert.equal(isCoverageEvidencePath('packages/core/coverage-spec/private.json'), false);
});

test('large standard Jest reports are accepted while incomplete LCOV records supply no percentage', async t => {
  const spec = 'packages/core/src/components/md-button/md-button.spec.ts';
  const { root } = await fixture(t, {
    [spec]: `it('renders', () => {});`,
    'packages/core/coverage-spec/test-results.json': JSON.stringify({ failureMessages: 'x'.repeat(2 * 1024 * 1024), testResults: [
      { name: spec, status: 'passed', assertionResults: [{ title: 'renders', status: 'passed' }] },
    ] }),
    'packages/core/coverage-spec/lcov.info': 'SF:src/components/md-button/md-button.tsx\nDA:1,1\n',
  });
  const unit = (await getComponentCoverage(root, 'md-button')).categories.unit;
  assert.equal(unit.executionStatus, 'passed'); assert.equal(unit.executions[0].passed, 1);
  assert.deepEqual(unit.measurements, [], 'A report being written must not expose an unfinished source record');
});

test('stories belong to their exported component metadata or exact filename, never incidental rendered controls', async t => {
  const { root } = await fixture(t, {
    'apps/storybook/src/stories/Actions.stories.ts': `const meta = ({ component: 'md-button' } satisfies Meta); export default meta;
      export const One: Story = {}; export const Two: StoryObj = {};`,
    'apps/storybook/src/stories/MdButton.stories.ts': `export default { component: 'md-chip' } as Meta;
      export const Other: Story = { render: () => '<md-button>Incidental action</md-button>' };`,
    'apps/storybook/src/stories/MdChip.stories.ts': `export default { title: 'Chip' };
      export const Primary: Story = { render: () => '<md-chip></md-chip><md-button></md-button>' };`,
    'apps/storybook/src/stories/Gallery.stories.ts': `const unrelated = { component: 'md-button' };
      export default { title: 'Gallery' }; export const Gallery: Story = { render: () => '<md-button></md-button>' };`,
  });
  const button = await getComponentCoverage(root, 'md-button');
  assert.equal(button.categories.component.testCount, 2);
  assert.deepEqual(button.categories.component.files.map(file => file.path), ['apps/storybook/src/stories/Actions.stories.ts']);
  assert.deepEqual(button.categories.accessibility.files, [], 'No accessibility configuration is inferred merely from story presence.');
  const chip = await getComponentCoverage(root, 'md-chip');
  assert.equal(chip.categories.component.testCount, 2);
  assert.deepEqual(chip.categories.component.files.map(file => path.basename(file.path)), ['MdButton.stories.ts', 'MdChip.stories.ts']);
});

test('accessibility includes owned configured stories and positive related declarations, excluding unrelated or disabled rows', async t => {
  const { root } = await fixture(t, {
    'apps/storybook/.storybook/preview.ts': `const preview = { parameters: { a11y: { options: { runOnly: ['wcag2a'] } } } }; export default preview;`,
    'apps/storybook/src/stories/MdButton.stories.ts': `export default { component: 'md-button' }; export const Primary: Story = {};`,
    'apps/storybook/src/stories/MdChip.stories.ts': `export default { component: 'md-chip' }; export const Other: Story = { render: () => '<md-button></md-button>' };`,
    'apps/storybook/src/stories/DisabledButton.stories.ts': `export default { component: 'md-button', parameters: { a11y: { disable: true } } }; export const Disabled: Story = {};`,
    'apps/storybook/src/stories/DisabledStory.stories.ts': `export default { component: 'md-button' }; export const Disabled: Story = { parameters: { a11y: { test: 'off' } } };`,
    'packages/core/src/components/md-button/empty.axe.spec.ts': `// Accessibility file with no declarations.`,
    'packages/core/src/components/md-button/focus.spec.ts': `it('preserves keyboard focus', () => { expect(button.tabIndex).toBe(0); });`,
  });
  const { categories } = await getComponentCoverage(root, 'md-button');
  assert.equal(categories.accessibility.testCount, 1);
  assert.deepEqual(categories.accessibility.files.map(file => path.basename(file.path)), ['MdButton.stories.ts', 'focus.spec.ts']);
  const configuration = categories.accessibility.files.find(file => file.kind === 'storybook-a11y-configuration');
  assert.equal(configuration.testCount, 0);
  assert.match(configuration.notes.join(' '), /Configuration only/);
});

test('Storybook accessibility outcomes require matching executable play assertions, not a title or addon configuration', async t => {
  const file = 'apps/storybook/src/stories/MdButton.stories.ts';
  const { root } = await fixture(t, {
    'apps/storybook/.storybook/preview.ts': `export default { parameters: { a11y: { options: { runOnly: ['wcag2a'] } } } };`,
    [file]: `export default { component: 'md-button' };
      export const Accessibility: Story = { render: () => '<md-button aria-label="Save">Save</md-button>' };
      export const KeyboardDemo: Story = { play: async () => { await userEvent.keyboard('{Tab}'); } };
      export const KeyboardCheck: Story = { name: 'Navigation behavior', play: async () => { await userEvent.keyboard('{Tab}'); expect(document.activeElement).toBe(button); } };`,
    'apps/storybook/coverage-stories/results.json': JSON.stringify({ testResults: [{ name: file, status: 'failed', assertionResults: [
      { title: 'Accessibility', fullName: 'Accessibility', status: 'passed', meta: { reports: [] } },
      { title: 'Keyboard Demo', fullName: 'Keyboard Demo', status: 'passed', meta: { reports: [] } },
      { title: 'Navigation behavior', fullName: 'Navigation behavior', status: 'failed', meta: { storyId: 'actions-button--keyboard-check', reports: [] } },
    ] }] }),
  });
  const { categories } = await getComponentCoverage(root, 'md-button');
  assert.equal(categories.component.executions[0].total, 3);
  assert.equal(categories.accessibility.testCount, 1);
  assert.equal(categories.accessibility.executions[0].total, 1);
  assert.equal(categories.accessibility.executionStatus, 'failed');
  assert.match(categories.accessibility.executions[0].notes.join(' '), /matching source play function/);
});

test('global historical snapshot stays separate from unavailable component measurements', async t => {
  const { root } = await fixture(t, { 'packages/core/coverage-snapshot.json': JSON.stringify({ generatedAt: '2026-01-01T00:00:00Z', linesFound: 100, linesHit: 90, unitTestCoveragePercent: 99 }) });
  const result = await getComponentCoverage(root, 'md-chip');
  assert.equal(result.librarySnapshot.scope, 'library');
  assert.equal(result.librarySnapshot.lines.percent, 90);
  for (const category of Object.values(result.categories)) {
    assert.equal(category.status, 'unavailable');
    assert.equal(category.executionStatus, 'unknown');
    assert.deepEqual(category.measurements, []);
  }
});

test('invalid tags, adjacent private files, traversal and symlink evidence are rejected', async t => {
  const { root, base } = await fixture(t);
  const dir = path.join(root, 'packages/core/src/components/md-button'); await mkdir(dir, { recursive: true });
  await writeFile(path.join(base, 'private.spec.ts'), `it('secret', () => {});`);
  await symlink(path.join(base, 'private.spec.ts'), path.join(dir, 'escape.spec.ts'));
  assert.equal((await getComponentCoverage(root, 'md-button')).categories.unit.files.length, 0);
  await assert.rejects(getComponentCoverage(root, '../md-button'), /Invalid/);
  await assert.rejects(getComponentCoverage(root, 'md-unknown'), /Unknown/);
  for (const file of ['.env', 'packages/core/src/components/md-button/md-button.tsx', 'packages/core/src/components/md-button/../secret.spec.ts', 'packages/core/src/components/md-button/.secret.spec.ts', 'apps/storybook/.storybook/private.ts', 'apps/test-react/e2e/private.json']) assert.equal(isCoverageEvidencePath(file), false, file);
  assert.equal(isCoverageEvidencePath('apps/storybook/.storybook/preview.ts'), true);
});

test('cached results are isolated from caller mutation', async t => {
  const { root } = await fixture(t);
  const first = await getComponentCoverage(root, 'md-button'); first.categories.unit.status = 'passed';
  assert.equal((await getComponentCoverage(root, 'md-button')).categories.unit.status, 'unavailable');
});

const e2eFile = tag => `packages/core/src/components/${tag}/${tag}.e2e.ts`;
const scopePath = scope => `packages/core/coverage-e2e/scopes/${scope}`;
const scopedRun = (scopeId, tags, files, extra = {}) => JSON.stringify({ schemaVersion: 1, scopeId, tags,
  e2eTests: files, componentTests: [], startedAt: '2026-10-01T10:00:00Z', completedAt: '2026-10-01T10:01:00Z',
  stencilExit: 0, componentExit: null, status: 'passed', errors: [], ...extra });
const jestResult = outcomes => JSON.stringify({ testResults: outcomes.map(([tag, status]) => ({
  name: e2eFile(tag), status, assertionResults: [{ title: 'renders', fullName: `${tag} renders`, status }],
})) });
async function reportTime(root, file, value = '2026-10-01T10:00:30Z') {
  const date = new Date(value); await utimes(path.join(root, file), date, date);
}

async function sealReports(root, directory, options = {}) {
  const legacy = await readFile(path.join(root, directory, 'run.json'), 'utf8').then(JSON.parse).catch(() => ({}));
  const { category, framework } = evidenceDirectory(directory);
  const handle = await beginTestRun({ root, directory, category, framework,
    label: options.label || `${framework} ${category}`, command: 'test fixture',
    testFiles: options.testFiles || legacy[category === 'e2e' ? 'e2eTests' : 'componentTests'] || [],
    tags: options.tags || legacy.tags || ['md-button', 'md-chip'] });
  for (const name of options.artifacts || ['results.json', 'test-results.json', 'lcov.info', 'coverage-final.json']) {
    const file = path.join(root, directory, name), bytes = await readFile(file).catch(() => null);
    if (bytes) await writeFile(file, bytes);
  }
  return finishTestRun(handle, { exitCode: options.exitCode ?? (legacy.status === 'failed' ? 1 : 0) });
}

test('durable single-component and all-component reports coexist and preserve exact attribution', async t => {
  const single = scopePath('md-button'), all = scopePath('all');
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`, [e2eFile('md-chip')]: `it('renders', () => {});`,
    [`${single}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button')]),
    [`${single}/results.json`]: jestResult([['md-button', 'passed'], ['md-chip', 'failed']]),
    [`${single}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nDA:2,0\nend_of_record\nSF:src/components/md-chip/md-chip.tsx\nDA:1,1\nend_of_record\n',
    [`${all}/run.json`]: scopedRun('all', ['md-button', 'md-chip'], [e2eFile('md-button'), e2eFile('md-chip')], { completedAt: '2026-10-01T10:02:00Z', stencilExit: 1, status: 'failed' }),
    [`${all}/results.json`]: jestResult([['md-button', 'failed'], ['md-chip', 'passed']]),
  });
  for (const file of [`${single}/results.json`, `${single}/lcov.info`, `${all}/results.json`]) await reportTime(root, file);
  await sealReports(root, single); await sealReports(root, all);
  const button = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  const chip = (await getComponentCoverage(root, 'md-chip')).categories.e2e;
  assert.equal(button.executions.length, 2, 'Runs remain separate, not summed');
  assert.equal(button.executionStatus, 'failed'); assert.equal(button.executions[0].total, 1);
  assert.equal(button.executions[0].scopeId, 'all');
  assert.equal(button.measurements[0].lines.percent, 50);
  assert.equal(button.measurements[0].timestampSource, 'run-completedAt');
  assert.equal(chip.executionStatus, 'passed', 'Another test failure in an all run does not taint this tag');
  assert.equal(chip.executions.length, 1, 'A single-component manifest excludes foreign recorded cases');
  assert.equal(chip.measurements.length, 0, 'A single-component manifest excludes foreign coverage files');
  assert.ok(isCoverageEvidencePath(`${all}/run.json`));
  assert.ok(isCoverageEvidencePath(`${single}/results.json`));
  assert.equal(isCoverageEvidencePath(`${single}/report/private.json`), false);
});

test('source measurements distinguish indirect execution, zero hits, owned outcomes and absence without borrowing broader cases', async t => {
  const all = scopePath('all'), group = 'md-button-group';
  const { root } = await fixture(t, {
    'packages/core/custom-elements.json': JSON.stringify({ modules: [{ declarations: ['md-button', 'md-chip', group].map(tagName => ({ tagName })) }] }),
    [e2eFile('md-button')]: `it('renders', () => {});`,
    [`${all}/run.json`]: scopedRun('all', ['md-button', 'md-chip', group], [e2eFile('md-button')]),
    [`${all}/results.json`]: jestResult([['md-button', 'passed']]),
    [`${all}/lcov.info`]: `SF:src/components/${group}/${group}.tsx\nDA:1,1\nDA:2,0\nend_of_record\nSF:src/components/md-chip/md-chip.tsx\nDA:1,0\nend_of_record\nSF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n`,
  });
  for (const file of [`${all}/results.json`, `${all}/lcov.info`]) await reportTime(root, file);
  await sealReports(root, all);
  const indirect = (await getComponentCoverage(root, group)).categories.e2e;
  const zero = (await getComponentCoverage(root, 'md-chip')).categories.e2e.measurements[0];
  const own = (await getComponentCoverage(root, 'md-button')).categories.e2e.measurements[0];
  assert.equal(indirect.testCount, 0); assert.equal(indirect.files.length, 0); assert.deepEqual(indirect.executions, []);
  assert.equal(indirect.measurements[0].lines.percent, 50, 'Measured hits do not change to match test ownership');
  const attribution = indirect.measurements[0].attribution;
  assert.equal(attribution.kind, 'broader-run'); assert.equal(attribution.sourceExecution, 'observed');
  assert.equal(attribution.componentTestCount, 0); assert.equal(attribution.componentExecutionPath, null);
  assert.equal(attribution.runContext.path, `${all}/results.json`); assert.equal(attribution.runContext.scope, 'report');
  assert.equal(attribution.runContext.total, 1); assert.equal(attribution.runContext.sourceFileCount, 1);
  assert.match(indirect.notes.join(' '), /No component-specific test outcomes/);
  assert.doesNotMatch(indirect.notes.join(' '), /last execution result is unknown|No matching execution report/);
  assert.equal(zero.lines.percent, 0); assert.equal(zero.attribution.sourceExecution, 'zero-hit');
  assert.equal(zero.attribution.kind, 'broader-run'); assert.equal(zero.attribution.componentTestCount, 0);
  assert.equal(own.attribution.kind, 'component-outcomes'); assert.equal(own.attribution.componentTestCount, 1);
  assert.equal(own.attribution.componentExecutionPath, `${all}/results.json`);
  const absent = (await getComponentCoverage(root, group)).categories.unit;
  assert.deepEqual(absent.measurements, []); assert.deepEqual(absent.executions, []);
});

test('a measurement cannot borrow outcomes from another family, another scope, stale output or unverified legacy mtimes', async t => {
  const all = scopePath('all'), single = scopePath('md-button');
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`,
    'packages/core/src/components/md-button/md-button.spec.ts': `it('renders', () => {});`,
    [`${all}/run.json`]: scopedRun('all', ['md-button', 'md-chip'], [e2eFile('md-button')]),
    [`${all}/results.json`]: jestResult([['md-button', 'passed']]),
    [`${all}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n',
    [`${single}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button')], { completedAt: '2026-10-01T11:01:00Z', startedAt: '2026-10-01T11:00:00Z' }),
    [`${single}/results.json`]: jestResult([['md-button', 'passed']]),
    'packages/core/coverage-spec/lcov.info': 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n',
    'packages/core/coverage-spec/test-results.json': JSON.stringify({ testResults: [{ name: 'packages/core/src/components/md-button/md-button.spec.ts', status: 'passed', assertionResults: [{ title: 'renders', status: 'passed' }] }] }),
  });
  await reportTime(root, `${all}/results.json`, '2026-09-01T10:00:00Z');
  await reportTime(root, `${all}/lcov.info`);
  await reportTime(root, `${single}/results.json`, '2026-10-01T11:00:30Z');
  await sealReports(root, all, { artifacts: ['lcov.info'] });
  await sealReports(root, single);
  const result = await getComponentCoverage(root, 'md-button');
  const attribution = result.categories.e2e.measurements[0].attribution;
  assert.equal(result.categories.e2e.executions[0].scopeId, 'md-button');
  assert.equal(attribution.kind, 'broader-run'); assert.equal(attribution.componentExecutionPath, null);
  assert.equal(attribution.componentTestCount, null, 'The matching case report was stale; absence of readable outcomes is not a proven zero case count');
  assert.equal(attribution.runContext.path, `${all}/run-evidence.json`);
  assert.equal(attribution.runContext.total, null, 'A manifest alone supplies no invented case totals');
  assert.match(attribution.notes.join(' '), /outcomes could not be verified/);
  assert.equal(result.categories.unit.executions[0].total, 1);
  assert.equal(result.categories.unit.measurements[0].attribution.kind, 'coverage-only');
  assert.equal(result.categories.unit.measurements[0].attribution.runContext, null, 'Adjacent file mtimes do not prove legacy run identity');
});

test('a matching suite-level failure remains attributable even when no test case outcomes were recorded', async t => {
  const all = scopePath('all');
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`,
    [`${all}/run.json`]: scopedRun('all', ['md-button', 'md-chip'], [e2eFile('md-button')], { status: 'failed', stencilExit: 1 }),
    [`${all}/results.json`]: JSON.stringify({ testResults: [{ name: e2eFile('md-button'), status: 'failed', assertionResults: [] }] }),
    [`${all}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,0\nend_of_record\n',
  });
  for (const report of [`${all}/results.json`, `${all}/lcov.info`]) await reportTime(root, report);
  await sealReports(root, all);
  const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  assert.equal(entry.executions[0].failedSuites, 1);
  assert.equal(entry.measurements[0].attribution.kind, 'component-outcomes');
  assert.equal(entry.measurements[0].attribution.componentExecutionPath, `${all}/results.json`);
  assert.equal(entry.measurements[0].attribution.componentTestCount, 0);
  assert.match(entry.measurements[0].attribution.notes.join(' '), /suite-level failure/);
});

test('explicit per-case mounts override a misleading folder without borrowing another component pass', async t => {
  const file = 'packages/core/src/components/md-button/shared.e2e.ts', all = scopePath('all');
  const { root } = await fixture(t, {
    [file]: `it('renders chip', async () => { const page = await newE2EPage(); await page.setContent('<md-chip>Chip</md-chip>'); expect(await page.find('md-chip')).toBeTruthy(); });`,
    [`${all}/run.json`]: scopedRun('all', ['md-button', 'md-chip'], [file]),
    [`${all}/results.json`]: JSON.stringify({ testResults: [{ name: file, status: 'passed', assertionResults: [{ title: 'renders chip', fullName: 'renders chip', status: 'passed' }] }] }),
    [`${all}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,0\nend_of_record\nSF:src/components/md-chip/md-chip.tsx\nDA:1,1\nend_of_record\n',
  });
  for (const report of [`${all}/results.json`, `${all}/lcov.info`]) await reportTime(root, report);
  await sealReports(root, all);
  const button = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  const chip = (await getComponentCoverage(root, 'md-chip')).categories.e2e;
  assert.equal(button.testCount, 0); assert.deepEqual(button.executions, []);
  assert.equal(button.measurements[0].attribution.kind, 'broader-run');
  assert.equal(chip.testCount, 1); assert.equal(chip.executions[0].total, 1);
  assert.equal(chip.measurements[0].attribution.kind, 'component-outcomes');
});

test('failed browser infrastructure replaces an old pass with a zero-case failed attempt', async t => {
  const scope = scopePath('md-button'), old = 'packages/core/coverage-e2e/results.json';
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`, [old]: jestResult([['md-button', 'passed']]),
    [`${scope}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button')], { status: 'failed', stencilExit: 1, errors: ['Chromium could not start.'] }),
  });
  await reportTime(root, old, '2026-09-01T10:00:00Z');
  const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  assert.equal(entry.executionStatus, 'failed');
  assert.equal(entry.executions[0].total, 0);
  assert.equal(entry.executions[0].failed, 0, 'Infrastructure does not fabricate a failed assertion');
  assert.equal(entry.executions[0].failedSuites, 0);
  assert.equal(entry.executions[0].runnerFailure, true);
  assert.equal(entry.executions[0].scope, 'runner-attempt');
  assert.match(entry.executions[0].notes.join(' '), /Chromium could not start/);
});

test('a failed isolated build records failed browser attempts without claiming test assertions ran', async t => {
  const scope = scopePath('md-button'), react = 'apps/test-react/coverage-native/scopes/md-button', source = 'apps/test-react/e2e/button.spec.tsx';
  const manifest = scopedRun('md-button', ['md-button'], [e2eFile('md-button')], {
    status: 'failed', stencilExit: null, componentExit: null, componentTests: [source], buildExit: 1, buildCompleted: false,
    errors: ['Isolated component build failed; browser suites were not started.'],
  });
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`, [source]: `test('renders', () => {});`,
    [`${scope}/run.json`]: manifest, [`${react}/run.json`]: manifest,
  });
  const { categories } = await getComponentCoverage(root, 'md-button');
  for (const id of ['e2e', 'component']) {
    const entry = categories[id];
    assert.equal(entry.executionStatus, 'failed', id);
    assert.equal(entry.executions[0].total, 0, id);
    assert.equal(entry.executions[0].failed, 0, id);
    assert.equal(entry.executions[0].failedSuites, 0, id);
    assert.equal(entry.executions[0].runnerFailure, true, id);
    assert.match(entry.executions[0].notes.join(' '), /build failed/);
  }
});

test('running, stale, and malformed scoped reports cannot retain a current passing result', async t => {
  for (const mode of ['running', 'stale', 'malformed']) {
    const scope = scopePath('md-button');
    const { root } = await fixture(t, {
      [e2eFile('md-button')]: `it('renders', () => {});`,
      [`${scope}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button')], mode === 'running' ? { status: 'running', completedAt: null, stencilExit: null } : {}),
      [`${scope}/results.json`]: mode === 'malformed' ? '{' : jestResult([['md-button', 'passed']]),
      [`${scope}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n',
    });
    await reportTime(root, `${scope}/results.json`, mode === 'stale' ? '2026-09-01T10:00:00Z' : undefined);
    await reportTime(root, `${scope}/lcov.info`, '2026-09-01T10:00:00Z');
    const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
    assert.equal(entry.executionStatus, 'unknown', mode);
    assert.equal(entry.executions[0].total, 0, mode);
    assert.equal(entry.measurements.length, 0, mode);
  }
});

test('incomplete scoped results do not label an entire component run passed', async t => {
  const scope = scopePath('md-button'), extra = 'packages/core/src/components/md-button/other.e2e.ts';
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`, [extra]: `it('other behavior', () => {});`,
    [`${scope}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button'), extra], { status: 'failed', stencilExit: 1 }),
    [`${scope}/results.json`]: jestResult([['md-button', 'passed']]),
  });
  await reportTime(root, `${scope}/results.json`);
  const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  assert.equal(entry.executions.length, 1);
  assert.equal(entry.executionStatus, 'unknown');
  assert.equal(entry.executions[0].passed, 1, 'The case that actually ran retains its recorded result');
  assert.match(entry.executions[0].notes.join(' '), /did not save case outcomes/);
});

test('scoped manifests reject foreign tags, invalid source paths and symlink report escapes', async t => {
  const scope = scopePath('md-button');
  const { root, base } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`,
    [`${scope}/run.json`]: scopedRun('md-button', ['md-chip'], [e2eFile('md-button')]),
    [`${scope}/results.json`]: jestResult([['md-button', 'passed']]),
  });
  await reportTime(root, `${scope}/results.json`);
  const evil = path.join(base, 'private.json'); await writeFile(evil, jestResult([['md-button', 'passed']]));
  await mkdir(path.join(root, scopePath('all')), { recursive: true });
  await symlink(evil, path.join(root, scopePath('all'), 'results.json'));
  const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  assert.deepEqual(entry.executions, []);
  assert.equal(isCoverageEvidencePath('packages/core/coverage-e2e/scopes/../results.json'), false);
});

test('framework filenames and individual shared cases exclude incidental child tags and unrelated accessibility outcomes', async t => {
  const own = 'apps/test-react/e2e/button.spec.tsx', shared = 'apps/test-react/e2e/shared.spec.tsx';
  const item = (title, status = 'passed') => ({ title, tests: [{ status: status === 'passed' ? 'expected' : 'unexpected', expectedStatus: 'passed', results: [{ status }] }] });
  const { root } = await fixture(t, {
    [own]: `test('renders', () => { const nested = '<md-chip></md-chip>'; });`,
    [shared]: `test.describe('md-button', () => { test('keyboard focus', () => {}); }); test.describe('md-chip', () => { test('renders', () => {}); });`,
    'apps/test-react/coverage-native/results.json': JSON.stringify({ suites: [
      { file: 'button.spec.tsx', title: 'button.spec.tsx', specs: [item('renders')] },
      { file: 'shared.spec.tsx', title: 'shared.spec.tsx', suites: [
        { file: 'shared.spec.tsx', title: 'md-button', specs: [item('keyboard focus', 'failed')] },
        { file: 'shared.spec.tsx', title: 'md-chip', specs: [item('renders')] },
      ] },
    ] }),
  });
  const button = (await getComponentCoverage(root, 'md-button')).categories;
  const chip = (await getComponentCoverage(root, 'md-chip')).categories;
  assert.equal(button.component.testCount, 2);
  assert.equal(chip.component.testCount, 1);
  assert.deepEqual(chip.component.files.map(file => file.path), [shared]);
  assert.equal(button.component.executions[0].total, 2);
  assert.equal(button.component.executionStatus, 'failed');
  assert.equal(chip.component.executions[0].total, 1);
  assert.equal(chip.component.executionStatus, 'passed');
  assert.equal(chip.accessibility.executions.length, 0, 'Button focus failure is not a Chip audit');
});

test('shared core cases resolve referenced literal samples without assigning the library or unused tags', async t => {
  const shared = 'packages/core/src/components/hidden-attribute.e2e.ts';
  const scope = scopePath('all');
  const { root } = await fixture(t, {
    [shared]: `const UNUSED = ['md-chip']; const SAMPLE = ['md-button']; describe('hidden contract', () => { it('hides sampled hosts', () => { expect(SAMPLE.map(tag => tag)).toEqual([]); }); });`,
    [`${scope}/run.json`]: scopedRun('all', ['md-button', 'md-chip'], [shared]),
    [`${scope}/results.json`]: JSON.stringify({ testResults: [{ name: shared, status: 'passed', assertionResults: [{ title: 'hides sampled hosts', fullName: 'hidden contract hides sampled hosts', status: 'passed' }] }] }),
  });
  await reportTime(root, `${scope}/results.json`);
  const button = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  const chip = (await getComponentCoverage(root, 'md-chip')).categories.e2e;
  assert.equal(button.testCount, 1);
  assert.equal(button.executions[0].total, 1);
  assert.equal(button.executions[0].scope, 'shared-test-files');
  assert.match(button.files[0].notes.join(' '), /joint assertion/);
  assert.equal(chip.files.length, 0, 'Unused sample is not source evidence');
  assert.equal(chip.executions.length, 0, 'Unreferenced tag is not part of the joint assertion');
  assert.ok(isCoverageEvidencePath(shared));
  assert.ok(isCoverageEvidencePath('packages/core/src/utils/behavior.e2e.ts'));
  assert.equal(isCoverageEvidencePath('packages/core/src/utils/private.ts'), false);
});

test('parameterized shared cases use recorded tag names and do not propagate another case failure', async t => {
  const shared = 'packages/core/src/utils/components.e2e.ts';
  const { root } = await fixture(t, {
    [shared]: `const SAMPLE = ['md-button', 'md-chip']; describe('sampled components', () => { it.each(SAMPLE)('%s renders', tag => { expect(tag); }); });`,
    'packages/core/coverage-e2e/results.json': JSON.stringify({ testResults: [{ name: shared, status: 'failed', assertionResults: [
      { title: 'md-button renders', fullName: 'sampled components md-button renders', status: 'failed' },
      { title: 'md-chip renders', fullName: 'sampled components md-chip renders', status: 'passed' },
    ] }] }),
  });
  const button = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  const chip = (await getComponentCoverage(root, 'md-chip')).categories.e2e;
  assert.equal(button.testCount, 1); assert.equal(chip.testCount, 1, 'Static declarations are not expanded');
  assert.equal(button.executions[0].total, 1); assert.equal(chip.executions[0].total, 1);
  assert.equal(button.executionStatus, 'failed'); assert.equal(chip.executionStatus, 'passed');
  assert.equal(chip.executions[0].failedSuites, 0);
});

test('a comparison title and a nested fixture child cannot steal the core component owner', async t => {
  const multi = 'packages/core/src/components/md-multi-select/virtual.spec.ts';
  const field = 'packages/core/src/components/md-text-field/field.spec.ts';
  const tags = ['md-multi-select', 'md-select', 'md-text-field', 'md-icon-button'];
  const { root } = await fixture(t, {
    'packages/core/custom-elements.json': JSON.stringify({ modules: [{ declarations: tags.map(tagName => ({ tagName })) }] }),
    [multi]: `describeWasm('virtual paths', () => { it('renders on BOTH paths, unlike md-select', async () => { await create(); }); });`,
    [field]: `describe('md-text-field', () => { describe('slotted trailing md-icon-button', () => {
      it('keeps the child wrapper', async () => { await newSpecPage({ html: '<md-text-field><md-icon-button slot="trailing"></md-icon-button></md-text-field>' }); });
    }); });`,
    'packages/core/coverage-spec/results.json': JSON.stringify({ testResults: [
      { name: multi, status: 'passed', assertionResults: [{ title: 'renders on BOTH paths, unlike md-select', fullName: 'virtual paths renders on BOTH paths, unlike md-select', status: 'passed' }] },
      { name: field, status: 'failed', assertionResults: [{ title: 'keeps the child wrapper', fullName: 'md-text-field slotted trailing md-icon-button keeps the child wrapper', status: 'failed' }] },
    ] }),
  });
  const byTag = Object.fromEntries(await Promise.all(tags.map(async tag => [tag, (await getComponentCoverage(root, tag)).categories.unit])));
  assert.equal(byTag['md-multi-select'].executions[0].total, 1);
  assert.equal(byTag['md-text-field'].executions[0].failed, 1);
  for (const incidental of ['md-select', 'md-icon-button']) {
    assert.equal(byTag[incidental].testCount, 0);
    assert.deepEqual(byTag[incidental].executions, []);
  }
});

test('a foreign form fixture belongs to its mounted declared subject, not nested options or sibling controls', async t => {
  const file = 'packages/core/src/components/md-select/form-participation.e2e.ts';
  const tags = ['md-select', 'md-multi-select', 'md-select-option', 'md-button'];
  const titles = ['md-multi-select submits repeated entries', 'md-select submits a value', 'md-button type=reset clears the form'];
  const { root } = await fixture(t, {
    'packages/core/custom-elements.json': JSON.stringify({ modules: [{ declarations: tags.map(tagName => ({ tagName })) }] }),
    [file]: `it('${titles[0]}', async () => { await page.setContent('<form><md-multi-select><md-select-option></md-select-option></md-multi-select><md-button></md-button></form>'); });
      it('${titles[1]}', async () => { await page.setContent('<form><md-select><md-select-option></md-select-option></md-select><md-button></md-button></form>'); });
      it('${titles[2]}', async () => { await page.setContent('<form><md-select><md-select-option></md-select-option></md-select><md-button type="reset"></md-button></form>'); });`,
    'packages/core/coverage-e2e/results.json': JSON.stringify({ testResults: [{ name: file, status: 'passed', assertionResults: titles.map(title => ({ title, fullName: title, status: 'passed' })) }] }),
  });
  for (const tag of ['md-multi-select', 'md-select', 'md-button']) {
    const category = (await getComponentCoverage(root, tag)).categories.e2e;
    assert.equal(category.testCount, 1, tag);
    assert.equal(category.executions[0].total, 1, tag);
  }
  const option = (await getComponentCoverage(root, 'md-select-option')).categories.e2e;
  assert.equal(option.testCount, 0); assert.deepEqual(option.executions, []);
});

test('shared control tables preserve runtime failure owners and resolve bounded helper fixtures', async t => {
  const file = 'packages/core/src/components/md-text-field/inline-validation.e2e.ts';
  const tags = ['md-text-field', 'md-multi-select', 'md-date-picker', 'md-number-field', 'md-checkbox', 'md-select-option'];
  const outcomes = [
    ['md-text-field validates', 'passed'], ['md-multi-select validates', 'failed'], ['md-date-picker validates', 'failed'],
    ['checkValidity does not present an error', 'passed'], ['authored checkbox messages remain', 'passed'], ['native siblings remain', 'passed'],
  ];
  const { root } = await fixture(t, {
    'packages/core/custom-elements.json': JSON.stringify({ modules: [{ declarations: tags.map(tagName => ({ tagName })) }] }),
    [file]: `const controls = [
      { tag: 'md-text-field', markup: '<md-text-field></md-text-field>' },
      { tag: 'md-number-field', markup: '<md-number-field></md-number-field>' },
      { tag: 'md-multi-select', markup: '<md-multi-select><md-select-option></md-select-option></md-multi-select>' },
      { tag: 'md-date-picker', markup: '<md-date-picker></md-date-picker>' },
    ];
    async function fixture(page, markup) { await page.setContent(\`<form>\${markup}</form>\`); }
    it.each(controls.map(control => [control.tag, control] as const))('%s validates', async (_, control) => { await fixture(page, control.markup); });
    it('checkValidity does not present an error', async () => { await fixture(page, controls[1].markup); });
    it('authored checkbox messages remain', async () => { await fixture(page, '<fieldset><md-checkbox></md-checkbox></fieldset>'); });
    it('native siblings remain', async () => { await fixture(page, \`\${controls[0].markup}<input required>\`); });`,
    'packages/core/coverage-e2e/results.json': JSON.stringify({ testResults: [{ name: file, status: 'failed', assertionResults: outcomes.map(([title, status]) => ({ title, fullName: title, status })) }] }),
  });
  const byTag = Object.fromEntries(await Promise.all(tags.map(async tag => [tag, (await getComponentCoverage(root, tag)).categories.e2e])));
  for (const tag of ['md-multi-select', 'md-date-picker']) {
    assert.equal(byTag[tag].executions[0].total, 1, tag);
    assert.equal(byTag[tag].executions[0].failed, 1, tag);
  }
  assert.equal(byTag['md-text-field'].executions[0].total, 2);
  assert.equal(byTag['md-text-field'].executions[0].failed, 0);
  assert.equal(byTag['md-number-field'].executions[0].total, 1);
  assert.equal(byTag['md-checkbox'].executions[0].total, 1);
  assert.deepEqual(byTag['md-select-option'].executions, []);
  assert.equal(byTag['md-select-option'].testCount, 0);
  assert.equal(Object.values(byTag).reduce((sum, category) => sum + (category.executions[0]?.total || 0), 0), outcomes.length);
});

test('an explicit outer suite subject survives a foreign folder when helper markup is dynamic', async t => {
  const file = 'packages/core/src/components/md-menu/modal-layer.e2e.ts';
  const tags = ['md-menu', 'md-select', 'md-dialog'];
  const { root } = await fixture(t, {
    'packages/core/custom-elements.json': JSON.stringify({ modules: [{ declarations: tags.map(tagName => ({ tagName })) }] }),
    [file]: `async function openFixture(overlayTag, direction) { await page.setContent(\`<\${overlayTag}><md-select></md-select></\${overlayTag}>\`); }
      describe('md-select popup across a modal clipping boundary', () => {
        for (const direction of ['ltr', 'rtl']) {
          it(\`Escape preserves md-dialog (\${direction})\`, async () => { await openFixture('md-dialog', direction); await assertEscapeClosesMenuOnly(page); });
        }
      });`,
    'packages/core/coverage-e2e/results.json': JSON.stringify({ testResults: [{ name: file, status: 'passed', assertionResults: ['ltr', 'rtl'].map(direction => ({ title: `Escape preserves md-dialog (${direction})`, fullName: `md-select popup across a modal clipping boundary Escape preserves md-dialog (${direction})`, status: 'passed' })) }] }),
  });
  const select = (await getComponentCoverage(root, 'md-select')).categories.e2e;
  assert.equal(select.testCount, 1);
  assert.equal(select.executions[0].total, 2);
  assert.match(select.executions[0].notes.join(' '), /per-component case counts are not additive/);
  for (const other of ['md-menu', 'md-dialog']) assert.deepEqual((await getComponentCoverage(root, other)).categories.e2e.executions, []);
});

test('real checkout maps button source, component, browser and accessibility evidence without inventing per-tag percentages', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const result = await getComponentCoverage(root, 'md-button');
  assert.equal(result.tag, 'md-button');
  assert.ok(result.categories.unit.files.some(file => file.path.endsWith('md-button.spec.ts')));
  assert.ok(result.categories.e2e.files.some(file => file.path.endsWith('md-button.e2e.ts')));
  assert.ok(result.categories.component.files.some(file => file.path === 'apps/test-react/e2e/button.spec.tsx'));
  assert.deepEqual(result.categories.component.files.filter(file => file.kind === 'storybook-story').map(file => path.basename(file.path)), ['MdButton.stories.ts']);
  assert.deepEqual(result.categories.accessibility.files.filter(file => file.kind === 'storybook-a11y-configuration').map(file => path.basename(file.path)), ['MdButton.stories.ts']);
  assert.ok(result.categories.accessibility.files.every(file => file.testCount > 0 || file.kind === 'storybook-a11y-configuration'));
  assert.ok(result.categories.accessibility.files.length > 0);
  assert.equal(result.librarySnapshot?.scope, 'library');
  for (const category of Object.values(result.categories)) {
    assert.ok(['passed', 'failed', 'unknown', 'skipped'].includes(category.executionStatus));
    assert.ok(category.executions.every(run => isCoverageEvidencePath(run.path)));
    assert.ok(category.runs.every(run => run.verified ? !!run.runId && isCoverageEvidencePath(run.runPath) : run.runId === null));
  }
});

test('content-verified artifacts pair despite changed mtimes and retain tested-input identity', async t => {
  const directory = 'packages/core/coverage-spec', source = 'packages/core/src/components/md-button/md-button.spec.ts';
  const { root } = await fixture(t, {
    [source]: `it('renders', () => {});`,
    [`${directory}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n',
    [`${directory}/results.json`]: JSON.stringify({ testResults: [{ name: source, status: 'passed', assertionResults: [{ title: 'renders', status: 'passed' }] }] }),
  });
  const evidence = await sealReports(root, directory, { testFiles: [source] });
  for (const name of ['results.json', 'lcov.info']) await reportTime(root, `${directory}/${name}`, '2000-01-01');
  const { unit } = (await getComponentCoverage(root, 'md-button')).categories;
  assert.equal(unit.runs.length, 1);
  const run = unit.runs[0];
  assert.equal(run.runId, evidence.runId); assert.equal(run.runPath, `${directory}/run-evidence.json`);
  assert.equal(run.verified, true); assert.equal(run.source.matchesCurrent, true);
  assert.equal(run.source.stableDuringRun, true); assert.equal(run.source.files, undefined);
  assert.equal(run.measurement.attribution.kind, 'component-outcomes');
  assert.equal(run.measurement.runId, run.execution.runId); assert.equal(run.execution.total, 1);
  assert.equal(run.reportedAt, evidence.completedAt);
  assert.ok(isCoverageEvidencePath(run.runPath));
  assert.equal(isCoverageEvidencePath(`${directory}/run-evidence-private.json`), false);
});

test('tampered output cannot borrow valid evidence, an old manifest or another report in its directory', async t => {
  const directory = scopePath('md-button');
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`,
    [`${directory}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button')]),
    [`${directory}/results.json`]: jestResult([['md-button', 'passed']]),
    [`${directory}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n',
  });
  await sealReports(root, directory);
  await writeFile(path.join(root, directory, 'results.json'), jestResult([['md-button', 'failed']]));
  await writeFile(path.join(root, directory, 'coverage-summary.json'), JSON.stringify({ 'src/components/md-button/md-button.tsx': { lines: { total: 10, covered: 10 } } }));
  const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  assert.equal(entry.measurements.length, 1, 'Unsealed later artifacts are excluded');
  assert.equal(entry.executions.length, 1); assert.equal(entry.executions[0].scope, 'runner-attempt');
  assert.equal(entry.executions[0].total, 0); assert.equal(entry.executionStatus, 'unknown');
  assert.equal(entry.runs.length, 1); assert.equal(entry.runs[0].verified, true);
  assert.equal(entry.measurements[0].attribution.componentExecutionPath, null);
  assert.equal(entry.measurements[0].attribution.componentTestCount, null);
});

test('a changed implementation retains historical paired results while changed test definitions block reassignment', async t => {
  for (const changedTest of [false, true]) {
    const directory = 'packages/core/coverage-spec', source = 'packages/core/src/components/md-button/md-button.spec.ts', implementation = 'packages/core/src/components/md-button/md-button.tsx';
    const { root } = await fixture(t, {
      [source]: `it('renders', () => {});`, [implementation]: 'export class Button {}',
      [`${directory}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n',
      [`${directory}/results.json`]: JSON.stringify({ testResults: [{ name: source, status: 'passed', assertionResults: [{ title: 'renders', status: 'passed' }] }] }),
    });
    await sealReports(root, directory, { testFiles: [source] });
    await writeFile(path.join(root, changedTest ? source : implementation), changedTest ? `it('different behavior', () => {});` : 'export class Button { changed = true; }');
    const run = (await getComponentCoverage(root, 'md-button')).categories.unit.runs[0];
    assert.equal(run.verified, true, 'Artifact identity remains verified'); assert.equal(run.source.matchesCurrent, false);
    assert.equal(run.execution.total, changedTest ? 0 : 1);
    assert.equal(run.status, changedTest ? 'unknown' : 'passed');
    assert.equal(run.measurement.attribution.kind, changedTest ? 'broader-run' : 'component-outcomes');
    if (changedTest) assert.match(run.execution.notes.join(' '), /test definitions have changed/);
  }
});

test('Component runners retain their own measurements and outcomes instead of pairing newest unrelated files', async t => {
  const react = 'apps/test-react/coverage-native', stories = 'apps/storybook/coverage-stories';
  const reactSource = 'apps/test-react/e2e/button.spec.tsx', storySource = 'apps/storybook/src/stories/MdButton.stories.ts';
  const { root } = await fixture(t, {
    [reactSource]: `test('renders', () => {});`,
    [storySource]: `export default { component: 'md-button' }; export const Primary: Story = {};`,
    [`${react}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nDA:2,0\nend_of_record\n',
    [`${react}/results.json`]: JSON.stringify({ suites: [{ file: 'button.spec.tsx', specs: [{ title: 'renders', tests: [{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] }] }] }] }),
    [`${stories}/lcov.info`]: 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nDA:2,1\nend_of_record\n',
    [`${stories}/results.json`]: JSON.stringify({ testResults: [{ name: storySource, status: 'failed', assertionResults: [{ title: 'Primary', fullName: 'Primary', status: 'failed' }] }] }),
  });
  await sealReports(root, stories, { testFiles: [storySource], label: 'Storybook interactions', exitCode: 1 });
  await sealReports(root, react, { testFiles: [reactSource], label: 'React harness · React project' });
  const entry = (await getComponentCoverage(root, 'md-button')).categories.component;
  assert.equal(entry.runs.length, 2); assert.equal(new Set(entry.runs.map(run => run.runnerKey)).size, 2);
  assert.equal(entry.executionStatus, 'failed', 'A newer passing React harness does not conceal a failing Storybook run');
  const byLabel = Object.fromEntries(entry.runs.map(run => [run.label, run]));
  assert.equal(byLabel['React harness · React project'].measurement.lines.percent, 50);
  assert.equal(byLabel['React harness · React project'].execution.status, 'passed');
  assert.equal(byLabel['Storybook interactions'].measurement.lines.percent, 100);
  assert.equal(byLabel['Storybook interactions'].execution.status, 'failed');
  for (const run of entry.runs) assert.equal(run.measurement.runId, run.execution.runId);
});

test('Accessibility preserves each parent runner and excludes ARIA fixture-only checks', async t => {
  const unit = 'packages/core/coverage-spec', browser = scopePath('md-button');
  const spec = 'packages/core/src/components/md-button/md-button.spec.ts', e2e = e2eFile('md-button');
  const { root } = await fixture(t, {
    [spec]: `it('reflects suppress-expand-icon-flip when set', () => { const fixture = '<md-button aria-expanded="true"></md-button>'; expect(el.hasAttribute('suppress-expand-icon-flip')).toBe(true); });
      it('exposes the accessible name', () => { expect(el.getAttribute('aria-label')).toBe('Save'); });`,
    [e2e]: `it('keyboard focus', () => { expect(document.activeElement).toBe(button); });`,
    [`${unit}/results.json`]: JSON.stringify({ testResults: [{ name: spec, status: 'passed', assertionResults: [
      { title: 'reflects suppress-expand-icon-flip when set', status: 'passed' }, { title: 'exposes the accessible name', status: 'passed' },
    ] }] }),
    [`${browser}/run.json`]: scopedRun('md-button', ['md-button'], [e2e]),
    [`${browser}/results.json`]: JSON.stringify({ testResults: [{ name: e2e, status: 'failed', assertionResults: [{ title: 'keyboard focus', status: 'failed' }] }] }),
  });
  await sealReports(root, browser, { exitCode: 1 });
  await sealReports(root, unit, { testFiles: [spec] });
  const entry = (await getComponentCoverage(root, 'md-button')).categories.accessibility;
  assert.equal(entry.runs.length, 2); assert.equal(entry.executionStatus, 'failed');
  assert.deepEqual(entry.runs.map(run => run.category).sort(), ['e2e', 'unit']);
  const mock = entry.runs.find(run => run.category === 'unit').execution;
  assert.equal(mock.total, 1); assert.equal(mock.environment, 'mock-dom');
  assert.deepEqual(mock.accessibilityKinds, ['aria-or-semantics']);
  assert.equal(entry.runs.find(run => run.category === 'e2e').execution.environment, 'browser');
  assert.deepEqual(entry.measurements, []); assert.deepEqual(entry.audits, []);
  assert.doesNotMatch(entry.notes.join(' '), /No component-specific measured coverage report/, 'Accessibility reports outcomes rather than a code coverage percentage');
});

test('Storybook axe audit metadata remains separate from story success, configured addons and related checks', async t => {
  const directory = 'apps/storybook/coverage-stories', source = 'apps/storybook/src/stories/MdButton.stories.ts';
  const audit = (status, result) => ({ type: 'a11y', version: 1, status, result });
  const outcomes = [
    ['NotRun', []], ['Clean', [audit('passed', { violations: [], incomplete: [] })]],
    ['Warning', [audit('warning', { violations: [{ id: 'color-contrast' }], incomplete: [] })]],
    ['Review', [audit('passed', { violations: [], incomplete: [{ id: 'color-contrast' }] })]],
    ['Error', [audit('failed', { error: {} })]],
  ];
  const { root } = await fixture(t, {
    [source]: `export default { component: 'md-button', parameters: { a11y: { test: 'todo' } } }; ${outcomes.map(([title]) => `export const ${title}: Story = {};`).join('\n')}`,
    [`${directory}/results.json`]: JSON.stringify({ testResults: [{ name: source, status: 'passed', assertionResults: outcomes.map(([title, reports]) => ({ title, fullName: title, status: 'passed', meta: { reports } })) }] }),
  });
  await sealReports(root, directory, { testFiles: [source], label: 'Storybook interactions' });
  const categories = (await getComponentCoverage(root, 'md-button')).categories;
  assert.equal(categories.component.executionStatus, 'passed'); assert.equal(categories.component.executions[0].total, 5);
  const run = categories.accessibility.runs[0];
  assert.equal(run.execution, null, 'Axe records do not invent related play assertions');
  assert.equal(run.measurement, null); assert.equal(run.status, 'failed');
  assert.equal(run.axeAudit.total, 4); assert.equal(run.axeAudit.passed, 1); assert.equal(run.axeAudit.failed, 2); assert.equal(run.axeAudit.unknown, 1);
  assert.equal(run.axeAudit.warning, 1); assert.equal(run.axeAudit.violations, 1); assert.equal(run.axeAudit.incomplete, 1); assert.equal(run.axeAudit.errors, 1);
  assert.equal(run.axeAudit.runId, categories.component.runs[0].runId);
  assert.equal(categories.accessibility.executionStatus, 'failed');
});

test('large verified Storybook reports retain failing cases and axe violations beyond 32 MiB', async t => {
  const directory = 'apps/storybook/coverage-stories', source = 'apps/storybook/src/stories/MdButton.stories.ts';
  const { root } = await fixture(t, {
    [source]: `export default { component: 'md-button' }; export const Broken: Story = {}; export const Warning: Story = {};`,
    [`${directory}/results.json`]: JSON.stringify({
      diagnosticPadding: ' '.repeat(33 * 1024 * 1024),
      testResults: [{ name: source, status: 'failed', assertionResults: [
        { title: 'Broken', fullName: 'Broken', status: 'failed', failureMessages: ['Recorded failure'] },
        { title: 'Warning', fullName: 'Warning', status: 'passed', meta: { reports: [{
          type: 'a11y', version: 1, status: 'warning', result: { violations: [{ id: 'color-contrast' }], incomplete: [] },
        }] } },
      ] }],
    }),
  });
  const evidence = await sealReports(root, directory, { testFiles: [source], exitCode: 1 });
  assert.ok(evidence.artifacts['results.json'].size > 32 * 1024 * 1024);
  const { component, accessibility } = (await getComponentCoverage(root, 'md-button')).categories;
  const run = component.runs.find(item => item.runId === evidence.runId);
  assert.equal(run.verified, true); assert.equal(run.status, 'failed');
  assert.equal(run.execution.total, 2); assert.equal(run.execution.passed, 1); assert.equal(run.execution.failed, 1);
  const audits = accessibility.runs.find(item => item.runId === evidence.runId);
  assert.equal(audits.verified, true); assert.equal(audits.status, 'failed');
  assert.equal(audits.axeAudit.total, 1); assert.equal(audits.axeAudit.failed, 1); assert.equal(audits.axeAudit.warning, 1);
});

test('a newer unverified failure stays visible beside an older verified pass from the same runner', async t => {
  const directory = scopePath('md-button'), newer = 'packages/core/coverage-e2e/results.json';
  const { root } = await fixture(t, {
    [e2eFile('md-button')]: `it('renders', () => {});`,
    [`${directory}/run.json`]: scopedRun('md-button', ['md-button'], [e2eFile('md-button')]),
    [`${directory}/results.json`]: jestResult([['md-button', 'passed']]), [newer]: jestResult([['md-button', 'failed']]),
  });
  const evidence = await sealReports(root, directory);
  await reportTime(root, newer, new Date(Date.parse(evidence.completedAt) + 60000).toISOString());
  const entry = (await getComponentCoverage(root, 'md-button')).categories.e2e;
  assert.equal(entry.executionStatus, 'failed');
  assert.equal(entry.runs.find(run => run.verified).execution.status, 'passed');
  assert.equal(entry.runs.find(run => !run.verified).execution.status, 'failed');
});

test('a running parent run replaces older Accessibility success with an explicit zero-case attempt', async t => {
  const directory = scopePath('md-button'), old = 'packages/core/coverage-e2e/results.json', file = e2eFile('md-button');
  const { root } = await fixture(t, {
    [file]: `it('keyboard focus', () => { expect(document.activeElement).toBe(button); });`,
    [old]: JSON.stringify({ testResults: [{ name: file, status: 'passed', assertionResults: [{ title: 'keyboard focus', status: 'passed' }] }] }),
  });
  await reportTime(root, old, '2000-01-01');
  const handle = await beginTestRun({ root, directory, category: 'e2e', framework: 'jest', label: 'Stencil browser E2E', command: 'fixture', testFiles: [file], tags: ['md-button'] });
  const entry = (await getComponentCoverage(root, 'md-button')).categories.accessibility;
  const run = entry.runs.find(run => run.runId === handle.runId);
  assert.equal(run.state, 'running'); assert.equal(run.status, 'unknown'); assert.equal(entry.executionStatus, 'unknown');
  assert.equal(run.execution.scope, 'runner-attempt'); assert.equal(run.execution.total, 0); assert.equal(run.execution.failedSuites, 0);
  assert.equal(run.axeAudit, null); assert.equal(run.category, 'e2e'); assert.equal(run.execution.environment, 'browser');
});

test('shared utility helper chains attribute registered real components without expanding fake element fixtures', async t => {
  const source = 'packages/core/src/utils/form-enter.spec.ts';
  const { root } = await fixture(t, {
    [source]: `import { newSpecPage } from '@stencil/core/testing';
      import { MdButton as Button } from '../components/md-button/md-button';
      describe('form helper', () => {
        async function buttonFixture(attributes = '') { return newSpecPage({ components: [Button], html: \`<md-button \${attributes}>Save</md-button>\` }); }
        async function delayedFixture() { return buttonFixture(); }
        function fakeFixture() { return document.createElement('md-chip'); }
        it('waits for the lazy default', async () => { await delayedFixture(); });
        it('rejects a failed upgrade', async () => { await delayedFixture(); });
        it('activates an already ready default', async () => { await delayedFixture(); });
        it('uses a fake utility host', () => { fakeFixture(); });
      });`,
    'packages/core/coverage-spec/results.json': JSON.stringify({ testResults: [{ name: source, status: 'passed', assertionResults: [
      'waits for the lazy default', 'rejects a failed upgrade', 'activates an already ready default', 'uses a fake utility host',
    ].map(title => ({ title, fullName: `form helper ${title}`, status: 'passed' })) }] }),
  });
  const button = (await getComponentCoverage(root, 'md-button')).categories.unit;
  assert.equal(button.testCount, 3); assert.equal(button.executions[0].total, 3);
  const chip = (await getComponentCoverage(root, 'md-chip')).categories.unit;
  assert.equal(chip.testCount, 0); assert.deepEqual(chip.executions, []);
});
