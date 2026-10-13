import { createCanvasTools } from './canvas-tools.js';
import { renderCode } from './syntax-highlighting.js';
import { computeStudioTheme, applyStudioTheme, DEFAULT_STUDIO_THEME, loadStudioTheme, saveStudioTheme, exportStudioTheme, nativeThemeTokens } from './studio-theme.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** The visible source and clipboard always use the same export payload. */
export function themeExportSource(result, format = 'css') {
  if (format === 'css') return {
    filename: 'theme.css', language: 'css', label: 'Copy CSS', announcement: 'Theme CSS copied',
    description: 'Light and dark CSS variables. Switch modes with the data-theme attribute.',
    code: exportStudioTheme(result),
  };
  if (format !== 'javascript') throw new Error('Choose CSS or JavaScript theme export.');
  const { config } = result;
  return {
    filename: 'theme.js', language: 'javascript', label: 'Copy JS', announcement: 'Theme JavaScript copied',
    description: 'Seed and contrast settings for @awc-ui/theme, including your current mode.',
    code: `import { computeTheme, applyThemeStylesheet } from '@awc-ui/theme';\n\nconst theme = computeTheme(${JSON.stringify({ primaryHex: config.primaryHex, ...(config.secondaryHex ? { secondaryHex: config.secondaryHex } : {}), ...(config.tertiaryHex ? { tertiaryHex: config.tertiaryHex } : {}), contrastLevel: config.contrastLevel }, null, 2)});\n\napplyThemeStylesheet(theme);\ndocument.documentElement.dataset.theme = '${config.mode}';`,
  };
}

export function createThemeExportUI({ root, getTheme, notify, writeText = text => navigator.clipboard.writeText(text), paintCode = renderCode }) {
  const query = selector => root.querySelector(selector);
  const tabs = query('#theme-export-tabs'), copy = query('#theme-copy-export');
  let format = 'css', current;
  function render() {
    current = themeExportSource(getTheme(), format);
    query('#theme-export-filename').textContent = current.filename;
    query('#theme-export-description').textContent = current.description;
    query('#theme-export-panel').setAttribute('aria-labelledby', format === 'css' ? 'theme-css-tab' : 'theme-javascript-tab');
    const code = query('#theme-code');
    code.setAttribute('aria-label', `${current.filename} source code`);
    copy.textContent = current.label;
    copy.setAttribute('aria-label', format === 'css' ? 'Copy theme CSS' : 'Copy theme JavaScript configuration');
    paintCode(code, current.code, current.language);
  }
  function init() {
    tabs.addEventListener('mdTabChange', event => {
      if (event.target !== tabs || ![0, 1].includes(event.detail?.index)) return;
      format = event.detail.index === 0 ? 'css' : 'javascript';
      render();
    });
    copy.addEventListener('mdClick', async event => {
      if (event.target !== copy) return;
      const payload = current;
      try { await writeText(payload.code); notify(payload.announcement); }
      catch { notify('Clipboard unavailable'); }
    });
    render();
  }
  return { init, render };
}

