import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, utimes } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { getComponentCoverage, isCoverageEvidencePath } from './coverage.mjs';

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
  assert.equal(run.scope, 'shared-test-files');
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
    assert.equal(category.executionStatus, category.executions[0]?.status || 'unknown');
    assert.ok(category.executions.every(run => isCoverageEvidencePath(run.path)));
  }
});
