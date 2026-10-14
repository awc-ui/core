import test from 'node:test';
import assert from 'node:assert/strict';
import { coveragePresentation, coverageRunViews, coverageRagStatus, renderCoverageRun, renderCoverageContent } from './studio-ui.js';

test('measured coverage uses the latest report without merging separate runs or inferring success', () => {
  const measured = { path: 'latest', lines: { covered: 8, total: 10, percent: 80 } };
  const run = { passed: 2, failed: 1, skipped: 1, total: 4, status: 'failed' };
  const view = coveragePresentation({ testCount: 57, measurements: [measured,
    { path: 'older', lines: { covered: 10, total: 10, percent: 100 } }], executions: [run] });
  assert.equal(view.percentage, '80%');
  assert.equal(view.testValue, '2/4');
  assert.equal(view.testLabel, 'Recorded cases passed');
  assert.equal(view.execution.status, 'failed');
  assert.equal(view.measurement.path, 'latest');
});

test('zero covered code remains 0%, while an empty denominator has no percentage', () => {
  const view = coveragePresentation({ measurements: [{
    lines: { covered: 0, total: 12, percent: 0 },
    branches: { covered: 0, total: 0, percent: null },
  }] });
  assert.equal(view.percentage, '0%');
  assert.equal(view.metrics[1].text, 'No locations');
  assert.equal(view.metrics[1].percent, null);
});

test('test declarations and passing accessibility tests do not imply measured code coverage', () => {
  const evidence = coveragePresentation({ testCount: 57, measurements: [] });
  assert.equal(evidence.testValue, '57');
  assert.equal(evidence.testLabel, 'Test / story declarations');
  assert.equal(evidence.percentage, 'Not measured');
  assert.equal(evidence.execution, undefined);
  const audit = coveragePresentation({ measurements: [], executions: [{ passed: 5, failed: 0, skipped: 0, total: 5, status: 'passed' }] });
  assert.equal(audit.testValue, '5/5');
  assert.equal(audit.percentage, 'Not measured');
});

test('category measurements distinguish real zero coverage, missing reports, missing tests and accessibility outcomes', () => {
  const categories = {
    unit: { testCount: 12, measurements: [{ lines: { covered: 0, total: 8, percent: 0 } }], executions: [{ status: 'failed', passed: 0, failed: 1, total: 1 }] },
    component: { testCount: 8, files: [{ kind: 'playwright-component' }] },
    e2e: { testCount: 0, files: [] },
    accessibility: { executions: [{ status: 'passed', passed: 3, failed: 0, total: 3 }] },
  };
  const overview = Object.entries(categories).map(([id, category]) => coveragePresentation(category, id));
  assert.equal(overview[0].measurementLabel, '0% lines');
  assert.equal(overview[0].executionLabel, 'Failed');
  assert.equal(overview[1].measurementLabel, 'Not measured');
  assert.equal(overview[1].executionLabel, 'No saved run');
  assert.equal(overview[1].sourceLabel, '8 declarations');
  assert.equal(overview[2].sourceLabel, 'No tests found');
  assert.equal(overview[2].contextTitle, 'No end-to-end tests attributed to this component');
  assert.equal(overview[3].measurementLabel, 'No coverage percentage');
  assert.equal(overview[3].executionLabel, 'Passed');
  assert.equal(overview[3].executionNote, '3/3 cases passed');
});

test('configured accessibility and incomplete, skipped or suite-failed runs cannot appear as passing coverage', () => {
  const configured = coveragePresentation({ files: [{ kind: 'storybook-a11y-configuration' }], testCount: 0 }, 'accessibility');
  assert.equal(configured.configurationOnly, true);
  assert.equal(configured.sourceLabel, 'Configuration only');
  assert.equal(configured.executionLabel, 'No saved run');
  for (const [status, label] of [['unknown', 'Incomplete'], ['skipped', 'Skipped']]) {
    assert.equal(coveragePresentation({ executions: [{ status, passed: 0, total: 2 }] }).executionLabel, label);
  }
  const failed = coveragePresentation({ executions: [{ status: 'failed', passed: 0, failed: 0, total: 0, failedSuites: 1 }] });
  assert.equal(failed.executionLabel, 'Failed');
  assert.equal(failed.executionNote, '1 suite-level failure recorded');
  assert.equal(failed.testValue, '0');
  assert.equal(failed.testLabel, 'Cases recorded');
  assert.equal(failed.percentage, 'Not measured');
});