export function createStudioUI({ getState, onLayoutChange, onThemeChange, notify }) {
  const state = getState();
  state.layout = { direction: 'ltr', width: 'fit', grid: false, bounds: false, expanded: false };
  const canvas = createCanvasTools({ getState, onLayoutChange });
  state.studioTheme = computeStudioTheme(loadStudioTheme());
  const themeExport = createThemeExportUI({ root: $('#theme-sheet'), getTheme: () => state.studioTheme, notify });
  function applyTheme() {
    applyStudioTheme(state.studioTheme, { root: document.documentElement });
    const frameRoot = state.previewDocument?.documentElement;
    if (frameRoot) applyStudioTheme(state.studioTheme, { root: frameRoot });
    $('#theme-toggle').icon = state.studioTheme.config.mode === 'dark' ? 'light_mode' : 'dark_mode';
    $('#theme-toggle').setAttribute('aria-label', `Switch to ${state.studioTheme.config.mode === 'dark' ? 'light' : 'dark'} theme`);
  }
  function renderThemeControls() {
    const { config, roles, swatches } = state.studioTheme;
    for (const role of ['primary', 'secondary', 'tertiary']) {
      const value = config[`${role}Hex`] || swatches[role];
      const picker = $(`#theme-${role}`), trigger = $(`#theme-${role}-trigger`);
      picker.value = value;
      trigger.querySelector('.theme-seed-value').textContent = value;
      trigger.querySelector('.theme-seed-swatch').style.backgroundColor = value;
      trigger.setAttribute('aria-label', `Choose ${role} seed color, ${value}`);
      if (role !== 'primary') {
        const auto = config[`${role}Hex`] === null;
        $(`#theme-${role}-auto`).selected = auto;
        picker.disabled = auto;
        trigger.disabled = auto;
        if (auto) picker.open = false;
      }
    }
    $('#theme-contrast').value = String(config.contrastLevel);
    $('#theme-mode-label').textContent = config.mode === 'dark' ? 'Dark' : 'Light';
    $('#theme-swatches').innerHTML = ['primary', 'secondary', 'tertiary', 'surface', 'surfaceContainer', 'outline'].map(role => `<div class="theme-swatch"><span style="background:${roles[config.mode][role]}"></span><strong>${role.replace(/([A-Z])/g, ' $1')}</strong><code>${roles[config.mode][role]}</code></div>`).join('');
    themeExport.render();
  }
  function changeTheme(patch, persist = true) {
    try {
      state.studioTheme = computeStudioTheme({ ...state.studioTheme.config, ...patch });
      $('#theme-error').hidden = true;
      if (persist) saveStudioTheme(state.studioTheme.config);
      applyTheme(); renderThemeControls(); onThemeChange();
    } catch (error) { $('#theme-error').textContent = error.message; $('#theme-error').hidden = false; }
  }
  function init() {
    applyTheme(); renderThemeControls();
    $('#open-theme').addEventListener('click', () => { $('#theme-sheet').open = true; });
    $('#theme-toggle').addEventListener('click', () => changeTheme({ mode: state.studioTheme.config.mode === 'dark' ? 'light' : 'dark' }));
    for (const role of ['primary', 'secondary', 'tertiary']) {
      const picker = $(`#theme-${role}`);
      picker.addEventListener('mdInput', event => { if (event.target === picker) changeTheme({ [`${role}Hex`]: event.detail.value }, false); });
      picker.addEventListener('mdChange', event => { if (event.target === picker) changeTheme({ [`${role}Hex`]: event.detail.value }); });
      picker.addEventListener('mdOpenChange', event => {
        if (event.target !== picker || !event.detail.open) return;
        document.querySelectorAll('.theme-color-field md-color-picker').forEach(other => { if (other !== picker) other.open = false; });
      });
      if (role !== 'primary') $(`#theme-${role}-auto`).addEventListener('mdChange', event => changeTheme({ [`${role}Hex`]: event.detail.selected ? null : state.studioTheme.swatches[role] }));
    }
    $('#theme-sheet').addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const picker = document.querySelector('.theme-color-field md-color-picker[open]');
      if (!picker) return;
      event.preventDefault(); event.stopPropagation();
      picker.open = false;
      picker.querySelector('[slot="trigger"]').focus();
    });
    $('#theme-sheet').addEventListener('mdClose', event => {
      if (event.target === $('#theme-sheet')) document.querySelectorAll('.theme-color-field md-color-picker').forEach(picker => { picker.open = false; });
    });
    $('#theme-contrast').addEventListener('mdChange', event => { if (event.target === $('#theme-contrast')) changeTheme({ contrastLevel: Number(event.detail) }); });
    $('#theme-reset').addEventListener('click', () => changeTheme({ ...DEFAULT_STUDIO_THEME, mode: state.studioTheme.config.mode }));
    themeExport.init();
    canvas.init();
  }
  return { init, applyTheme, applyCanvas: canvas.update, dispose: canvas.dispose, nativeOptions: () => ({ themeTokens: nativeThemeTokens(state.studioTheme), direction: state.layout.direction }) };
}

