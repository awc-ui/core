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
  assert.equal(view.testLabel, 'Tests passed');
  assert.equal(view.execution.status, 'failed');
  assert.equal(view.measurement.path, 'latest');
});

test('zero covered code remains 0%, while an empty denominator has no percentage', () => {
  const view = coveragePresentation({ measurements: [{
    lines: { covered: 0, total: 12, percent: 0 },
    branches: { covered: 0, total: 0, percent: null },
  }] });
  assert.equal(view.percentage, '0%');
  assert.equal(view.metrics[1].text, '—');
  assert.equal(view.metrics[1].percent, null);
});

test('test declarations and passing accessibility tests do not imply measured code coverage', () => {
  const evidence = coveragePresentation({ testCount: 57, measurements: [] });
  assert.equal(evidence.testValue, '57');
  assert.equal(evidence.testLabel, 'Test / story declarations');
  assert.equal(evidence.percentage, '—');
  assert.equal(evidence.execution, undefined);
  const audit = coveragePresentation({ measurements: [], executions: [{ passed: 5, failed: 0, skipped: 0, total: 5, status: 'passed' }] });
  assert.equal(audit.testValue, '5/5');
  assert.equal(audit.percentage, '—');
});
