import { memberDocumentation, eventPayloadDocumentation } from './documentation.js';
import { usageSnippet, snippetLanguages } from './usage-snippets.js';
import { recipeFor } from './recipes.js';
import { usageBrandIcon } from './brand-icons.js';
import { renderCode } from './syntax-highlighting.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { BUTTON_APPEARANCE_FIELDS, buttonAppearanceCSS } from './button-appearance.js';
import { apiExample } from './api-examples.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const prose = value => escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const categoryDescriptions = {
  Events: 'Events notify your application about interactions or changes proposed by a component. In Web, listen with `addEventListener` and read `event.detail`; cancelable events can prevent their default action. Native adapters use their documented callback contracts.',
  Slots: 'Slots are insertion points for child content. The default slot accepts unnamed content; named Web slots use the `slot` attribute. Native adapters provide their supported content equivalents. The editors below change plain text.',
  Methods: 'Methods are actions you can call on a component, such as focusing an input or checking validity. Each method documents its arguments and return value. Run them against the Web preview with a JSON argument array; native method availability depends on the adapter.',
  'CSS parts': 'CSS parts are named elements exposed from a Web component’s shadow DOM. Style them with `component-tag::part(name)` without depending on private markup. CSS selectors do not apply directly to SwiftUI or Jetpack Compose.',
};

const categorySummaries = {
  Events: 'Handle interactions and read the data they send.',
  Slots: 'Add labels, icons and custom content.',
  Methods: 'Call actions from your application code.',
  'CSS parts': 'Customize individual surfaces, text and icons.',
};
const codeLanguageLabels = { javascript: 'JavaScript', typescript: 'TypeScript', html: 'HTML', tsx: 'React · TSX', vue: 'Vue', svelte: 'Svelte', swift: 'Swift', kotlin: 'Kotlin', css: 'CSS' };

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

