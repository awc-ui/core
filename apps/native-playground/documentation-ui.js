import { memberDocumentation, eventPayloadDocumentation } from './documentation.js';
import { usageSnippet, snippetLanguages } from './usage-snippets.js';
import { recipeFor } from './recipes.js';
import { usageBrandIcon } from './brand-icons.js';
import { renderCode } from './syntax-highlighting.js';

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
  let activeTooltip, sequence = 0, renderedTag, renderGeneration = 0, snippetLanguage = 'html';
  const listeners = [];
  const listen = (target, name, callback, options) => {
    target?.addEventListener(name, callback, options);
    listeners.push(() => target?.removeEventListener(name, callback, options));
  };
  const hide = () => { if (activeTooltip) activeTooltip.open = false; activeTooltip = undefined; };
  const tooltipPosition = () => (window.matchMedia?.('(max-width: 640px)').matches ?? globalThis.innerWidth <= 640) ? 'bottom' : 'left-start';
  // Narrow screens have room above/below the trigger, not beside it. AWC still
  // handles flipping and viewport clamping; only the preferred side changes.
  listen(window, 'resize', () => {
    const position = tooltipPosition();
    for (const tooltip of document.querySelectorAll('[data-doc-tooltip]')) tooltip.position = position;
  });

  // md-tooltip owns positioning, hover/focus timers, aria-description and Escape.
  // Its lifecycle events do not bubble: capture coordinates one open help popup.
  listen(document, 'mdOpen', event => {
    const tooltip = event.target;
    if (!tooltip.matches?.('[data-doc-tooltip]')) return;
    if (activeTooltip !== tooltip) hide();
    activeTooltip = tooltip;
  }, true);
  listen(document, 'mdClose', event => { if (event.target === activeTooltip) activeTooltip = undefined; }, true);
  listen(document, 'mdClick', event => {
    const button = event.target.closest?.('[data-doc-info]');
    if (!button) return;
    const tooltip = button.closest('[data-doc-tooltip]');
    if (!tooltip) return;
    if (activeTooltip !== tooltip) hide();
    activeTooltip = tooltip;
    tooltip.open = true; // Immediate tap/click reveal through the public AWC API.
  });
  listen(document, 'click', event => { if (activeTooltip && !activeTooltip.contains(event.target)) hide(); });

  function infoButton(kind, member) {
    const state = getState(), key = String(++sequence);
    const doc = memberDocumentation(state.selected, kind, member, state.platform);
    const values = doc.options?.length ? doc.options.map(value => JSON.stringify(value)).join(' · ') : '';
    return `<md-tooltip class="documentation-tooltip" data-doc-tooltip="${key}" variant="rich" position="${tooltipPosition()}" show-delay="350" hide-delay="300">
      <md-icon-button class="doc-info" data-doc-info="${key}" icon="info" size="xs" aria-label="About ${escape(member.name || 'the default slot')}"></md-icon-button>
      <strong slot="subhead" class="doc-tooltip-title">${escape(doc.name || 'Default slot')}</strong>
      <div slot="content" class="doc-tooltip-content" tabindex="0" aria-label="${escape(doc.name || 'Default slot')} documentation">
        <p>${prose(doc.description)}</p>
        <dl>${doc.type ? `<dt>Type</dt><dd><code>${escape(doc.type)}</code></dd>` : ''}${Object.hasOwn(doc, 'default') && doc.default !== undefined ? `<dt>Default</dt><dd><code>${escape(doc.default === '' ? 'Not declared' : doc.default)}</code></dd>` : ''}${doc.attribute ? `<dt>Attribute</dt><dd><code>${escape(doc.attribute)}</code></dd>` : ''}${values ? `<dt>Values</dt><dd><code>${escape(values)}</code></dd>` : ''}</dl>
        ${doc.kind === 'event' ? `<p>Source web event: ${['cancelable', 'bubbles', 'composed'].filter(key => typeof doc[key] === 'boolean').map(key => `${key}: ${doc[key]}`).join(' · ') || 'flags not declared'}</p>` : ''}
        ${doc.parameters?.length ? `<strong class="doc-tooltip-label">Parameters</strong>${doc.parameters.map(parameter => `<p><code>${escape(parameter.name)}${parameter.optional ? '?' : ''}: ${escape(parameter.type?.text || parameter.type || 'unknown')}</code>${parameter.description ? `<br>${prose(parameter.description)}` : ''}</p>`).join('')}` : ''}
        ${doc.returnType && doc.returnType !== 'inferred' ? `<p>Returns <code>${escape(doc.returnType)}</code></p>` : ''}
        ${doc.usage ? `<p>${prose(doc.usage)}</p>` : ''}<p class="doc-support">${escape(doc.support?.description || '')}</p>
      </div>
      <md-button slot="actions" variant="text" size="xs" href="/repo/packages/core/src/components/${escape(state.selected.tag)}/readme.md" target="_blank">Full guide</md-button>
    </md-tooltip>`;
  }
  function filterProperties() {
    const query = (document.querySelector('#props-search')?.value || '').trim().toLowerCase();
    const rows = [...document.querySelectorAll('#props-controls .prop-control')];
    for (const row of rows) row.hidden = !row.dataset.search.includes(query);
    const empty = document.querySelector('#props-empty');
    if (empty) empty.hidden = !rows.length || rows.some(row => !row.hidden);
  }
  listen(document.querySelector('#props-search'), 'mdInput', filterProperties);

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
    if (code) renderCode(code, snippet(), snippetLanguages.find(language => language.id === snippetLanguage)?.language || snippetLanguage);
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
  function eventPayload(event, index, expanded) {
    const state = getState(), doc = memberDocumentation(state.selected, 'event', event, state.platform);
    const payload = eventPayloadDocumentation(state.selected, doc);
    const fields = payload.fields.length ? `<dl class="payload-fields">${payload.fields.map(field => `<div class="payload-field"><dt><code>${escape(field.name)}</code>${field.optional ? '<span class="payload-field-optional">Optional</span>' : ''}<code class="payload-field-type">${escape(field.type)}</code></dt><dd>${prose(field.description)}</dd></div>`).join('')}</dl>` : '';
    const typeLabel = payload.fields.length ? doc.payloadType?.name || 'object' : payload.type.length < 80 && !/[\n{};]/.test(payload.type) ? payload.type : 'declared type';
    return `<div class="event-payload"><p class="payload-heading">Web event detail${payload.empty ? '' : ` · <code>${escape(typeLabel)}</code>`}</p><p>${escape(payload.description)}</p>${fields}
      ${payload.example ? `<p class="payload-example-heading">Read this event</p><pre class="payload-example" data-code-language="javascript" tabindex="0" aria-label="${escape(event.name)} web event example">${escape(payload.example)}</pre>` : ''}
      ${state.platform !== 'web' ? '<p class="payload-platform-note">This is the source web contract. Native callbacks use their adapter payload; DOM event objects are not sent to the native renderer.</p>' : ''}
      ${payload.empty ? '' : `<md-accordion-item id="usage-payload-${index}" class="usage-type" data-usage-payload="${escape(event.name)}" headline="Type definition" heading-level="4" region-role="group" density="-3" content-max-height="300px"${expanded ? ' expanded' : ''}><pre data-code-language="typescript">${escape(payload.definition)}</pre></md-accordion-item>`}</div>`;
  }
  let renderedCssKey;
  function renderCssVariables(styles, sameComponent) {
    const state = getState(), root = document.querySelector('#css-controls');
    const section = document.querySelector('#css-variables-section');
    if (!sameComponent) section.expanded = false;
    document.querySelector('#css-variables-count').textContent = String(styles.length);
    document.querySelector('#css-variables-note').textContent = styles.length
      ? `Overrides update web framework examples${state.platform === 'web' ? ' and this Web preview' : ''}.`
      : 'No public CSS variables declared.';
    const key = JSON.stringify([state.selected.tag, state.platform, styles]);
    if (key !== renderedCssKey) {
      renderedCssKey = key;
      root.innerHTML = styles.map((item, index) => `<div class="css-variable-control"><div class="css-variable-heading"><code>${escape(item.name)}</code>${infoButton('cssProperty', item)}</div><md-text-field id="css-${index}" data-css-index="${index}" aria-label="${escape(item.name)} value" placeholder="Inherited value" value="${escape(state.docCssValues?.[item.name] || '')}" density="-3" variant="outlined"></md-text-field></div>`).join('');
      root.querySelectorAll('[data-css-index]').forEach(input => input.addEventListener('mdInput', event => {
        if (event.target !== input) return;
        const state = getState();
        state.docCssValues ||= {};
        state.docCssValues[styles[Number(input.dataset.cssIndex)].name] = typeof event.detail === 'string' ? event.detail : input.value;
        if (state.platform === 'web') applyOverrides();
        updateSnippet();
      }));
    }
    // Keep mounted editors on ordinary preview refreshes so the active input,
    // caret and accordion state survive. Reset still synchronizes their values.
    root.querySelectorAll('[data-css-index]').forEach(input => {
      const value = state.docCssValues?.[styles[Number(input.dataset.cssIndex)].name] || '';
      if (input.value !== value) input.value = value;
    });
  }
  function renderUsage() {
    const state = getState(), component = state.selected, web = state.platform === 'web';
    const root = document.querySelector('#usage-docs'), cssRoot = document.querySelector('#css-controls');
    const sameComponent = renderedTag === component.tag;
    const openSections = sameComponent ? new Map([...root.querySelectorAll('[data-usage-section]')].map(section => [section.dataset.usageSection, section.expanded])) : new Map();
    const openPayloads = sameComponent ? new Map([...root.querySelectorAll('[data-usage-payload]')].map(section => [section.dataset.usagePayload, section.expanded])) : new Map();
    const methodArguments = sameComponent ? new Map([...root.querySelectorAll('[data-method-name]')].map(input => [input.dataset.methodName, input.value])) : new Map();
    const focused = sameComponent && (root.contains(document.activeElement) || cssRoot.contains(document.activeElement)) ? document.activeElement : null;
    const editor = focused?.shadowRoot?.activeElement || focused;
    const focus = focused?.id ? { id: focused.id, start: editor.selectionStart, end: editor.selectionEnd, header: focused.matches('[data-usage-section]') || focused.matches('[data-usage-payload]') } : null;
    renderedTag = component.tag;
    const generation = ++renderGeneration;
    // Each API topic is an independent disclosure, as recommended for a single
    // region. Standalone items also keep nested payload headers from sending
    // their arrow-key focus requests to an unrelated outer accordion group.
    const section = (title, rows, body) => `<md-accordion-item id="usage-section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}" class="usage-section" data-usage-section="${escape(title)}" headline="${escape(title)}" heading-level="3" density="-2"${openSections.get(title) ? ' expanded' : ''}><span slot="headline" class="usage-section-headline">${escape(title)} <span class="usage-section-count">${rows.length}</span></span>${rows.length ? body : `<p class="usage-empty">No public ${escape(title.toLowerCase())} declared.</p>`}</md-accordion-item>`;
    const events = component.events || [], slots = component.slots || [], methods = component.methods || [], styles = component.cssProperties || [], parts = component.cssParts || [];
    root.innerHTML = `<div class="usage-intro"><p>Change properties and interact with the preview. Use <span aria-hidden="true">ⓘ</span> for details, defaults and platform support.</p><md-button class="usage-guide" variant="text" size="xs" icon="open_in_new" href="/repo/packages/core/src/components/${escape(component.tag)}/readme.md" target="_blank">Full component guide</md-button></div>
      <section class="usage-example" aria-label="Live usage example"><div class="usage-code-heading"><md-tabs id="usage-language-tabs" variant="secondary" tab-width="auto" active-tab-index="${snippetLanguages.findIndex(language => language.id === snippetLanguage)}" aria-label="Code language">${snippetLanguages.map(language => `<md-tab label="${escape(language.label)}" data-snippet-language="${language.id}" inline-icon${language.id === 'android' ? ' icon="android"' : ''}>${usageBrandIcon(language.id)}</md-tab>`).join('')}</md-tabs><md-button type="button" id="copy-usage" variant="text" size="xs" icon="content_copy">Copy</md-button></div><pre id="usage-snippet" class="usage-code" tabindex="0" aria-label="Usage code"></pre></section>
      <div class="api-reference">${section('Events', events, `<md-button type="button" id="watch-usage-events" class="usage-action" variant="text" size="xs">Watch live events</md-button>${events.map((event, index) => {
        return memberRow('event', event, eventPayload(event, index, openPayloads.get(event.name)));
      }).join('')}`)}
      ${section('Slots', slots, `<p class="usage-empty">Edit plain slot text in the examples${web ? ' and Web preview' : ''}. Reset props restores the fixture.</p>${slots.map((slot, index) => memberRow('slot', slot, `<md-text-field id="slot-${index}" data-slot-index="${index}" label="${escape(slot.name || 'Default')} slot text" aria-label="${escape(slot.name || 'Default')} slot text" placeholder="Use fixture content" value="${escape(state.docSlotValues?.[slot.name] ?? '')}" density="-2" variant="outlined"></md-text-field>`)).join('')}`)}
      ${section('Methods', methods, `<p class="usage-empty">${web ? 'Arguments use a JSON array, for example ["Message"].' : 'Methods are documented here; browser invocation is available in the Web reference.'}</p>${methods.map((method, index) => {
        const doc = memberDocumentation(component, 'method', method, state.platform);
        const signature = method.signature || `${method.name}(${method.params || (method.parameters || []).map(p => `${p.name}: ${p.type?.text || p.type || 'unknown'}`).join(', ')})`;
        return memberRow('method', method, `<code class="usage-signature">${escape(signature)}</code>${doc.returnType && doc.returnType !== 'inferred' ? `<p>Returns <code>${escape(doc.returnType)}</code></p>` : ''}<md-text-field id="method-${index}" data-method-args="${index}" data-method-name="${escape(method.name)}" label="Arguments (JSON array)" value="${escape(methodArguments.get(method.name) ?? '[]')}" density="-2" variant="outlined" ${web ? '' : 'disabled'}></md-text-field><md-button type="button" class="usage-action" variant="tonal" size="xs" data-run-method="${index}" ${web ? '' : 'disabled'}>Run ${escape(method.name)}</md-button><output class="usage-result" id="method-result-${index}" aria-live="polite"></output>`);
      }).join('')}`)}
      ${section('CSS parts', parts, parts.map(part => memberRow('cssPart', part, `<code class="usage-signature">${escape(component.tag)}::part(${escape(part.name)}) { … }</code>`)).join(''))}
      ${(component.dataTypes?.length || component.callableProps?.length) ? section('Data & callback types', [...(component.dataTypes || []), ...(component.callableProps || [])], [...(component.dataTypes || []).map(type => ['dataType', type]), ...(component.callableProps || []).map(type => ['callableProp', type])].map(([kind, type]) => memberRow(kind, type, `<pre class="usage-code" data-code-language="typescript">${escape(type.body || type.type?.text || type.type || '')}</pre>`)).join('')) : ''}</div>`;
    root.querySelectorAll('[data-code-language]').forEach(code => renderCode(code, code.textContent, code.dataset.codeLanguage));
    renderCssVariables(styles, sameComponent);
    if (focus) {
      const next = document.getElementById(focus.id);
      if (next && next !== focused && (root.contains(next) || cssRoot.contains(next)) && !next.disabled) {
        const restore = input => { if (generation === renderGeneration && typeof input?.setSelectionRange === 'function' && focus.start != null) input.setSelectionRange(focus.start, focus.end); };
        const restoreFocus = () => {
          if (generation !== renderGeneration || !next.isConnected) return;
          if (focus.header && typeof next.focusHeader === 'function') next.focusHeader();
          else next.focus({ preventScroll: true });
          if (typeof next.getInputElement === 'function') next.getInputElement().then(restore); else restore(next);
        };
        if (typeof next.componentOnReady === 'function') next.componentOnReady().then(restoreFocus); else restoreFocus();
      }
    }
    updateSnippet();
    root.querySelector('#usage-language-tabs').addEventListener('mdTabChange', event => { const language = snippetLanguages[event.detail?.index]; if (language) { snippetLanguage = language.id; updateSnippet(); } });
    root.querySelector('#copy-usage').addEventListener('mdClick', async () => { try { await navigator.clipboard.writeText(snippet()); notify('Usage example copied'); } catch { notify('Clipboard unavailable'); } });
    root.querySelector('#watch-usage-events')?.addEventListener('mdClick', watchEvents);
    const valueFor = (event, input) => typeof event.detail === 'string' ? event.detail : input.value;
    root.querySelectorAll('[data-slot-index]').forEach(input => input.addEventListener('mdInput', event => { state.docSlotValues ||= {}; state.docSlotValues[slots[Number(input.dataset.slotIndex)].name] = valueFor(event, input); if (state.platform === 'web') applyOverrides(); updateSnippet(); }));
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
  return { infoButton, renderUsage, updateSnippet, applyOverrides, filterProperties, beginRender() { hide(); }, dispose() { hide(); ++renderGeneration; listeners.splice(0).forEach(remove => remove()); } };
}