test('shared source outcomes and measurement-only reports retain separate attribution', () => {
  const shared = coveragePresentation({ executions: [{ status: 'passed', passed: 5, total: 5, scope: 'shared-test-files' }] });
  assert.match(shared.executionNote, /shared test files/);
  const coverageOnly = coveragePresentation({ measurements: [{ branches: { covered: 2, total: 4, percent: 50 } }] });
  assert.equal(coverageOnly.measurementLabel, 'Measured · no line data');
  assert.equal(coverageOnly.percentage, 'No line data');
  assert.equal(coverageOnly.executionLabel, 'No component test results');
});

test('indirect execution explains positive coverage without inventing component tests or denying a saved run', () => {
  const view = coveragePresentation({ files: [], testCount: 0, measurements: [{
    scopeId: 'all', lines: { covered: 55, total: 168, percent: 32.74 },
    attribution: { kind: 'broader-run', sourceExecution: 'observed', componentTestCount: 0,
      runContext: { path: 'packages/core/coverage-e2e/scopes/all/results.json' } },
  }] }, 'e2e');
  assert.equal(view.percentage, '32.74%');
  assert.equal(view.contextTitle, 'No end-to-end tests attributed to this component');
  assert.equal(view.coverageTitle, 'Indirect source coverage');
  assert.match(view.contextNote, /55 of 168 source lines covered during the recorded end-to-end run/);
  assert.match(view.contextNote, /initialization and use by other components/);
  assert.match(view.contextNote, /does not establish that its behavior was tested/);
  assert.doesNotMatch(view.contextNote, /No saved run|passed/);
  assert.equal(view.execution, undefined);
});

test('unexecuted source and an unlinked report do not become indirect behavioral coverage', () => {
  const zero = coveragePresentation({ measurements: [{ lines: { covered: 0, total: 55, percent: 0 },
    attribution: { kind: 'broader-run', sourceExecution: 'zero-hit', componentTestCount: 0 } }] }, 'e2e');
  assert.equal(zero.coverageTitle, 'Source coverage · no execution');
  assert.match(zero.contextNote, /0 of 55 source lines covered/);
  assert.doesNotMatch(zero.contextNote, /use by other components/);
  const functionOnly = coveragePresentation({ measurements: [{ functions: { covered: 1, total: 2, percent: 50 },
    attribution: { kind: 'broader-run', sourceExecution: 'observed', componentTestCount: 0 } }] }, 'e2e');
  assert.equal(functionOnly.coverageTitle, 'Indirect source coverage');
  assert.doesNotMatch(functionOnly.contextNote, /unexecuted source/);
  const unlinked = coveragePresentation({ measurements: [{ lines: { covered: 5, total: 5, percent: 100 },
    attribution: { kind: 'coverage-only' } }] }, 'unit');
  assert.equal(unlinked.coverageTitle, 'Source coverage · unlinked report');
  assert.match(unlinked.contextNote, /No component test outcomes have been linked/);
});

test('a different successful execution never appears to validate an indirect coverage report', () => {
  const view = coveragePresentation({ files: [{ kind: 'storybook-story' }], testCount: 9,
    measurements: [{ scopeId: 'all', lines: { covered: 4, total: 4, percent: 100 }, attribution: { kind: 'broader-run', componentTestCount: 0 } }],
    executions: [{ path: 'apps/storybook/coverage-stories/results.json', total: 9, passed: 9, status: 'passed' }],
  }, 'component');
  assert.equal(view.contextTitle, 'No component test results in this coverage run');
  assert.match(view.contextNote, /component test results below belong to a different report or run/);
  assert.equal(view.coverageTitle, 'Indirect source coverage');
  assert.equal(view.execution.passed, 9);
});

test('verified matching run and accessibility checks keep their specific meaning', () => {
  const path = 'scoped/results.json', reportedAt = '2026-10-13T17:44:20Z', runPath = 'scoped/run.json';
  const view = coveragePresentation({ measurements: [{ runPath, reportedAt, attribution: { kind: 'component-outcomes', componentExecutionPath: path } }],
    executions: [{ path, runPath, reportedAt, passed: 1, total: 1, status: 'passed' }] }, 'e2e');
  assert.equal(view.contextTitle, 'Tests and source coverage');
  assert.doesNotMatch(view.contextNote, /different|not linked/);
  const a11y = coveragePresentation({ executions: [{ passed: 3, total: 3, status: 'passed' }] }, 'accessibility');
  assert.equal(a11y.contextTitle, 'Accessibility check results');
  assert.match(a11y.contextNote, /not a WCAG conformance or coverage percentage/);
});

