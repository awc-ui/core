/** Selection belongs to authored children, never to a synthetic group property. */
export function normalizeButtonGroupSelection(value) {
  if (!Array.isArray(value) || value.length > 100 || Reflect.ownKeys(value).length !== value.length + 1) throw Object.assign(new Error('Button group selection must be an array of at most 100 booleans.'), { code: 'INVALID_BUTTON_GROUP_SELECTION' });
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean') throw Object.assign(new Error('Every child selection must be a boolean.'), { code: 'INVALID_BUTTON_GROUP_SELECTION' });
    return descriptor.value;
  });
}
export function buttonGroupSelectionOptions(value, tag) {
  if (value === undefined) return {};
  if (tag !== undefined && tag !== 'md-button-group') throw Object.assign(new Error('Child selection applies to md-button-group only.'), { code: 'INVALID_BUTTON_GROUP_SELECTION' });
  return { buttonGroupSelection: normalizeButtonGroupSelection(value) };
}
export function updateButtonGroupSelection(state, value) {
  if (state.selected?.tag !== 'md-button-group' || value === undefined) return false;
  const next = normalizeButtonGroupSelection(value);
  if (next.length !== state.buttonGroupChildren?.length) return false;
  if (next.every((selected, index) => selected === state.buttonGroupSelection?.[index])) return false;
  state.buttonGroupSelection = next;
  return true;
}
export function applyButtonGroupSelection(target, selection) {
  if (target?.localName !== 'md-button-group' || selection === undefined) return;
  const next = normalizeButtonGroupSelection(selection), children = [...target.querySelectorAll('md-button,md-icon-button')];
  if (next.length !== children.length) return;
  children.forEach((child, index) => { child.selected = next[index]; });
}
