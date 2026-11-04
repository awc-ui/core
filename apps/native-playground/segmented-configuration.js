import { SEGMENTED_CHILDREN, SEGMENTED_PARENT_PROPERTIES, defaultSegmentedContext, normalizeSegmentedContext, segmentedParentProperties, updateSegmentedSelection } from './segmented-context.js';

export function createSegmentedConfigurationUI({ getState, onChange }) {
  const root = () => document.querySelector('#props-controls');
  function markup() {
    const state = getState();
    if (state.selected?.tag !== 'md-segmented-button') return '';
    const context = state.segmentedContext || defaultSegmentedContext();
    return `<div class="prop-control" data-search="preview composition standalone set multiselect density children selection"><h4>Preview composition</h4>
      <md-select id="segment-preview-mode" label="Composition" aria-label="Segment composition" value="${context.mode}" density="-3" variant="outlined"><md-select-option value="set">Inside a set</md-select-option><md-select-option value="standalone">Standalone segment</md-select-option></md-select>
      <p class="prop-note">${context.mode === 'set' ? 'The set owns index, total, parent density and multiselect. Its selection follows the authored child order.' : 'All segment properties are editable. Activation proposes selection; it does not automatically commit it.'}</p>
      ${context.mode === 'set' ? `<md-switch id="segment-set-multiselect" aria-label="Set multiselect" supporting-text="Set multiselect"${context.multiselect ? ' selected' : ''}></md-switch>
      <md-select id="segment-set-density" label="Set density" aria-label="Set density" value="${context.density}" density="-3" variant="outlined">${[0,-1,-2,-3,-4].map(value => `<md-select-option value="${value}">${value}</md-select-option>`).join('')}</md-select>
      <h4>Child selection</h4>${SEGMENTED_CHILDREN.map((child, index) => `<md-switch data-segment-child="${index}" aria-label="${child.label} selected" supporting-text="${child.label}"${context.selection[index] ? ' selected' : ''}></md-switch>`).join('')}` : ''}</div>`;
  }
  function bind() {
    const change = (patch, mode = false) => {
      const state = getState(), before = state.segmentedContext || defaultSegmentedContext();
      if (mode) {
        if (patch.mode === 'set') {
          state.segmentedStandaloneProperties = Object.fromEntries(SEGMENTED_PARENT_PROPERTIES.map(name => [name, state.props[name]]));
          patch.selection = [state.props.selected === true, ...(state.segmentedSetSelection || [false, false])];
        } else {
          state.segmentedSetSelection = before.selection.slice(1);
          patch.selection = [];
          Object.assign(state.props, state.segmentedStandaloneProperties || { segmentIndex: 0, segmentTotal: 1, segmentDensity: 0, segmentMultiselect: false });
          state.editedProps ||= {};
          for (const name of SEGMENTED_PARENT_PROPERTIES) state.editedProps[name] = state.props[name];
        }
      }
      state.segmentedContext = normalizeSegmentedContext({ ...before, ...patch });
      Object.assign(state.props, segmentedParentProperties(state.segmentedContext));
      onChange?.();
    };
    root()?.querySelector('#segment-preview-mode')?.addEventListener('mdChange', event => {
      if (event.target.id === 'segment-preview-mode' && ['set', 'standalone'].includes(event.target.value) && event.target.value !== (getState().segmentedContext || defaultSegmentedContext()).mode) change({ mode: event.target.value }, true);
    });
    root()?.querySelector('#segment-set-multiselect')?.addEventListener('mdChange', event => { if (event.target.id === 'segment-set-multiselect') change({ multiselect: event.target.selected === true }); });
    root()?.querySelector('#segment-set-density')?.addEventListener('mdChange', event => { if (event.target.id === 'segment-set-density' && [0,-1,-2,-3,-4].includes(Number(event.target.value))) change({ density: Number(event.target.value) }); });
    root()?.querySelectorAll('[data-segment-child]').forEach(input => input.addEventListener('mdChange', event => {
      if (event.target !== input) return;
      const state = getState(), next = [...state.segmentedContext.selection];
      next[Number(input.dataset.segmentChild)] = input.selected === true;
      if (updateSegmentedSelection(state, next)) onChange?.();
    }));
  }
  function sync() {
    root()?.querySelectorAll('[data-segment-child]').forEach(input => { input.selected = getState().segmentedContext?.selection[Number(input.dataset.segmentChild)] === true; });
    const selected = root()?.querySelector('#prop-selected');
    if (selected && getState().segmentedContext?.mode === 'set') selected.selected = getState().segmentedContext.selection[0];
  }
  return { markup, bind, sync };
}