test('a run manifest without verified outcomes does not prove that zero component cases ran', () => {
  const view = coveragePresentation({ measurements: [{ lines: { covered: 4, total: 5, percent: 80 },
    attribution: { kind: 'broader-run', componentTestCount: null } }] }, 'e2e');
  assert.equal(view.contextTitle, 'Component outcomes unavailable for this run');
  assert.match(view.contextNote, /outcomes could not be verified/);
  assert.doesNotMatch(view.contextNote, /has no test outcomes|other components/);
  assert.equal(view.coverageTitle, 'Source coverage · outcomes unavailable');
});

test('runner infrastructure failures do not claim component case or suite outcomes', () => {
  for (const status of ['failed', 'unknown']) {
    const view = coveragePresentation({ executions: [{ scope: 'runner-attempt', status, total: 0,
      passed: 0, failed: 0, skipped: 0, failedSuites: status === 'failed' ? 2 : 0 }] }, 'e2e');
    assert.equal(view.runnerAttempt, true);
    assert.equal(view.executionTitle, status === 'failed' ? 'Runner attempt failed' : 'Runner attempt incomplete');
    assert.equal(view.contextTitle, 'No recorded case outcomes');
    assert.equal(view.executionNote, 'No case outcomes were recorded for this runner attempt.');
    assert.doesNotMatch(view.contextNote, /Test outcomes are recorded|suite.*failed/);
    const oldCoverage = coveragePresentation({ executions: [view.execution], measurements: [{
      lines: { total: 10, covered: 8, percent: 80 }, attribution: { kind: 'coverage-only' },
    }] }, 'e2e');
    assert.match(oldCoverage.contextNote, /runner attempt below recorded no case outcomes/);
    assert.doesNotMatch(oldCoverage.contextNote, /component results below/);
  }
});

test('each runner keeps its own latest paired reports without hiding other test environments', () => {
  const react = { runnerKey: 'component:react', runId: 'react-new', label: 'React CT', verified: true, reportedAt: '2026-10-14T12:00:00Z' };
  const story = { runnerKey: 'component:storybook', runId: 'story', label: 'Storybook', verified: true, reportedAt: '2026-10-14T11:00:00Z' };
  const views = coverageRunViews({ runs: [story, { ...react, runId: 'react-old', reportedAt: '2026-10-14T10:00:00Z' }, react] });
  assert.deepEqual(views.map(run => run.runId), ['react-new', 'story']);
  const a11y = coverageRunViews({ runs: [{ ...react, runnerKey: 'unit:core', execution: { status: 'passed' } },
    { ...story, runnerKey: 'e2e:core', execution: { status: 'failed' } }] });
  assert.deepEqual(a11y.map(run => run.execution.status), ['passed', 'failed']);
});

test('coverage bands match reporter boundaries and reject missing or invalid percentages', () => {
  for (const percent of [0, 32.74, 49.99]) assert.deepEqual(coverageRagStatus(percent), { color: 'error', label: 'Red' });
  for (const percent of [50, 79.83, 79.99]) assert.deepEqual(coverageRagStatus(percent), { color: 'warning', label: 'Amber' });
  for (const percent of [80, 99.53, 100]) assert.deepEqual(coverageRagStatus(percent), { color: 'success', label: 'Green' });
  for (const percent of [null, undefined, NaN, Infinity, -1, 101, '80']) assert.equal(coverageRagStatus(percent), null);
});

test('coverage-only cards use library meters and retain exact counts without test outcomes or provenance sections', () => {
  const html = renderCoverageRun({ label: 'Unit', verified: true, runId: 'run-1', runPath: 'unit/run-evidence.json',
    reportedAt: '2026-10-14T12:00:00Z', source: { matchesCurrent: true },
    measurement: { path: 'unit/lcov.info', lines: { covered: 424, total: 426, percent: 99.53 },
      branches: { covered: 61, total: 71, percent: 85.92 }, functions: { covered: 9, total: 9, percent: 100 } },
    execution: { path: 'unit/results.json', status: 'failed', passed: 79, failed: 1, skipped: 0, total: 80 },
  }, 'unit');
  assert.match(html, /<md-meter[^>]+value="99.53" color="success"[^>]+value-text="99.53% · Green"/);
  assert.match(html, /424 of 426 covered/);
  assert.match(html, /61 of 71 covered/);
  assert.match(html, /9 of 9 covered/);
  assert.doesNotMatch(html, /Test cases|passed|failed|Run details|Run completed|Report hashes|Test results|Run record|progress-indicator|<a /);
});

