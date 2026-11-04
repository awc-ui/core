import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import { coveragePresentation, coverageRunViews, coverageRagStatus, renderCoverageRun, renderCoverageContent, createCoverageUI } from './studio-ui.js';

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

test('accessibility displays recorded scan and case totals separately, including review-needed scans', () => {
  const entry = { runs: [{ label: 'Storybook', axeAudit: { total: 25, passed: 1, failed: 0, unknown: 24 },
    execution: { total: 5, passed: 5 } }] };
  const html = renderCoverageContent(entry, 'accessibility');
  assert.match(html, /Automated axe scans/);
  assert.match(html, /Accessibility test cases/);
  assert.match(html, /<b>25<\/b> total/);
  assert.match(html, /<b>1<\/b> passed/);
  assert.match(html, /<b>0<\/b> failed/);
  assert.match(html, /<b>24<\/b> need review/);
  assert.match(html, /data-status="unknown">Needs review/);
  assert.match(html, /<b>5<\/b> total/);
  assert.match(html, /<b>5<\/b> passed/);
  assert.doesNotMatch(html, /md-meter|75%|100%|<b>30<\/b> total|percentage is not measured/);
});

test('passing interaction cases cannot hide failed axe scans', () => {
  const html = renderCoverageRun({ label: 'Storybook', axeAudit: { total: 31, passed: 0, failed: 1, unknown: 30 },
    execution: { total: 6, passed: 6, failed: 0 },
  }, 'accessibility');
  assert.match(html, /Automated axe scans<\/span><strong data-status="failed">Failed/);
  assert.match(html, /<b>1<\/b> failed/);
  assert.match(html, /<b>30<\/b> need review/);
  assert.match(html, /Accessibility test cases<\/span><strong data-status="passed">Passed/);
});

test('accessibility only counts recorded outcomes, retaining skipped, incomplete and flaky cases', () => {
  const configured = renderCoverageContent({ testCount: 65, files: [{ path: 'example.stories.ts', testCount: 65 }], runs: [] }, 'accessibility');
  assert.match(configured, /No accessibility results recorded/);
  assert.doesNotMatch(configured, /<b>65<\/b> total|passed|failed/);
  const html = renderCoverageRun({ label: 'React', execution: { total: 5, passed: 2, failed: 0, skipped: 1, unknown: 2, flaky: 1 } }, 'accessibility');
  assert.match(html, /data-status="unknown">Incomplete/);
  assert.match(html, /<b>1<\/b> skipped/);
  assert.match(html, /<b>2<\/b> incomplete/);
  assert.match(html, /<b>1<\/b> flaky/);
  assert.doesNotMatch(html, /Automated axe scans/);
});

