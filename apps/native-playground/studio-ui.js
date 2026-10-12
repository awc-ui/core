import { computeStudioTheme, applyStudioTheme, DEFAULT_STUDIO_THEME, loadStudioTheme, saveStudioTheme, exportStudioTheme, nativeThemeTokens } from './studio-theme.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function createStudioUI({ getState, onLayoutChange, onThemeChange, notify }) {
  const state = getState();
  state.layout = { direction: 'ltr', width: 'fit', grid: false, bounds: false };
  state.studioTheme = computeStudioTheme(loadStudioTheme());
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
    $('#theme-code').textContent = `import { computeTheme, applyThemeStylesheet } from '@awc-ui/theme';\n\nconst theme = computeTheme(${JSON.stringify({ primaryHex: config.primaryHex, ...(config.secondaryHex ? { secondaryHex: config.secondaryHex } : {}), ...(config.tertiaryHex ? { tertiaryHex: config.tertiaryHex } : {}), contrastLevel: config.contrastLevel }, null, 2)});\n\napplyThemeStylesheet(theme);\ndocument.documentElement.dataset.theme = '${config.mode}';`;
  }
  function changeTheme(patch, persist = true) {
    try {
      state.studioTheme = computeStudioTheme({ ...state.studioTheme.config, ...patch });
      $('#theme-error').hidden = true;
      if (persist) saveStudioTheme(state.studioTheme.config);
      applyTheme(); renderThemeControls(); onThemeChange();
    } catch (error) { $('#theme-error').textContent = error.message; $('#theme-error').hidden = false; }
  }
  function applyCanvas() {
    const { layout } = state;
    $('#preview-stage').dataset.grid = String(layout.grid);
    $('#preview-stage').dataset.bounds = String(layout.bounds);
    const frame = $('#component-frame');
    if (frame) frame.style.width = layout.width === 'fit' ? '100%' : `${layout.width}px`;
    const root = state.previewDocument?.documentElement;
    if (root) { root.dir = layout.direction; root.dataset.grid = String(layout.grid); root.dataset.bounds = String(layout.bounds); }
    const native = $('#preview-content > .native-snapshot');
    if (native) native.style.width = layout.width === 'fit' ? '100%' : `${layout.width}px`;
    const width = (layout.width !== 'fit' ? Number(layout.width) : frame?.getBoundingClientRect().width || native?.getBoundingClientRect().width);
    $('#canvas-dimensions').textContent = `${width ? `${Math.round(width)}px` : 'Auto width'} · ${layout.direction.toUpperCase()}`;
    $('#canvas-rtl').selected = layout.direction === 'rtl'; $('#canvas-grid').selected = layout.grid; $('#canvas-bounds').selected = layout.bounds;
  }
  function changeLayout(patch) { Object.assign(state.layout, patch); applyCanvas(); onLayoutChange(patch); }
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
    $('#theme-copy-css').addEventListener('click', async () => { try { await navigator.clipboard.writeText(exportStudioTheme(state.studioTheme)); notify('Theme CSS copied'); } catch { notify('Clipboard unavailable'); } });
    $('#canvas-width').addEventListener('mdChange', event => { if (event.target === $('#canvas-width')) changeLayout({ width: ['360', '768', '1024'].includes(event.detail) ? Number(event.detail) : 'fit' }); });
    $('#canvas-rtl').addEventListener('mdClick', event => changeLayout({ direction: event.detail.selected ? 'rtl' : 'ltr' }));
    $('#canvas-grid').addEventListener('mdClick', event => changeLayout({ grid: event.detail.selected }));
    $('#canvas-bounds').addEventListener('mdClick', event => changeLayout({ bounds: event.detail.selected }));
    $('#canvas-fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('.preview-panel').requestFullscreen(); } catch { notify('Fullscreen is unavailable in this browser'); } });
    new ResizeObserver(() => applyCanvas()).observe($('#preview-stage'));
  }
  return { init, applyTheme, applyCanvas, nativeOptions: () => ({ themeTokens: nativeThemeTokens(state.studioTheme), direction: state.layout.direction }) };
}

