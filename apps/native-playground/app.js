import { encodeLiteralChoice, literalChoiceLabel, portabilityFindings, createLatestRequest, nativeRenderRequest, nativeViewportWidth, nativePreviewTarget, nativeLiveEndpoint, createNativeSessionCoordinator, createNativeLiveClient, createNativePointerInput, nativeImagePoint, nativeTextChunks } from './contracts.js';
import { recipeFor, categoryFor, categoryOrder, displayName, icons } from './recipes.js';
import { mergeComponentDocumentation, memberDocumentation } from './documentation.js';
import { createDocumentationUI } from './documentation-ui.js';
import { propertyEditor, parsePropertyInput } from './property-controls.js';
import { createStudioUI, createCoverageUI } from './studio-ui.js';
import { createAIInstructionsUI } from './ai-instructions-ui.js';

const $ = selector => document.querySelector(selector);
const state = { components: [], selected: null, platform: 'web', docSection: 'usage', propertiesSection: 'properties', propertiesScroll: {}, snippetLanguage: 'html', filter: 'all', props: {}, events: [], catalog: null, ready: false, target: null };
const documentationUI = createDocumentationUI({ getState: () => state, notify: toast, afterInteraction: syncReferenceState, onContentChange: name => { if (state.selected.tag === 'md-button' && name === '') scheduleNativeRender(); }, watchEvents: () => { selectStudioSection('events'); $('.inspector-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
const studioUI = createStudioUI({ getState: () => state, notify: toast, onLayoutChange: patch => { if ('direction' in patch || 'width' in patch) scheduleNativeRender(); }, onThemeChange: () => scheduleNativeRender(400) });
const coverageUI = createCoverageUI({ getState: () => state, notify: toast });
const aiInstructionsUI = createAIInstructionsUI({ getState: () => state, notify: toast });
const documentationRequests = new Map();
const nativeRequests = createLatestRequest();
const nativeSessions = { ios: createNativeSessionCoordinator(), android: createNativeSessionCoordinator() };
let nativeLive = nativeClientFor('ios');
const isNativePlatform = platform => platform === 'ios' || platform === 'android';
function nativeClientFor(platform) {
  // Capture the transport target: a late create/close must address its original
  // host even after the user has switched preview tabs.
  return createNativeLiveClient({
    coordinator: nativeSessions[platform],
    send: (route, payload) => sendNativeLive(route, payload, platform),
    subscribe: (id, onFrame, onError) => subscribeNativeLive(id, onFrame, onError, platform),
    onFrame: frame => { if (state.platform === platform) showNativeLiveFrame(frame, platform); },
    onEvents: events => { if (state.platform === platform) recordNativeEvents(events, platform); },
    onError: error => { if (state.platform === platform) reportNativeLiveError(error); },
  });
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const text = (selector, value) => { if ($(selector)) $(selector).textContent = String(value ?? ''); };

function parseDefault(value) {
  if (value === undefined || value === 'undefined') return undefined;
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) return value.slice(1, -1);
  try { return JSON.parse(value); } catch { return undefined; }
}
function normalizeManifest(manifest) {
  return manifest.modules.flatMap(module => module.declarations || []).filter(component => component.tagName).map(component => {
    const normalized = mergeComponentDocumentation(component);
    return { ...normalized, category: categoryFor(normalized.tag), description: normalized.description || normalized.summary || '',
      properties: normalized.properties.map(normalizeProperty), events: normalized.events.map(event => ({ ...event, detail: event.detail || event.type?.text || '' })), diagnostics: [], support: {} };
  });
}
function normalizeProperty(prop) {
  const type = typeof prop.type === 'object' ? prop.type.text : prop.type || 'unknown';
  return { ...prop, type, defaultValue: Object.hasOwn(prop, 'defaultValue') ? prop.defaultValue : parseDefault(prop.default), options: prop.options || Array.from(type.matchAll(/'([^']*)'/g), match => match[1]) };
}
async function loadComponentDocumentation(component) {
  if (component.documentationLoaded) return;
  if (!documentationRequests.has(component.tag)) documentationRequests.set(component.tag, getJSON(`/repo/apps/docs/src/data/components/${component.tag.replace(/^md-/, '')}.json`));
  try {
    const reference = await documentationRequests.get(component.tag);
    Object.assign(component, mergeComponentDocumentation(component, {}, reference), { documentationLoaded: true });
    if (state.selected === component) renderProperties();
  } catch { documentationRequests.delete(component.tag); }
}
async function getJSON(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }

async function init() {
  try {

    const [manifestResult, catalogResult, runtimeResult, tokensResult] = await Promise.allSettled([
      getJSON('/repo/packages/core/custom-elements.json'), getJSON('/repo/packages/native-compiler/generated/catalog.json'), import('/web-dist/md3/md3.esm.js'), getJSON('/repo/packages/native-compiler/generated/tokens.json'),
    ]);
    if (manifestResult.status !== 'fulfilled') throw new Error('Unable to read the AWC component manifest. Start the server from the repository checkout.');
    const contracts = normalizeManifest(manifestResult.value);
    state.catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
    state.tokens = tokensResult.status === 'fulfilled' ? tokensResult.value : null;
    studioUI.init();
    const generated = new Map((state.catalog?.components || []).map(component => [component.tag, component]));
    state.components = contracts.map(component => {
      const output = generated.get(component.tag);
      const merged = mergeComponentDocumentation(component, output || {});
      return { ...merged, category: categoryFor(component.tag), properties: merged.properties.map(normalizeProperty) };
    });
    state.ready = runtimeResult.status === 'fulfilled';
    text('#component-count', state.components.length);
    $('#compiler-status').innerHTML = `<i></i>${state.catalog ? 'Library connected' : 'Source manifest only'}`;
    text('#pipeline-state', state.catalog ? `${generated.size} contracts · ${state.components.reduce((count, component) => count + portabilityFindings(component).total, 0)} findings` : 'Run native:build to inspect output');
    const hashTag = location.hash.slice(1);
    const requestedExample = new URLSearchParams(location.search).get('example');
    state.nativeScenario = ['button-behavior', 'navigation-events', 'focus-accessibility'].includes(requestedExample) ? requestedExample : '';
    selectComponent(state.components.some(component => component.tag === hashTag) ? hashTag : 'md-button');
    bindEvents();
    const requestedPlatform = new URLSearchParams(location.search).get('platform');
    if (['ios', 'android'].includes(requestedPlatform)) selectPlatform(requestedPlatform);
    window.__awcNativeLab = { componentCount: state.components.length, generatedCount: generated.size, selectComponent, getState: () => ({ selected: state.selected?.tag, platform: state.platform, props: { ...state.props }, events: state.events.length, webReady: state.ready }) };
  } catch (error) {
    $('#component-list').innerHTML = `<p class="load-error">${escape(error.message)}</p>`;
    $('#preview-content').innerHTML = `<p class="load-error">${escape(error.message)}</p>`;
    text('#compiler-status', 'Source unavailable');
  }
}

function bindEvents() {
  $('#search').addEventListener('mdInput', renderNavigation);
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.variant = item === button ? 'tonal' : 'text'); renderNavigation(); }));
  $('#component-list').addEventListener('mdClick', event => { const button = event.target.closest('[data-tag]'); if (button) { selectNativeScenario(''); location.hash = button.dataset.tag; if (state.selected?.tag === button.dataset.tag) selectComponent(button.dataset.tag); } });
  window.addEventListener('hashchange', () => { const tag = location.hash.slice(1); if (state.components.some(component => component.tag === tag)) { selectNativeScenario(''); selectComponent(tag); } });
  window.addEventListener('pagehide', () => { disposeNativePointer(); nativeRequests.cancel(); clearTimeout(state.nativeRenderTimer); nativeLive.stop(); });
  window.addEventListener('pageshow', event => { if (event.persisted && isNativePlatform(state.platform)) renderPreview(); });
  document.addEventListener('visibilitychange', () => nativeLive.setVisible(!document.hidden));
  $('#reset').addEventListener('click', () => { selectComponent(state.selected.tag); toast('Component properties reset'); });
  $('#preview-platform-buttons').addEventListener('mdSelectionChange', event => { if (event.target === $('#preview-platform-buttons')) selectPlatform(event.detail.values[0]); });
  $('#studio-doc-tabs').addEventListener('mdTabChange', event => { if (event.target === $('#studio-doc-tabs')) selectStudioSection(['usage', 'coverage', 'events', 'ai'][event.detail.index]); });
  $('#properties-tabs').addEventListener('mdTabChange', event => { if (event.target === $('#properties-tabs')) selectPropertiesSection(['properties', 'css'][event.detail.index]); });
  document.addEventListener('keydown', event => { if (event.key === '/' && !event.composedPath().some(element => ['INPUT', 'TEXTAREA', 'SELECT', 'MD-TEXT-FIELD', 'MD-SELECT'].includes(element?.tagName))) { event.preventDefault(); $('#search').setFocus(); } });
}
function selectPlatform(platform) {
  if (!['web', 'ios', 'android'].includes(platform)) return;
  if (state.platform === platform) return;
  state.platform = platform;
  const url = new URL(location.href);
  if (platform === 'web') url.searchParams.delete('platform'); else url.searchParams.set('platform', platform);
  history.replaceState(null, '', url);
  document.querySelectorAll('[data-platform]').forEach(button => { button.selected = button.dataset.platform === platform; });
  renderPreview(); renderProperties();
}
async function toast(message) {
  const generation = state.toastGeneration = (state.toastGeneration || 0) + 1;
  await customElements.whenDefined('md-snackbar');
  if (generation !== state.toastGeneration) return;
  const snackbar = $('#toast');
  // show() only changes open; close first so repeated messages restart the
  // snackbar's own dismiss timer, without a second timer in the Studio.
  await snackbar.hide();
  if (generation !== state.toastGeneration) return;
  snackbar.message = String(message ?? '');
  await snackbar.show();
}
function renderNavigation() {
  const query = ($('#search').value || '').trim().toLowerCase();
  const filtered = state.components.filter(component => `${component.tag} ${displayName(component.tag)} ${component.category}`.toLowerCase().includes(query) && (state.filter === 'all' || portabilityFindings(component).total));
  const groups = categoryOrder.map(category => ({ category, components: filtered.filter(component => component.category === category) })).filter(group => group.components.length);
  $('#component-list').innerHTML = groups.map(({ category, components }) => `<section class="nav-group"><h3>${escape(category)}<md-chip class="count-chip nav-group-count" inert aria-hidden="true" variant="input" selectable="false" removable="false" density="-4">${components.length}</md-chip><span class="studio-visually-hidden">${components.length} components</span></h3>${components.map(component => `<md-button type="button" class="component-link ${component.tag === state.selected?.tag ? 'active' : ''}" variant="${component.tag === state.selected?.tag ? 'tonal' : 'text'}" size="xs" shape="square" full-width data-tag="${escape(component.tag)}" aria-label="${escape(displayName(component.tag))}${portabilityFindings(component).total ? `, ${portabilityFindings(component).total} portability findings` : ''}" ${component.tag === state.selected?.tag ? 'aria-current="true"' : ''}><span class="nav-icon" slot="leading-icon" aria-hidden="true">${icons[category]}</span><span>${escape(displayName(component.tag))}</span>${portabilityFindings(component).total ? `<md-chip class="count-chip nav-warning" inert aria-hidden="true" variant="input" selectable="false" removable="false" density="-4" slot="trailing-icon" title="${portabilityFindings(component).source} source diagnostics · ${portabilityFindings(component).ios} iOS API gaps · ${portabilityFindings(component).android} Android API gaps">${portabilityFindings(component).total}</md-chip>` : ''}</md-button>`).join('')}</section>`).join('') || '<p class="empty-state">No matching components.</p>';
}
function selectComponent(tag) {
  const component = state.components.find(item => item.tag === tag); if (!component) return;
  state.selected = component; state.events = []; state.props = {}; state.editedTag = tag; state.editedProps = {};
  state.docSlotValues = {}; state.docCssValues = {}; state.propertiesScroll = {}; $('#props-search').value = ''; $('#properties-panel').scrollTop = 0;
  for (const prop of component.properties || []) { if (prop.defaultValue !== undefined) state.props[prop.name] = structuredClone(prop.defaultValue); }
  Object.assign(state.props, recipeFor(tag).props);
  text('#category-label', component.category); text('#tag-label', tag); text('#component-title', displayName(tag)); text('#component-description', component.description);
  text('#props-count', component.properties.length); text('#findings-count', portabilityFindings(component).total); text('#event-count', '0');
  renderNavigation(); renderPreview(); renderProperties(); renderEvents(); if (state.docSection === 'coverage') void coverageUI.load();
  if (state.docSection === 'ai') void aiInstructionsUI.load();
  void loadComponentDocumentation(component);
}
function renderPreview() {
  disposeNativePointer(); clearTimeout(state.nativeRenderTimer); nativeRequests.cancel(); nativeLive.stop();
  state.previewObserver?.disconnect(); state.previewDocument = null;
  const generation = state.previewGeneration = (state.previewGeneration || 0) + 1;
  state.liveFrame = null; state.liveDisplayedRevision = -1; state.liveImageVersion = (state.liveImageVersion || 0) + 1;
  const root = $('#preview-content'); root.replaceChildren(); state.target = null;
  const isWeb = state.platform === 'web'; $('#preview-stage').classList.toggle('native-mode', !isWeb);
  $('#preview-stage').classList.toggle('snapshot-mode', !isWeb);
  text('#preview-runtime', isWeb ? 'LIVE WEB' : 'NATIVE PREVIEW');
  text('.props-hint', isWeb ? 'Explore every property. Changes update the component and usage code.' : 'Initial properties · editing restarts the native session.');
  if (!isWeb) { nativeLive = nativeClientFor(state.platform); renderNativePreview(); studioUI.applyCanvas(); return; }
  if (!state.ready) { root.innerHTML = '<div class="load-error">Web runtime unavailable. Build <code>@awc-ui/core</code> and reload.</div>'; return; }
  const recipe = recipeFor(state.selected.tag), tag = state.selected.tag;
  const frame = document.createElement('iframe'); frame.id = 'component-frame'; frame.title = `${displayName(tag)} interactive component preview`;
  frame.src = '/preview-frame.html';
  frame.addEventListener('load', async () => {
    try {
      await frame.contentWindow.customElements.whenDefined(tag);
      if (generation !== state.previewGeneration || state.platform !== 'web') return;
      const doc = frame.contentDocument, canvas = doc.querySelector('#preview-content');
      state.previewDocument = doc;
      studioUI.applyTheme(); studioUI.applyCanvas();
      canvas.innerHTML = `<div class="demo ${recipe.mode}">${recipe.html}</div>`;
      state.target = canvas.querySelector(tag);
      if (state.target) {
        for (const [name, value] of Object.entries(recipe.props)) state.target[name] = value;
        for (const prop of state.selected.properties || []) {
          const name = prop.name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
          if (!state.target.hasAttribute(name)) continue;
          const raw = state.target.getAttribute(name);
          state.props[prop.name] = prop.type === 'boolean' ? raw !== 'false' : prop.type === 'number' ? Number(raw) : raw;
        }
        for (const [name, value] of Object.entries(state.editedProps || {})) { state.target[name] = value; if (value === undefined) delete state.props[name]; else state.props[name] = value; }
      }
      recipe.setup?.(canvas); documentationUI.applyOverrides();
      for (const name of new Set(['click', ...(state.selected.events || []).map(event => event.name)])) canvas.addEventListener(name, recordEvent);
      canvas.addEventListener('click', event => { if (event.composedPath().some(element => element?.tagName === 'A')) event.preventDefault(); });
      state.previewObserver = new ResizeObserver(() => {
        const demo = canvas.querySelector('.demo');
        const height = Math.max(310, Math.min(560, Math.ceil(demo?.getBoundingClientRect().height || 0) + 64));
        if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
      });
      state.previewObserver.observe(canvas.querySelector('.demo'));
      renderProperties(); studioUI.applyCanvas();
    } catch (error) { if (generation === state.previewGeneration) { root.innerHTML = `<p class="load-error">${escape(error.message)}</p>`; } }
  });
  // Wrap before insertion: moving a mounted iframe would reload its component.
  const viewportShell = document.createElement('div'); viewportShell.className = 'canvas-viewport-shell';
  const viewportScene = document.createElement('div'); viewportScene.className = 'canvas-viewport-scale';
  viewportScene.append(frame); viewportShell.append(viewportScene); root.append(viewportShell); studioUI.applyCanvas();
  text('#preview-caption', 'AWC web component · live browser rendering'); text('#recipe-status', recipe.note);
}

function renderNativePreview() {
  const component = state.selected;
  const target = nativePreviewTarget(state.platform);
  $('#preview-content').innerHTML = `<section class="native-snapshot" aria-label="${target.renderer} native preview"><div class="snapshot-heading"><div><h3><span aria-hidden="true">◇</span> ${target.title}</h3><p>${escape(displayName(component.tag))} · native AWC adapter</p></div><div class="native-preview-actions"><span class="native-live-badge">Live</span><md-button variant="text" size="xs" id="native-render-button" icon="refresh">Reconnect</md-button></div></div><div class="snapshot-frame" id="native-render-frame" aria-busy="true"></div></section>`;
  studioUI.applyCanvas();
  $('#native-render-button').addEventListener('mdClick', () => scheduleNativeRender(0));
  configureNativeLivePreview();
  text('#preview-caption', state.platform === 'android' ? 'Real Android emulator · connecting to Jetpack Compose' : 'Real SwiftUI on this Mac · connecting to the live host');
  text('#recipe-status', 'Native fixture + current root properties');
  scheduleNativeRender(0);
}

function selectNativeScenario(value) {
  state.nativeScenario = ['button-behavior', 'navigation-events', 'focus-accessibility'].includes(value) ? value : '';
  const url = new URL(location.href);
  if (state.nativeScenario) url.searchParams.set('example', state.nativeScenario); else url.searchParams.delete('example');
  history.replaceState(null, '', url);
}

function nativeRenderState(kind, message) {
  const frame = $('#native-render-frame');
  if (!frame) return;
  frame.dataset.state = kind;
  frame.setAttribute('aria-busy', String(kind === 'loading'));
  if (kind === 'loading' && state.activeNativeMode === 'live') text('#preview-runtime', 'CONNECTING');
  frame.replaceChildren();
  if (kind !== 'ready') {
    const marker = document.createElement(kind === 'loading' ? 'md-progress-indicator' : 'span');
    if (kind === 'loading') {
      marker.setAttribute('variant', 'circular'); marker.setAttribute('indeterminate', '');
      marker.setAttribute('size', '32'); marker.setAttribute('label', 'Rendering native component');
    } else {
      marker.className = 'snapshot-error-symbol'; marker.setAttribute('aria-hidden', 'true'); marker.textContent = '◇';
    }
    const label = document.createElement('p'); label.setAttribute('role', 'status'); label.textContent = message;
    frame.append(marker, label);
  }
  text('#native-render-button', kind === 'error' ? 'Retry connection' : 'Reconnect');
}

function scheduleNativeRender(delay = 300) {
  if (!isNativePlatform(state.platform) || !$('#native-render-frame')) return;
  clearTimeout(state.nativeRenderTimer);
  disposeNativePointer(); nativeLive.stop(); state.liveFrame = null; state.liveDisplayedRevision = -1; state.liveImageVersion = (state.liveImageVersion || 0) + 1;
  const request = nativeRequests.start();
  const payload = nativeRenderRequest(state.selected.tag, state.props, document.documentElement.dataset.theme === 'dark', { ...studioUI.nativeOptions(), text: state.docSlotValues?.[''] });
  if (state.selected.tag === 'md-button' && state.nativeScenario) payload.scenario = state.nativeScenario;
  // Fixed presets retain their native logical viewport when the image fits a
  // narrower card. Responsive mode uses the available width at native scale.
  const frame = $('#native-render-frame'), frameStyle = getComputedStyle(frame);
  const fixedWidth = Number(state.layout?.width);
  payload.width = Number.isFinite(fixedWidth) && fixedWidth > 0
    ? nativeViewportWidth(fixedWidth)
    : nativeViewportWidth(frame.clientWidth, frameStyle);
  nativeRenderState('loading', delay ? 'Waiting for property changes…' : 'Checking the native renderer…');
  const platform = state.platform;
  state.nativeRenderTimer = setTimeout(() => chooseNativePreview(payload, request, platform), delay);
}

async function readNativeResponse(response) {
  let result;
  try { result = await response.json(); } catch { throw new Error(`The native server returned an invalid response (${response.status}). Restart the playground server.`); }
  if (!response.ok) throw new Error(result.message || result.error || `Native preview failed (${response.status}).`);
  return result;
}

async function sendNativeLive(route, payload, platform) {
  let response;
  try { response = await fetch(nativeLiveEndpoint(route, platform), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: route.endsWith('/close') }); }
  catch (error) { if (error.name === 'TypeError') throw new TypeError(`Native ${route.split('/').at(-1)} request could not reach the local server (${error.message}).`); throw error; }
  return readNativeResponse(response);
}