export function createDocumentationUI({ getState, watchEvents, notify, afterInteraction, onContentChange, onAppearanceChange }) {
  const appearanceUI = createButtonAppearanceUI({ getState, onChange: () => { applyOverrides(); updateSnippet(); onAppearanceChange?.(); } });
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

  const documentationPlatform = () => ({ swift: 'ios', android: 'android' })[snippetLanguage] || 'web';
  function infoButton(kind, member, platform = getState().platform) {
    const state = getState(), key = String(++sequence);
    const doc = memberDocumentation(state.selected, kind, member, platform);
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
    </md-tooltip>`;
  }
  function categoryInfo(title) {
    const key = String(++sequence);
    return `<md-tooltip class="documentation-tooltip usage-category-tooltip" data-doc-tooltip="${key}" data-category-info="${escape(title)}" variant="rich" position="${tooltipPosition()}" show-delay="350" hide-delay="300">
      <md-icon-button class="doc-info" data-doc-info="${key}" icon="info" size="xs" aria-label="About ${escape(title)}"></md-icon-button>
      <strong slot="subhead" class="doc-tooltip-title">${escape(title)}</strong>
      <div slot="content" class="doc-tooltip-content" tabindex="0" aria-label="${escape(title)} explanation"><p>${prose(categoryDescriptions[title])}</p></div>
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
    if (target) applyOverrides(target, false);
    return usageSnippet(state.selected, snippetProperties(state), snippetLanguage, { html: template.innerHTML, buttonAppearanceDefaults: state.buttonAppearanceDefaults, buttonAppearance: state.buttonAppearance, ...(Object.hasOwn(state.docSlotValues || {}, '') ? { text: state.docSlotValues[''] } : {}) });
  }
  function updateSnippet() {
    const code = document.querySelector('#usage-snippet');
    if (code) renderCode(code, snippet(), snippetLanguages.find(language => language.id === snippetLanguage)?.language || snippetLanguage);
  }
  function slotValue(name) {
    const state = getState();
    return state.docSlotValues?.[name] ?? (name === '' ? recipeFor(state.selected.tag).text : undefined) ?? '';
  }
  function setSlotValue(name, value) {
    const state = getState();
    state.docSlotValues ||= {};
    state.docSlotValues[name] = value;
    if (state.platform === 'web') applyOverrides();
    const textInput = document.querySelector('#component-text');
    if (name === '' && textInput && textInput.value !== value) textInput.value = value;
    document.querySelector('#usage-docs')?.querySelectorAll('[data-slot-index]').forEach(input => {
      if (state.selected.slots[Number(input.dataset.slotIndex)].name === name && input.value !== value) input.value = value;
    });
    updateSnippet();
    onContentChange?.(name, value);
  }
  function textControl() {
    const state = getState();
    if (recipeFor(state.selected.tag).text === undefined) return '';
    return `<div class="prop-control text" data-search="text label content default slot string"><div class="prop-heading"><label class="prop-label" for="component-text"><code>Text</code></label>${infoButton('slot', { name: '' })}<span class="prop-type">content</span></div><md-text-field id="component-text" aria-label="Text" aria-describedby="component-text-note" variant="outlined" density="-3" value="${escape(slotValue(''))}"></md-text-field><p class="prop-note" id="component-text-note">Visible button label. Updates the preview and usage examples.</p></div>`;
  }
  function bindTextControl() {
    const input = document.querySelector('#component-text');
    input?.addEventListener('mdInput', event => {
      if (event.target === input) setSlotValue('', typeof event.detail === 'string' ? event.detail : input.value);
    });
  }
  function applyOverrides(target = getState().target, includeAppearance = true) {
    const state = getState();
    if (!target) return;
    if (includeAppearance) appearanceUI.apply(target);
    for (const [name, value] of Object.entries(state.docSlotValues || {})) {
      for (const child of [...target.childNodes]) {
        const slot = child.nodeType === 1 ? child.getAttribute('slot') || '' : '';
        if (slot === name) child.remove();
      }
      const content = (target.ownerDocument || document).createElement('span'); if (name) content.slot = name;
      content.textContent = value; target.append(content);
    }
    const appearance = includeAppearance && state.selected.tag === 'md-button' ? buttonAppearanceCSS(state.buttonAppearance, state.buttonAppearanceDefaults) : {};
    for (const [name, value] of Object.entries(state.docCssValues || {})) { if (value) target.style.setProperty(name, value); else if (Object.hasOwn(appearance, name)) target.style.setProperty(name, appearance[name]); else target.style.removeProperty(name); }
  }
  function memberRow(kind, member, content = '') {
    const state = getState(), doc = memberDocumentation(state.selected, kind, member, documentationPlatform());
    return `<article class="usage-member"><div class="usage-member-heading"><code>${escape(member.name || 'Default slot')}</code>${infoButton(kind, member, documentationPlatform())}</div>
      <p>${prose(doc.description)}</p>${content}</article>`;
  }
  function codeCard({ id, title, description, language, code, payload }) {
    return `<md-card id="${id}" class="usage-code-card" variant="filled" full-width density="-3"${payload ? ` data-usage-payload="${escape(payload)}"` : ''}><div class="usage-code-card-heading"><h4 id="${id}-title">${escape(title)}</h4><div class="usage-code-card-actions"><span class="usage-code-language">${escape(codeLanguageLabels[language] || language)}</span><md-icon-button icon="content_copy" size="xs" data-copy-api-code="${id}-code" aria-label="Copy ${escape(title)}"></md-icon-button></div></div><p class="usage-code-description">${prose(description)}</p><pre id="${id}-code" class="usage-code-body" data-code-language="${language}" tabindex="0" aria-labelledby="${id}-title">${escape(code)}</pre></md-card>`;
  }
  function memberExample(kind, member, index) {
    const example = apiExample(getState().selected, kind, member, snippetLanguage);
    const id = `usage-api-${kind}-${index}`;
    return `<div class="usage-api-example" data-api-framework="${snippetLanguage}" data-api-status="${escape(example.status)}">${example.code
      ? codeCard({ id, ...example })
      : `<div class="usage-api-unavailable"><strong>${escape(example.title)}</strong><p>${prose(example.description)}</p></div>`}
      ${example.notes?.length ? `<ul class="usage-api-notes">${example.notes.map(note => `<li>${prose(note)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  function eventPayload(event, index) {
    if (documentationPlatform() !== 'web') return '';
    const state = getState(), doc = memberDocumentation(state.selected, 'event', event, 'web');
    const payload = eventPayloadDocumentation(state.selected, doc);
    const fields = payload.fields.length ? `<dl class="payload-fields">${payload.fields.map(field => `<div class="payload-field"><dt><code>${escape(field.name)}</code>${field.optional ? '<span class="payload-field-optional">Optional</span>' : ''}<code class="payload-field-type">${escape(field.type)}</code></dt><dd>${prose(field.description)}</dd></div>`).join('')}</dl>` : '';
    const typeLabel = payload.fields.length ? doc.payloadType?.name || 'object' : payload.type.length < 80 && !/[\n{};]/.test(payload.type) ? payload.type : 'declared type';
    return `<div class="event-payload"><p class="payload-heading">Event data${payload.empty ? '' : ` · <code>${escape(typeLabel)}</code>`}</p><p>${escape(payload.description)}</p>${fields}
      ${payload.empty ? '' : `<md-accordion-item id="usage-type-${index}" data-usage-disclosure class="usage-type-disclosure" headline="Type definition" heading-level="4" density="-3">${codeCard({ id: `usage-payload-${index}`, title: 'Type definition', description: `The TypeScript contract for \`${event.name}\` event detail.`, language: 'typescript', code: payload.definition, payload: event.name })}</md-accordion-item>`}
      </div>`;
  }
  let renderedCssKey;
  function renderCssVariables(styles) {
    const state = getState(), root = document.querySelector('#css-controls');
    const button = state.selected.tag === 'md-button';
    document.querySelector('#css-variables-tab').label = button ? 'Styles' : 'CSS variables';
    document.querySelector('#css-variables-count').textContent = String(button ? BUTTON_APPEARANCE_FIELDS.length : styles.length);
    appearanceUI.render();
    document.querySelector('#css-variables-note').textContent = styles.length
      ? `Overrides update web framework examples${state.platform === 'web' ? ' and this Web preview' : ''}.`
      : 'No public CSS variables declared.';
    const key = JSON.stringify([state.selected.tag, state.platform, styles]);
    if (key !== renderedCssKey) {
      renderedCssKey = key;
      const controls = styles.map((item, index) => `<div class="css-variable-control"><div class="css-variable-heading"><code>${escape(item.name)}</code>${infoButton('cssProperty', item)}</div><md-text-field id="css-${index}" data-css-index="${index}" aria-label="${escape(item.name)} value" placeholder="Inherited value" value="${escape(state.docCssValues?.[item.name] || '')}" density="-3" variant="outlined"></md-text-field></div>`).join('');
      root.innerHTML = button ? `<md-accordion-item headline="Web CSS overrides" heading-level="3" density="-3"><div class="css-variable-fields">${controls}</div></md-accordion-item>` : controls;
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
    // caret survive. Reset still synchronizes their values.
    root.querySelectorAll('[data-css-index]').forEach(input => {
      const value = state.docCssValues?.[styles[Number(input.dataset.cssIndex)].name] || '';
      if (input.value !== value) input.value = value;
    });
  }
  function renderUsage() {
    const state = getState(), component = state.selected, web = state.platform === 'web';
    const root = document.querySelector('#usage-docs'), cssRoot = document.querySelector('#css-controls');
    const sameComponent = renderedTag === component.tag;
    const firstSection = [['Events', component.events], ['Slots', component.slots], ['Methods', component.methods], ['CSS parts', component.cssParts]].find(([, members]) => members?.length)?.[0];
    const expandedSections = sameComponent ? new Set([...root.querySelectorAll('[data-usage-section]')].filter(item => item.expanded).map(item => item.dataset.usageSection)) : new Set(firstSection ? [firstSection] : []);
    const openDisclosures = sameComponent ? [...root.querySelectorAll('[data-usage-disclosure]')].filter(item => item.expanded).map(item => item.id) : [];
    const methodArguments = sameComponent ? new Map([...root.querySelectorAll('[data-method-name]')].map(input => [input.dataset.methodName, input.value])) : new Map();
    const focused = sameComponent && (root.contains(document.activeElement) || cssRoot.contains(document.activeElement)) ? document.activeElement : null;
    const editor = focused?.shadowRoot?.activeElement || focused;
    const focus = focused?.id ? { id: focused.id, start: editor.selectionStart, end: editor.selectionEnd } : null;
    renderedTag = component.tag;
    const generation = ++renderGeneration;
    const section = (title, rows, body, action = '') => {
      const id = `usage-section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
      const empty = title === 'Methods' ? 'This component has no public methods. Configure it through properties and respond through events.' : `This component does not declare public ${title.toLowerCase()}.`;
      const content = rows.length ? body : `<p class="usage-empty">${escape(empty)}</p>`;
      const count = `<md-chip class="usage-section-count" variant="input" selectable="false" removable="false" appearance="filled" density="-4" inert aria-hidden="true" tabindex="-1">${rows.length}</md-chip>`;
      if (!Object.hasOwn(categoryDescriptions, title)) return `<md-card id="${id}" class="usage-section" data-usage-section="${escape(title)}" variant="outlined" full-width density="-3"><div class="usage-section-heading"><div class="usage-section-label"><h3 class="usage-section-title">${escape(title)}<span class="sr-only">, ${rows.length} declarations</span></h3>${count}</div>${action}</div>${content}</md-card>`;
      const summary = rows.length ? categorySummaries[title] : `No public ${title.toLowerCase()} for this component.`;
      // Interactive help stays outside the accordion's own header button.
      return `<section class="usage-accordion-section"><md-accordion-item id="${id}" class="usage-section usage-accordion" data-usage-section="${escape(title)}" headline="${escape(title)}" heading-level="3" region-role="group" density="-3"${expandedSections.has(title) ? ' expanded' : ''}><span slot="headline" class="sr-only">${escape(title)}, ${rows.length} declarations. ${escape(summary)}</span><div class="usage-accordion-body">${action ? `<div class="usage-accordion-action">${action}</div>` : ''}${content}</div></md-accordion-item><div class="usage-accordion-tools"><div class="usage-accordion-copy"><div class="usage-accordion-title-row"><span class="usage-accordion-label" aria-hidden="true">${escape(title)}</span>${categoryInfo(title)}</div><p class="usage-accordion-summary" aria-hidden="true">${escape(summary)}</p></div>${count}</div></section>`;
    };
    const events = component.events || [], slots = component.slots || [], methods = component.methods || [], styles = component.cssProperties || [], parts = component.cssParts || [];
    root.innerHTML = `<div class="usage-intro"><h2>Usage &amp; API</h2><p>Choose your framework to see how to render this component, handle events, add content and customize its appearance.</p></div>
      <section class="usage-example" aria-label="Live usage example"><div class="usage-code-heading"><md-tabs id="usage-language-tabs" variant="secondary" tab-width="auto" active-tab-index="${snippetLanguages.findIndex(language => language.id === snippetLanguage)}" aria-label="Code language">${snippetLanguages.map(language => `<md-tab id="usage-language-${language.id}" label="${escape(language.label)}" data-snippet-language="${language.id}" inline-icon${language.id === 'android' ? ' icon="android"' : ''}>${usageBrandIcon(language.id)}</md-tab>`).join('')}</md-tabs></div><md-card class="usage-snippet-card" variant="outlined" full-width><div class="usage-snippet-actions"><md-button type="button" id="copy-usage" variant="text" size="xs" icon="content_copy" aria-label="Copy usage code">Copy</md-button></div><pre id="usage-snippet" class="usage-code" tabindex="0" aria-label="Usage code"></pre></md-card></section>
      <div class="api-reference"><div class="usage-api-toolbar"><div><h3>API examples</h3><p>Practical recipes for each API. Changing the framework updates every example.</p></div><md-select id="api-framework" label="Framework" aria-label="API examples framework" value="${snippetLanguage}" variant="outlined" density="-2">${snippetLanguages.map(language => `<md-select-option value="${language.id}">${language.id === 'swift' ? 'SwiftUI / iOS' : escape(language.label)}</md-select-option>`).join('')}</md-select></div>
      ${section('Events', events, events.map((event, index) => memberRow('event', event, memberExample('event', event, index) + eventPayload(event, index))).join(''), events.length ? '<md-button type="button" id="watch-usage-events" class="usage-action" variant="tonal" size="xs" density="0" icon="bolt">Watch live events</md-button>' : '')}
      ${section('Slots', slots, slots.map((slot, index) => memberRow('slot', slot, memberExample('slot', slot, index) + `<div class="usage-try-it"><p>Try plain text${web ? ' in the Web preview' : ' in the usage example'}. ${component.tag === 'md-button' && !slot.name ? 'This also updates the native button label.' : ''}</p><md-text-field id="slot-${index}" data-slot-index="${index}" label="${escape(slot.name || 'Default')} slot text" aria-label="${escape(slot.name || 'Default')} slot text" placeholder="Use fixture content" value="${escape(slotValue(slot.name))}" density="-2" variant="outlined"></md-text-field></div>`)).join(''))}
      ${section('Methods', methods, methods.map((method, index) => {
        const doc = memberDocumentation(component, 'method', method, documentationPlatform());
        const signature = method.signature || `${method.name}(${method.params || (method.parameters || []).map(p => `${p.name}: ${p.type?.text || p.type || 'unknown'}`).join(', ')})`;
        return memberRow('method', method, `<code class="usage-signature">${escape(signature)}</code>${doc.returnType && doc.returnType !== 'inferred' ? `<p>Returns <code>${escape(doc.returnType)}</code></p>` : ''}${memberExample('method', method, index)}<div class="usage-try-it"><p>${web ? 'Try this method in the Web preview. Supply arguments as a JSON array.' : 'Switch the preview to Web to try this source method.'}</p><md-text-field id="method-${index}" data-method-args="${index}" data-method-name="${escape(method.name)}" label="Arguments (JSON array)" value="${escape(methodArguments.get(method.name) ?? '[]')}" density="-2" variant="outlined" ${web ? '' : 'disabled'}></md-text-field><md-button type="button" class="usage-action" variant="tonal" size="xs" data-run-method="${index}" ${web ? '' : 'disabled'}>Run ${escape(method.name)}</md-button><output class="usage-result" id="method-result-${index}" aria-live="polite"></output></div>`);
      }).join(''))}
      ${section('CSS parts', parts, parts.map((part, index) => memberRow('cssPart', part, memberExample('cssPart', part, index))).join(''))}
      ${(component.dataTypes?.length || component.callableProps?.length) ? section('Data & callback types', [...(component.dataTypes || []), ...(component.callableProps || [])], [...(component.dataTypes || []).map(type => ['dataType', type]), ...(component.callableProps || []).map(type => ['callableProp', type])].map(([kind, type], index) => memberRow(kind, type, codeCard({ id: `usage-data-type-${index}`, title: type.name, description: kind === 'callableProp' ? 'The function signature accepted by this callback property.' : 'The TypeScript declaration used by this component.', language: 'typescript', code: type.body || type.type?.text || type.type || '' }))).join('')) : ''}</div>`;
    openDisclosures.forEach(id => { const item = root.querySelector(`#${id}`); if (item) item.expanded = true; });
    root.querySelectorAll('[data-code-language]').forEach(code => renderCode(code, code.textContent, code.dataset.codeLanguage));
    renderCssVariables(styles);
    if (focus) {
      const next = document.getElementById(focus.id);
      if (next && next !== focused && (root.contains(next) || cssRoot.contains(next)) && !next.disabled) {
        const restore = input => { if (generation === renderGeneration && typeof input?.setSelectionRange === 'function' && focus.start != null) input.setSelectionRange(focus.start, focus.end); };
        const restoreFocus = () => {
          if (generation !== renderGeneration || !next.isConnected) return;
          if (next.matches('md-accordion-item')) next.focusHeader();
          else if (next.matches('md-select')) next.focusTrigger();
          else next.focus({ preventScroll: true });
          if (typeof next.getInputElement === 'function') next.getInputElement().then(restore); else restore(next);
        };
        if (typeof next.componentOnReady === 'function') next.componentOnReady().then(restoreFocus); else restoreFocus();
      }
    }
    updateSnippet();
    const changeFramework = id => {
      if (id === snippetLanguage || !snippetLanguages.some(language => language.id === id)) return;
      snippetLanguage = id; state.snippetLanguage = id; renderUsage();
    };
    root.querySelector('#usage-language-tabs').addEventListener('mdTabChange', event => {
      if (event.target === root.querySelector('#usage-language-tabs')) changeFramework(snippetLanguages[event.detail?.index]?.id);
    });
    root.querySelector('#api-framework').addEventListener('mdChange', event => {
      const select = root.querySelector('#api-framework');
      if (event.target === select) changeFramework(typeof event.detail === 'string' ? event.detail : event.detail?.value ?? select.value);
    });
    root.querySelectorAll('[data-copy-api-code]').forEach(button => button.addEventListener('mdClick', async () => {
      try { await navigator.clipboard.writeText(root.querySelector(`#${button.dataset.copyApiCode}`).textContent); notify('API example copied'); }
      catch { notify('Clipboard unavailable'); }
    }));
    root.querySelector('#copy-usage').addEventListener('mdClick', async () => { try { await navigator.clipboard.writeText(snippet()); notify('Usage example copied'); } catch { notify('Clipboard unavailable'); } });
    root.querySelector('#watch-usage-events')?.addEventListener('mdClick', watchEvents);
    const valueFor = (event, input) => typeof event.detail === 'string' ? event.detail : input.value;
    root.querySelectorAll('[data-slot-index]').forEach(input => input.addEventListener('mdInput', event => { if (event.target === input) setSlotValue(slots[Number(input.dataset.slotIndex)].name, valueFor(event, input)); }));
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
  return { infoButton, renderUsage, updateSnippet, applyOverrides, textControl, bindTextControl, filterProperties, beginRender() { hide(); }, dispose() { hide(); ++renderGeneration; listeners.splice(0).forEach(remove => remove()); } };
}
