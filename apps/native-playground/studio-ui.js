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

/** Keep saved-run results separate from instrumented code coverage. */
export function coveragePresentation(entry) {
  const measurement = entry.measurements?.[0];
  const execution = entry.executions?.[0];
  const metrics = Object.entries(coverageMetricLabels).filter(([key]) => measurement?.[key]).map(([key, label]) => {
    const value = measurement[key];
    const percent = value.total > 0 && Number.isFinite(value.percent) ? value.percent : null;
    return { key, label, ...value, percent, text: percent === null ? '—' : `${percent}%` };
  });
  const lines = metrics.find(item => item.key === 'lines');
  return { measurement, execution, metrics, percentage: lines?.text || '—',
    testValue: execution ? `${execution.passed}/${execution.total}` : String(entry.testCount ?? '—'),
    testLabel: execution ? 'Tests passed' : 'Test / story declarations' };
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
    const keys = ['unit', 'component', 'e2e', 'accessibility'];
    const selected = result.categories[category];
    const { measurement, execution, metrics, percentage, testValue, testLabel } = coveragePresentation(selected);
    const reportDate = value => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : String(value || 'Unknown');
    };
    const auditResult = category === 'accessibility' && !measurement;
    const coverageNote = measurement ? 'Instrumented code coverage from the latest saved report.'
      : execution ? (category === 'accessibility' ? 'Automated accessibility results for the tested cases.' : 'This test run did not collect code coverage.')
      : 'No measured report yet. Run the coverage command below, then refresh.';
    const executionCard = execution ? `<md-card class="coverage-run-card" variant="filled" full-width density="-1">
      <div class="coverage-run-heading"><strong data-status="${escape(execution.status)}">${escape({ passed: 'Passed', failed: 'Failed', skipped: 'Skipped', unknown: 'Incomplete' }[execution.status] || 'Incomplete')}</strong><time datetime="${escape(execution.reportedAt)}">Report saved ${escape(reportDate(execution.reportedAt))}</time></div>
      <div class="coverage-run-counts"><span><b>${execution.passed}</b> passed</span><span><b>${execution.failed}</b> failed</span><span><b>${execution.skipped}</b> skipped</span>${execution.unknown ? `<span><b>${execution.unknown}</b> incomplete</span>` : ''}</div>
      <a href="/repo/${escape(execution.path)}" target="_blank" rel="noopener">${escape(execution.framework)} test report</a>
      ${(execution.notes || []).map(note => `<p>${escape(note)}</p>`).join('')}
    </md-card>` : '';
    const measurementCard = measurement ? `<md-card class="coverage-report-card" variant="outlined" full-width density="-1">
      <div class="coverage-run-heading"><strong>Measured code coverage</strong><time datetime="${escape(measurement.reportedAt)}">Report saved ${escape(reportDate(measurement.reportedAt))}</time></div>
      <div class="coverage-measurements">${metrics.map(metric => `<div class="coverage-measurement"><div><span>${metric.label}</span><strong>${metric.text}</strong></div>
        ${metric.percent === null ? '' : `<md-progress-indicator variant="linear" value="${metric.percent}" max="100" label="${metric.label} coverage"></md-progress-indicator>`}
        <small>${metric.covered} of ${metric.total} covered</small></div>`).join('')}</div>
      <a href="/repo/${escape(measurement.path)}" target="_blank" rel="noopener">${escape(measurement.path)}</a>
    </md-card>` : '';
    const sourceRow = (path, supportingText = '') => `<md-list-item type="link" href="/repo/${escape(path)}" target="_blank" leading-icon="description" trailing-icon="open_in_new" supporting-text="${escape(supportingText)}" density="-2"><code slot="headline">${escape(path)}</code></md-list-item>`;
    $('#coverage-panel').innerHTML = `<div class="coverage-heading"><div><h2>Test coverage</h2><p>Evidence from this checkout, scoped to <code>${escape(result.tag)}</code>.</p></div><md-button id="coverage-refresh" variant="text" size="sm" icon="refresh">Refresh</md-button></div>
      <md-tabs id="coverage-tabs" variant="secondary" tab-width="auto" active-tab-index="${keys.indexOf(category)}" aria-label="Coverage category">${keys.map(key => `<md-tab label="${escape(result.categories[key].label)}"></md-tab>`).join('')}</md-tabs>
      <div class="coverage-body"><div class="coverage-summary" role="group" aria-label="Coverage evidence summary">
        <md-card class="coverage-metric" variant="outlined" density="-1"><strong>${selected.files.length}</strong><span>Test files</span></md-card>
        <md-card class="coverage-metric" variant="outlined" density="-1"><strong>${testValue}</strong><span>${testLabel}</span></md-card>
        <md-card class="coverage-metric" variant="outlined" density="-1"><strong>${auditResult ? escape({ passed: 'Passed', failed: 'Failed', skipped: 'Skipped', unknown: 'Incomplete' }[execution?.status] || '—') : percentage}</strong><span>${auditResult ? 'Automated checks' : 'Measured line coverage'}</span></md-card>
      </div><p class="coverage-disclaimer">${coverageNote}</p>
      ${measurementCard}${executionCard}
      <h3>Test sources</h3>${selected.files.length ? `<md-list class="coverage-source-list" label="Component test sources" density="-2">${selected.files.map(file => sourceRow(file.path, [file.kind === 'storybook-a11y-configuration' ? 'Configured' : `${file.testCount ?? '—'} ${file.countKind === 'static-story-exports' ? 'stories' : 'tests'}`, ...(file.notes || [])].join(' · '))).join('<md-divider></md-divider>')}</md-list>` : '<p class="usage-empty">No component-specific evidence found in this category.</p>'}
      <h3>Run locally</h3>${selected.commands.map((command, index) => `<md-card class="coverage-command-card" variant="filled" full-width density="-1"><div class="coverage-command-content"><p>${escape(command.label)}</p><code data-command-code="${index}">${escape(command.command)}</code></div><md-icon-button data-copy-command="${index}" icon="content_copy" size="sm" aria-label="Copy ${escape(command.label)} command"></md-icon-button></md-card>`).join('')}
      ${selected.notes.length ? `<ul class="coverage-notes">${selected.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}</div>`;
    $('#coverage-panel').querySelectorAll('[data-command-code]').forEach(code => renderCode(code, selected.commands[Number(code.dataset.commandCode)].command, 'bash'));
    $('#coverage-refresh').addEventListener('mdClick', () => load(true));
    $('#coverage-tabs').addEventListener('mdTabChange', event => { if (event.target !== $('#coverage-tabs')) return; category = keys[event.detail.index] || 'unit'; render(); });
    $('#coverage-panel').querySelectorAll('[data-copy-command]').forEach(button => button.addEventListener('mdClick', async () => { try { await navigator.clipboard.writeText(selected.commands[Number(button.dataset.copyCommand)].command); notify('Test command copied'); } catch { notify('Clipboard unavailable'); } }));
  }
  return { load };
}