const coverageMetricLabels = { lines: 'Lines', branches: 'Branches', functions: 'Functions', statements: 'Statements' };
const coverageCategories = { unit: 'Unit', component: 'Component', e2e: 'End-to-end', accessibility: 'Accessibility' };

/** Keep saved-run results separate from instrumented code coverage. */
export function coveragePresentation(entry = {}, category = entry.id) {
  const measurement = entry.measurements?.[0];
  const execution = entry.executions?.[0];
  const metrics = Object.entries(coverageMetricLabels).filter(([key]) => measurement?.[key]).map(([key, label]) => {
    const value = measurement[key];
    const percent = value.total > 0 && Number.isFinite(value.percent) ? value.percent : null;
    return { key, label, ...value, percent, text: percent === null ? 'No locations' : `${percent}%` };
  });
  const lines = metrics.find(item => item.key === 'lines');
  const hasSources = !!entry.files?.length || entry.testCount > 0;
  const configurationOnly = !!entry.files?.length && !entry.testCount && entry.files.every(file => file.kind === 'storybook-a11y-configuration');
  const runStatus = execution ? (execution.failed || execution.failedSuites ? 'failed' : execution.status || 'unknown') : 'not-recorded';
  const runnerAttempt = execution?.scope === 'runner-attempt';
  const executionLabel = execution ? ({ passed: 'Passed', failed: 'Failed', skipped: 'Skipped', unknown: 'Incomplete' }[runStatus] || 'Incomplete') : measurement ? 'No component test results' : 'No saved run';
  const executionTitle = runnerAttempt ? `Runner attempt ${runStatus === 'failed' ? 'failed' : 'incomplete'}` : `${executionLabel} · component test results`;
  const measurementLabel = measurement ? lines?.percent != null ? `${lines.percent}% lines` : 'Measured · no line data'
    : category === 'accessibility' ? 'No coverage percentage' : 'Not measured';
  const sourceLabel = entry.testCount > 0 ? `${entry.testCount} declarations` : configurationOnly ? 'Configuration only' : hasSources ? 'Test sources found' : 'No tests found';
  const outcome = execution?.total ? `${execution.passed}/${execution.total} cases passed`
    : execution?.failedSuites ? `${execution.failedSuites} suite-level failure${execution.failedSuites === 1 ? '' : 's'} recorded` : 'No case results recorded';
  const executionNote = runnerAttempt ? 'No case outcomes were recorded for this runner attempt.' : execution ? `${outcome}${execution.scope === 'shared-test-files' ? ' · shared test files' : ''}`
    : configurationOnly ? 'Accessibility checks are configured; no matching run is saved.'
    : hasSources ? 'Test sources exist; no component test outcomes are recorded.' : 'No tests are attributed to this component in this category.';
  const attribution = measurement?.attribution;
  const matched = attribution?.kind === 'component-outcomes';
  const broaderRun = attribution?.kind === 'broader-run';
  const noAttributedCases = broaderRun && attribution.componentTestCount === 0;
  const sourceExecuted = attribution?.sourceExecution === 'observed' || metrics.some(metric => metric.covered > 0);
  const categoryName = { unit: 'unit', component: 'component', e2e: 'end-to-end', accessibility: 'accessibility' }[category] || 'component';
  const scopeName = `recorded ${(coverageCategories[category] || 'test').toLowerCase()} run`;
  const executionSentence = lines ? `The report records ${lines.covered} of ${lines.total} source lines covered` : 'Source execution was measured';
  const runnerNote = ' The runner attempt below recorded no case outcomes.';
  let contextTitle, contextNote;
  if (category === 'accessibility' && !measurement) {
    contextTitle = execution && !runnerAttempt ? 'Accessibility check results' : 'No recorded accessibility checks';
    contextNote = execution && !runnerAttempt ? 'These results describe the recorded accessibility-related checks, not a WCAG conformance or coverage percentage.'
      : configurationOnly ? 'Checks are configured, but no executed accessibility results are recorded for this component.' : executionNote;
  } else if (measurement && noAttributedCases) {
    contextTitle = hasSources ? 'No component test results in this coverage run' : `No ${categoryName} tests attributed to this component`;
    contextNote = `${executionSentence} during the ${scopeName}. ${sourceExecuted ? 'This can include initialization and use by other components.' : 'The report includes unexecuted source in its coverage denominator.'} This run has no test outcomes attributed to this component, so the percentage does not establish that its behavior was tested.`;
    if (execution) contextNote += runnerAttempt ? runnerNote : ' The component test results below belong to a different report or run.';
  } else if (measurement && broaderRun) {
    contextTitle = 'Component outcomes unavailable for this run';
    contextNote = `${executionSentence} during the ${scopeName}. The run is recorded, but its component-level test outcomes could not be verified. This percentage describes code execution only.`;
    if (execution) contextNote += runnerAttempt ? runnerNote : ' The component results below are from a separate report or run.';
  } else if (measurement && !matched) {
    contextTitle = !hasSources && !execution ? `No ${categoryName} tests attributed to this component` : 'Coverage and test results are not linked';
    contextNote = `${executionSentence} according to the saved coverage report. ${execution && !runnerAttempt ? 'The component results below have not been verified as belonging to that coverage run.' : 'No component test outcomes have been linked to that report.'} Code execution alone does not establish behavioral validation.`;
    if (runnerAttempt) contextNote += runnerNote;
  } else if (measurement) {
    contextTitle = 'Tests and source coverage';
    contextNote = 'This coverage report is linked to recorded test outcomes for this component. Coverage measures code execution across that run, not which behaviors were asserted.';
    if (execution?.path !== attribution.componentExecutionPath || (measurement.runPath && execution?.runPath !== measurement.runPath) || (measurement.runPath && execution?.reportedAt !== measurement.reportedAt)) {
      contextNote += runnerAttempt ? runnerNote : ' The latest component results below come from a different report or run.';
    }
  } else {
    contextTitle = runnerAttempt ? 'No recorded case outcomes' : execution ? 'Component test results' : hasSources ? 'Tests found; no recorded results' : `No ${categoryName} tests attributed to this component`;
    contextNote = execution && !runnerAttempt ? 'Test outcomes are recorded, but no source coverage measurement is available for this category.' : executionNote;
  }
  const coverageTitle = noAttributedCases ? (sourceExecuted ? 'Indirect source coverage' : 'Source coverage · no execution') : broaderRun ? 'Source coverage · outcomes unavailable' : matched ? 'Source coverage' : 'Source coverage · unlinked report';
  return { measurement, execution, metrics, percentage: lines?.percent != null ? `${lines.percent}%` : measurement ? 'No line data' : 'Not measured',
    measurementLabel, sourceLabel, executionLabel, executionTitle, executionNote, runStatus, runnerAttempt, configurationOnly, contextTitle, contextNote, coverageTitle,
    testValue: execution ? execution.total ? `${execution.passed}/${execution.total}` : '0' : String(entry.testCount || 0),
    testLabel: execution ? execution.total ? 'Recorded cases passed' : 'Cases recorded' : 'Test / story declarations' };
}