function subscribeNativeLive(id, onFrame, onError, platform) {
  const controller = new AbortController();
  void (async () => {
    const response = await fetch(nativeLiveEndpoint(`${id}/stream`, platform), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: controller.signal });
    if (!response.ok) { await readNativeResponse(response); return; }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let pending = '';
    try {
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) throw new Error('The native frame stream ended. Reconnect to continue.');
        pending += decoder.decode(value, { stream: true });
        let end;
        while ((end = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          if (line.length > 16 * 1024 * 1024) throw new Error('Native frame exceeds the stream size limit.');
          const frame = JSON.parse(line);
          if (frame.error) throw new Error(frame.message || 'Native stream failed.');
          if (!controller.signal.aborted) onFrame(frame);
        }
        if (pending.length > 16 * 1024 * 1024) throw new Error('Native frame exceeds the stream size limit.');
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  })().catch(error => { if (!controller.signal.aborted) onError(error); });
  return () => controller.abort();
}

function configureNativeLivePreview() {
  state.activeNativeMode = 'live';
  text('#preview-runtime', 'CONNECTING');
  text('.props-hint', 'Initial properties · editing restarts the native session.');
  if (state.selected.tag === 'md-button' && state.nativeScenario === 'button-behavior') {
    text('.props-hint', 'This linked form demo has fixed actions. Select Button in the library to edit the component.');
  }
  if (state.selected.tag === 'md-button' && state.nativeScenario === 'navigation-events') {
    text('.props-hint', 'This linked navigation demo has fixed actions. Select Button in the library to edit the component.');
  }
  if (state.selected.tag === 'md-button' && state.nativeScenario === 'focus-accessibility') {
    text('.props-hint', 'This linked focus demo has fixed controls. Select Button in the library to edit the component.');
  }
  text('#preview-caption', state.platform === 'android' ? 'Real Android emulator · Jetpack Compose frames and native events' : 'Persistent macOS SwiftUI app · live frames and native events');
  text('#recipe-status', 'Click & type · native state persists');
  text('#native-render-button', 'Reconnect');
}

