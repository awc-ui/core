import { componentContentSlots, componentSlotElement, nativeContentSlots } from './content-slots.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const labelFor = name => ({ 'leading-icon': 'Leading icon slot', 'trailing-icon': 'Trailing icon slot', loader: 'Loader slot', icon: 'Icon slot', '': 'Default icon slot', selected: 'Selected icon slot' })[name];
const slotId = name => name || 'default';
const isButton = tag => ['md-button', 'md-icon-button'].includes(tag);
const configurable = tag => isButton(tag) || ['md-badge', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(tag);
const slotMode = value => value === undefined ? 'default' : typeof value === 'string' ? 'text' : value.kind;

/** Only a committed root button change updates the shared configuration. */
export function nativeButtonSelection(state, events) {
  if (!isButton(state.selected?.tag) || state.nativeScenario || !['ios', 'android'].includes(state.platform)) return undefined;
  let selected;
  for (const event of events) {
    if (event.tag === state.selected.tag &&
        (event.tag === 'md-icon-button' ? event.name === 'mdClick' : event.name === 'mdChange' && event.defaultPrevented !== true) &&
        typeof event.detail?.selected === 'boolean') selected = event.detail.selected;
  }
  return selected;
}

/** Persist live state for the next Web mount/native session, not only the switch. */
export function setButtonSelection(state, selected) {
  if (!isButton(state.selected?.tag) || typeof selected !== 'boolean') return;
  state.props ||= {};
  state.props.selected = selected;
  if (state.editedTag !== state.selected.tag) state.editedProps = {};
  state.editedTag = state.selected.tag;
  state.editedProps ||= {};
  state.editedProps.selected = selected;
}

/** Finite named-slot compositions and the host attribute used by icon rotation. */
export function createButtonConfigurationUI({ getState, infoButton, onChange }) {
  const originalSlots = new WeakMap();
  const root = () => document.querySelector('#props-controls');
  function markup() {
    const state = getState();
    if (!configurable(state.selected?.tag)) return '';
    const iconButton = ['md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(state.selected.tag);
    const expanded = state.props?.['aria-expanded'];
    const expandedControl = `<div class="prop-control literal" data-search="aria-expanded expanded trailing icon rotation accessibility"><div class="prop-heading"><label class="prop-label" for="button-aria-expanded"><code>aria-expanded</code></label><span class="prop-type">host attribute</span></div><md-select id="button-aria-expanded" aria-label="aria-expanded" aria-describedby="button-expanded-note" value="${expanded === true ? 'true' : expanded === false ? 'false' : ''}" variant="outlined" density="-3"><md-select-option value="">Unset</md-select-option><md-select-option value="false">false</md-select-option><md-select-option value="true">true</md-select-option></md-select><p id="button-expanded-note" class="prop-note">Expanded state for a disclosure trigger. Also rotates its trailing icon unless suppressExpandIconFlip is enabled.</p></div>`;
    const nameControl = `<div class="prop-control text" data-search="aria-label accessible name accessibility"><div class="prop-heading"><label class="prop-label" for="button-aria-label"><code>aria-label</code></label><span class="prop-type">host attribute</span></div><md-text-field id="button-aria-label" aria-label="Accessible name" value="${escape(state.props?.['aria-label'] || '')}" variant="outlined" density="-3"></md-text-field><p class="prop-note">Accessible name for this action.</p></div>`;
    return (state.selected.tag === 'md-badge' ? '' : iconButton ? nameControl : expandedControl) +
      componentContentSlots(state.selected.tag).filter(name => state.selected.slots?.some(slot => slot.name === name)).map(name => {
        const value = state.docSlotValues?.[name], mode = slotMode(value), label = labelFor(name);
        return `<div class="prop-control text" data-search="${name} ${label.toLowerCase()} content symbol loader progress"><div class="prop-heading"><label class="prop-label" for="button-slot-mode-${slotId(name)}">${label}</label>${infoButton?.('slot', { name }) || ''}<span class="prop-type">content</span></div><md-select id="button-slot-mode-${slotId(name)}" data-button-slot-mode="${name}" aria-label="${label} content" value="${mode}" variant="outlined" density="-3"><md-select-option value="default">Default</md-select-option><md-select-option value="text">Text</md-select-option><md-select-option value="symbol">Material Symbol</md-select-option>${name === 'loader' ? '<md-select-option value="progress">Circular progress</md-select-option>' : ''}</md-select><md-text-field id="button-slot-value-${slotId(name)}" data-button-slot-value="${name}" aria-label="${label} value" value="${escape(typeof value === 'string' ? value : value?.value || '')}" placeholder="${mode === 'symbol' ? 'add' : 'Slot text'}" variant="outlined" density="-3"${['default', 'progress'].includes(mode) ? ' hidden' : ''}></md-text-field><p class="prop-note">Default uses the component fallback. Text and symbols replace this slot; empty text is supplied as literal slot content.${name === 'loader' ? ' Enable loading to see this slot.' : state.selected.tag === 'md-segmented-button' ? ' This slot is additional to the built-in icon or checkmark reservation.' : ''}</p></div>`;
      }).join('');
  }
  function commit(name, value, input) {
    const state = getState(), slots = { ...state.docSlotValues };
    if (value === undefined) delete slots[name]; else slots[name] = value;
    try { state.docSlotValues = nativeContentSlots(slots, state.selected.tag).slots; }
    catch (error) { input.error = true; input.errorText = error.message; return false; }
    input.error = false;
    onChange?.(name, value);
    return true;
  }
  function bind() {
    root()?.querySelector('#button-aria-label')?.addEventListener('mdInput', event => {
      if (event.target.id !== 'button-aria-label') return;
      const value = typeof event.detail === 'string' ? event.detail : event.target.value;
      const state = getState();
      state.props ||= {};
      state.props['aria-label'] = value;
      onChange?.('aria-label', value);
    });
    root()?.querySelector('#button-aria-expanded')?.addEventListener('mdChange', event => {
      if (event.target.id !== 'button-aria-expanded') return;
      const value = event.target.value;
      if (!['', 'true', 'false'].includes(value)) return;
      const state = getState();
      state.props ||= {};
      if (!value) delete state.props['aria-expanded']; else state.props['aria-expanded'] = value === 'true';
      onChange?.('aria-expanded', value ? value === 'true' : undefined);
    });
    root()?.querySelectorAll('[data-button-slot-mode]').forEach(input => input.addEventListener('mdChange', event => {
      if (event.target !== input) return;
      const name = input.dataset.buttonSlotMode, mode = input.value;
      if (!['default', 'text', 'symbol', ...(name === 'loader' ? ['progress'] : [])].includes(mode)) return;
      const field = root().querySelector(`#button-slot-value-${slotId(name)}`);
      const current = getState().docSlotValues?.[name];
      const value = mode === 'default' ? undefined : mode === 'progress' ? { kind: 'progress' }
        : mode === 'symbol' ? { kind: 'symbol', value: current?.kind === 'symbol' ? current.value : name === '' ? 'favorite_border' : name === 'selected' ? 'favorite' : name === 'trailing-icon' ? 'arrow_forward' : name === 'loader' ? 'hourglass_empty' : 'add' }
          : typeof current === 'string' ? current : '';
      if (!commit(name, value, field)) return;
      field.hidden = mode === 'default' || mode === 'progress';
      field.value = typeof value === 'string' ? value : value?.value || '';
      field.placeholder = mode === 'symbol' ? 'add' : 'Slot text';
    }));
    root()?.querySelectorAll('[data-button-slot-value]').forEach(input => input.addEventListener('mdInput', event => {
      if (event.target !== input) return;
      const name = input.dataset.buttonSlotValue, mode = root().querySelector(`#button-slot-mode-${slotId(name)}`)?.value;
      if (!['text', 'symbol'].includes(mode)) return;
      const value = typeof event.detail === 'string' ? event.detail : input.value;
      commit(name, mode === 'symbol' ? { kind: 'symbol', value: value.trim() } : value, input);
    }));
  }
  function apply(target) {
    const state = getState();
    if (!target || !configurable(state.selected?.tag)) return;
    if (['md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(state.selected.tag) && typeof state.props?.['aria-label'] === 'string') target.setAttribute?.('aria-label', state.props['aria-label']);
    const expanded = state.props?.['aria-expanded'];
    if (state.selected.tag === 'md-button') {
      if (expanded === true || expanded === false) target.setAttribute?.('aria-expanded', String(expanded));
      else target.removeAttribute?.('aria-expanded');
    }
    let slots = originalSlots.get(target);
    if (!slots) { slots = new Map(); originalSlots.set(target, slots); }
    for (const name of componentContentSlots(state.selected.tag)) {
      const value = state.docSlotValues?.[name];
      let saved = slots.get(name);
      if (value === undefined && !saved) continue;
      if (!saved) {
        saved = { original: [...target.childNodes].filter(child => name ? child.nodeType === 1 && child.getAttribute('slot') === name
          : child.nodeType === 3 || child.nodeType === 1 && !child.getAttribute('slot') && child.localName !== 'md-badge'), node: null, signature: null };
        slots.set(name, saved);
      }
      if (value === undefined) {
        saved.node?.remove();
        for (const node of saved.original) target.append(node);
        slots.delete(name);
        continue;
      }
      const descriptor = componentSlotElement(state.selected.tag, name, value, state.props);
      const signature = JSON.stringify(descriptor);
      if (saved.signature === signature && saved.node?.parentNode === target) continue;
      for (const child of saved.original) child.remove();
      if (saved.node?.localName !== descriptor.tag) {
        saved.node?.remove();
        saved.node = (target.ownerDocument || document).createElement(descriptor.tag);
      }
      for (const attribute of saved.node.getAttributeNames()) if (!(attribute in descriptor.attributes)) saved.node.removeAttribute(attribute);
      for (const [name, value] of Object.entries(descriptor.attributes)) saved.node.setAttribute(name, value);
      if (descriptor.text !== undefined) saved.node.textContent = descriptor.text;
      if (saved.node.parentNode !== target) target.append(saved.node);
      saved.signature = signature;
    }
  }
  return { markup, bind, apply };
}
