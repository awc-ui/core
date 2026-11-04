/** Retain committed state when a platform switch recreates the recipe. */
export function setFabMenuOpen(state, open) {
  if (state.selected?.tag !== 'md-fab-menu' || state.nativeScenario || typeof open !== 'boolean') return false;
  const changed = state.props?.open !== open;
  state.props ||= {};
  state.props.open = open;
  if (state.editedTag !== state.selected.tag) state.editedProps = {};
  state.editedTag = state.selected.tag;
  state.editedProps ||= {};
  state.editedProps.open = open;
  return changed;
}

/** Lifecycle notifications follow committed state, independently of method ACKs. */
export function updateFabMenuState(state, events) {
  if (!['ios', 'android'].includes(state.platform)) return false;
  let open;
  for (const event of events) {
    if (event.tag !== 'md-fab-menu' || event.nodeID !== 'component') continue;
    if (event.name === 'mdOpen') open = true;
    else if (event.name === 'mdClose') open = false;
  }
  return setFabMenuOpen(state, open);
}
