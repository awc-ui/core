// Svelte action: assign JS-only properties (series, xAxis, data …) onto an
// AWC chart element. Objects and arrays have no attribute form, so they must
// be set as properties; Stencil captures pre-upgrade own properties, so this
// is safe to run before defineCustomElements resolves.
export function chartProps(node, props) {
  Object.assign(node, props);
  return {
    update(next) {
      Object.assign(node, next);
    },
  };
}
