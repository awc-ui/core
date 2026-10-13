import test from 'node:test';
import assert from 'node:assert/strict';
import { coveragePresentation } from './studio-ui.js';

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
  assert.equal(failed.executionNote, '1 suite failed before case results');
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
  assert.equal(coverageOnly.executionLabel, 'No saved run');
});
