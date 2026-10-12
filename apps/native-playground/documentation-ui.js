import { memberDocumentation } from './documentation.js';
import { usageSnippet, snippetLanguages } from './usage-snippets.js';
import { recipeFor } from './recipes.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const prose = value => escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/** Explicit fixture/edited values plus values that actually differ from defaults. */
export function snippetProperties(state) {
  const recipe = recipeFor(state.selected.tag);
  const edited = state.editedTag === state.selected.tag ? state.editedProps || {} : {};
  const declared = new Map((state.selected.properties || []).map(property => [property.name, property]));
  return Object.fromEntries(Object.entries(state.props || {}).filter(([name, value]) => {
    if (!declared.has(name) || value === undefined) return false;
    if (Object.hasOwn(recipe.props, name) || Object.hasOwn(edited, name)) return true;
    const property = declared.get(name);
    return JSON.stringify(value) !== JSON.stringify(property.defaultValue);
  }));
}

export function createDocumentationUI({ getState, watchEvents, notify, afterInteraction }) {
  const help = new Map();
  const tooltip = document.createElement('div');
  tooltip.id = 'documentation-tooltip'; tooltip.className = 'documentation-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true;
  document.body.append(tooltip);
  let trigger, pinned = false, hideTimer, sequence = 0, renderedTag, renderGeneration = 0, snippetLanguage = 'html';
  const hide = () => { clearTimeout(hideTimer); trigger?.removeAttribute('aria-describedby'); tooltip.hidden = true; trigger = undefined; pinned = false; };
  const position = () => {
    if (!trigger?.isConnected) { hide(); return; }
    const rect = trigger.getBoundingClientRect();
    const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const left = rect.left > width + 20 ? rect.left - width - 10 : rect.right + 10;
    tooltip.style.left = `${Math.max(12, Math.min(left, innerWidth - width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(rect.top - 8, innerHeight - height - 12))}px`;
  };
  function show(button) {
    clearTimeout(hideTimer);
    if (trigger === button && !tooltip.hidden) return;
    hide(); trigger = button;
    const doc = help.get(button.dataset.docInfo);
    if (!doc) return;
    const values = doc.options?.length ? doc.options.map(value => JSON.stringify(value)).join(' · ') : '';
    tooltip.innerHTML = `<strong class="doc-tooltip-title">${escape(doc.name || 'Default slot')}</strong><p>${prose(doc.description)}</p>
      <dl>${doc.type ? `<dt>Type</dt><dd><code>${escape(doc.type)}</code></dd>` : ''}${Object.hasOwn(doc, 'default') && doc.default !== undefined ? `<dt>Default</dt><dd><code>${escape(doc.default === '' ? 'Not declared' : doc.default)}</code></dd>` : ''}${doc.attribute ? `<dt>Attribute</dt><dd><code>${escape(doc.attribute)}</code></dd>` : ''}${values ? `<dt>Values</dt><dd><code>${escape(values)}</code></dd>` : ''}</dl>
      ${doc.kind === 'event' ? `<p>Source web event: ${['cancelable', 'bubbles', 'composed'].filter(key => typeof doc[key] === 'boolean').map(key => `${key}: ${doc[key]}`).join(' · ') || 'flags not declared'}</p>` : ''}
      ${doc.parameters?.length ? `<strong class="doc-tooltip-label">Parameters</strong>${doc.parameters.map(parameter => `<p><code>${escape(parameter.name)}${parameter.optional ? '?' : ''}: ${escape(parameter.type?.text || parameter.type || 'unknown')}</code>${parameter.description ? `<br>${prose(parameter.description)}` : ''}</p>`).join('')}` : ''}
      ${doc.returnType && doc.returnType !== 'inferred' ? `<p>Returns <code>${escape(doc.returnType)}</code></p>` : ''}
      ${doc.usage ? `<p>${prose(doc.usage)}</p>` : ''}<p class="doc-support">${escape(doc.support?.description || '')}</p>`;
    tooltip.hidden = false; button.setAttribute('aria-describedby', tooltip.id); position();
  }
  const deferHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!pinned && !tooltip.matches(':hover') && document.activeElement !== trigger) hide(); }, 160);
  };
  document.addEventListener('pointerover', event => { const button = event.target.closest?.('[data-doc-info]'); if (button) show(button); });
  document.addEventListener('pointerout', event => { if (event.target.closest?.('[data-doc-info]')) deferHide(); });
  document.addEventListener('focusin', event => { if (event.target.matches?.('[data-doc-info]')) show(event.target); });
  document.addEventListener('focusout', event => { if (event.target.matches?.('[data-doc-info]')) deferHide(); });
  tooltip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  tooltip.addEventListener('pointerleave', deferHide);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-doc-info]');
    if (button) { if (trigger === button && pinned) hide(); else { show(button); pinned = true; } }
    else if (!tooltip.contains(event.target)) hide();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !tooltip.hidden) { hide(); event.preventDefault(); } });
  window.addEventListener('resize', hide);
  document.addEventListener('scroll', event => { if (!tooltip.hidden && !tooltip.contains(event.target)) hide(); }, true);

  function infoButton(kind, member) {
    const state = getState(), key = String(++sequence);
    help.set(key, memberDocumentation(state.selected, kind, member, state.platform));
    return `<md-icon-button class="doc-info" data-doc-info="${key}" icon="info" size="xs" aria-label="About ${escape(member.name || 'the default slot')}"></md-icon-button>`;
  }
  function filterProperties() {
    const query = (document.querySelector('#props-search')?.value || '').trim().toLowerCase();
    const rows = [...document.querySelectorAll('#props-controls .prop-control')];
    for (const row of rows) row.hidden = !row.dataset.search.includes(query);
    const empty = document.querySelector('#props-empty');
    if (empty) empty.hidden = !rows.length || rows.some(row => !row.hidden);
  }
  document.querySelector('#props-search')?.addEventListener('mdInput', filterProperties);

  function snippet() {
    const state = getState(), recipe = recipeFor(state.selected.tag);
    // Never serialize the mounted preview: it belongs to a separate document and
    // contains runtime hydration, accessibility and interaction state.
    const template = document.createElement('template');
    template.innerHTML = recipe.html;
    const target = template.content.querySelector(state.selected.tag);
    if (target) applyOverrides(target);
    return usageSnippet(state.selected, snippetProperties(state), snippetLanguage, { html: template.innerHTML, ...(Object.hasOwn(state.docSlotValues || {}, '') ? { text: state.docSlotValues[''] } : {}) });
  }
  function updateSnippet() {
    const code = document.querySelector('#usage-snippet');
    if (code) { code.textContent = snippet(); code.dataset.language = snippetLanguages.find(language => language.id === snippetLanguage)?.language || snippetLanguage; }
  }
  function applyOverrides(target = getState().target) {
    const state = getState();
    if (!target) return;
    for (const [name, value] of Object.entries(state.docSlotValues || {})) {
      for (const child of [...target.childNodes]) {
        const slot = child.nodeType === 1 ? child.getAttribute('slot') || '' : '';
        if (slot === name) child.remove();
      }
      const content = (target.ownerDocument || document).createElement('span'); if (name) content.slot = name;
      content.textContent = value; target.append(content);
    }
    for (const [name, value] of Object.entries(state.docCssValues || {})) { if (value) target.style.setProperty(name, value); else target.style.removeProperty(name); }
  }
  function memberRow(kind, member, content = '') {
    const state = getState(), doc = memberDocumentation(state.selected, kind, member, state.platform);
    const status = doc.support?.status;
    return `<div class="usage-member"><div class="usage-member-heading"><code>${escape(member.name || 'Default slot')}</code>${infoButton(kind, member)}</div>
      <p>${prose(doc.description)}</p>${status === 'unsupported' || status === 'unknown' ? `<span class="usage-support">${escape(doc.support.description)}</span>` : ''}${content}</div>`;
  }
  function renderUsage() {
    const state = getState(), component = state.selected, web = state.platform === 'web';
    const root = document.querySelector('#usage-docs');
    const sameComponent = renderedTag === component.tag;
    const openSections = sameComponent ? new Map([...root.querySelectorAll('[data-usage-section]')].map(section => [section.dataset.usageSection, section.open])) : new Map();
    const methodArguments = sameComponent ? new Map([...root.querySelectorAll('[data-method-name]')].map(input => [input.dataset.methodName, input.value])) : new Map();
    const focused = sameComponent && root.contains(document.activeElement) ? document.activeElement : null;
    const editor = focused?.shadowRoot?.activeElement || focused;
    const focus = focused?.id ? { id: focused.id, start: editor.selectionStart, end: editor.selectionEnd } : null;
    renderedTag = component.tag;
    const generation = ++renderGeneration;
    const section = (title, rows, body) => `<details class="usage-section" data-usage-section="${escape(title)}"><summary>${escape(title)}<span>${rows.length}</span></summary>${rows.length ? body : `<p class="usage-empty">No public ${escape(title.toLowerCase())} declared.</p>`}</details>`;
    const events = component.events || [], slots = component.slots || [], methods = component.methods || [], styles = component.cssProperties || [], parts = component.cssParts || [];
    root.innerHTML = `<div class="usage-intro"><p>Change properties and interact with the preview. Use <span aria-hidden="true">ⓘ</span> for details, defaults and platform support.</p><a href="/repo/packages/core/src/components/${escape(component.tag)}/readme.md" target="_blank" rel="noopener">Full component guide ↗</a></div>
      <section class="usage-example" aria-label="Live usage example"><div class="usage-code-heading"><md-tabs id="usage-language-tabs" variant="secondary" tab-width="auto" active-tab-index="${snippetLanguages.findIndex(language => language.id === snippetLanguage)}" aria-label="Code language">${snippetLanguages.map(language => `<md-tab label="${escape(language.label)}" data-snippet-language="${language.id}"></md-tab>`).join('')}</md-tabs><md-button type="button" id="copy-usage" variant="text" size="xs" icon="content_copy">Copy</md-button></div><pre id="usage-snippet" class="usage-code" tabindex="0" aria-label="Usage code"></pre></section>
      <div class="api-reference">${section('Events', events, `<md-button type="button" id="watch-usage-events" class="usage-action" variant="text" size="xs">Watch live events</md-button>${events.map(event => {
        const doc = memberDocumentation(component, 'event', event, state.platform);
        const payload = doc.payloadType?.body || doc.detail || event.detail || event.type?.text;
        return memberRow('event', event, payload ? `<details class="usage-type"><summary>Payload</summary><pre>${escape(payload)}</pre></details>` : '');
      }).join('')}`)}
      ${section('Slots', slots, `<p class="usage-empty">Edit plain slot text in the examples${web ? ' and Web preview' : ''}. Reset props restores the fixture.</p>${slots.map((slot, index) => memberRow('slot', slot, `<md-text-field id="slot-${index}" data-slot-index="${index}" label="${escape(slot.name || 'Default')} slot text" aria-label="${escape(slot.name || 'Default')} slot text" placeholder="Use fixture content" value="${escape(state.docSlotValues?.[slot.name] ?? '')}" density="-2" variant="outlined"></md-text-field>`)).join('')}`)}
      ${section('Methods', methods, `<p class="usage-empty">${web ? 'Arguments use a JSON array, for example ["Message"].' : 'Methods are documented here; browser invocation is available in the Web reference.'}</p>${methods.map((method, index) => {
        const doc = memberDocumentation(component, 'method', method, state.platform);
        const signature = method.signature || `${method.name}(${method.params || (method.parameters || []).map(p => `${p.name}: ${p.type?.text || p.type || 'unknown'}`).join(', ')})`;
        return memberRow('method', method, `<code class="usage-signature">${escape(signature)}</code>${doc.returnType && doc.returnType !== 'inferred' ? `<p>Returns <code>${escape(doc.returnType)}</code></p>` : ''}<md-text-field id="method-${index}" data-method-args="${index}" data-method-name="${escape(method.name)}" label="Arguments (JSON array)" value="${escape(methodArguments.get(method.name) ?? '[]')}" density="-2" variant="outlined" ${web ? '' : 'disabled'}></md-text-field><md-button type="button" class="usage-action" variant="tonal" size="xs" data-run-method="${index}" ${web ? '' : 'disabled'}>Run ${escape(method.name)}</md-button><output class="usage-result" id="method-result-${index}" aria-live="polite"></output>`);
      }).join('')}`)}
      ${section('CSS variables', styles, `<p class="usage-empty">Overrides update web framework examples${web ? ' and this Web preview' : ''}. Native styling uses native themes and supported props.</p>${styles.map((item, index) => memberRow('cssProperty', item, `<md-text-field id="css-${index}" data-css-index="${index}" aria-label="${escape(item.name)} value" placeholder="Inherited value" value="${escape(state.docCssValues?.[item.name] || '')}" density="-2" variant="outlined"></md-text-field>`)).join('')}`)}
      ${section('CSS parts', parts, parts.map(part => memberRow('cssPart', part, `<code class="usage-signature">${escape(component.tag)}::part(${escape(part.name)}) { … }</code>`)).join(''))}
      ${(component.dataTypes?.length || component.callableProps?.length) ? section('Data & callback types', [...(component.dataTypes || []), ...(component.callableProps || [])], [...(component.dataTypes || []).map(type => ['dataType', type]), ...(component.callableProps || []).map(type => ['callableProp', type])].map(([kind, type]) => memberRow(kind, type, `<pre class="usage-code">${escape(type.body || type.type?.text || type.type || '')}</pre>`)).join('')) : ''}</div>`;
    for (const section of root.querySelectorAll('[data-usage-section]')) if (openSections.has(section.dataset.usageSection)) section.open = openSections.get(section.dataset.usageSection);
    if (focus) {
      const next = document.getElementById(focus.id);
      if (next && root.contains(next) && !next.disabled) {
        next.focus({ preventScroll: true });
        const restore = input => { if (generation === renderGeneration && typeof input?.setSelectionRange === 'function' && focus.start != null) input.setSelectionRange(focus.start, focus.end); };
        if (typeof next.getInputElement === 'function') next.getInputElement().then(restore); else restore(next);
      }
    }
    updateSnippet();
    root.querySelector('#usage-language-tabs').addEventListener('mdTabChange', event => { const language = snippetLanguages[event.detail?.index]; if (language) { snippetLanguage = language.id; updateSnippet(); } });
    root.querySelector('#copy-usage').addEventListener('mdClick', async () => { try { await navigator.clipboard.writeText(snippet()); notify('Usage example copied'); } catch { notify('Clipboard unavailable'); } });
    root.querySelector('#watch-usage-events')?.addEventListener('mdClick', watchEvents);
    const valueFor = (event, input) => typeof event.detail === 'string' ? event.detail : input.value;
    root.querySelectorAll('[data-slot-index]').forEach(input => input.addEventListener('mdInput', event => { state.docSlotValues ||= {}; state.docSlotValues[slots[Number(input.dataset.slotIndex)].name] = valueFor(event, input); if (state.platform === 'web') applyOverrides(); updateSnippet(); }));
    root.querySelectorAll('[data-css-index]').forEach(input => input.addEventListener('mdInput', event => { state.docCssValues ||= {}; state.docCssValues[styles[Number(input.dataset.cssIndex)].name] = valueFor(event, input); if (state.platform === 'web') applyOverrides(); updateSnippet(); }));
    root.querySelectorAll('[data-run-method]').forEach(button => button.addEventListener('mdClick', async () => {
      const index = Number(button.dataset.runMethod), output = root.querySelector(`#method-result-${index}`), target = state.target;
      button.disabled = true;
      try {
        const args = JSON.parse(root.querySelector(`[data-method-args="${index}"]`).value);
        if (!Array.isArray(args)) throw new Error('Use a JSON array of arguments.');
        const method = methods[index].name;
        if (!target || typeof target[method] !== 'function') throw new Error('This method is unavailable in the current preview.');
        const result = await target[method](...args);
        if (generation !== renderGeneration || getState().target !== target) return;
        output.textContent = result?.nodeType === 1 && typeof result.tagName === 'string' ? `<${result.tagName.toLowerCase()}>` : result === undefined ? 'Done' : JSON.stringify(result);
        afterInteraction(); updateSnippet();
      } catch (error) { output.textContent = error.message; }
      finally { button.disabled = false; }
    }));
  }
  return { infoButton, renderUsage, updateSnippet, applyOverrides, filterProperties, beginRender() { hide(); help.clear(); } };
}
