import { literalChoices, encodeLiteralChoice, decodeLiteralChoice, literalChoiceLabel, portabilityFindings, createLatestRequest, nativeRenderRequest } from './contracts.js';
import { recipeFor, categoryFor, categoryOrder, displayName, icons } from './recipes.js';

const $ = selector => document.querySelector(selector);
const state = { components: [], selected: null, platform: 'web', inspector: 'contract', filter: 'all', props: {}, events: [], catalog: null, ready: false, target: null, sourcePlatform: 'ios', sourceText: '', sourceCache: new Map(), renderVersion: 0 };
const nativeRequests = createLatestRequest();
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
  return manifest.modules.flatMap(module => module.declarations || []).filter(component => component.tagName).map(component => ({
    tag: component.tagName, name: component.name, category: categoryFor(component.tagName), description: component.description || component.summary || '',
    properties: (component.members || []).filter(member => member.kind === 'field' && member.privacy !== 'private').map(member => ({ name: member.name, type: member.type?.text || 'unknown', default: member.default, defaultValue: parseDefault(member.default), options: Array.from((member.type?.text || '').matchAll(/'([^']*)'/g), match => match[1]) })),
    events: (component.events || []).map(event => ({ name: event.name, detail: event.type?.text || '' })), slots: component.slots || [], methods: (component.members || []).filter(member => member.kind === 'method'), diagnostics: [], support: {},
  }));
}
async function getJSON(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }

async function init() {
  try {
    try { if (localStorage.getItem('awc-native-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch { /* Storage may be disabled. */ }
    updateThemeLabel();
    const [manifestResult, catalogResult, runtimeResult] = await Promise.allSettled([
      getJSON('/repo/packages/core/custom-elements.json'), getJSON('/repo/packages/native-compiler/generated/catalog.json'), import('/web-dist/md3/md3.esm.js'),
    ]);
    if (manifestResult.status !== 'fulfilled') throw new Error('Unable to read the AWC component manifest. Start the server from the repository checkout.');
    const contracts = normalizeManifest(manifestResult.value);
    state.catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
    const generated = new Map((state.catalog?.components || []).map(component => [component.tag, component]));
    state.components = contracts.map(component => {
      const output = generated.get(component.tag);
      return output ? { ...component, ...output, category: categoryFor(component.tag), properties: (output.properties || component.properties).map(prop => ({ ...prop, type: typeof prop.type === 'object' ? prop.type.text : prop.type, defaultValue: Object.hasOwn(prop, 'defaultValue') ? prop.defaultValue : parseDefault(prop.default), options: prop.options || Array.from((typeof prop.type === 'string' ? prop.type : '').matchAll(/'([^']*)'/g), match => match[1]) })) } : component;
    });
    state.ready = runtimeResult.status === 'fulfilled';
    text('#component-count', state.components.length); text('#coverage-count', state.components.length);
    $('#compiler-status').innerHTML = `<i></i>${state.catalog ? 'Generated catalog connected' : 'Source manifest only'}`;
    text('#pipeline-state', state.catalog ? `${generated.size} contracts · ${state.components.reduce((count, component) => count + portabilityFindings(component).total, 0)} findings` : 'Run native:build to inspect output');
    const hashTag = location.hash.slice(1);
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
  $('#component-list').addEventListener('click', event => { const button = event.target.closest('[data-tag]'); if (button) { location.hash = button.dataset.tag; if (state.selected?.tag === button.dataset.tag) selectComponent(button.dataset.tag); } });
  window.addEventListener('hashchange', () => { const tag = location.hash.slice(1); if (state.components.some(component => component.tag === tag)) selectComponent(tag); });
  $('#theme-toggle').addEventListener('click', () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('awc-native-theme', dark ? 'dark' : 'light'); } catch { /* Optional storage. */ } updateThemeLabel(); scheduleNativeRender(); });
  $('#reset').addEventListener('click', () => { selectComponent(state.selected.tag); toast('Component properties reset'); });
  document.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', () => selectPlatform(button.dataset.platform)));
  document.querySelectorAll('[data-inspector]').forEach(button => button.addEventListener('click', () => selectInspector(button.dataset.inspector)));
  $('#copy-source').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.sourceText); toast('Generated source copied'); } catch { toast('Clipboard unavailable in this browser'); } });
  document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); $('#search').focus(); } });
}
function updateThemeLabel() { const dark = document.documentElement.dataset.theme === 'dark'; $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); $('#theme-toggle').textContent = dark ? '☼' : '◐'; }
function selectPlatform(platform) {
  if (!['web', 'ios', 'android'].includes(platform)) return;
  state.platform = platform;
  const url = new URL(location.href);
  if (platform === 'web') url.searchParams.delete('platform'); else url.searchParams.set('platform', platform);
  history.replaceState(null, '', url);
  document.querySelectorAll('[data-platform]').forEach(button => { const active = button.dataset.platform === platform; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  if (platform !== 'web') { state.sourcePlatform = platform; selectInspector('source'); }
  renderPreview();
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
  for (const prop of component.properties || []) { if (prop.defaultValue !== undefined) state.props[prop.name] = structuredClone(prop.defaultValue); }
  Object.assign(state.props, recipeFor(tag).props);
  text('#category-label', component.category); text('#tag-label', tag); text('#component-title', displayName(tag)); text('#component-description', component.description);
  text('#props-count', component.properties.length); text('#findings-count', portabilityFindings(component).total); text('#event-count', '0');
  renderNavigation(); renderPreview(); renderProperties(); renderInspector();
}
function renderPreview() {
  clearTimeout(state.nativeRenderTimer); nativeRequests.cancel();
  const root = $('#preview-content'); root.replaceChildren(); state.target = null;
  const isWeb = state.platform === 'web'; $('#preview-stage').classList.toggle('native-mode', !isWeb);
  $('#preview-stage').classList.toggle('snapshot-mode', state.platform === 'ios');
  text('#preview-runtime', isWeb ? 'LIVE WEB' : state.platform === 'ios' ? 'NATIVE SNAPSHOT' : 'NATIVE TARGET');
  text('.props-hint', state.platform === 'ios' ? 'Changes rerender the native snapshot.' : 'Changes apply to the web reference.');
  if (state.platform === 'ios') { renderNativePreview(); return; }
  if (!isWeb) {
    const ios = state.platform === 'ios'; const path = ios ? state.selected.swiftPath : state.selected.kotlinPath;
    const support = state.selected.support?.[state.platform];
    const status = support?.status || support?.level || (path ? 'Source generated' : 'Not generated');
    root.innerHTML = `<div class="native-card"><div class="native-symbol" aria-hidden="true">${ios ? '◇' : '⌘'}</div><h3>${ios ? 'SwiftUI' : 'Jetpack Compose'} target</h3><span class="native-status">${escape(status)} · native execution required</span><p>${support ? `${support.unsupportedProperties?.length || 0} unsupported properties · ${support.unsupportedEvents?.length || 0} unsupported events` : 'Adapter coverage has not been reported.'}</p><p>Inspect the real generated source below. Open the native playground to run this component with platform controls.</p><div class="native-command"><code>${ios ? 'open apps/native-ios-playground/AWCPlayground.xcodeproj' : 'Open apps/native-android-playground in Android Studio'}</code></div></div>`;
    text('#preview-caption', 'Source inspection · this browser does not render native views'); text('#recipe-status', 'Device/simulator validation separate'); return;
  }
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
  const eventNames = new Set(['click', ...(state.selected.events || []).map(event => event.name)]);
  for (const eventName of eventNames) root.addEventListener(eventName, recordEvent);
  root.addEventListener('click', event => { if (event.composedPath().some(element => element?.tagName === 'A')) event.preventDefault(); });
  text('#preview-caption', 'Original AWC web component · browser rendering'); text('#recipe-status', recipe.note);
}

function renderNativePreview() {
  const component = state.selected;
  const support = component.support?.ios;
  $('#preview-content').innerHTML = `<section class="native-snapshot" aria-label="SwiftUI native snapshot"><div class="snapshot-heading"><div><h3><span aria-hidden="true">◇</span> SwiftUI · macOS native render</h3><p>${escape(displayName(component.tag))} · native AWC adapter</p></div><button class="secondary-button" id="native-render-button" type="button">Render again</button></div><div class="snapshot-frame" id="native-render-frame" aria-busy="true"></div><p class="snapshot-status" id="native-render-status" role="status" aria-live="polite"></p><p class="snapshot-note">Static snapshot — interact in the native app. For iOS, open the native playground.</p><details class="snapshot-details"><summary>Fixture & native playground</summary><p>The native example uses this component’s root properties. Its child content and text may differ from the web reference.</p><p>${support ? `${support.unsupportedProperties?.length || 0} unsupported properties · ${support.unsupportedEvents?.length || 0} unsupported events. Inspect full coverage in Portability.` : 'Adapter coverage has not been reported.'}</p><code>open apps/native-ios-playground/AWCPlayground.xcodeproj</code></details></section>`;
  $('#native-render-button').addEventListener('click', () => scheduleNativeRender(0));
  text('#preview-caption', 'Rendered by SwiftUI on this Mac · displayed as a PNG');
  text('#recipe-status', 'Native fixture + current root properties');
  scheduleNativeRender(0);
}

function nativeRenderState(kind, message) {
  const frame = $('#native-render-frame');
  if (!frame) return;
  frame.dataset.state = kind;
  frame.setAttribute('aria-busy', String(kind === 'loading'));
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
  text('#native-render-button', kind === 'error' ? 'Retry render' : kind === 'loading' ? 'Restart render' : 'Render again');
}

function scheduleNativeRender(delay = 300) {
  if (state.platform !== 'ios' || !$('#native-render-frame')) return;
  clearTimeout(state.nativeRenderTimer);
  const request = nativeRequests.start();
  const payload = nativeRenderRequest(state.selected.tag, state.props, document.documentElement.dataset.theme === 'dark');
  nativeRenderState('loading', delay ? 'Waiting for property changes…' : 'Checking the native renderer…');
  state.nativeRenderTimer = setTimeout(() => fetchNativeRender(payload, request), delay);
}

async function fetchNativeRender(payload, request) {
  const current = () => request.isCurrent() && state.platform === 'ios' && state.selected.tag === payload.tag;
  async function readResponse(response) {
    let result;
    try { result = await response.json(); } catch { throw new Error(`The render server returned an invalid response (${response.status}). Restart the playground server and retry.`); }
    if (!response.ok) throw new Error(result.message || result.error || `Native rendering failed (${response.status}).`);
    return result;
  }
  try {
    const status = await readResponse(await fetch('/api/native-render/status', { signal: request.signal }));
    if (!current()) return;
    if (!status.available) throw new Error(status.message || 'The SwiftUI renderer is not available on this host.');
    text('#native-render-status', 'SwiftUI is rendering this component on your Mac…');
    const result = await readResponse(await fetch('/api/native-render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: request.signal }));
    if (!current()) return;
    if (result.tag !== payload.tag || result.platform !== 'macos' || result.renderer !== 'SwiftUI' || !/^\/native-renders\/[a-f\d]+\.png$/.test(result.imageUrl || '')) throw new Error('The renderer returned an unexpected component or image. Retry this render.');
    const snapshot = new Image();
    snapshot.className = 'snapshot-image';
    snapshot.style.width = `${payload.width}px`; // PNG pixels may be 2× the logical SwiftUI width on Retina displays.
    snapshot.alt = `${displayName(payload.tag)} rendered natively by SwiftUI on macOS in ${payload.dark ? 'dark' : 'light'} mode`;
    snapshot.addEventListener('load', () => {
      if (!current()) return;
      nativeRenderState('ready', `${result.width} × ${result.height} px · ${payload.dark ? 'Dark' : 'Light'} appearance · ${payload.tag}`);
      $('#native-render-frame').append(snapshot);
    }, { once: true });
    snapshot.addEventListener('error', () => { if (current()) nativeRenderState('error', 'The native render completed, but the snapshot could not be loaded. Retry the render.'); }, { once: true });
    snapshot.src = result.imageUrl;
  } catch (error) {
    if (current() && error.name !== 'AbortError') nativeRenderState('error', error.message || 'The native render failed. Retry the render.');
  }
}

function renderProperties() {
  const fields = state.selected.properties || [];
  const preferred = ['label', 'headline', 'variant', 'size', 'shape', 'value', 'selected', 'checked', 'disabled', 'loading', 'icon', 'supportingText', 'options', 'series', 'data', 'nodes'];
  const sorted = [...fields].sort((a, b) => { const ai = preferred.indexOf(a.name), bi = preferred.indexOf(b.name); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); });
  $('#props-controls').innerHTML = sorted.map(prop => {
    const value = state.props[prop.name]; const id = `prop-${prop.name}`; const type = prop.type || ''; const choices = literalChoices(prop);
    if (type === 'boolean') return `<div class="prop-control boolean"><label class="prop-label" for="${id}"><code>${escape(prop.name)}</code><input id="${id}" data-prop="${escape(prop.name)}" class="switch-control" type="checkbox" ${value ? 'checked' : ''} /></label></div>`;
    let input;
    if (type.includes('=>') || type.includes('HTMLElement')) input = `<p class="prop-note">Function or DOM reference. Inspect this contract in Portability.</p>`;
    else if (choices.length > 1) input = `<select id="${id}" data-prop="${escape(prop.name)}" data-literal="true">${choices.some(option => Object.is(option, value)) ? '' : '<option value="" selected disabled>Unset</option>'}${choices.map(option => `<option value="${escape(encodeLiteralChoice(option))}" ${Object.is(value, option) ? 'selected' : ''}>${escape(literalChoiceLabel(option, choices))}</option>`).join('')}</select>`;
    else if (typeof value === 'object' && value !== null || /\[\]|\{|MdChartAxis|NodeInput|Options/.test(type) && !['string', 'number'].includes(type)) input = `<textarea id="${id}" data-prop="${escape(prop.name)}" data-json="true" spellcheck="false" aria-describedby="${id}-error">${escape(JSON.stringify(value ?? [], null, 2))}</textarea><span class="prop-error" id="${id}-error" hidden></span>`;
    else input = `<input id="${id}" data-prop="${escape(prop.name)}" type="${/^number( \| null)?$/.test(type) ? 'number' : 'text'}" ${/^number/.test(type) ? 'step="any"' : ''} value="${escape(value ?? '')}" placeholder="${escape(prop.default ?? '')}" />`;
    return `<div class="prop-control"><label class="prop-label" for="${id}"><code>${escape(prop.name)}</code><span class="prop-type" title="${escape(type)}">${escape(type)}</span></label>${input}</div>`;
  }).join('') || '<p class="prop-note">This structural component has no public properties. Explore it through its parent composition.</p>';
  $('#props-controls').querySelectorAll('[data-prop]').forEach(input => input.addEventListener('input', () => {
    let value;
    if (input.dataset.literal) value = decodeLiteralChoice(input.value, state.selected.properties.find(prop => prop.name === input.dataset.prop));
    else if (input.dataset.json) { try { value = JSON.parse(input.value); input.setAttribute('aria-invalid', 'false'); $(`#${input.id}-error`).hidden = true; } catch { input.setAttribute('aria-invalid', 'true'); $(`#${input.id}-error`).hidden = false; $(`#${input.id}-error`).textContent = 'Enter valid JSON to update the reference.'; return; } }
    else value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value;
    state.props[input.dataset.prop] = value;
    if (state.editedTag !== state.selected.tag) { state.editedTag = state.selected.tag; state.editedProps = {}; }
    state.editedProps[input.dataset.prop] = value;
    if (state.target) state.target[input.dataset.prop] = value;
    scheduleNativeRender();
  }));
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
}
function recordEvent(event) {
  if (state.platform !== 'web') return;
  requestAnimationFrame(syncReferenceState);
  let detail = event.detail;
  if (detail && typeof detail === 'object') { try { detail = JSON.parse(JSON.stringify(detail, (_, value) => value instanceof Element ? `<${value.tagName.toLowerCase()}>` : value)); } catch { detail = '[Non-serializable event detail]'; } }
  state.events.unshift({ name: event.type, time: new Date().toLocaleTimeString('en-GB'), detail: detail === undefined ? null : detail });
  state.events = state.events.slice(0, 100); text('#event-count', state.events.length); if (state.inspector === 'events') renderInspector();
}
function selectInspector(tab) {
  state.inspector = tab; document.querySelectorAll('[data-inspector]').forEach(button => { const active = button.dataset.inspector === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); }); renderInspector();
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
    root.innerHTML = `<div class="diagnostics"><p class="source-note">${findings.source} static source diagnostics · ${findings.ios} iOS API gaps · ${findings.android} Android API gaps. Counts include unsupported properties, events, methods, slots, and missing adapters.</p><div class="support-summary">${['ios', 'android'].map(platform => {
      const support = component.support?.[platform]; const status = support?.status || support?.level || 'No policy reported';
      return `<div class="support-card"><h4>${platform === 'ios' ? 'iOS · SwiftUI' : 'Android · Compose'}</h4><p><strong>${escape(status)}</strong></p>${support ? `<p class="support-count">${support.properties?.length || 0} supported / ${support.unsupportedProperties?.length || 0} unsupported properties</p><p>${support.events?.length || 0} supported / ${support.unsupportedEvents?.length || 0} unsupported events</p><p>${support.unsupportedMethods?.length || 0} unsupported methods · ${support.unsupportedSlots?.length || 0} unsupported slots</p><details><summary>Inspect coverage details</summary>${Object.entries(support).filter(([key]) => !['status', 'level'].includes(key)).map(([key, value]) => `<p><code>${escape(key)}</code>: ${escape(Array.isArray(value) ? value.map(item => typeof item === 'string' ? item || 'default slot' : JSON.stringify(item)).join(', ') || 'None' : typeof value === 'object' ? JSON.stringify(value) : value)}</p>`).join('')}</details>` : '<p>Generate the native catalog to inspect platform coverage.</p>'}<p>Adapter implemented does not mean source parity. Validate behavior in the native playground.</p></div>`;
    }).join('')}</div>${!state.catalog ? '<div class="load-error">Compiler diagnostics are unavailable. Run the native generation command and reload this page.</div>' : diagnostics.length ? diagnostics.map(diagnostic => `<div class="diagnostic"><span class="diag-symbol" aria-hidden="true">△</span><div><code>${escape(diagnostic.code || diagnostic.severity || 'PORTABILITY')}${diagnostic.line ? ` · line ${escape(diagnostic.line)}` : ''}</code><p>${escape(diagnostic.message || diagnostic.description)}</p></div></div>`).join('') : '<p class="empty-state">No static portability findings reported.<br />This does not establish runtime behavior or native parity.</p>'}</div>`;
  } else {
    root.innerHTML = `<div class="event-toolbar"><span>Web reference events · latest 100</span><button id="clear-events" class="text-button">Clear</button></div>${state.events.length ? `<div class="event-log">${state.events.map(event => `<div class="event-row"><time>${event.time}</time><code>${escape(event.name)}</code><pre>${escape(JSON.stringify(event.detail))}</pre></div>`).join('')}</div>` : '<p class="empty-state">Interact with the web reference to see emitted events.<br />Native events are logged in each platform playground.</p>'}`;
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