async function chooseNativePreview(payload, request, platform) {
  if (!request.isCurrent()) return;
  const target = nativePreviewTarget(platform);
  try {
    const status = await readNativeResponse(await fetch(nativeLiveEndpoint('status', platform), { signal: request.signal }));
    if (!request.isCurrent()) return;
    if (status.available) {
      configureNativeLivePreview(); text('#native-render-frame [role="status"]', `Starting a persistent ${target.renderer} session…`);
      nativeLive.setVisible(!document.hidden);
      void nativeLive.start(payload);
      return;
    }
    text('#preview-runtime', platform === 'android' ? 'EMULATOR OFFLINE' : 'LIVE HOST OFFLINE');
    nativeRenderState('error', platform === 'android'
      ? `${status.message || 'The Android emulator is not ready.'} Start the native Android playground, then reconnect.`
      : `${status.message || 'The SwiftUI live host is not ready.'} Build AWCLivePreview in apps/native-ios-playground, then reconnect.`);
  } catch (error) {
    if (request.isCurrent() && error.name !== 'AbortError') reportNativeLiveError(error);
  }
}

function showNativeLiveFrame(result, platform) {
  if (state.platform !== platform || state.activeNativeMode !== 'live') return;
  const target = nativePreviewTarget(platform);
  if (result.platform !== target.platform || result.renderer !== target.renderer || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.imageUrl || '') || ![result.logicalWidth, result.logicalHeight].every(size => Number.isFinite(size) && size > 0)) throw new Error('The live host returned an invalid native frame.');
  const now = performance.now();
  if (state.nativePerf?.sessionId !== result.sessionId) state.nativePerf = { sessionId: result.sessionId, since: now, received: 0, presented: 0, fresh: 0, changed: 0, windowFrames: 0, windowFresh: 0, fps: 0, freshFps: 0, decodeMs: 0 };
  state.nativePerf.received++;
  // Android may repeat an idle frame as a heartbeat. It is transport traffic,
  // not a new native capture or an animation frame.
  const sequence = result.diagnostics?.captureSequence;
  if (sequence === undefined || sequence !== state.nativePerf.captureSequence) {
    state.nativePerf.fresh++; state.nativePerf.windowFresh++;
    state.nativePerf.captureSequence = sequence;
  }
  const imageVersion = state.liveImageVersion;
  const queue = image => {
    if (imageVersion !== state.liveImageVersion || state.platform !== platform || result.revision < state.liveDisplayedRevision) return;
    if (!state.nextNativeFrame || state.nextNativeFrame.imageVersion !== imageVersion || result.revision > state.nextNativeFrame.result.revision) state.nextNativeFrame = { image, result, imageVersion, platform };
    if (state.nativePresentation) return;
    state.nativePresentation = requestAnimationFrame(() => {
      state.nativePresentation = null;
      const next = state.nextNativeFrame; state.nextNativeFrame = null;
      if (!next || next.imageVersion !== state.liveImageVersion || state.platform !== next.platform || state.activeNativeMode !== 'live' || next.result.revision < state.liveDisplayedRevision) return;
      presentNativeLiveFrame(next.image, next.result, next.platform);
    });
  };
  if ($('#native-live-surface') && state.liveFrame?.sessionId === result.sessionId && state.liveFrame.imageUrl === result.imageUrl && state.liveFrame.logicalWidth === result.logicalWidth && state.liveFrame.logicalHeight === result.logicalHeight) { queue(null); return; }
  const image = new Image(); image.className = 'snapshot-image native-live-image'; image.style.width = `${result.logicalWidth}px`; image.draggable = false;
  image.alt = `${displayName(state.selected.tag)} live ${target.renderer} view on ${target.host}`;
  image.addEventListener('load', () => {
    if (imageVersion !== state.liveImageVersion) return;
    state.nativePerf.decodeMs = performance.now() - now;
    queue(image);
  }, { once: true });
  image.addEventListener('error', () => { if (imageVersion === state.liveImageVersion && result.revision >= state.liveDisplayedRevision && state.platform === platform && state.activeNativeMode === 'live') { nativeLive.stop(); reportNativeLiveError(new Error('The live native frame could not be decoded.')); } }, { once: true });
  image.src = result.imageUrl;
}