test('runner and suite failures do not fabricate failed accessibility case counts', () => {
  const attempt = renderCoverageRun({ label: 'Browser', execution: { scope: 'runner-attempt', status: 'failed', total: 0 } }, 'accessibility');
  assert.match(attempt, /Runner failed · No test case results recorded/);
  assert.doesNotMatch(attempt, /<b>0<\/b> passed|<b>0<\/b> failed/);
  const suite = renderCoverageRun({ label: 'Browser', execution: { total: 0, passed: 0, failed: 0, failedSuites: 1 } }, 'accessibility');
  assert.match(suite, /data-status="failed">Failed/);
  assert.match(suite, /1 suite-level failure recorded/);
  assert.match(suite, /<b>0<\/b> failed/);
  const running = renderCoverageRun({ label: 'Browser', state: 'running', execution: { scope: 'runner-attempt', status: 'unknown' } }, 'accessibility');
  assert.match(running, /Run in progress · No test case results recorded/);
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

test('coverage panel retains source files without commands or the threshold legend', () => {
  const html = renderCoverageContent({ files: [{ path: 'test.spec.ts' }], commands: [{ command: 'run tests' }],
    runs: [{ runnerKey: 'component:storybook', label: 'Storybook', verified: true, source: { matchesCurrent: true },
      measurement: { lines: { covered: 3, total: 4, percent: 75 } } },
    { runnerKey: 'component:react', label: 'React', verified: true, source: { matchesCurrent: true },
      measurement: { lines: { covered: 4, total: 4, percent: 100 } } }],
  }, 'component');
  assert.match(html, /Storybook/); assert.match(html, /React/);
  assert.match(html, /color="warning"/); assert.match(html, /color="success"/);
  assert.match(html, /href="\/repo\/test.spec.ts"/);
  assert.match(html, /Source files/);
  assert.doesNotMatch(html, /coverage-legend|Coverage thresholds|Red &lt; 50%|Run locally|run tests|data-copy-command/);
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


// Use the same DOM boundary as canvas-inspector tests: verify mounted node
// identity and asynchronous request ordering, without claiming browser layout.
const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const jsdomPackage = packages.find(name => name.startsWith('jsdom@22.')) || packages.find(name => name.startsWith('jsdom@'));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${jsdomPackage}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
function coverageFixture(t) {
  const dom = new JSDOM('<!doctype html><div id="coverage-panel"></div>');
  const state = { selected: { tag: 'md-button' } }, requests = [];
  const globals = { document: dom.window.document, fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })) };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  const ui = createCoverageUI({ getState: () => state }), root = dom.window.document.querySelector('#coverage-panel');
  const data = (tag = state.selected.tag, covered = 8) => ({ tag, categories: Object.fromEntries([
    ['unit', 'Unit'], ['component', 'Component'], ['e2e', 'End-to-end'], ['accessibility', 'Accessibility'],
  ].map(([id, label]) => [id, { label, files: [{ path: `${tag}-${id}.test.ts`, testCount: 2 }], runs: [{
    label: `${label} runner`, runnerKey: `${id}:core`, verified: true, source: { matchesCurrent: true },
    measurement: { lines: { covered, total: 10, percent: covered * 10 } }, execution: { total: 2, passed: 2, failed: 0 },
  }] }])) });
  const respond = (index, report = data()) => requests[index].resolve({ ok: true, json: async () => report });
  const select = index => root.querySelector('#coverage-tabs').dispatchEvent(new dom.window.CustomEvent('mdTabChange', { bubbles: true, detail: { index } }));
  t.after(() => {
    dom.window.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  return { dom, state, ui, root, requests, data, respond, select };
}

test('same-component coverage revisit preserves every mounted node and makes no request or DOM writes', async t => {
  const { dom, ui, root, requests, respond } = coverageFixture(t);
  const loading = ui.load(); respond(0); await loading;
  const nodes = [...root.querySelectorAll('*')], observer = new dom.window.MutationObserver(() => {});
  observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  await ui.load();
  assert.equal(requests.length, 1);
  assert.deepEqual([...root.querySelectorAll('*')], nodes);
  assert.deepEqual(observer.takeRecords(), []);
  observer.disconnect();
});

test('coverage categories retain their hydrated content while switching visibility and preserving focused tabs', async t => {
  const { dom, ui, root, respond, select } = coverageFixture(t);
  const loading = ui.load(); respond(0); await loading;
  const tabs = root.querySelector('#coverage-tabs'), heading = root.querySelector('.coverage-heading'), body = root.querySelector('.coverage-body');
  const refresh = root.querySelector('#coverage-refresh'), third = tabs.children[2];
  const nodes = [...body.querySelectorAll('*')], unit = body.querySelector('[data-category="unit"]');
  unit.scrollTop = 45;
  third.tabIndex = 0; third.focus();
  select(2);
  assert.equal(root.querySelector('#coverage-tabs'), tabs); assert.equal(root.querySelector('.coverage-heading'), heading);
  assert.equal(root.querySelector('.coverage-body'), body); assert.equal(root.querySelector('#coverage-refresh'), refresh);
  assert.equal(dom.window.document.activeElement, third);
  assert.match(body.querySelector(':scope > :not([hidden])').textContent, /End-to-end runner/); assert.equal(tabs.activeTabIndex, 2);
  assert.equal(unit.hidden, true); assert.deepEqual([...body.querySelectorAll('*')], nodes);
  select(3);
  assert.match(root.querySelector('#coverage-description').textContent, /Recorded accessibility checks/);
  assert.match(body.querySelector(':scope > :not([hidden])').textContent, /Accessibility test cases/);
  const content = body.firstChild; select(3); select(-1);
  assert.equal(body.firstChild, content, 'reselecting or invalid selections cannot reconstruct content');
  select(0);
  assert.equal(unit.hidden, false); assert.equal(unit.scrollTop, 45);
  assert.equal(body.querySelectorAll(':scope > :not([hidden])').length, 1);
  assert.deepEqual([...body.querySelectorAll('*')], nodes, 'returning to a category cannot recreate its custom elements');
});

test('initial coverage keeps its loader visible until every category is hydrated', async t => {
  const { dom, ui, root, respond } = coverageFixture(t);
  let ready;
  const hydration = new Promise(resolve => { ready = resolve; });
  let disconnects = 0;
  dom.window.customElements.define('md-card', class extends dom.window.HTMLElement {
    componentOnReady() { return hydration; }
    disconnectedCallback() { disconnects++; }
  });
  const loading = ui.load(); respond(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(root.querySelector(':scope > .coverage-loading'));
  assert.equal(root.getAttribute('aria-busy'), 'true');
  const categories = [...root.querySelectorAll('.coverage-category')];
  assert.equal(categories.length, 4);
  assert.ok(categories.every(panel => panel.hidden && panel.closest('[aria-hidden="true"]')?.hidden));
  ready(); await loading;
  assert.equal(root.querySelector('.coverage-loading'), null);
  assert.equal(root.querySelectorAll('.coverage-category:not([hidden])').length, 1);
  assert.equal(root.querySelector('[data-category="unit"]').hidden, false);
  assert.equal(root.hasAttribute('aria-busy'), false);
  assert.equal(disconnects, 0, 'revealing the first report must not disconnect freshly hydrated hosts');
});

test('refresh stages hydrated categories without replacing current evidence and reveals the latest selected category', async t => {
  const { dom, ui, root, respond, data, select } = coverageFixture(t);
  const loading = ui.load(); respond(0); await loading;
  const body = root.querySelector('.coverage-body'), oldNodes = [...body.querySelectorAll('*')];
  let ready;
  const hydration = new Promise(resolve => { ready = resolve; });
  dom.window.customElements.define('md-card', class extends dom.window.HTMLElement {
    componentOnReady() { return hydration; }
  });
  const refreshing = ui.load(true); respond(1, data('md-button', 9));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(oldNodes.every(node => body.contains(node)), 'old report stays mounted while replacement hydrates');
  assert.match(body.querySelector(':scope > :not([hidden])').textContent, /8 of 10 covered/);
  assert.equal(body.querySelectorAll(':scope > :not([hidden])').length, 1);
  select(2);
  ready(); await refreshing;
  assert.equal(root.querySelector('.coverage-body'), body);
  assert.equal(body.querySelector(':scope > :not([hidden])').dataset.category, 'e2e');
  assert.match(body.textContent, /9 of 10 covered/);
  assert.doesNotMatch(body.textContent, /8 of 10 covered/);
  assert.equal(root.querySelector('[aria-hidden="true"]'), null);
});

test('a stale hydration completion cannot replace another component report', async t => {
  const { dom, ui, root, state, respond, data } = coverageFixture(t);
  let ready;
  const hydration = new Promise(resolve => { ready = resolve; });
  let hold = true;
  dom.window.customElements.define('md-card', class extends dom.window.HTMLElement {
    componentOnReady() { return hold ? hydration : Promise.resolve(); }
  });
  const first = ui.load(); respond(0);
  await new Promise(resolve => setImmediate(resolve));
  state.selected.tag = 'md-card'; hold = false;
  const next = ui.load(); respond(1, data('md-card', 4)); await next;
  const nodes = [...root.querySelectorAll('*')];
  ready(); await first;
  assert.deepEqual([...root.querySelectorAll('*')], nodes);
  assert.match(root.textContent, /md-card/);
  assert.doesNotMatch(root.textContent, /md-button|8 of 10 covered/);
});

test('same-component refresh keeps old evidence mounted while busy and retains header and tabs after success', async t => {
  const { ui, root, respond, data, select } = coverageFixture(t);
  const loading = ui.load(); respond(0); await loading;
  const tabs = root.querySelector('#coverage-tabs'), heading = root.querySelector('.coverage-heading');
  const body = root.querySelector('.coverage-body'), oldReport = body.firstElementChild;
  const refreshing = ui.load(true);
  assert.equal(root.getAttribute('aria-busy'), 'true');
  assert.equal(root.querySelector('#coverage-refresh').disabled, true);
  assert.equal(body.firstElementChild, oldReport); assert.match(body.textContent, /8 of 10 covered/);
  select(2); respond(1, data('md-button', 9)); await refreshing;
  assert.equal(root.querySelector('#coverage-tabs'), tabs); assert.equal(root.querySelector('.coverage-heading'), heading);
  assert.equal(root.querySelector('.coverage-body'), body);
  assert.equal(tabs.activeTabIndex, 2); assert.match(body.textContent, /End-to-end runner/);
  assert.match(body.textContent, /9 of 10 covered/); assert.doesNotMatch(body.textContent, /8 of 10 covered/);
  assert.equal(root.hasAttribute('aria-busy'), false); assert.equal(root.querySelector('#coverage-refresh').disabled, false);
});

test('failed refresh honestly labels retained evidence and permits retry without replacing the tabs', async t => {
  const { ui, root, requests, respond, data } = coverageFixture(t);
  const loading = ui.load(); respond(0); await loading;
  const tabs = root.querySelector('#coverage-tabs'), body = root.querySelector('.coverage-body'), report = body.firstElementChild;
  const refreshing = ui.load(true); requests[1].reject(new Error('Network unavailable')); await refreshing;
  const error = root.querySelector('#coverage-error');
  assert.equal(error.hidden, false); assert.equal(error.getAttribute('role'), 'alert');
  assert.match(error.textContent, /Refresh failed.*previously loaded report.*Network unavailable/);
  assert.equal(body.firstElementChild, report); assert.equal(root.querySelector('#coverage-tabs'), tabs);
  await ui.load(); assert.equal(error.hidden, false, 'revisiting cannot erase a failed-refresh warning');
  const retry = ui.load(true); respond(2, data('md-button', 7)); await retry;
  assert.equal(error.hidden, true); assert.equal(error.textContent, '');
  assert.equal(root.querySelector('#coverage-tabs'), tabs); assert.match(body.textContent, /7 of 10 covered/);
});

test('in-flight loads for the same component are deduplicated including repeated refresh requests', async t => {
  const { ui, root, requests, respond } = coverageFixture(t);
  const first = ui.load(), repeated = ui.load(), refresh = ui.load(true);
  assert.equal(first, repeated); assert.equal(first, refresh); assert.equal(requests.length, 1);
  respond(0); await Promise.all([first, repeated, refresh]);
  assert.equal(root.querySelectorAll('#coverage-tabs').length, 1);
  const next = ui.load(true), duplicate = ui.load(true);
  assert.equal(next, duplicate); assert.equal(requests.length, 2);
  respond(1); await next;
});

test('changing components removes old evidence immediately and rejects late results from the previous component', async t => {
  const { ui, root, state, requests, respond, data } = coverageFixture(t);
  const first = ui.load(); respond(0); await first;
  const oldRefresh = ui.load(true);
  state.selected = { tag: 'md-card' };
  const next = ui.load();
  assert.doesNotMatch(root.textContent, /Unit runner|md-button/);
  assert.match(root.textContent, /Reading test sources and reports/);
  respond(2, data('md-card', 4)); await next;
  const nodes = [...root.querySelectorAll('*')];
  respond(1, data('md-button', 10)); await oldRefresh;
  assert.deepEqual([...root.querySelectorAll('*')], nodes);
  assert.match(root.textContent, /md-card/); assert.match(root.textContent, /4 of 10 covered/);
  assert.doesNotMatch(root.textContent, /md-button|10 of 10 covered/);
  assert.equal(requests.length, 3);
});

test('wrong-component reports and initial failures never render stale or fabricated measurements', async t => {
  const { ui, root, requests, respond, data } = coverageFixture(t);
  const wrong = ui.load(); respond(0, data('md-card', 10)); await wrong;
  assert.match(root.textContent, /did not match the selected component/);
  assert.equal(root.querySelector('md-meter'), null);
  assert.equal(root.hasAttribute('aria-busy'), false);
  const failed = ui.load(); requests[1].resolve({ ok: false }); await failed;
  assert.match(root.textContent, /could not be loaded/);
  assert.equal(root.querySelector('#coverage-tabs'), null);
  const retry = ui.load(); respond(2); await retry;
  assert.match(root.textContent, /8 of 10 covered/);
});