test('accessibility outcomes never become a fabricated coverage percentage', () => {
  const entry = { runs: [{ label: 'Storybook', axeAudit: { total: 8, passed: 6, failed: 1, unknown: 1 },
    execution: { total: 5, passed: 5 } }] };
  const html = renderCoverageContent(entry, 'accessibility');
  assert.match(html, /A coverage percentage is not measured for accessibility checks/);
  assert.doesNotMatch(html, /md-meter|75%|100%|passed|failed/);
});

test('unmeasured and zero-location values stay neutral while measured zero coverage is red', () => {
  const missing = renderCoverageContent({ runs: [] }, 'component');
  assert.match(missing, /No coverage measurement available/);
  assert.doesNotMatch(missing, /md-meter|0%|Coverage thresholds/);
  const html = renderCoverageRun({ label: 'E2E', verified: true, source: { matchesCurrent: true }, measurement: {
    lines: { covered: 0, total: 55, percent: 0 }, branches: { covered: 0, total: 0, percent: null },
  } }, 'e2e');
  assert.match(html, /value="0" color="error"/);
  assert.match(html, /0 of 55 covered/);
  assert.match(html, /No locations/);
  assert.equal((html.match(/<md-meter/g) || []).length, 1);
});

test('coverage keeps a concise warning when saved measurements no longer match the inputs', () => {
  const base = { verified: true, measurement: { lines: { covered: 1, total: 2, percent: 50 } } };
  assert.match(renderCoverageRun({ ...base, source: { changedFiles: ['component.tsx'] } }, 'unit'), /inputs have changed/);
  assert.match(renderCoverageRun({ ...base, source: { buildInputsMatchCurrent: false } }, 'unit'), /build inputs could not be verified/);
  assert.match(renderCoverageRun({ ...base, verified: false }, 'unit'), /unverified report/);
  const running = renderCoverageRun({ state: 'running' }, 'unit');
  assert.match(running, /Coverage measurement in progress/);
  assert.doesNotMatch(running, /md-meter|inputs have changed/);
});

test('coverage panel retains source files and runnable commands without the threshold legend', () => {
  const html = renderCoverageContent({ files: [{ path: 'test.spec.ts' }], commands: [{ command: 'run tests' }],
    runs: [{ runnerKey: 'component:storybook', label: 'Storybook', verified: true, source: { matchesCurrent: true },
      measurement: { lines: { covered: 3, total: 4, percent: 75 } } },
    { runnerKey: 'component:react', label: 'React', verified: true, source: { matchesCurrent: true },
      measurement: { lines: { covered: 4, total: 4, percent: 100 } } }],
  }, 'component');
  assert.match(html, /Storybook/); assert.match(html, /React/);
  assert.match(html, /color="warning"/); assert.match(html, /color="success"/);
  assert.match(html, /href="\/repo\/test.spec.ts"/);
  assert.match(html, /run tests/);
  assert.match(html, /Source files/);
  assert.match(html, /Run locally/);
  assert.match(html, /data-copy-command="0"/);
  assert.doesNotMatch(html, /coverage-legend|Coverage thresholds|Red &lt; 50%/);
});

test('new unpaired coverage cannot hide a recorded failure, while new outcomes replace older outcomes', () => {
  const failed = { key: 'old', runnerKey: 'e2e:core', verified: true, reportedAt: '2026-10-14T11:00:00Z',
    execution: { status: 'failed' }, measurement: { lines: { covered: 10, total: 20, percent: 50 } } };
  const newer = { key: 'new', runnerKey: 'e2e:core', verified: false, reportedAt: '2026-10-14T12:00:00Z',
    measurement: { lines: { covered: 20, total: 20, percent: 100 } } };
  const separate = coverageRunViews({ runs: [failed, newer] });
  assert.equal(separate.length, 2);
  assert.equal(separate[0].measurement.lines.percent, 100);
  assert.equal(separate[1].execution.status, 'failed');
  const compact = renderCoverageContent({ runs: [failed, newer] }, 'e2e');
  assert.equal((compact.match(/coverage-report-card/g) || []).length, 1);
  assert.match(compact, /100%/);
  assert.doesNotMatch(compact, /10 of 20 covered/);
  const latestOutcome = { ...newer, measurement: null, execution: { status: 'failed' } };
  assert.deepEqual(coverageRunViews({ runs: [{ ...failed, execution: { status: 'passed' } }, latestOutcome] }), [latestOutcome]);
});
