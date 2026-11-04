import { applyButtonGroupSelection, updateButtonGroupSelection } from './button-group-state.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function createButtonGroupConfigurationUI({ getState, onChange }) {
  const root = () => document.querySelector('#props-controls');
  function markup() {
    const state = getState();
    if (state.selected?.tag !== 'md-button-group') return '';
    return `<div class="prop-control" data-search="child buttons selected selection"><h4>Child selection</h4><p class="prop-note">Set each authored button’s initial selection. User interactions follow the group’s selection mode and required setting.</p>${(state.buttonGroupChildren || []).map((child, index) => `<md-switch id="group-child-${index}" data-group-child="${index}" aria-label="${escape(child.label)} selected" supporting-text="${escape(child.label)}${child.value ? ' · ' + escape(child.value) : ''}"${state.buttonGroupSelection?.[index] ? ' selected' : ''}></md-switch>`).join('')}</div>`;
  }
  function sync() {
    const state = getState();
    root()?.querySelectorAll('[data-group-child]').forEach(input => { input.selected = state.buttonGroupSelection?.[Number(input.dataset.groupChild)] === true; });
  }
  function bind() {
    root()?.querySelectorAll('[data-group-child]').forEach(input => input.addEventListener('mdChange', event => {
      if (event.target !== input) return;
      const next = [...(getState().buttonGroupSelection || [])];
      next[Number(input.dataset.groupChild)] = input.selected === true;
      if (updateButtonGroupSelection(getState(), next)) onChange?.();
    }));
  }
  function apply(target) { if (getState().selected?.tag === 'md-button-group') applyButtonGroupSelection(target, getState().buttonGroupSelection); }
  return { markup, bind, apply, sync };
}
