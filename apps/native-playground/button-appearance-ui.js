import { COMPONENT_APPEARANCES, componentAppearance } from './component-appearance.js';
import { applyAppearancePartRules } from './appearance-part-rules.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function createButtonAppearanceUI({ getState, onChange }) {
  const state = getState();
  for (const profile of Object.values(COMPONENT_APPEARANCES)) {
    state[profile.key] = {};
    state[`${profile.key}Defaults`] = {};
  }
  // Retire the former Studio-wide defaults so hidden settings cannot affect previews.
  try { localStorage.removeItem('awc-studio-button-appearance'); } catch { /* Storage is optional. */ }
  let mounted;
  const originalStyles = new WeakMap();
  function setAppearance(target, profile, appearance) {
    if (!originalStyles.has(target)) originalStyles.set(target, new Map(profile.fields.filter(field => field.cssProperty).map(field => [field.cssProperty, [target.style.getPropertyValue?.(field.cssProperty) || '', target.style.getPropertyPriority?.(field.cssProperty) || '']])));
    for (const [name, [value, priority]] of originalStyles.get(target)) {
      if (value) target.style.setProperty(name, value, priority);
      else target.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(profile.css(appearance))) target.style.setProperty(name, value);
    if (profile.partCSS) applyAppearancePartRules(target, profile.partCSS(appearance));
  }
  const root = () => document.querySelector('#button-appearance-controls');
  const values = () => getState()[componentAppearance(getState().selected?.tag)?.key] || {};
  function changed() { onChange(); }
  function sync() {
    root().querySelectorAll('[data-appearance-field]').forEach(input => {
      const name = input.dataset.appearanceField;
      const profile = componentAppearance(getState().selected?.tag);
      input.value = profile.formatInput ? profile.formatInput(name, values()[name]) : values()[name] === undefined ? '' : String(values()[name]);
      input.placeholder = 'Component default';
      input.error = false;
    });
  }
  function render() {
    const host = root();
    const profile = componentAppearance(getState().selected?.tag);
    host.hidden = !profile;
    if (host.hidden) return;
    if (mounted !== profile) {
      mounted = profile;
      const descriptors = new Map(profile.fields.map(field => [field.name, field]));
      host.innerHTML = `<div class="appearance-intro"><h3>Shared appearance</h3><p>Style the same component on Web, iOS and Android.</p></div>
        <p class="prop-note appearance-editor-note">Applies to this component. Leave a field blank to use its default style.</p>
        <div class="appearance-groups">${profile.groups.map(([title, fields], index) => `<md-accordion-item headline="${title}" heading-level="4" density="-3"${index === 0 ? ' expanded' : ''}><div class="appearance-fields">${fields.map(name => {
          const field = descriptors.get(name);
          const hint = field.hint || (field.kind === 'color' ? 'Hex color, for example #6750A4.' : `${field.min}–${field.max}${/Opacity|Weight/.test(name) ? '' : ['fontSize', 'lineHeight', 'letterSpacing'].includes(name) ? ' px / pt / sp' : ' px / pt / dp'}.`);
          return `<md-text-field id="appearance-${name}" data-appearance-field="${name}" label="${escape(field.label)}" aria-label="${escape(field.label)}" supporting-text="${escape(hint)}" type="text" inputmode="${field.kind === 'number' ? 'decimal' : 'text'}" variant="outlined" density="-3" clearable="internal"></md-text-field>`;
        }).join('')}</div></md-accordion-item>`).join('')}</div>
        <md-button id="appearance-reset" variant="text" size="xs" icon="restart_alt" full-width>Reset style</md-button>
        <p class="prop-note appearance-boundary">${escape(profile.note)}</p>`;
      host.querySelector('#appearance-reset').addEventListener('mdClick', () => { getState()[profile.key] = {}; sync(); changed(); });
      host.querySelectorAll('[data-appearance-field]').forEach(input => input.addEventListener('mdInput', event => {
        if (event.target !== input) return;
        const name = input.dataset.appearanceField, field = descriptors.get(name);
        const raw = String(typeof event.detail === 'string' ? event.detail : input.value).trim();
        try {
          const next = { ...values() };
          if (!raw) delete next[name];
          else next[name] = profile.parseInput ? profile.parseInput(name, raw) : field.kind === 'number' ? Number(raw) : raw;
          getState()[profile.key] = profile.normalize(next);
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
    const profile = componentAppearance(current.selected?.tag);
    if (profile) setAppearance(target, profile, current[profile.key]);
  }
  return { render, apply };
}