/** Choose within each runner, never between independent test environments. */
export function coverageRunViews(entry = {}) {
  const grouped = new Map();
  for (const run of [...(entry.runs || [])].sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || Number(b.verified) - Number(a.verified))) {
    const key = run.runnerKey || run.key;
    if (!grouped.has(key)) grouped.set(key, []);
    const kept = grouped.get(key);
    if (kept.some(item => item.verified)) continue;
    if (run.verified) {
      if (!kept.length) kept.push(run);
      else {
        // A newer unpaired coverage file cannot replace recorded outcomes.
        const execution = kept.some(item => item.execution) ? null : run.execution;
        const axeAudit = kept.some(item => item.axeAudit) ? null : run.axeAudit;
        if (execution || axeAudit) kept.push({ ...run, execution, axeAudit });
      }
      continue;
    }
    // Unverified files remain separate records even if their directory matches.
    if (!kept.some(item => !!item.measurement === !!run.measurement && !!item.execution === !!run.execution && !!item.axeAudit === !!run.axeAudit)) kept.push(run);
  }
  return [...grouped.values()].flat();
}

export function renderCoverageRun(run, category) {
  const view = coveragePresentation({ measurements: run.measurement ? [run.measurement] : [], executions: run.execution ? [run.execution] : [] }, category);
  const { measurement, execution, metrics, runnerAttempt, runStatus, executionLabel } = view;
  const audit = run.axeAudit;
  const date = new Date(run.reportedAt);
  const timestamp = Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Time unavailable';
  const sourceStatus = run.state === 'running' ? 'Run in progress; inputs not yet verified' : !run.verified ? 'Unverified legacy report' : run.source?.matchesCurrent ? 'Tested inputs unchanged'
    : run.source?.stableDuringRun === false ? 'Inputs changed during this run' : run.source?.changedFiles?.length ? 'Inputs changed since this run' : 'Input verification incomplete';
  const heading = run.label || 'Saved test report';
  const metricHTML = measurement ? `<div class="coverage-measurements">${metrics.map(metric => `<div class="coverage-measurement"><div><span>${metric.label}</span><strong>${metric.text}</strong></div>${metric.percent === null ? '' : `<md-progress-indicator variant="linear" value="${metric.percent}" max="100" label="${escape(heading)} ${metric.label} coverage"></md-progress-indicator>`}<small>${metric.covered} of ${metric.total} covered</small></div>`).join('')}</div>` : '';
  const noCases = measurement?.attribution?.kind === 'broader-run' && measurement.attribution.componentTestCount === 0;
  const noCaseNote = measurement?.attribution?.sourceExecution === 'observed'
    ? 'Indirect source execution; this run contains no test cases attributed to this component.'
    : 'Source included with zero recorded hits; this run contains no test cases attributed to this component.';
  const caseLabel = category === 'accessibility' ? 'Accessibility-related test cases' : 'Test cases';
  const executionHTML = execution ? `<div class="coverage-outcomes"><h4>${runnerAttempt ? 'Runner attempt' : caseLabel}</h4>${runnerAttempt
    ? `<p data-status="${escape(runStatus)}">${run.state === 'running' ? 'Run in progress' : runStatus === 'failed' ? 'Runner failed' : 'Runner incomplete'}; no case outcomes were recorded.</p>`
    : `<div class="coverage-run-counts"><strong data-status="${escape(runStatus)}">${escape(executionLabel)}</strong><span><b>${execution.passed}</b> passed</span><span><b>${execution.failed}</b> failed</span><span><b>${execution.skipped}</b> skipped</span>${execution.unknown ? `<span><b>${execution.unknown}</b> incomplete</span>` : ''}</div>${execution.failedSuites ? `<p>${execution.failedSuites} suite-level failures recorded.</p>` : ''}`}
    ${category === 'accessibility' && execution.accessibilityKinds?.length ? `<p class="coverage-run-description">${escape(execution.environment === 'mock-dom' ? 'Mock DOM' : 'Browser')} · ${execution.accessibilityKinds.map(value => escape(value.replaceAll('-', ' '))).join(', ')}</p>` : ''}</div>` : '';
  const auditHTML = audit ? `<div class="coverage-outcomes"><h4>Automated axe audits</h4><div class="coverage-run-counts"><span><b>${audit.passed}</b> clean</span><span><b>${audit.failed}</b> failed</span><span><b>${audit.unknown}</b> need review</span></div><p class="coverage-run-description">${audit.total ?? audit.passed + audit.failed + audit.unknown} scans recorded · ${audit.violations} recorded rule violations${audit.errors ? ` · ${audit.errors} audit errors` : ''}${audit.incomplete ? ` · ${audit.incomplete} rule results need review` : ''}${audit.warning ? ` · ${audit.warning} nonblocking warnings` : ''}. Counts describe this run’s scans.</p></div>` : '';
  const links = [measurement && { path: measurement.path, label: 'Coverage report' }, execution && { path: execution.path, label: runnerAttempt ? 'Run record' : 'Test results' }, audit && { path: audit.path, label: 'Axe results' }, run.runPath && { path: run.runPath, label: 'Run record' }].filter(Boolean)
    .filter((link, index, all) => all.findIndex(item => item.path === link.path) === index);
  const notes = [...new Set([...(run.notes || []), ...(execution?.notes || []), ...(audit?.notes || [])])];
  return `<section class="coverage-run-group" aria-label="${escape(heading)}"><md-card class="coverage-report-card" variant="outlined" full-width density="-1">
    <div class="coverage-run-heading"><h3>${escape(heading)}</h3><time datetime="${escape(run.reportedAt)}">${run.timestampSource === 'file-mtime' ? 'File updated' : run.timestampSource === 'run-startedAt' ? 'Run started' : 'Run completed'} ${escape(timestamp)}</time></div>
    <p class="coverage-run-description">${escape(sourceStatus)}${run.verified && (measurement || execution && !runnerAttempt || audit) ? ' · Report hashes verified' : ''}</p>
    ${executionHTML}${auditHTML}${noCases ? `<p class="coverage-run-description">${noCaseNote}</p>` : ''}
    ${measurement ? `<h4>${escape(view.coverageTitle)}</h4>${metricHTML}` : category !== 'accessibility' && !runnerAttempt ? '<p class="coverage-run-description">No source coverage report recorded for this run.</p>' : ''}
    <div class="coverage-report-links">${links.map(link => `<a href="/repo/${escape(link.path)}" target="_blank" rel="noopener">${link.label}</a>`).join('')}</div>
    <md-accordion-item class="coverage-provenance" headline="Run details" density="-3">
      ${run.runId ? `<p>Run ID: <code>${escape(run.runId)}</code></p>` : '<p>This legacy file has no verified run identity and is displayed separately.</p>'}
      ${run.source?.revision ? `<p>Git HEAD at collection: <code>${escape(run.source.revision)}</code></p>` : ''}
      ${run.source?.digest ? `<p>Tested input fingerprint: <code>${escape(run.source.digest)}</code></p>` : ''}
      ${run.source?.changedFiles?.length ? `<p>Changed inputs: ${run.source.changedFiles.map(file => `<code>${escape(file)}</code>`).join(', ')}</p>` : ''}
      ${measurement?.sourceFiles?.length ? `<p>Measured sources: ${measurement.sourceFiles.map(file => `<code>${escape(file)}</code>`).join(', ')}</p>` : ''}
      ${notes.map(note => `<p>${escape(note)}</p>`).join('')}
      <p>Source coverage measures executed locations in this runner. Percentages from different runners are not combined.</p>
    </md-accordion-item>
  </md-card></section>`;
}

