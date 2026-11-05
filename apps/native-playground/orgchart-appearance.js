import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The fifteen md-organization-chart source hooks (--md-org-chart-*). The shared CEM generator collects the
// --md-organization-chart- prefix, so none of them reach the CEM (recorded in md-organization-chart-source-review.md);
// this list follows md-organization-chart.css. Field order follows the native initializers (Swift requires labelled
// arguments in order). Lengths are px (points on SwiftUI, dp on Android); the duration is ms; colours #RRGGBB[AA].
const field = (name, label, suffix, kind) => appearanceField('org-chart', name, label, suffix, kind);
export const ORG_CHART_APPEARANCE_FIELDS = Object.freeze([
  field('connectorColor', 'Connector color', 'connector-color', 'color'),
  field('connectorWidth', 'Connector width', 'connector-width', 'length'),
  field('nodeColor', 'Node color', 'node-color', 'color'),
  field('nodeOutlineColor', 'Node outline color', 'node-outline-color', 'color'),
  field('nodeOutlineWidth', 'Node outline width', 'node-outline-width', 'length'),
  field('nodeShape', 'Node corner radius', 'node-shape', 'length'),
  field('nodeMinWidth', 'Node minimum width', 'node-min-width', 'length'),
  field('nodeMaxWidth', 'Node maximum width', 'node-max-width', 'length'),
  field('selectedColor', 'Selected color', 'selected-color', 'color'),
  field('focusRingColor', 'Focus ring color', 'focus-ring-color', 'color'),
  field('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  field('toggleSize', 'Toggler size', 'toggle-size', 'length'),
  field('levelGap', 'Level gap', 'level-gap', 'length'),
  field('siblingGap', 'Sibling gap', 'sibling-gap', 'length'),
  field('duration', 'Motion duration', 'duration', 'duration'),
]);
const profile = appearanceProfile(ORG_CHART_APPEARANCE_FIELDS, 'INVALID_ORG_CHART_APPEARANCE', 'Organization chart');
export const orgChartAppearance = Object.freeze({
  fields: ORG_CHART_APPEARANCE_FIELDS,
  normalize: value => profile.normalize(value),
  css: value => profile.css(value),
  parseInput: (name, raw) => profile.parseInput(name, raw),
  formatInput: (name, value) => profile.formatInput(name, value),
  nativeValue: (name, value, platform) => profile.nativeValue(name, value, platform),
});
