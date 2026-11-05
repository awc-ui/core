import { normalizeThemeColorTokens } from './theme-color-tokens.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** The selected Meter's custom roles supplement the regular preview theme. */
export function meterThemeOptions(state, options = {}) {
  if (state.selected?.tag !== 'md-meter') return options;
  const local = normalizeThemeColorTokens(state.meterThemeTokens || {});
  return Object.keys(local).length ? { ...options, themeTokens: { ...options.themeTokens, ...local } } : options;
}

export function createMeterConfigurationUI({ getState, onChange }) {
  const applied = new WeakMap();
  function markup() {
    const state = getState();
    if (state.selected?.tag !== 'md-meter') return '';
    const value = Object.keys(state.meterThemeTokens || {}).length ? JSON.stringify(state.meterThemeTokens, null, 2) : '';
    return `<div class="prop-control" data-search="theme role colors tokens meter custom alpha"><div class="prop-heading"><label class="prop-label" for="meter-theme-tokens">Theme role colors</label><span class="prop-type">JSON</span></div><md-text-field multiline="fixed" id="meter-theme-tokens" aria-label="Theme role colors" aria-describedby="meter-theme-tokens-note" variant="outlined" density="-3" rows="4" value="${escape(value)}" placeholder='{"--md-sys-color-custom": "#33669980", "--md-sys-color-custom-container": "#E0E8F0"}'></md-text-field><p class="prop-note" id="meter-theme-tokens-note">Add color tokens for the color property, including custom roles. Use #RRGGBB or #RRGGBBAA; token names are case-sensitive. Clear to restore the preview theme.</p></div>`;
  }
  function bind() {
    const input = document.querySelector('#meter-theme-tokens');
    input?.addEventListener('mdInput', event => {
      if (event.target !== input || getState().selected?.tag !== 'md-meter') return;
      const raw = typeof event.detail === 'string' ? event.detail : input.value;
      try {
        const value = String(raw ?? '').trim();
        const tokens = normalizeThemeColorTokens(value ? JSON.parse(value) : {});
        input.error = false; input.errorText = '';
        getState().meterThemeTokens = tokens;
        onChange?.();
      } catch (error) {
        input.error = true;
        input.errorText = error instanceof SyntaxError ? 'Enter a JSON object of color-token names and hexadecimal colors.' : error.message;
      }
    });
  }
  function apply(target) {
    if (!target?.style || getState().selected?.tag !== 'md-meter') return;
    const current = normalizeThemeColorTokens(getState().meterThemeTokens || {});
    let previous = applied.get(target);
    if (!previous) { previous = new Map(); applied.set(target, previous); }
    for (const [key, original] of previous) {
      if (Object.hasOwn(current, key)) continue;
      if (original.value) target.style.setProperty(key, original.value, original.priority);
      else target.style.removeProperty(key);
      previous.delete(key);
    }
    for (const [key, value] of Object.entries(current)) {
      if (!previous.has(key)) previous.set(key, { value: target.style.getPropertyValue(key), priority: target.style.getPropertyPriority(key) });
      target.style.setProperty(key, value);
    }
  }
  return { markup, bind, apply };
}