function presentNativeLiveFrame(image, result, platform) {
  const target = nativePreviewTarget(platform);
  let surface = $('#native-live-surface');
  const firstFrame = !surface;
  if (!surface) {
    if (!image) return;
    nativeRenderState('ready', 'Native session connected.');
    surface = document.createElement('div'); surface.id = 'native-live-surface'; surface.className = 'native-live-surface'; surface.tabIndex = 0; surface.setAttribute('role', 'group'); surface.setAttribute('aria-label', `Live native ${target.renderer} view. Click or focus, then type. Escape releases keyboard.`);
    const input = document.createElement('textarea'); input.className = 'native-keyboard-input'; input.setAttribute('aria-label', `Keyboard input for the native ${target.renderer} view`); input.tabIndex = -1; input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
    surface.append(image, input); bindNativeInput(surface, input);
    $('#native-render-frame').append(surface);
  } else if (image) surface.querySelector('img').replaceWith(image);
  const perf = state.nativePerf;
  perf.presented++; perf.windowFrames++;
  if (image) perf.changed++;
  const now = performance.now();
  if (now - perf.since >= 1000) {
    perf.fps = Math.round(perf.windowFrames * 1000 / (now - perf.since));
    perf.freshFps = Math.round(perf.windowFresh * 1000 / (now - perf.since));
    perf.windowFrames = 0; perf.windowFresh = 0; perf.since = now;
  }
  // Read-only diagnostics keep heartbeat delivery separate from fresh captures.
  surface.dataset.frameMetrics = JSON.stringify({ received: perf.received, presented: perf.presented, fresh: perf.fresh, changed: perf.changed,
    fps: perf.fps, freshFps: perf.freshFps, decodeMs: +perf.decodeMs.toFixed(2), pixelWidth: result.width, pixelHeight: result.height,
    pixelScale: +(result.width / result.logicalWidth).toFixed(2), ...(result.diagnostics ? { capture: result.diagnostics } : {}) });
  updateNativeLiveFrameMetadata(result, target);
  if (firstFrame) studioUI.applyCanvas();
}

