import { createSegmentedConfigurationUI } from './segmented-configuration.js';
import { createMeterConfigurationUI } from './meter-configuration.js';
import { applySegmentedContext, SEGMENTED_PARENT_PROPERTIES } from './segmented-context.js';
import { nativeMethodSupported } from './native-methods.js';
import { createButtonGroupConfigurationUI } from './button-group-configuration.js';
import { editableTextSlot, nativeTextSlot, nativeContentSlots, defaultSlotMaskingProperty } from './content-slots.js';
import { memberDocumentation, eventPayloadDocumentation } from './documentation.js';
import { usageSnippet, snippetLanguages, recipePropertyValues } from './usage-snippets.js';
import { recipeFor } from './recipes.js';
import { usageBrandIcon } from './brand-icons.js';
import { renderCode } from './syntax-highlighting.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { apiExample, methodExampleArguments } from './api-examples.js';
import { nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { createComponentStylesUI } from './component-styles-ui.js';
import { createCSSOverrideApplier } from './component-styles.js';
import { createButtonConfigurationUI } from './button-configuration.js';
import { applyAppearancePartRules } from './appearance-part-rules.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const prose = value => escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const categoryDescriptions = {
  Events: 'Events notify your application about interactions or changes proposed by a component. In Web, listen with `addEventListener` and read `event.detail`; cancelable events can prevent their default action. Native adapters use their documented callback contracts.',
  Slots: 'Slots are insertion points for child content. The default slot accepts unnamed content; named Web slots use the `slot` attribute. Native adapters provide their supported content equivalents. Text editors update labels and prose; structural and interactive slots retain their component composition.',
  Methods: 'Methods are actions you can call on a component, such as focusing an input or checking validity. Each method documents its arguments and return value. Run supported methods against the selected preview with a JSON argument array. Native methods are enabled when an explicit native bridge is available.',
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
  const recipe = recipeFor(state.selected.tag), fixture = recipePropertyValues(state.selected, recipe);
  const edited = state.editedTag === state.selected.tag ? state.editedProps || {} : {};
  const declared = new Map((state.selected.properties || []).map(property => [property.name, property]));
  return Object.fromEntries(Object.entries(state.props || {}).filter(([name, value]) => {
    if (state.selected.tag === 'md-button' && name === 'aria-expanded') return typeof value === 'boolean';
    if (['md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(state.selected.tag) && name === 'aria-label') return typeof value === 'string';
    if (state.selected.tag === 'md-segmented-button' && state.segmentedContext?.mode === 'set' && SEGMENTED_PARENT_PROPERTIES.includes(name)) return false;
    if (!declared.has(name) || value === undefined) return false;
    if (Object.hasOwn(fixture, name) || Object.hasOwn(edited, name)) return true;
    const property = declared.get(name);
    return JSON.stringify(value) !== JSON.stringify(property.defaultValue);
  }));
}

export function createDocumentationUI({ getState, watchEvents, notify, afterInteraction, onContentChange, onAppearanceChange, invokeNativeMethod, onPreviewContextChange }) {
  const appearanceUI = createButtonAppearanceUI({ getState, onChange: () => { applyOverrides(); updateSnippet(); onAppearanceChange?.(); } });
  const buttonConfigurationUI = createButtonConfigurationUI({ getState, infoButton, onChange: (name, value) => {
    if (getState().platform === 'web') applyOverrides();
    updateSnippet(); onContentChange?.(name, value);
  } });
  const groupConfigurationUI = createButtonGroupConfigurationUI({ getState, onChange: () => { if (getState().platform === 'web') applyOverrides(); updateSnippet(); onContentChange?.(); } });
  const segmentedConfigurationUI = createSegmentedConfigurationUI({ getState, onChange: () => { updateSnippet(); onPreviewContextChange?.(); } });
  const meterConfigurationUI = createMeterConfigurationUI({ getState, onChange: () => { if (getState().platform === 'web') applyOverrides(); updateSnippet(); onAppearanceChange?.(); } });
  const applyCSS = createCSSOverrideApplier();
  const stylesUI = createComponentStylesUI({ getState, infoButton, onChange: () => { if (getState().platform === 'web') applyOverrides(); updateSnippet(); } });
  let activeTooltip, sequence = 0, renderedTag, renderGeneration = 0, snippetLanguage = 'html';
  const listeners = [], usageListeners = [];
  const managedAttributes = new WeakMap();
  let cancelPreparation = () => {};
  const bindUsage = (target, name, callback) => {
    target?.addEventListener(name, callback);
    usageListeners.push(() => target?.removeEventListener(name, callback));
  };

  // Only template-owned attributes are reconciled. AWC's runtime roles,
  // tab stops and hydrated classes belong to the mounted components.
  const remember = node => {
    if (node.nodeType === 1) managedAttributes.set(node, new Map(node.getAttributeNames().map(name => [name, name === 'class' ? node.getAttribute(name).split(/\s+/).filter(value => value !== 'hydrated').join(' ') : node.getAttribute(name)])));
    for (const child of node.childNodes) remember(child);
  };
  const nodeKey = node => node.nodeType === 1
    ? `${node.nodeName}:${node.id || `${managedAttributes.get(node)?.get('class') ?? node.getAttribute('class') ?? ''}:${node.getAttribute('slot') || ''}`}`
    : node.nodeName;
  const pairs = (current, desired) => {
    const remaining = [...current.childNodes];
    return [...desired.childNodes].map(next => {
      const index = remaining.findIndex(node => nodeKey(node) === nodeKey(next));
      return [index < 0 ? null : remaining.splice(index, 1)[0], next];
    });
  };
  function reconcile(current, desired) {
    if (current.nodeType !== 1 && current.nodeType !== 11) {
      if (current.nodeValue !== desired.nodeValue) current.nodeValue = desired.nodeValue;
      return;
    }
    if (current.nodeType === 1 && desired.nodeType === 1) {
      const previous = managedAttributes.get(current) || new Map();
      const next = new Map(desired.getAttributeNames().map(name => [name, desired.getAttribute(name)]));
      for (const name of previous.keys()) if (!next.has(name)) {
        if (name === 'class') {
          const generated = new Set((previous.get(name) || '').split(/\s+/));
          for (const value of generated) if (value) current.classList.remove(value);
        } else current.removeAttribute(name);
      }
      for (const [name, value] of next) {
        if (name === 'class') {
          const oldClasses = new Set((previous.get('class') || '').split(/\s+/));
          const runtimeClasses = [...current.classList].filter(value => !oldClasses.has(value));
          const classes = [...new Set([...value.split(/\s+/).filter(Boolean), ...runtimeClasses])].join(' ');
          if (current.getAttribute(name) !== classes) current.setAttribute(name, classes);
        } else if (current.getAttribute(name) !== value) current.setAttribute(name, value);
      }
      managedAttributes.set(current, next);
      if (current.localName === 'md-text-field' && next.has('value') && current.value !== next.get('value')) current.value = next.get('value');
      // Highlight spans do not change source geometry. Keep them when the code
      // is unchanged, and keep the live snippet mounted for updateSnippet().
      if (current.id === 'usage-snippet') return;
      if (current.tagName === 'PRE' && current.textContent === desired.textContent) return;
    }
    const matched = pairs(current, desired);
    const reused = new Set(matched.map(([existing]) => existing));
    // Remove retired siblings first so a surviving host never has to move past
    // them (moving a focused custom element would disconnect it).
    for (const child of [...current.childNodes]) if (!reused.has(child)) child.remove();
    let cursor = current.firstChild;
    const retained = new Set();
    for (const [existing, next] of matched) {
      const node = existing || next;
      if (existing) reconcile(existing, next);
      else if (!managedAttributes.has(node)) remember(node);
      if (node !== cursor) current.insertBefore(node, cursor);
      cursor = node.nextSibling; retained.add(node);
    }
    for (const child of [...current.childNodes]) if (!retained.has(child)) child.remove();
  }
  function prepareNewComponents(current, desired, generation) {
    const additions = [];
    const inspect = (parent, template) => {
      const matches = pairs(parent, template);
      matches.forEach(([existing, next], index) => {
        if (existing && next.nodeType === 1) inspect(existing, next);
        else if (!existing && next.nodeType === 1 && (next.localName.startsWith('md-') || [...next.querySelectorAll('*')].some(node => node.localName.startsWith('md-')))) {
          // Hydrate at the final parent and position. Moving a hydrated custom
          // element can tear down its observers in disconnectedCallback.
          const node = next.cloneNode(true); remember(node);
          const style = node.getAttribute('style'), inert = node.hasAttribute('inert');
          node.style.setProperty('display', 'none', 'important'); node.style.visibility = 'hidden'; node.inert = true;
          parent.insertBefore(node, matches.slice(index + 1).find(([candidate]) => candidate)?.[0] || null);
          document.defaultView?.customElements?.upgrade(node);
          additions.push({ node, style, inert });
        }
      });
    };
    inspect(current, desired);
    if (!additions.length) return null;
    const hosts = additions.flatMap(({ node }) => [node, ...node.querySelectorAll('*')]).filter(node => typeof node.componentOnReady === 'function');
    const reveal = () => additions.forEach(({ node, style, inert }) => {
      if (style === null) node.removeAttribute('style'); else node.setAttribute('style', style);
      node.inert = inert;
    });
    if (!hosts.length) { reveal(); return null; }
    let cancel;
    const canceled = new Promise(resolve => { cancel = resolve; });
    const clean = () => { additions.forEach(({ node }) => node.remove()); cancel(false); };
    cancelPreparation = clean;
    return Promise.race([Promise.all(hosts.map(node => node.componentOnReady())).then(() => true), canceled]).then(ready => {
      if (ready && generation === renderGeneration) reveal();
      if (cancelPreparation === clean) cancelPreparation = () => {};
      return ready && generation === renderGeneration;
    }, () => {
      if (generation === renderGeneration) reveal();
      else additions.forEach(({ node }) => node.remove());
      if (cancelPreparation === clean) cancelPreparation = () => {};
      return generation === renderGeneration;
    });
  }
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
    const state = getState(), recipe = recipeFor(state.selected.tag, state.segmentedContext);
    // Never serialize the mounted preview: it belongs to a separate document and
    // contains runtime hydration, accessibility and interaction state.
    const template = document.createElement('template');
    template.innerHTML = recipe.html;
    const target = template.content.querySelector(state.selected.tag);
    if (target) applyOverrides(target, false);
    return usageSnippet(state.selected, snippetProperties(state), snippetLanguage, { html: template.innerHTML, sourceHtml: recipe.html, slots: state.docSlotValues, ...componentAppearanceOptions(state), ...(state.selected.tag === 'md-meter' ? { themeTokens: state.meterThemeTokens } : {}), ...(state.selected.tag === 'md-segmented-button' ? { segmentedContext: state.segmentedContext } : {}), ...(state.selected.tag === 'md-button-group' ? { buttonGroupSelection: state.buttonGroupSelection } : {}), ...(Object.hasOwn(state.docSlotValues || {}, '') ? { text: state.docSlotValues[''] } : {}) });
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
    if (!editableTextSlot(state.selected, name)) return;
    const editors = [...(document.querySelector('#usage-docs')?.querySelectorAll('[data-slot-index]') || [])].filter(input => state.selected.slots[Number(input.dataset.slotIndex)].name === name);
    const textEditor = name === '' ? document.querySelector('#component-text') : null;
    if (textEditor) editors.push(textEditor);
    try { nativeContentSlots({ ...state.docSlotValues, [name]: value }); }
    catch (error) { editors.forEach(input => { input.error = true; input.errorText = error.message; }); return; }
    editors.forEach(input => { input.error = false; });
    state.docSlotValues ||= {};
    state.docSlotValues[name] = value;
    const masking = name === '' && defaultSlotMaskingProperty(state.selected.tag);
    if (masking) {
      state.props[masking] = '';
      if (state.editedTag !== state.selected.tag) { state.editedTag = state.selected.tag; state.editedProps = {}; }
      state.editedProps ||= {}; state.editedProps[masking] = '';
      const propertyEditor = document.querySelector(`#prop-${masking}`);
      if (propertyEditor) propertyEditor.value = '';
    }
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
    const recipe = recipeFor(state.selected.tag);
    if (recipe.text === undefined) return '';
    return `<div class="prop-control text" data-search="text label content default slot string"><div class="prop-heading"><label class="prop-label" for="component-text"><code>${escape(recipe.textLabel || 'Text')}</code></label>${infoButton('slot', { name: '' })}<span class="prop-type">content</span></div><md-text-field id="component-text" aria-label="Text" aria-describedby="component-text-note" variant="outlined" density="-3" value="${escape(slotValue(''))}"></md-text-field><p class="prop-note" id="component-text-note">${escape(recipe.textDescription || 'Visible content. Updates the preview and usage examples.')}</p></div>`;
  }
  function bindTextControl() {
    buttonConfigurationUI.bind();
    groupConfigurationUI.bind();
    segmentedConfigurationUI.bind();
    meterConfigurationUI.bind();
    const input = document.querySelector('#component-text');
    input?.addEventListener('mdInput', event => {
      if (event.target === input) setSlotValue('', typeof event.detail === 'string' ? event.detail : input.value);
    });
  }
  function applyOverrides(target = getState().target, includeAppearance = true) {
    const state = getState();
    if (!target) return;
    buttonConfigurationUI.apply(target);
    groupConfigurationUI.apply(target);
    meterConfigurationUI.apply(target);
    if (state.selected.tag === 'md-segmented-button') applySegmentedContext(target, state.segmentedContext);
    if (includeAppearance) appearanceUI.apply(target);
    for (const [name, value] of Object.entries(state.docSlotValues || {})) {
      if (!editableTextSlot(state.selected, name)) continue;
      const masking = name === '' && defaultSlotMaskingProperty(state.selected.tag);
      if (masking) { target[masking] = ''; target.removeAttribute?.(masking); }
      for (const child of [...target.childNodes]) {
        const slot = child.nodeType === 1 ? child.getAttribute('slot') || '' : '';
        if (slot === name) child.remove();
      }
      const content = (target.ownerDocument || document).createElement('span'); if (name) content.slot = name;
      content.textContent = value; target.append(content);
    }
    const profile = componentAppearance(state.selected.tag);
    const appearance = includeAppearance && profile ? profile.css(state[profile.key], state[`${profile.key}Defaults`]) : {};
    applyCSS(target, state.docCssValues, appearance, profile ? profile.fields.filter(field => field.cssProperty).map(field => field.cssProperty) : []);
    if (profile?.partCSS) applyAppearancePartRules(target, includeAppearance ? [...profile.partCSS(state[`${profile.key}Defaults`]), ...profile.partCSS(state[profile.key])] : []);
  }
  function slotEditor(slot, index) {
    const state = getState(), component = state.selected;
    if (!editableTextSlot(component, slot.name)) return '<p class="prop-note">Use the composition above for this slot. Its icons, controls or child components remain interactive in the preview.</p>';
    const native = state.platform !== 'web' && nativeTextSlot(component, slot.name, state.platform);
    const destination = state.platform === 'web' ? 'Web preview and usage code' : native ? 'native preview and usage code' : 'Web usage code';
    return `<div class="usage-try-it"><p>Try plain text in the ${destination}. Clear the field to render empty content.</p><md-text-field id="slot-${index}" data-slot-index="${index}" label="${escape(slot.name || 'Default')} slot text" aria-label="${escape(slot.name || 'Default')} slot text" placeholder="Use fixture content" value="${escape(slotValue(slot.name))}" density="-2" variant="outlined"></md-text-field></div>`;
  }
  function memberRow(kind, member, content = '') {
    const state = getState(), doc = memberDocumentation(state.selected, kind, member, documentationPlatform());
    return `<article class="usage-member"><div class="usage-member-heading"><code>${escape(member.name || 'Default slot')}</code>${infoButton(kind, member, documentationPlatform())}</div>
      <p>${prose(doc.description)}</p>${content}</article>`;
  }
  function codeCard({ id, title, description, language, code, payload }) {
    return `<md-card id="${id}" class="usage-code-card" variant="filled" full-width density="-3"${payload ? ` data-usage-payload="${escape(payload)}"` : ''}><div class="usage-code-card-heading"><h4 id="${id}-title">${escape(title)}</h4><div class="usage-code-card-actions"><span class="usage-code-language">${escape(codeLanguageLabels[language] || language)}</span><md-icon-button icon="content_copy" size="xs" data-copy-api-code="${id}-code" aria-label="Copy ${escape(title)}"></md-icon-button></div></div><p class="usage-code-description">${prose(description)}</p><pre id="${id}-code" class="usage-code-body" data-code-language="${language}" tabindex="0" aria-labelledby="${id}-title">${escape(code)}</pre></md-card>`;
  }
  function nativeIntegration() {
    if (!['swift', 'android'].includes(snippetLanguage)) return '';
    return `<div class="native-integration-examples">${[
      ['state', 'Native content & state', nativeUsageExample(getState().selected, snippetLanguage)],
      ['theme', 'Native theme colors', nativeThemeExample(getState().selected, snippetLanguage)],
    ].filter(([, , example]) => example.code).map(([key, title, example]) => `<md-accordion-item id="usage-native-${key}" data-usage-disclosure headline="${title}" heading-level="3" density="-3">${codeCard({ id: `usage-native-${key}-example`, ...example })}${example.notes?.length ? `<ul class="usage-api-notes">${example.notes.map(note => `<li>${prose(note)}</li>`).join('')}</ul>` : ''}</md-accordion-item>`).join('')}</div>`;
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
  function renderCssVariables(styles) {
    const state = getState(), profile = componentAppearance(state.selected.tag);
    document.querySelector('#css-variables-tab').label = 'Styles';
    document.querySelector('#css-variables-count').textContent = String(profile ? profile.fields.length : new Set(styles.map(style => style.name)).size);
    appearanceUI.render();
    document.querySelector('#css-variables-note').textContent = styles.length
      ? `Web CSS overrides update web framework examples${state.platform === 'web' ? ' and this Web preview' : ''}.`
      : 'No public CSS variables declared.';
    stylesUI.render(styles);
  }
  function renderUsage({ frameworkOnly = false } = {}) {
    cancelPreparation();
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
    const markup = `<div class="usage-intro"><h2>Usage &amp; API</h2><p>Choose your framework to see how to render this component, handle events, add content and customize its appearance.</p></div>
      <section class="usage-example" aria-label="Live usage example"><div class="usage-code-heading"><md-tabs id="usage-language-tabs" variant="secondary" tab-width="auto" active-tab-index="${snippetLanguages.findIndex(language => language.id === snippetLanguage)}" aria-label="Code language">${snippetLanguages.map(language => `<md-tab id="usage-language-${language.id}" label="${escape(language.label)}" data-snippet-language="${language.id}" inline-icon${language.id === 'android' ? ' icon="android"' : ''}>${usageBrandIcon(language.id)}</md-tab>`).join('')}</md-tabs></div><md-card class="usage-snippet-card" variant="outlined" full-width><div class="usage-snippet-actions"><md-button type="button" id="copy-usage" variant="text" size="xs" icon="content_copy" aria-label="Copy usage code">Copy</md-button></div><pre id="usage-snippet" class="usage-code" tabindex="0" aria-label="Usage code"></pre></md-card></section>
      ${nativeIntegration()}
      <div class="api-reference"><div class="usage-api-toolbar"><div><h3>API examples</h3><p>Practical recipes for each API. Changing the framework updates every example.</p></div><md-select id="api-framework" label="Framework" aria-label="API examples framework" value="${snippetLanguage}" variant="outlined" density="-2">${snippetLanguages.map(language => `<md-select-option value="${language.id}">${language.id === 'swift' ? 'SwiftUI / iOS' : escape(language.label)}</md-select-option>`).join('')}</md-select></div>
      ${section('Events', events, events.map((event, index) => memberRow('event', event, memberExample('event', event, index) + eventPayload(event, index))).join(''), events.length ? '<md-button type="button" id="watch-usage-events" class="usage-action" variant="tonal" size="xs" density="0" icon="bolt">Watch live events</md-button>' : '')}
      ${section('Slots', slots, slots.map((slot, index) => memberRow('slot', slot, memberExample('slot', slot, index) + slotEditor(slot, index))).join(''))}
      ${section('Methods', methods, methods.map((method, index) => {
        const doc = memberDocumentation(component, 'method', method, documentationPlatform());
        const available = web || typeof invokeNativeMethod === 'function' && nativeMethodSupported(component.tag, method.name, component.support?.[state.platform]);
        const signature = method.signature || `${method.name}(${method.params || (method.parameters || []).map(p => `${p.name}: ${p.type?.text || p.type || 'unknown'}`).join(', ')})`;
        return memberRow('method', method, `<code class="usage-signature">${escape(signature)}</code>${doc.returnType && doc.returnType !== 'inferred' ? `<p>Returns <code>${escape(doc.returnType)}</code></p>` : ''}${memberExample('method', method, index)}<div class="usage-try-it"><p>${available ? `Try this method in the ${web ? 'Web' : 'native'} preview. Supply arguments as a JSON array.` : 'Switch the preview to Web to try this source method.'}</p><md-text-field id="method-${index}" data-method-args="${index}" data-method-name="${escape(method.name)}" label="Arguments (JSON array)" value="${escape(methodArguments.get(method.name) ?? JSON.stringify(methodExampleArguments(component, method) ?? []))}" density="-2" variant="outlined" ${available ? '' : 'disabled'}></md-text-field><md-button type="button" class="usage-action" variant="tonal" size="xs" data-run-method="${index}" ${available ? '' : 'disabled'}>Run ${escape(method.name)}</md-button><output class="usage-result" id="method-result-${index}" aria-live="polite"></output></div>`);
      }).join(''))}
      ${section('CSS parts', parts, parts.map((part, index) => memberRow('cssPart', part, memberExample('cssPart', part, index))).join(''))}
      ${(component.dataTypes?.length || component.callableProps?.length) ? section('Data & callback types', [...(component.dataTypes || []), ...(component.callableProps || [])], [...(component.dataTypes || []).map(type => ['dataType', type]), ...(component.callableProps || []).map(type => ['callableProp', type])].map(([kind, type], index) => memberRow(kind, type, codeCard({ id: `usage-data-type-${index}`, title: type.name, description: kind === 'callableProp' ? 'The function signature accepted by this callback property.' : 'The TypeScript declaration used by this component.', language: 'typescript', code: type.body || type.type?.text || type.type || '' }))).join('')) : ''}</div>`;
    const template = document.createElement('template'); template.innerHTML = markup;
    const commit = () => {
    if (generation !== renderGeneration) return;
    usageListeners.splice(0).forEach(remove => remove());
    if (sameComponent) {
      const currentArguments = new Map([...root.querySelectorAll('[data-method-name]')].map(input => [input.dataset.methodName, input.value]));
      for (const input of template.content.querySelectorAll('[data-method-name]')) {
        if (currentArguments.has(input.dataset.methodName)) input.setAttribute('value', currentArguments.get(input.dataset.methodName));
      }
      for (const input of template.content.querySelectorAll('[data-slot-index]')) input.setAttribute('value', slotValue(slots[Number(input.dataset.slotIndex)].name));
    }
    if (sameComponent) reconcile(root, template.content);
    else { root.innerHTML = markup; remember(root); }
    root.removeAttribute('aria-busy');
    // These are public component properties; reflect the shared selection even
    // when an AWC host has not yet reflected a recent user selection itself.
    root.querySelector('#usage-language-tabs').activeTabIndex = snippetLanguages.findIndex(language => language.id === snippetLanguage);
    root.querySelector('#api-framework').value = snippetLanguage;
    openDisclosures.forEach(id => { const item = root.querySelector(`#${id}`); if (item) item.expanded = true; });
    root.querySelectorAll('[data-code-language]').forEach(code => renderCode(code, code.textContent, code.dataset.codeLanguage));
    if (!frameworkOnly) renderCssVariables(styles);
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
      hide(); snippetLanguage = id; state.snippetLanguage = id; return renderUsage({ frameworkOnly: true });
    };
    bindUsage(root.querySelector('#usage-language-tabs'), 'mdTabChange', event => {
      if (event.target === root.querySelector('#usage-language-tabs')) return changeFramework(snippetLanguages[event.detail?.index]?.id);
    });
    bindUsage(root.querySelector('#api-framework'), 'mdChange', event => {
      const select = root.querySelector('#api-framework');
      if (event.target === select) return changeFramework(typeof event.detail === 'string' ? event.detail : event.detail?.value ?? select.value);
    });
    root.querySelectorAll('[data-copy-api-code]').forEach(button => bindUsage(button, 'mdClick', async () => {
      try { await navigator.clipboard.writeText(root.querySelector(`#${button.dataset.copyApiCode}`).textContent); notify('API example copied'); }
      catch { notify('Clipboard unavailable'); }
    }));
    bindUsage(root.querySelector('#copy-usage'), 'mdClick', async () => { try { await navigator.clipboard.writeText(snippet()); notify('Usage example copied'); } catch { notify('Clipboard unavailable'); } });
    bindUsage(root.querySelector('#watch-usage-events'), 'mdClick', watchEvents);
    const valueFor = (event, input) => typeof event.detail === 'string' ? event.detail : input.value;
    root.querySelectorAll('[data-slot-index]').forEach(input => bindUsage(input, 'mdInput', event => { if (event.target === input) setSlotValue(slots[Number(input.dataset.slotIndex)].name, valueFor(event, input)); }));
    root.querySelectorAll('[data-run-method]').forEach(button => bindUsage(button, 'mdClick', async () => {
      const index = Number(button.dataset.runMethod), output = root.querySelector(`#method-result-${index}`), target = state.target;
      button.disabled = true;
      try {
        const args = JSON.parse(root.querySelector(`[data-method-args="${index}"]`).value);
        if (!Array.isArray(args)) throw new Error('Use a JSON array of arguments.');
        const method = methods[index].name;
        let result;
        if (!web && nativeMethodSupported(component.tag, method, component.support?.[state.platform]) && invokeNativeMethod) result = await invokeNativeMethod(method, args);
        else {
          if (!target || typeof target[method] !== 'function') throw new Error('This method is unavailable in the current preview.');
          result = await target[method](...args);
        }
        if (generation !== renderGeneration || getState().target !== target) return;
        output.textContent = result?.nodeType === 1 && typeof result.tagName === 'string' ? `<${result.tagName.toLowerCase()}>` : result === undefined ? 'Done' : JSON.stringify(result);
        afterInteraction(); updateSnippet();
      } catch (error) {
        if (generation === renderGeneration && getState().target === target) output.textContent = error.message;
      }
      finally { button.disabled = false; }
    }));
    };
    const pending = sameComponent && frameworkOnly && prepareNewComponents(root, template.content, generation);
    if (pending) {
      root.setAttribute('aria-busy', 'true');
      return pending.then(ready => { if (ready) commit(); });
    }
    commit();
  }
  return { infoButton, renderUsage, updateSnippet, applyOverrides, textControl, configurationControls: () => buttonConfigurationUI.markup() + groupConfigurationUI.markup() + segmentedConfigurationUI.markup() + meterConfigurationUI.markup(), syncGroupSelection: groupConfigurationUI.sync, syncSegmentedSelection: segmentedConfigurationUI.sync, bindTextControl, filterProperties, beginRender() { hide(); }, dispose() { hide(); ++renderGeneration; cancelPreparation(); usageListeners.splice(0).forEach(remove => remove()); listeners.splice(0).forEach(remove => remove()); } };
}