export function createCoverageUI({ getState, notify }) {
  let category = 'unit', currentTag, result, generation = 0;
  async function load(refresh = false) {
    const tag = getState().selected?.tag, root = $('#coverage-panel');
    if (!tag) return;
    if (!refresh && tag === currentTag && result) { render(); return; }
    const request = ++generation; currentTag = tag; result = null;
    root.innerHTML = '<p class="coverage-loading">Reading test sources and reports…</p>';
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
    $('#coverage-panel').innerHTML = `<div class="coverage-heading"><div><h2>Test coverage</h2><p>Evidence from this checkout, scoped to <code>${escape(result.tag)}</code>.</p></div><md-button id="coverage-refresh" variant="text" size="sm" icon="refresh">Refresh</md-button></div><md-tabs id="coverage-tabs" variant="secondary" tab-width="auto" active-tab-index="${keys.indexOf(category)}" aria-label="Coverage category">${keys.map(key => `<md-tab label="${escape(result.categories[key].label)}"></md-tab>`).join('')}</md-tabs><div class="coverage-body"><div class="coverage-stats"><div><strong>${selected.files.length}</strong><span>Test files</span></div><div><strong>${selected.testCount ?? '—'}</strong><span>Test / story declarations</span></div><div><strong>${selected.measurements.length ? 'Available' : '—'}</strong><span>Measured coverage</span></div></div><p class="coverage-disclaimer">${selected.measurements.length ? 'Measured values below come from saved reports. Report timestamps do not establish freshness or passing tests.' : 'Test files are present where listed. No measured report is available for this component; test presence does not mean the tests passed.'}</p>${selected.measurements.map(report => `<div class="coverage-report"><strong>${escape(report.path)}</strong><p>Report file modified ${escape(report.reportedAt)}</p><div class="coverage-metrics">${['lines', 'branches', 'functions'].filter(key => report[key]).map(key => `<span>${escape(key)} <b>${report[key].percent}%</b> · ${report[key].covered}/${report[key].total}</span>`).join('')}</div></div>`).join('')}<h3>Test sources</h3>${selected.files.length ? `<div class="coverage-files">${selected.files.map(file => `<div class="coverage-file"><a href="/repo/${escape(file.path)}" target="_blank" rel="noopener"><span class="material-symbols-outlined" aria-hidden="true">description</span><code>${escape(file.path)}</code><span>${file.kind === 'storybook-a11y-configuration' ? 'Configured' : `${file.testCount ?? '—'} ${file.countKind === 'static-story-exports' ? 'stories' : 'tests'}`} ↗</span></a>${file.notes?.length ? `<small>${file.notes.map(escape).join(' ')}</small>` : ''}</div>`).join('')}</div>` : '<p class="usage-empty">No component-specific evidence found in this category.</p>'}${selected.configuration?.length ? `<details class="coverage-config"><summary>Test configuration</summary>${selected.configuration.map(path => `<a href="/repo/${escape(path)}" target="_blank" rel="noopener"><code>${escape(path)}</code> ↗</a>`).join('')}</details>` : ''}<h3>Run locally</h3>${selected.commands.map((command, index) => `<div class="coverage-command"><p>${escape(command.label)}</p><code>${escape(command.command)}</code><md-icon-button data-copy-command="${index}" icon="content_copy" aria-label="Copy ${escape(command.label)} command"></md-icon-button></div>`).join('')}${selected.notes.length ? `<ul class="coverage-notes">${selected.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}</div>`;
    $('#coverage-refresh').addEventListener('click', () => load(true));
    $('#coverage-tabs').addEventListener('mdTabChange', event => { if (event.target !== $('#coverage-tabs')) return; category = keys[event.detail.index] || 'unit'; render(); });
    $('#coverage-panel').querySelectorAll('[data-copy-command]').forEach(button => button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(selected.commands[Number(button.dataset.copyCommand)].command); notify('Test command copied'); } catch { notify('Clipboard unavailable'); } }));
  }
  return { load };
}
