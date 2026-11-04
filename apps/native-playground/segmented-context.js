export const SEGMENTED_CHILDREN = Object.freeze([
  Object.freeze({ label: 'Day', value: 'day', selected: true }),
  Object.freeze({ label: 'Week', value: 'week', selected: false }),
  Object.freeze({ label: 'Month', value: 'month', selected: false }),
]);
export const SEGMENTED_PARENT_PROPERTIES = Object.freeze(['segmentIndex', 'segmentTotal', 'segmentDensity', 'segmentMultiselect']);
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_SEGMENTED_CONTEXT' });
const allowedTag = tag => ['md-segmented-button', 'md-segmented-button-set'].includes(tag);

function selection(value, lengths) {
  if (!Array.isArray(value) || !lengths.includes(value.length) || Reflect.ownKeys(value).length !== value.length + 1) throw invalid('Segment selection must match the authored segment count.');
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean') throw invalid('Every segment selection must be a Boolean.');
    return descriptor.value;
  });
}

export const defaultSegmentedContext = () => ({ mode: 'set', multiselect: false, density: 0, selection: SEGMENTED_CHILDREN.map(child => child.selected) });
export function normalizeSegmentedContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== 4 || Reflect.ownKeys(value).some(key => !['mode', 'multiselect', 'density', 'selection'].includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) throw invalid('Segmented context requires mode, multiselect, density and selection data.');
  if (!['set', 'standalone'].includes(value.mode) || typeof value.multiselect !== 'boolean' || ![0, -1, -2, -3, -4].includes(value.density)) throw invalid('Choose a valid segmented preview mode, selection mode and density.');
  return { mode: value.mode, multiselect: value.multiselect, density: value.density, selection: selection(value.selection, [value.mode === 'set' ? SEGMENTED_CHILDREN.length : 0]) };
}
export function segmentedContextOptions(value, tag) {
  if (value === undefined) return {};
  if (!allowedTag(tag)) throw invalid('Segmented context applies to segmented buttons only.');
  const normalized = normalizeSegmentedContext(value);
  if (tag === 'md-segmented-button-set' && normalized.mode === 'standalone') throw invalid('A segmented set requires set mode.');
  return { segmentedContext: normalized };
}
export function segmentedSelectionOptions(value, tag, context) {
  if (value === undefined) return {};
  if (!allowedTag(tag)) throw invalid('Segmented selection applies to segmented buttons only.');
  const lengths = context === undefined ? (tag === 'md-segmented-button-set' ? [SEGMENTED_CHILDREN.length] : [0, SEGMENTED_CHILDREN.length]) : [normalizeSegmentedContext(context).mode === 'set' ? SEGMENTED_CHILDREN.length : 0];
  return { segmentedSelection: selection(value, lengths) };
}
export function segmentedParentProperties(context) {
  const c = normalizeSegmentedContext(context);
  return c.mode === 'set' ? { segmentIndex: 0, segmentTotal: c.selection.length, segmentDensity: c.density, segmentMultiselect: c.multiselect } : {};
}
export function updateSegmentedSelection(state, value) {
  if (!allowedTag(state.selected?.tag) || state.segmentedContext?.mode !== 'set' || value === undefined) return false;
  const next = selection(value, [0, SEGMENTED_CHILDREN.length]);
  if (next.length !== state.segmentedContext.selection.length) return false;
  if (next.every((selected, index) => selected === state.segmentedContext.selection[index])) return false;
  state.segmentedContext = { ...state.segmentedContext, selection: next };
  if (state.selected.tag === 'md-segmented-button') {
    state.props.selected = next[0];
    state.editedProps ||= {};
    state.editedProps.selected = next[0];
  }
  return true;
}
export function applySegmentedContext(target, value) {
  if (!target || !allowedTag(target.localName) || value === undefined) return;
  const context = normalizeSegmentedContext(value);
  if (context.mode !== 'set') return;
  const set = target.localName === 'md-segmented-button-set' ? target : target.closest('md-segmented-button-set');
  if (!set) return;
  const children = [...set.querySelectorAll('md-segmented-button')];
  if (children.length !== context.selection.length) return;
  set.multiselect = context.multiselect; set.density = context.density;
  children.forEach((child, index) => {
    child.selected = context.selection[index];
    Object.assign(child, { segmentIndex: index, segmentTotal: children.length, segmentDensity: context.density, segmentMultiselect: context.multiselect });
  });
}
