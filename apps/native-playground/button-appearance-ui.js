import { BUTTON_APPEARANCE_FIELDS, normalizeButtonAppearance, buttonAppearanceCSS } from './button-appearance.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const groups = [
  ['Surface', ['containerColor', 'outlineColor', 'outlineWidth', 'cornerRadius', 'paddingInline', 'paddingBlock', 'gap']],
  ['Label', ['labelColor', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']],
  ['Icons', ['iconColor', 'iconSize', 'trailingIconColor', 'trailingIconSize']],
  ['Loading', ['loadingColor', 'loadingSize']],
  ['Interaction states', ['stateLayerColor', 'hoverOpacity', 'focusOpacity', 'pressedOpacity']],
];

export function createButtonAppearanceUI({ getState, onChange }) {
  const state = getState();
  state.buttonAppearance = {};
  state.buttonAppearanceDefaults = {};
  // Retire the former Studio-wide defaults so hidden settings cannot affect previews.
  try { localStorage.removeItem('awc-studio-button-appearance'); } catch { /* Storage is optional. */ }
  let mounted = false;
  const originalStyles = new WeakMap();
  function setAppearance(target, appearance, inherited) {
    if (!originalStyles.has(target)) originalStyles.set(target, new Map(BUTTON_APPEARANCE_FIELDS.map(field => [field.cssProperty, [target.style.getPropertyValue?.(field.cssProperty) || '', target.style.getPropertyPriority?.(field.cssProperty) || '']])));
    for (const [name, [value, priority]] of originalStyles.get(target)) {
      if (value) target.style.setProperty(name, value, priority);
      else target.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(buttonAppearanceCSS(appearance, inherited))) target.style.setProperty(name, value);
  }
  const root = () => document.querySelector('#button-appearance-controls');
  const values = () => getState().buttonAppearance || {};
  function changed() { onChange(); }
  function sync() {
    root().querySelectorAll('[data-appearance-field]').forEach(input => {
      const name = input.dataset.appearanceField;
      input.value = values()[name] === undefined ? '' : String(values()[name]);
      input.placeholder = 'Component default';
      input.error = false;
    });
  }
  function render() {
    const host = root();
    host.hidden = getState().selected?.tag !== 'md-button';
    if (host.hidden) return;
    if (!mounted) {
      mounted = true;
      const descriptors = new Map(BUTTON_APPEARANCE_FIELDS.map(field => [field.name, field]));
      host.innerHTML = `<div class="appearance-intro"><h3>Shared appearance</h3><p>Style the same button on Web, iOS and Android.</p></div>
        <p class="prop-note appearance-editor-note">Applies to this button. Leave a field blank to use its default style.</p>
        <div class="appearance-groups">${groups.map(([title, fields], index) => `<md-accordion-item headline="${title}" heading-level="4" density="-3"${index === 0 ? ' expanded' : ''}><div class="appearance-fields">${fields.map(name => {
          const field = descriptors.get(name);
          const hint = field.kind === 'color' ? 'Hex color, for example #6750A4.' : `${field.min}–${field.max}${/Opacity|Weight/.test(name) ? '' : ['fontSize', 'lineHeight', 'letterSpacing'].includes(name) ? ' px / pt / sp' : ' px / pt / dp'}.`;
          return `<md-text-field id="appearance-${name}" data-appearance-field="${name}" label="${escape(field.label)}" aria-label="${escape(field.label)}" supporting-text="${escape(hint)}" type="text" inputmode="${field.kind === 'number' ? 'decimal' : 'text'}" variant="outlined" density="-3" clearable="internal"></md-text-field>`;
        }).join('')}</div></md-accordion-item>`).join('')}</div>
        <md-button id="appearance-reset" variant="text" size="xs" icon="restart_alt">Reset style</md-button>
        <p class="prop-note appearance-boundary">Explicit corner radius stays fixed on press. Authored slot content keeps its own styling. Typography uses CSS pixels on Web, points on SwiftUI and scalable text units on Android.</p>`;
      host.querySelector('#appearance-reset').addEventListener('mdClick', () => { getState().buttonAppearance = {}; sync(); changed(); });
      host.querySelectorAll('[data-appearance-field]').forEach(input => input.addEventListener('mdInput', event => {
        if (event.target !== input) return;
        const name = input.dataset.appearanceField, field = descriptors.get(name);
        const raw = String(typeof event.detail === 'string' ? event.detail : input.value).trim();
        try {
          const next = { ...values() };
          if (!raw) delete next[name];
          else next[name] = field.kind === 'number' ? Number(raw) : raw;
          getState().buttonAppearance = normalizeButtonAppearance(next);
          input.error = false;
          changed();
        } catch (error) { input.error = true; input.errorText = error.message; }
      }));
    }
    // Preserve incomplete edits while normal property/native refreshes occur.
    if (!host.contains(document.activeElement)) sync();
  }
  function apply(target) {
    if (!target) return;
    const current = getState();
    if (current.selected?.tag !== 'md-button') return;
    setAppearance(target, current.buttonAppearance);
  }
  return { render, apply };
}
