import { encodeLiteralChoice, literalChoiceLabel, portabilityFindings, createLatestRequest, nativeRenderRequest, nativePreviewTarget, nativeLiveEndpoint, createNativeSessionCoordinator, createNativeLiveClient, createNativePointerInput, nativeImagePoint, nativeTextChunks } from './contracts.js';
import { recipeFor, categoryFor, categoryOrder, displayName, icons } from './recipes.js';
import { mergeComponentDocumentation, memberDocumentation } from './documentation.js';
import { createDocumentationUI } from './documentation-ui.js';
import { propertyEditor, parsePropertyInput } from './property-controls.js';

const $ = selector => document.querySelector(selector);
const state = { components: [], selected: null, platform: 'web', inspector: 'contract', filter: 'all', props: {}, events: [], catalog: null, ready: false, target: null, sourcePlatform: 'ios', sourceText: '', sourceCache: new Map(), renderVersion: 0 };
const documentationUI = createDocumentationUI({ getState: () => state, notify: toast, afterInteraction: syncReferenceState, watchEvents: () => { selectInspector('events'); $('.inspector-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
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
const text = (selector, value) => { $(selector).textContent = String(value ?? ''); };
const sourceURL = value => value && !value.startsWith('/') && !value.split('/').includes('..') ? `/repo/${value}` : null;

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
    try { if (localStorage.getItem('awc-native-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch { /* Storage may be disabled. */ }
    updateThemeLabel();
    const [manifestResult, catalogResult, runtimeResult, tokensResult] = await Promise.allSettled([
      getJSON('/repo/packages/core/custom-elements.json'), getJSON('/repo/packages/native-compiler/generated/catalog.json'), import('/web-dist/md3/md3.esm.js'), getJSON('/repo/packages/native-compiler/generated/tokens.json'),
    ]);
    if (manifestResult.status !== 'fulfilled') throw new Error('Unable to read the AWC component manifest. Start the server from the repository checkout.');
    const contracts = normalizeManifest(manifestResult.value);
    state.catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
    state.tokens = tokensResult.status === 'fulfilled' ? tokensResult.value : null;
    applyPreviewTheme();
    const generated = new Map((state.catalog?.components || []).map(component => [component.tag, component]));
    state.components = contracts.map(component => {
      const output = generated.get(component.tag);
      const merged = mergeComponentDocumentation(component, output || {});
      return { ...merged, category: categoryFor(component.tag), properties: merged.properties.map(normalizeProperty) };
    });
    state.ready = runtimeResult.status === 'fulfilled';
    text('#component-count', state.components.length); text('#coverage-count', state.components.length);
    $('#compiler-status').innerHTML = `<i></i>${state.catalog ? 'Generated catalog connected' : 'Source manifest only'}`;
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
  $('#search').addEventListener('input', renderNavigation);
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button)); renderNavigation(); }));
  $('#component-list').addEventListener('click', event => { const button = event.target.closest('[data-tag]'); if (button) { selectNativeScenario(''); location.hash = button.dataset.tag; if (state.selected?.tag === button.dataset.tag) selectComponent(button.dataset.tag); } });
  window.addEventListener('hashchange', () => { const tag = location.hash.slice(1); if (state.components.some(component => component.tag === tag)) { selectNativeScenario(''); selectComponent(tag); } });
  window.addEventListener('pagehide', () => { disposeNativePointer(); nativeRequests.cancel(); clearTimeout(state.nativeRenderTimer); nativeLive.stop(); });
  window.addEventListener('pageshow', event => { if (event.persisted && isNativePlatform(state.platform)) renderPreview(); });
  document.addEventListener('visibilitychange', () => nativeLive.setVisible(!document.hidden));
  $('#theme-toggle').addEventListener('click', () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('awc-native-theme', dark ? 'dark' : 'light'); } catch { /* Optional storage. */ } updateThemeLabel(); applyPreviewTheme(); scheduleNativeRender(); });
  $('#reset').addEventListener('click', () => { selectComponent(state.selected.tag); toast('Component properties reset'); });
  document.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', () => selectPlatform(button.dataset.platform)));
  document.querySelectorAll('[data-inspector]').forEach(button => button.addEventListener('click', () => selectInspector(button.dataset.inspector)));
  $('#copy-source').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.sourceText); toast('Generated source copied'); } catch { toast('Clipboard unavailable in this browser'); } });
  document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); $('#search').focus(); } });
}
function updateThemeLabel() { const dark = document.documentElement.dataset.theme === 'dark'; $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); $('#theme-toggle').textContent = dark ? '☼' : '◐'; }
function applyPreviewTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const tokens = { ...state.tokens?.light, ...(dark ? state.tokens?.dark : {}) };
  for (const [name, value] of Object.entries(tokens)) {
    if (/^--md-[a-z0-9-]+$/.test(name) && typeof value === 'string') $('#preview-content').style.setProperty(name, value);
  }
}
function selectPlatform(platform) {
  if (!['web', 'ios', 'android'].includes(platform)) return;
  state.platform = platform;
  const url = new URL(location.href);
  if (platform === 'web') url.searchParams.delete('platform'); else url.searchParams.set('platform', platform);
  history.replaceState(null, '', url);
  document.querySelectorAll('[data-platform]').forEach(button => { const active = button.dataset.platform === platform; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  if (platform !== 'web') { state.sourcePlatform = platform; selectInspector('source'); }
  renderPreview(); renderProperties();
}
function toast(message) { text('#toast', message); $('#toast').classList.add('visible'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2000); }
function renderNavigation() {
  const query = $('#search').value.trim().toLowerCase();
  const filtered = state.components.filter(component => `${component.tag} ${displayName(component.tag)} ${component.category}`.toLowerCase().includes(query) && (state.filter === 'all' || portabilityFindings(component).total));
  const groups = categoryOrder.map(category => ({ category, components: filtered.filter(component => component.category === category) })).filter(group => group.components.length);
  $('#component-list').innerHTML = groups.map(({ category, components }) => `<section class="nav-group"><h3>${escape(category)}<span>${components.length}</span></h3>${components.map(component => `<button class="component-link ${component.tag === state.selected?.tag ? 'active' : ''}" data-tag="${escape(component.tag)}" ${component.tag === state.selected?.tag ? 'aria-current="true"' : ''}><span class="nav-icon" aria-hidden="true">${icons[category]}</span><span>${escape(displayName(component.tag))}</span>${portabilityFindings(component).total ? `<span class="nav-warning" title="${portabilityFindings(component).source} source diagnostics · ${portabilityFindings(component).ios} iOS API gaps · ${portabilityFindings(component).android} Android API gaps">${portabilityFindings(component).total}</span>` : ''}</button>`).join('')}</section>`).join('') || '<p class="empty-state">No matching components.</p>';
}
function selectComponent(tag) {
  const component = state.components.find(item => item.tag === tag); if (!component) return;
  state.selected = component; state.events = []; state.props = {}; state.editedTag = tag; state.editedProps = {};
  state.docSlotValues = {}; state.docCssValues = {}; $('#props-search').value = ''; $('#props-controls').scrollTop = 0;
  for (const prop of component.properties || []) { if (prop.defaultValue !== undefined) state.props[prop.name] = structuredClone(prop.defaultValue); }
  Object.assign(state.props, recipeFor(tag).props);
  text('#category-label', component.category); text('#tag-label', tag); text('#component-title', displayName(tag)); text('#component-description', component.description);
  text('#props-count', component.properties.length); text('#findings-count', portabilityFindings(component).total); text('#event-count', '0');
  renderNavigation(); renderPreview(); renderProperties(); renderInspector();
  void loadComponentDocumentation(component);
}
function renderPreview() {
  disposeNativePointer(); clearTimeout(state.nativeRenderTimer); nativeRequests.cancel(); nativeLive.stop();
  state.liveFrame = null; state.liveDisplayedRevision = -1; state.liveImageVersion = (state.liveImageVersion || 0) + 1;
  const root = $('#preview-content'); root.replaceChildren(); state.target = null;
  const isWeb = state.platform === 'web'; $('#preview-stage').classList.toggle('native-mode', !isWeb);
  root.classList.toggle('button-reference', isWeb && state.selected.tag === 'md-button');
  $('#preview-stage').classList.toggle('snapshot-mode', !isWeb);
  text('#preview-runtime', isWeb ? 'LIVE WEB' : 'NATIVE PREVIEW');
  text('.props-hint', isWeb ? 'Changes apply to the web reference.' : 'Initial properties · editing restarts the native session.');
  if (!isWeb) { nativeLive = nativeClientFor(state.platform); renderNativePreview(); return; }
  if (!state.ready) { root.innerHTML = '<div class="load-error">Web runtime unavailable. Build <code>@awc-ui/core</code>, or start this server with <code>AWC_WEB_DIST=/absolute/path/to/core/dist</code>.</div>'; text('#preview-caption', 'Web reference unavailable'); text('#recipe-status', 'Build core to enable'); return; }
  const recipe = recipeFor(state.selected.tag);
  root.innerHTML = `<div class="demo ${recipe.mode}">${recipe.html}</div>`;
  state.target = root.querySelector(state.selected.tag);
  if (state.target) {
    // Markup defines surrounding context; only explicitly edited and demo values
    // override the selected element so child compositions retain their state.
    for (const [name, value] of Object.entries(recipe.props)) state.target[name] = value;
    const fields = (state.selected.properties || []).map(prop => prop.name);
    for (const field of fields) if (state.target.hasAttribute(field.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`))) {
      const attr = state.target.getAttribute(field.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`));
      const prop = state.selected.properties.find(prop => prop.name === field);
      state.props[field] = prop.type === 'boolean' ? true : prop.type === 'number' ? Number(attr) : attr;
    }
    for (const [name, value] of Object.entries(state.editedTag === state.selected.tag ? state.editedProps || {} : {})) { state.target[name] = value; state.props[name] = value; }
  }
  recipe.setup?.(root);
  documentationUI.applyOverrides();
  const eventNames = new Set(['click', ...(state.selected.events || []).map(event => event.name)]);
  for (const eventName of eventNames) root.addEventListener(eventName, recordEvent);
  root.addEventListener('click', event => { if (event.composedPath().some(element => element?.tagName === 'A')) event.preventDefault(); });
  text('#preview-caption', 'Original AWC web component · browser rendering'); text('#recipe-status', recipe.note);
}

function renderNativePreview() {
  const component = state.selected;
  const target = nativePreviewTarget(state.platform);
  const support = component.support?.[state.platform];
  $('#preview-content').innerHTML = `<section class="native-snapshot" aria-label="${target.renderer} native preview"><div class="snapshot-heading"><div><h3><span aria-hidden="true">◇</span> ${target.title}</h3><p>${escape(displayName(component.tag))} · native AWC adapter</p></div><div class="native-preview-actions"><span class="native-live-badge">Live</span><button class="secondary-button" id="native-render-button" type="button">Reconnect</button></div></div><div class="snapshot-frame" id="native-render-frame" aria-busy="true"></div><p class="snapshot-status" id="native-render-status" role="status" aria-live="polite"></p><p class="snapshot-note" id="native-preview-note"></p><details class="snapshot-details"><summary>Fixture & native playground</summary><p>The native example uses this component’s root properties. Its child content and text may differ from the web reference.</p><p>Live pixels preserve native state. Native accessibility remains in the running ${state.platform === 'android' ? 'Android' : 'macOS'} app; this image does not expose its control tree to the browser.</p>${state.platform === 'android' ? '<p>Live rendering requires the Android emulator and native playground. One Android preview can use the emulator at a time. Capture covers the visible Activity surface; separate Popup/Dialog windows and off-screen content are outside this preview.</p>' : ''}<p>${support ? `${support.unsupportedProperties?.length || 0} unsupported properties · ${support.unsupportedEvents?.length || 0} unsupported events. Inspect full coverage in Portability.` : 'Adapter coverage has not been reported.'}</p><code>${escape(target.playground)}</code></details></section>`;
  $('#native-render-button').addEventListener('click', () => scheduleNativeRender(0));
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
    const marker = document.createElement('span');
    marker.className = kind === 'loading' ? 'snapshot-spinner' : 'snapshot-error-symbol';
    marker.setAttribute('aria-hidden', 'true');
    if (kind !== 'loading') marker.textContent = '◇';
    const label = document.createElement('p'); label.textContent = kind === 'loading' ? 'Rendering native component…' : 'Native render unavailable';
    frame.append(marker, label);
  }
  text('#native-render-status', message);
  text('#native-render-button', kind === 'error' ? 'Retry connection' : 'Reconnect');
}