function updateNativeLiveFrameMetadata(result, target) {
  state.liveDisplayedRevision = result.revision; state.liveFrame = result;
  if ($('#preview-runtime').textContent !== target.badge) text('#preview-runtime', target.badge);
}

function reportNativeLiveError(error) {
  disposeNativePointer();
  state.liveImageVersion = (state.liveImageVersion || 0) + 1; state.liveFrame = null;
  text('#preview-runtime', 'DISCONNECTED');
  nativeRenderState('error', `${error.message} Reconnect starts a fresh native session.`);
}

function queueNativeInput(command) {
  const accepted = nativeLive.input(command);
  if (!accepted) toast('Native input is busy or disconnected. Reconnect to start a fresh session.');
  return accepted;
}

function disposeNativePointer() { const cleanup = state.nativePointerCleanup; state.nativePointerCleanup = null; cleanup?.(); }

function bindNativeInput(surface, input) {
  const pointerPoint = event => {
    const image = surface.querySelector('img'), frame = state.liveFrame;
    return image && frame ? nativeImagePoint(image.getBoundingClientRect(), image.naturalWidth, image.naturalHeight, frame.logicalWidth, frame.logicalHeight, event.clientX, event.clientY) : null;
  };
  // Native examples contain editors and switches whose platform
  // tracking loops need the host's atomic click path (down + queued release).
  const pressable = state.selected.tag === 'md-button' && !state.nativeScenario;
  if (pressable) {
    surface.classList.add('native-live-pressable');
    surface.setAttribute('aria-label', `Live native ${nativePreviewTarget(state.platform).renderer} button. Press and hold, then release to activate. Escape cancels.`);
    const pointer = createNativePointerInput(queueNativeInput);
    const releaseCapture = id => { if (id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); };
    let motionFrame, motion;
    const clearMotion = () => { if (motionFrame) cancelAnimationFrame(motionFrame); motionFrame = null; motion = null; };
    const leave = () => queueNativeInput({ command: 'pointer', phase: 'leave', x: 0, y: 0 });
    const cancel = () => { clearMotion(); const id = pointer.pointerId; pointer.cancel(); releaseCapture(id); leave(); };
    const hidden = () => { if (document.hidden) cancel(); };
    surface.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || !pointer.down(event.pointerId, pointerPoint(event))) return;
      clearMotion(); event.preventDefault(); input.focus({ preventScroll: true });
      try { surface.setPointerCapture(event.pointerId); } catch { cancel(); }
    });
    surface.addEventListener('pointerup', event => {
      if (event.pointerId !== pointer.pointerId) return;
      clearMotion(); event.preventDefault(); pointer.up(event.pointerId, pointerPoint(event)); releaseCapture(event.pointerId);
    });
    surface.addEventListener('pointermove', event => {
      if (event.isPrimary === false) return;
      motion = pointerPoint(event);
      if (!motionFrame) motionFrame = requestAnimationFrame(() => {
        motionFrame = null;
        if (motion) queueNativeInput({ command: 'pointer', phase: 'move', ...motion });
        else leave();
      });
    });
    surface.addEventListener('pointerleave', () => { clearMotion(); leave(); });
    surface.addEventListener('pointercancel', event => { if (event.pointerId === pointer.pointerId) cancel(); });
    surface.addEventListener('lostpointercapture', event => pointer.cancel(event.pointerId));
    input.addEventListener('blur', cancel);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    state.nativePointerCleanup = () => { cancel(); input.removeEventListener('blur', cancel); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden); };
  }
  surface.addEventListener('focus', () => input.focus({ preventScroll: true }));
  surface.addEventListener('click', event => {
    if (pressable) { event.preventDefault(); event.stopPropagation(); return; }
    const point = pointerPoint(event);
    if (!point) return;
    input.focus({ preventScroll: true }); queueNativeInput({ command: 'click', ...point });
  });
  input.addEventListener('input', event => {
    if (event.isComposing) return;
    const value = input.value; input.value = '';
    for (const text of nativeTextChunks(value)) queueNativeInput({ command: 'text', text });
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); input.blur(); return; }
    if (event.isComposing) return;
    const key = event.key === ' ' ? 'Space' : event.key;
    const named = ['Enter', 'Space', 'Tab', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
    if (!named.includes(key)) return;
    event.preventDefault(); event.stopPropagation();
    const modifiers = [['shiftKey', 'shift'], ['ctrlKey', 'control'], ['altKey', 'alt'], ['metaKey', 'meta']].filter(([key]) => event[key]).map(([, value]) => value);
    queueNativeInput({ command: 'key', key, modifiers });
  });
}