export function createCoverageUI({ getState, notify }) {
  let category = 'unit', currentTag, result, generation = 0;
  async function load(refresh = false) {
    const tag = getState().selected?.tag, root = $('#coverage-panel');
    if (!tag) return;
    if (!refresh && tag === currentTag && result) { render(); return; }
    const request = ++generation; currentTag = tag; result = null;
    root.innerHTML = '<div class="coverage-loading" role="status"><md-progress-indicator variant="circular" indeterminate size="24" label="Loading coverage evidence"></md-progress-indicator><span>Reading test sources and reports…</span></div>';
    try {
      const response = await fetch(`/api/coverage/${encodeURIComponent(tag)}`);
      if (!response.ok) throw new Error('Coverage evidence could not be loaded.');
      const data = await response.json();
      if (request !== generation || tag !== getState().selected?.tag) return;
      result = data; render();
    } catch (error) { if (request === generation) root.innerHTML = `<p class="load-error">${escape(error.message)}</p>`; }
  }
  function render() {
    if (!result) return;
    const keys = Object.keys(coverageCategories);
    const selected = result.categories[category];
    const runs = coverageRunViews(selected);
    const reportHTML = runs.map(run => renderCoverageRun(run, category)).join('');
    const empty = coveragePresentation(selected, category);
    const sourceRow = (path, supportingText = '') => `<md-list-item type="link" href="/repo/${escape(path)}" target="_blank" leading-icon="description" trailing-icon="open_in_new" supporting-text="${escape(supportingText)}" density="-2"><code slot="headline">${escape(path)}</code></md-list-item>`;
    $('#coverage-panel').innerHTML = `<div class="coverage-heading"><div><h2>Test coverage</h2><p>Saved Web test evidence for <code>${escape(result.tag)}</code>.</p></div><md-button id="coverage-refresh" variant="text" size="sm" icon="refresh">Refresh</md-button></div>
      <md-tabs id="coverage-tabs" variant="secondary" tab-width="auto" active-tab-index="${keys.indexOf(category)}" aria-label="Coverage category">${keys.map(key => `<md-tab label="${escape(result.categories[key].label)}"></md-tab>`).join('')}</md-tabs>
      <div class="coverage-body">${reportHTML || `<div class="coverage-context"><h3>${escape(empty.contextTitle)}</h3><p>${escape(empty.contextNote)}</p></div>`}
      <h3>Tests attributed to this component</h3>${selected.files.length ? `<md-list class="coverage-source-list" label="Component test sources" density="-2">${selected.files.map(file => sourceRow(file.path, [file.kind === 'storybook-a11y-configuration' ? 'Configuration only' : `${file.testCount ?? 0} ${file.countKind === 'static-story-exports' ? 'story' : 'test'} declarations`, ...(file.notes || [])].join(' · '))).join('<md-divider></md-divider>')}</md-list>` : '<p class="usage-empty">No test sources are attributed to this component in this category.</p>'}
      <h3>Run locally</h3>${selected.commands.map((command, index) => `<md-card class="coverage-command-card" variant="filled" full-width density="-1"><div class="coverage-command-content"><p>${escape(command.label)}</p><code data-command-code="${index}">${escape(command.command)}</code></div><md-icon-button data-copy-command="${index}" icon="content_copy" size="sm" aria-label="Copy ${escape(command.label)} command"></md-icon-button></md-card>`).join('')}
      ${selected.notes.length ? `<ul class="coverage-notes">${selected.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}</div>`;
    $('#coverage-panel').querySelectorAll('[data-command-code]').forEach(code => renderCode(code, selected.commands[Number(code.dataset.commandCode)].command, 'bash'));
    $('#coverage-refresh').addEventListener('mdClick', () => load(true));
    $('#coverage-tabs').addEventListener('mdTabChange', event => { if (event.target !== $('#coverage-tabs')) return; category = keys[event.detail.index] || 'unit'; render(); });
    $('#coverage-panel').querySelectorAll('[data-copy-command]').forEach(button => button.addEventListener('mdClick', async () => { try { await navigator.clipboard.writeText(selected.commands[Number(button.dataset.copyCommand)].command); notify('Test command copied'); } catch { notify('Clipboard unavailable'); } }));
  }
  return { load };
}