function scheduleNativeRender(delay = 300) {
  if (!isNativePlatform(state.platform) || !$('#native-render-frame')) return;
  clearTimeout(state.nativeRenderTimer);
  disposeNativePointer(); nativeLive.stop(); state.liveFrame = null; state.liveDisplayedRevision = -1; state.liveImageVersion = (state.liveImageVersion || 0) + 1;
  const request = nativeRequests.start();
  const payload = nativeRenderRequest(state.selected.tag, state.props, document.documentElement.dataset.theme === 'dark');
  if (state.selected.tag === 'md-button' && state.nativeScenario) payload.scenario = state.nativeScenario;
  // Render at the available logical width instead of shrinking a 640pt image
  // (which also shrinks the native button and font in a narrow browser pane).
  const frame = $('#native-render-frame'), frameStyle = getComputedStyle(frame);
  payload.width = Math.max(320, Math.min(640, Math.floor(frame.clientWidth - parseFloat(frameStyle.paddingLeft) - parseFloat(frameStyle.paddingRight))));
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
  const target = nativePreviewTarget(state.platform);
  state.activeNativeMode = 'live';
  text('#preview-runtime', 'CONNECTING');
  text('.props-hint', 'Initial properties · editing restarts the native session.');
  text('#native-preview-note', state.selected.tag === 'md-button' ? `Press and hold to see the native button response; release to activate. Esc cancels and releases keyboard focus. Frames stream directly from ${target.renderer}; hover and pointer position are forwarded.` : 'Click the native view, then type. Esc releases keyboard focus. Clicks and typing are live; dragging, hover and sheets are not validated.');
  if (state.selected.tag === 'md-button' && state.nativeScenario === 'button-behavior') {
    text('#native-preview-note', 'Edit the native field and press Enter or Submit. Try validation, reset and cancellation, then inspect the submitted data and Events. Form data and link actions stay local. This example runs entirely in the native host.');
    text('.props-hint', 'This linked form demo has fixed actions. Select Button in the library to edit the component.');
  }
  if (state.selected.tag === 'md-button' && state.nativeScenario === 'navigation-events') {
    text('#native-preview-note', 'Follow a link, open another native context, or go Back. Try cancellation and propagation controls, then inspect the event trace. Routes stay inside this native demo; no external page opens.');
    text('.props-hint', 'This linked navigation demo has fixed actions. Select Button in the library to edit the component.');
  }
  if (state.selected.tag === 'md-button' && state.nativeScenario === 'focus-accessibility') {
    text('#native-preview-note', 'Click the native preview to give it keyboard input. Tab enters or leaves the group; Left, Right, Home and End move within it without selecting. Enter or Space activates. Escape returns keyboard control to the browser. Native accessibility semantics are tested in the platform app; this image cannot expose them to a browser screen reader.');
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
      configureNativeLivePreview(); text('#native-render-status', `Starting a persistent ${target.renderer} session…`);
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
  if (state.nativePerf?.sessionId !== result.sessionId) state.nativePerf = { sessionId: result.sessionId, since: now, received: 0, presented: 0, windowFrames: 0, fps: 0, decodeMs: 0 };
  state.nativePerf.received++;
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
  const now = performance.now();
  if (now - perf.since >= 1000) {
    perf.fps = Math.round(perf.windowFrames * 1000 / (now - perf.since));
    perf.windowFrames = 0; perf.since = now;
    // Read-only QA measurements also distinguish arrival rate from actual paints.
    surface.dataset.frameMetrics = JSON.stringify({ received: perf.received, presented: perf.presented, fps: perf.fps, decodeMs: +perf.decodeMs.toFixed(2) });
  }
  updateNativeLiveFrameMetadata(result, target);
}

function updateNativeLiveFrameMetadata(result, target) {
  state.liveDisplayedRevision = result.revision; state.liveFrame = result;
  if ($('#preview-runtime').textContent !== target.badge) text('#preview-runtime', target.badge);
  // Do not announce every poll to screen readers or replace an unchanged image.
  const status = `Live stream${state.nativePerf?.fps ? ` · ${state.nativePerf.fps} fps` : ''} · ${Math.round(result.logicalWidth * 100) / 100} × ${Math.round(result.logicalHeight * 100) / 100} ${target.unit} · ${state.selected.tag}`;
  if ($('#native-render-status').textContent !== status) text('#native-render-status', status);
}

function reportNativeLiveError(error) {
  disposeNativePointer();
  state.liveImageVersion = (state.liveImageVersion || 0) + 1; state.liveFrame = null;
  text('#preview-runtime', 'DISCONNECTED');
  nativeRenderState('error', `${error.message} Reconnect starts a fresh native session.`);
}

function queueNativeInput(command) {
  const accepted = nativeLive.input(command);
  if (!accepted) text('#native-render-status', 'Native input is busy or disconnected. Reconnect to start a fresh session.');
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
  if (state.inspector === 'events') renderInspector();
}

function renderProperties() {
  const active = document.activeElement;
  const focusedId = active?.closest('#props-controls') ? active.id : null;
  const draft = focusedId && active.dataset.prop ? { value: active.value, checked: active.checked, invalid: active.getAttribute('aria-invalid'), error: document.getElementById(`${focusedId}-error`)?.textContent } : null;
  const selection = ['text', 'search', 'textarea'].includes(active?.type) ? [active.selectionStart, active.selectionEnd] : null;
  const scrollTop = $('#props-controls').scrollTop;
  documentationUI.beginRender();
  const fields = state.selected.properties || [];
  const preferred = ['label', 'headline', 'variant', 'size', 'shape', 'value', 'selected', 'checked', 'disabled', 'loading', 'icon', 'supportingText', 'options', 'series', 'data', 'nodes'];
  const sorted = [...fields].sort((a, b) => { const ai = preferred.indexOf(a.name), bi = preferred.indexOf(b.name); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); });
  const editors = new Map();
  $('#props-controls').innerHTML = sorted.map(prop => {
    const value = state.props[prop.name], id = `prop-${prop.name}`, type = prop.type || '';
    const editor = propertyEditor(state.selected, prop, value); editors.set(prop.name, editor);
    const doc = memberDocumentation(state.selected, 'property', prop, state.platform);
    const unsupported = doc.support.status === 'unsupported';
    const attrs = `id="${id}" data-prop="${escape(prop.name)}" aria-describedby="${id}-error${editor.note || unsupported ? ` ${id}-note` : ''}" ${unsupported ? 'disabled' : ''}`;
    const label = editor.kind === 'readonly' ? `<span class="prop-label"><code>${escape(prop.name)}</code></span>` : `<label class="prop-label" for="${id}"><code>${escape(prop.name)}</code></label>`;
    const header = `<div class="prop-heading">${label}${documentationUI.infoButton('property', prop)}${editor.kind === 'boolean' ? `<input ${attrs} class="switch-control" type="checkbox" ${value ? 'checked' : ''} />` : `<span class="prop-type" title="${escape(type)}">${escape(type)}</span>`}</div>`;
    let input;
    if (editor.kind === 'boolean') input = '';
    else if (editor.kind === 'readonly') input = `<code class="prop-signature" id="${id}">${escape(type)}</code>`;
    else if (editor.kind === 'literal') {
      const isSet = editor.choices.some(option => Object.is(option, value));
      input = `<select ${attrs} data-literal="true">${editor.optional || !isSet ? `<option value="" ${!isSet ? 'selected' : ''} ${editor.optional ? '' : 'disabled'}>Unset</option>` : ''}${editor.choices.map(option => `<option value="${escape(encodeLiteralChoice(option))}" ${Object.is(value, option) ? 'selected' : ''}>${escape(literalChoiceLabel(option, editor.choices))}</option>`).join('')}</select>`;
    }
    else if (editor.kind === 'json') input = `<textarea ${attrs} data-json="true" spellcheck="false" placeholder="JSON value">${escape(value === undefined ? '' : JSON.stringify(value, null, 2))}</textarea>`;
    else input = `<input ${attrs} type="${editor.kind === 'number' ? 'number' : 'text'}" ${editor.kind === 'number' ? 'step="any"' : ''} value="${escape(value ?? '')}" placeholder="${escape(prop.default ?? '')}" />`;
    const note = unsupported ? 'Not available in this native adapter. Try it in the Web reference.' : editor.note;
    const unset = editor.optional && ['text', 'boolean'].includes(editor.kind) ? `<button type="button" class="prop-unset text-button" data-unset-prop="${escape(prop.name)}" aria-label="Unset ${escape(prop.name)}" ${unsupported ? 'disabled' : ''}>${value === undefined ? 'Unset · using default' : 'Unset'}</button>` : '';
    return `<div class="prop-control ${editor.kind}" data-search="${escape(`${prop.name} ${type} ${doc.description}`.toLowerCase())}">${header}${input}${note ? `<p class="prop-note" id="${id}-note">${escape(note)}</p>` : ''}${unset}<span class="prop-error" id="${id}-error" role="status" hidden></span></div>`;
  }).join('') || '<p class="prop-note">This structural component has no public properties. Explore it through its parent composition.</p>';
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
    if (input.type === 'checkbox') input.checked = false; else input.value = '';
    applyValue(name, undefined);
  }));
  $('#props-controls').querySelectorAll('[data-prop]').forEach(input => input.addEventListener('input', () => {
    let value;
    const error = document.getElementById(`${input.id}-error`);
    try {
      if (input.validity?.badInput) throw new Error('Enter a finite number.');
      value = parsePropertyInput(editors.get(input.dataset.prop), input.value, input.checked);
      input.removeAttribute('aria-invalid'); error.hidden = true;
    } catch (issue) { input.setAttribute('aria-invalid', 'true'); error.hidden = false; error.textContent = issue.message; return; }
    applyValue(input.dataset.prop, value);
  }));
  documentationUI.renderUsage(); documentationUI.filterProperties();
  $('#props-controls').scrollTop = scrollTop;
  const replacement = focusedId && document.getElementById(focusedId);
  if (replacement && !replacement.disabled) {
    if (draft && replacement.dataset.prop) {
      if (replacement.type === 'checkbox') replacement.checked = draft.checked; else replacement.value = draft.value;
      if (draft.invalid === 'true') { replacement.setAttribute('aria-invalid', 'true'); const error = document.getElementById(`${focusedId}-error`); error.textContent = draft.error; error.hidden = false; }
    }
    replacement.focus({ preventScroll: true });
    if (selection && ['text', 'search', 'textarea'].includes(replacement.type)) replacement.setSelectionRange(...selection);
  }
}
function syncReferenceState() {
  if (!state.target) return;
  for (const name of ['value', 'checked', 'selected', 'expanded', 'open', 'activeTabIndex', 'activeIndex']) {
    const input = document.getElementById(`prop-${name}`);
    if (!input || input === document.activeElement || state.target[name] === undefined) continue;
    const value = state.target[name];
    state.props[name] = value;
    if (input.dataset.literal) input.value = encodeLiteralChoice(value);
    else if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (input.dataset.json) input.value = JSON.stringify(value, null, 2);
    else input.value = value ?? '';
  }
  documentationUI.updateSnippet();
}
function recordEvent(event) {
  if (state.platform !== 'web') return;
  requestAnimationFrame(syncReferenceState);
  let detail = event.detail;
  if (detail && typeof detail === 'object') { try { detail = JSON.parse(JSON.stringify(detail, (_, value) => value instanceof Element ? `<${value.tagName.toLowerCase()}>` : value)); } catch { detail = '[Non-serializable event detail]'; } }
  state.events.unshift({ name: event.type, time: new Date().toLocaleTimeString('en-GB'), detail: detail === undefined ? null : detail, origin: 'Web reference' });
  state.events = state.events.slice(0, 100); text('#event-count', state.events.length); if (state.inspector === 'events') renderInspector();
}
function selectInspector(tab) {
  state.inspector = tab; document.querySelectorAll('[data-inspector]').forEach(button => { const active = button.dataset.inspector === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); }); renderInspector();
}
function nativeEquivalentSummary(component, platform) {
  const equivalents = component.support?.[platform]?.nativeEquivalents || {};
  const entries = (component.diagnostics || []).map(diagnostic => equivalents[diagnostic.code]);
  const implemented = entries.filter(entry => entry?.status === 'implemented').length;
  const partial = entries.filter(entry => entry?.status === 'partial').length;
  return `${implemented} native replacements · ${partial} partial replacements · ${entries.length - implemented - partial} unmapped source findings`;
}
function renderDiagnostic(component, diagnostic) {
  const platforms = ['ios', 'android'];
  const mapped = platforms.every(platform => component.support?.[platform]?.nativeEquivalents?.[diagnostic.code]?.status === 'implemented');
  return `<div class="diagnostic${mapped ? ' mapped' : ''}"><span class="diag-symbol" aria-hidden="true">${mapped ? '✓' : '△'}</span><div class="diagnostic-body"><code>${escape(diagnostic.code || diagnostic.severity || 'PORTABILITY')}${diagnostic.line ? ` · source line ${escape(diagnostic.line)}` : ''}</code><p>${escape(diagnostic.message || diagnostic.description)}</p><div class="native-equivalents">${platforms.map(platform => {
    const equivalent = component.support?.[platform]?.nativeEquivalents?.[diagnostic.code];
    const name = platform === 'ios' ? 'SwiftUI' : 'Compose';
    if (!equivalent) return `<div class="native-equivalent unmapped"><strong>${name} · not mapped</strong><p>No native replacement is declared for this source finding.</p></div>`;
    const demoExample = diagnostic.code === 'HTML_FORM' ? 'button-behavior' : ['DOM_GLOBAL', 'CANCELABLE_EVENT'].includes(diagnostic.code) ? 'navigation-events' : '';
    const demoLabel = diagnostic.code === 'HTML_FORM' ? 'form' : 'navigation & events';
    const demo = component.tag === 'md-button' && demoExample
      ? `<p><a href="?platform=${platform}&amp;example=${demoExample}#md-button">Try the ${name} ${demoLabel} →</a></p>` : '';
    return `<div class="native-equivalent ${equivalent.status === 'implemented' ? 'implemented' : 'partial'}"><strong>${name} · ${equivalent.status === 'implemented' ? 'Native replacement' : 'Partial replacement'}</strong><p><code>${escape(equivalent.api)}</code></p><p>${escape(equivalent.description)}</p>${equivalent.limitations?.length ? `<ul>${equivalent.limitations.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : ''}${demo}</div>`;
  }).join('')}</div></div></div>`;
}
function renderInspector() {
  const component = state.selected; const root = $('#inspector-content');
  $('#copy-source').hidden = state.inspector !== 'source';
  state.renderVersion++;
  if (state.inspector === 'contract') {
    root.innerHTML = `<div class="contract-grid"><div class="contract-section"><h4>Public properties · ${component.properties.length}</h4>${component.properties.slice(0, 5).map(prop => `<div class="contract-property"><code>${escape(prop.name)}</code><span title="${escape(prop.type)}">${escape(prop.type)}</span></div>`).join('') || '<p>No public properties.</p>'}${component.properties.length > 5 ? `<span class="more-contract">+ ${component.properties.length - 5} more in the property editor</span>` : ''}</div><div class="contract-section"><h4>Events · ${component.events.length}</h4>${component.events.slice(0, 7).map(event => `<p><code>${escape(event.name)}</code></p>`).join('') || '<p>No custom events declared.</p>'}${component.events.length > 7 ? `<p>+ ${component.events.length - 7} more in the source contract</p>` : ''}</div><div class="contract-section"><h4>Content & methods</h4><p>${component.slots.length ? component.slots.map(slot => `<code>${escape(slot.name || 'default')}</code>`).join(' · ') : 'No slots declared.'}</p><p>${component.methods?.length || 0} public methods</p><p>Extracted from the source contract.</p>${component.irPath ? `<p><a href="${escape(sourceURL(component.irPath))}" target="_blank" rel="noopener">Open component IR ↗</a></p>` : ''}</div></div>`;
  } else if (state.inspector === 'source') { void renderSource(state.renderVersion); }
  else if (state.inspector === 'diagnostics') {
    const diagnostics = component.diagnostics || []; const findings = portabilityFindings(component);
    root.innerHTML = `<div class="diagnostics"><p class="source-note">${findings.source} source findings · ${findings.ios} iOS API gaps · ${findings.android} Android API gaps. Source findings remain visible after a native replacement is added. Each mapping below describes the behavior implemented and its remaining limits.</p><div class="support-summary">${['ios', 'android'].map(platform => {
      const support = component.support?.[platform]; const status = support?.status || support?.level || 'No policy reported';
      return `<div class="support-card"><h4>${platform === 'ios' ? 'iOS · SwiftUI' : 'Android · Compose'}</h4><p><strong>${escape(status)}</strong></p><p class="equivalent-count">${escape(nativeEquivalentSummary(component, platform))}</p>${support ? `<p class="support-count${support.unsupportedProperties?.length ? '' : ' complete'}">${support.properties?.length || 0} supported / ${support.unsupportedProperties?.length || 0} unsupported properties</p><p>${support.events?.length || 0} supported / ${support.unsupportedEvents?.length || 0} unsupported events</p><p>${support.unsupportedMethods?.length || 0} unsupported methods · ${support.unsupportedSlots?.length || 0} unsupported slots</p><details><summary>Inspect coverage details</summary>${Object.entries(support).filter(([key]) => !['status', 'level', 'nativeEquivalents'].includes(key)).map(([key, value]) => `<p><code>${escape(key)}</code>: ${escape(Array.isArray(value) ? value.map(item => typeof item === 'string' ? item || 'default slot' : JSON.stringify(item)).join(', ') || 'None' : typeof value === 'object' ? JSON.stringify(value) : value)}</p>`).join('')}</details>` : '<p>Generate the native catalog to inspect platform coverage.</p>'}<p>Native mappings are scoped to this component. Full source parity remains a separate verification.</p>${component.tag === 'md-button' ? `<p><a href="?platform=${platform}&amp;example=focus-accessibility#md-button">Try ${platform === 'ios' ? 'SwiftUI' : 'Compose'} focus &amp; accessibility →</a></p>` : ''}</div>`;
    }).join('')}</div>${!state.catalog ? '<div class="load-error">Compiler diagnostics are unavailable. Run the native generation command and reload this page.</div>' : diagnostics.length ? diagnostics.map(diagnostic => renderDiagnostic(component, diagnostic)).join('') : '<p class="empty-state">No static portability findings reported.<br />This does not establish runtime behavior or native parity.</p>'}</div>`;
  } else {
    root.innerHTML = `<div class="event-toolbar"><span>Component events · latest 100</span><button id="clear-events" class="text-button">Clear</button></div>${state.events.length ? `<div class="event-log">${state.events.map(event => `<div class="event-row"><time>${event.time}</time><div><code>${escape(event.name)}</code><small class="event-origin">${escape(event.origin || 'Web reference')}</small></div><pre>${escape(JSON.stringify(event.native ? { detail: event.detail, native: event.native } : event.detail))}</pre></div>`).join('')}</div>` : '<p class="empty-state">Interact with the web reference or live native preview to see emitted events.<br />Native records come from the running native app.</p>'}`;
    $('#clear-events').addEventListener('click', () => { state.events = []; text('#event-count', '0'); renderInspector(); });
  }
}
async function renderSource(version) {
  const component = state.selected; const root = $('#inspector-content');
  const platform = state.sourcePlatform; const implementation = platform === 'ios' ? component.sources?.swiftImplementation : component.sources?.kotlinImplementation; const path = platform === 'ios' ? component.swiftPath : component.kotlinPath;
  root.innerHTML = `<div class="source-bar"><select id="source-platform" aria-label="Generated source platform"><option value="ios" ${platform === 'ios' ? 'selected' : ''}>SwiftUI · Swift</option><option value="android" ${platform === 'android' ? 'selected' : ''}>Compose · Kotlin</option></select><code>${escape(path || 'No generated source available')}</code>${sourceURL(path) ? `<a href="${escape(sourceURL(path))}" target="_blank" rel="noopener">Full file ↗</a>${sourceURL(implementation) ? `<a href="${escape(sourceURL(implementation))}" target="_blank" rel="noopener">Runtime ↗</a>` : ''}` : ''}</div><p class="source-note">Actual compiler output from this checkout. Generated wrappers use the native runtime; this view is not a native build or a behavior test.</p><pre class="source-code" id="generated-source">${path ? 'Reading generated source…' : 'Run the native compiler to generate platform source files.'}</pre>`;
  $('#source-platform').addEventListener('change', event => { state.sourcePlatform = event.target.value; renderInspector(); });
  state.sourceText = '';
  if (!sourceURL(path)) return;
  try {
    let source = state.sourceCache.get(path);
    if (!source) { const response = await fetch(sourceURL(path)); if (!response.ok) throw new Error(`Generated file unavailable (${response.status}). Run the compiler and reload.`); source = await response.text(); state.sourceCache.set(path, source); }
    if (version !== state.renderVersion) return;
    const lines = source.split('\n');
    const typeName = `AWC${(component.className || '').replace(/^Md/, '') || displayName(component.tag).replaceAll(' ', '')}`;
    const search = lines.findIndex(line => line.includes(`struct ${typeName}Properties`) || line.includes(`data class ${typeName}Properties`));
    const wrapper = lines.findIndex(line => line.includes(`struct ${typeName}: View`) || line.includes(`fun ${typeName}(`));
    let snippet = source;
    if (search >= 0 && wrapper > search) {
      const end = lines.findIndex((line, index) => index > wrapper && line === '}') + 1;
      snippet = lines.slice(search, end || lines.length).join('\n').trimEnd();
      $('.source-note').textContent = `Actual generated ${typeName} properties and declaration, lines ${search + 1}–${end}. Open the full file for enums and imports, or Runtime for the implementation. Generation does not establish behavior parity.`;
    }
    state.sourceText = snippet; text('#generated-source', snippet);
  } catch (error) { if (version === state.renderVersion) text('#generated-source', error.message); }
}
void init();