function recordNativeEvents(events, platform) {
  const { eventOrigin } = nativePreviewTarget(platform);
  for (const event of events) {
    const native = Object.fromEntries(['defaultPrevented', 'activation', 'propagationPath'].filter(key => Object.hasOwn(event, key)).map(key => [key, event[key]]));
    state.events.unshift({ name: event.name, time: new Date().toLocaleTimeString('en-GB'), detail: event.detail ?? null, origin: eventOrigin, nodeID: event.nodeID, ...(Object.keys(native).length ? { native } : {}) });
  }
  state.events = state.events.slice(0, 100); text('#event-count', state.events.length);
  if (state.docSection === 'events') renderEvents();
}

function renderProperties() {
  const active = document.activeElement;
  const focusedId = active?.closest('#props-controls') ? active.id : null;
  const draft = focusedId && active.dataset.prop ? { value: active.value, checked: active.selected, invalid: active.getAttribute('aria-invalid'), error: document.getElementById(`${focusedId}-error`)?.textContent } : null;
  const innerInput = active?.shadowRoot?.querySelector('input,textarea');
  const selection = innerInput && ['text', 'search', 'textarea'].includes(innerInput.type) ? [innerInput.selectionStart, innerInput.selectionEnd] : null;
  const scrollTop = $('#properties-panel').scrollTop;
  documentationUI.beginRender();
  const fields = state.selected.properties || [];
  text('#props-count', fields.length);
  const preferred = ['label', 'headline', 'variant', 'size', 'shape', 'value', 'selected', 'checked', 'disabled', 'loading', 'icon', 'supportingText', 'options', 'series', 'data', 'nodes'];
  const sorted = [...fields].sort((a, b) => { const ai = preferred.indexOf(a.name), bi = preferred.indexOf(b.name); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); });
  const editors = new Map();
  $('#props-controls').innerHTML = documentationUI.textControl() + (sorted.map(prop => {
    const value = state.props[prop.name], id = `prop-${prop.name}`, type = prop.type || '';
    const editor = propertyEditor(state.selected, prop, value); editors.set(prop.name, editor);
    const doc = memberDocumentation(state.selected, 'property', prop, state.platform);
    const unsupported = doc.support.status === 'unsupported';
    const attrs = `id="${id}" data-prop="${escape(prop.name)}" aria-label="${escape(prop.name)}" aria-describedby="${id}-error${editor.note || unsupported ? ` ${id}-note` : ''}" ${unsupported ? 'disabled' : ''}`;
    const label = editor.kind === 'readonly' ? `<span class="prop-label"><code>${escape(prop.name)}</code></span>` : `<label class="prop-label" for="${id}"><code>${escape(prop.name)}</code></label>`;
    const header = `<div class="prop-heading">${label}${documentationUI.infoButton('property', prop)}${editor.kind === 'boolean' ? `<md-switch ${attrs} density="-3" ${value ? 'selected' : ''}></md-switch>` : `<span class="prop-type" title="${escape(type)}">${escape(type)}</span>`}</div>`;
    let input;
    if (editor.kind === 'boolean') input = '';
    else if (editor.kind === 'readonly') input = `<code class="prop-signature" id="${id}">${escape(type)}</code>`;
    else if (editor.kind === 'literal') {
      const isSet = editor.choices.some(option => Object.is(option, value));
      input = `<md-select ${attrs} variant="outlined" density="-3" data-literal="true" value="${escape(isSet ? encodeLiteralChoice(value) : '')}">${editor.optional || !isSet ? `<md-select-option value="" ${editor.optional ? '' : 'disabled'}>Unset</md-select-option>` : ''}${editor.choices.map(option => `<md-select-option value="${escape(encodeLiteralChoice(option))}">${escape(literalChoiceLabel(option, editor.choices))}</md-select-option>`).join('')}</md-select>`;
    }
    else if (editor.kind === 'json') input = `<md-text-field ${attrs} variant="outlined" density="-3" multiline="fixed" rows="4" data-json="true" value="${escape(value === undefined ? '' : JSON.stringify(value, null, 2))}" placeholder="JSON value"></md-text-field>`;
    else input = `<md-text-field ${attrs} variant="outlined" density="-3" type="${editor.kind === 'number' ? 'number' : 'text'}" value="${escape(value ?? '')}" placeholder="${escape(prop.default ?? '')}"></md-text-field>`;
    const note = unsupported ? 'Not available in this native adapter. Try it in the Web reference.' : editor.note;
    const unset = editor.optional && ['text', 'boolean'].includes(editor.kind) ? `<md-button variant="text" size="xs" class="prop-unset" data-unset-prop="${escape(prop.name)}" aria-label="Unset ${escape(prop.name)}" ${unsupported ? 'disabled' : ''}>${value === undefined ? 'Unset · using default' : 'Unset'}</md-button>` : '';
    return `<div class="prop-control ${editor.kind}" data-search="${escape(`${prop.name} ${type} ${doc.description}`.toLowerCase())}">${header}${input}${note ? `<p class="prop-note" id="${id}-note">${escape(note)}</p>` : ''}${unset}<span class="prop-error" id="${id}-error" role="status" hidden></span></div>`;
  }).join('') || '<p class="prop-note">This structural component has no public properties. Explore it through its parent composition.</p>');
  documentationUI.bindTextControl();
  const applyValue = (name, value) => {
    if (value === undefined) delete state.props[name]; else state.props[name] = value;
    if (state.editedTag !== state.selected.tag) { state.editedTag = state.selected.tag; state.editedProps = {}; }
    state.editedProps[name] = value;
    if (state.target) state.target[name] = value;
    const unset = [...$('#props-controls').querySelectorAll('[data-unset-prop]')].find(button => button.dataset.unsetProp === name);
    if (unset) unset.textContent = value === undefined ? 'Unset · using default' : 'Unset';
    documentationUI.updateSnippet(); scheduleNativeRender();
  };
  $('#props-controls').querySelectorAll('[data-unset-prop]').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.unsetProp, input = document.getElementById(`prop-${name}`);
    if (input.tagName === 'MD-SWITCH') input.selected = false; else input.value = '';
    applyValue(name, undefined);
  }));
  $('#props-controls').querySelectorAll('[data-prop]').forEach(input => input.addEventListener(['MD-SWITCH', 'MD-SELECT'].includes(input.tagName) ? 'mdChange' : 'mdInput', event => {
    if (event.target !== input) return;
    let value;
    const error = document.getElementById(`${input.id}-error`);
    try {
      if (input.shadowRoot?.querySelector('input')?.validity.badInput) throw new Error('Enter a finite number.');
      value = parsePropertyInput(editors.get(input.dataset.prop), input.value, input.selected);
      input.removeAttribute('aria-invalid'); error.hidden = true;
    } catch (issue) { input.setAttribute('aria-invalid', 'true'); error.hidden = false; error.textContent = issue.message; return; }
    applyValue(input.dataset.prop, value);
  }));
  documentationUI.renderUsage(); documentationUI.filterProperties();
  $('#properties-tab').setAttribute('aria-label', `Properties, ${fields.length} declarations`);
  $('#css-variables-tab').setAttribute('aria-label', `CSS variables, ${$('#css-variables-count').textContent} declarations`);
  $('#properties-panel').scrollTop = scrollTop;
  const replacement = focusedId && document.getElementById(focusedId);
  if (replacement && !replacement.disabled) {
    if (draft && replacement.dataset.prop) {
      if (replacement.tagName === 'MD-SWITCH') replacement.selected = draft.checked; else replacement.value = draft.value;
      if (draft.invalid === 'true') { replacement.setAttribute('aria-invalid', 'true'); const error = document.getElementById(`${focusedId}-error`); error.textContent = draft.error; error.hidden = false; }
    }
    if (replacement.setFocus) void replacement.setFocus().then(async () => { const inner = await replacement.getInputElement?.(); if (selection && inner?.setSelectionRange) inner.setSelectionRange(...selection); });
    else if (replacement.focusTrigger) void replacement.focusTrigger();
    else replacement.focus({ preventScroll: true });
  }
}
function selectPropertiesSection(section) {
  if (!['properties', 'css'].includes(section) || section === state.propertiesSection) return;
  const panel = $('#properties-panel');
  state.propertiesScroll[state.propertiesSection] = panel.scrollTop;
  state.propertiesSection = section;
  for (const tooltip of $('.props-panel').querySelectorAll('md-tooltip[open]')) tooltip.open = false;
  $('#properties-tabs').activeTabIndex = section === 'css' ? 1 : 0;
  $('#properties-tabpanel').hidden = section !== 'properties';
  $('#css-variables-tabpanel').hidden = section !== 'css';
  panel.scrollTop = state.propertiesScroll[section] || 0;
}
function syncReferenceState() {
  if (!state.target) return;
  for (const name of ['value', 'checked', 'selected', 'expanded', 'open', 'activeTabIndex', 'activeIndex']) {
    const input = document.getElementById(`prop-${name}`);
    if (!input || input === document.activeElement || state.target[name] === undefined) continue;
    const value = state.target[name];
    state.props[name] = value;
    if (input.dataset.literal) input.value = encodeLiteralChoice(value);
    else if (input.tagName === 'MD-SWITCH') input.selected = Boolean(value);
    else if (input.dataset.json) input.value = JSON.stringify(value, null, 2);
    else input.value = value ?? '';
  }
  documentationUI.updateSnippet();
}
function recordEvent(event) {
  if (state.platform !== 'web') return;
  requestAnimationFrame(syncReferenceState);
  let detail = event.detail;
  if (detail && typeof detail === 'object') { try { detail = JSON.parse(JSON.stringify(detail, (_, value) => value?.nodeType === 1 ? `<${value.tagName.toLowerCase()}>` : value)); } catch { detail = '[Non-serializable event detail]'; } }
  state.events.unshift({ name: event.type, time: new Date().toLocaleTimeString('en-GB'), detail: detail === undefined ? null : detail, origin: 'Web reference' });
  state.events = state.events.slice(0, 100); text('#event-count', state.events.length); if (state.docSection === 'events') renderEvents();
}
function selectStudioSection(section) {
  const names = ['usage', 'coverage', 'events', 'ai'];
  if (!names.includes(section)) return;
  state.docSection = section;
  $('#studio-doc-tabs').activeTabIndex = names.indexOf(section);
  $('#usage-docs').hidden = section !== 'usage'; $('#coverage-panel').hidden = section !== 'coverage';
  $('.inspector-panel').hidden = section !== 'events';
  $('#ai-instructions-panel').hidden = section !== 'ai';
  if (section === 'coverage') void coverageUI.load();
  else if (section === 'events') renderEvents();
  else if (section === 'ai') void aiInstructionsUI.load();
}
function renderEvents() {
  const root = $('#inspector-content');
  root.innerHTML = `<div class="event-toolbar"><span>Component events · latest 100</span><md-button id="clear-events" variant="text" size="xs">Clear</md-button></div>${state.events.length ? `<div class="event-log">${state.events.map(event => `<div class="event-row"><time>${event.time}</time><div><code>${escape(event.name)}</code><small class="event-origin">${escape(event.origin || 'Web reference')}</small></div><pre>${escape(JSON.stringify(event.native ? { detail: event.detail, native: event.native } : event.detail))}</pre></div>`).join('')}</div>` : '<p class="empty-state">Interact with the web reference or live native preview to see emitted events.<br />Native records come from the running native app.</p>'}`;
  $('#clear-events').addEventListener('mdClick', () => { state.events = []; text('#event-count', '0'); renderEvents(); });
}
void init();
