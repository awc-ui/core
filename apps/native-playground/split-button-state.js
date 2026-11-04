/** Capture-correlated root state. Event values from arbitrary descendants are not authoritative. */
export function splitButtonCheckedOptions(value, tag) {
  if (value === undefined) return {};
  if (tag !== 'md-split-button' || typeof value !== 'boolean') {
    throw Object.assign(new Error('Split button checked state must be a Boolean for the selected split button.'), { code: 'INVALID_SPLIT_BUTTON_STATE' });
  }
  return { splitButtonChecked: value };
}

export function updateSplitButtonChecked(state, checked) {
  if (state.selected?.tag !== 'md-split-button' || typeof checked !== 'boolean') return false;
  const changed = state.props?.trailingChecked !== checked;
  state.props ||= {};
  state.props.trailingChecked = checked;
  if (state.editedTag !== state.selected.tag) state.editedProps = {};
  state.editedTag = state.selected.tag;
  state.editedProps ||= {};
  state.editedProps.trailingChecked = checked;
  return changed;
}
