import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-navigation-bar / md-navigation-tab typed hooks: the seven bar hooks (--md-navigation-bar-*) and md-navigation-tab's
// documented hooks (--md-navigation-tab-*, the stylesheet's public list), which the bar passes down to every destination.
// Field order follows the native initializers (Swift requires labelled arguments in order). Lengths in px (points on
// SwiftUI, dp on Android); the indicator shape is one corner radius (9999 = full); labelFont is the CSS font shorthand
// (its weight is the inactive weight, its line height the label line; the size comes from labelFontSize).
const bar = (name, label, suffix, kind) => appearanceField('navigation-bar', name, label, suffix, kind);
const tab = (name, label, suffix, kind) => appearanceField('navigation-tab', name, label, suffix, kind);
export const NAVIGATION_TAB_APPEARANCE_FIELDS = Object.freeze([
  tab('activeIndicatorColor', 'Active indicator color', 'active-indicator-color', 'color'), tab('activeIndicatorWidth', 'Active indicator width', 'active-indicator-width', 'length'),
  tab('activeIndicatorHeight', 'Active indicator height', 'active-indicator-height', 'length'), tab('activeIndicatorShape', 'Active indicator corner radius', 'active-indicator-shape', 'length'),
  tab('activeIconColor', 'Active icon color', 'active-icon-color', 'color'), tab('inactiveIconColor', 'Inactive icon color', 'inactive-icon-color', 'color'),
  tab('activeLabelColor', 'Active label color', 'active-label-color', 'color'), tab('inactiveLabelColor', 'Inactive label color', 'inactive-label-color', 'color'),
  tab('labelFont', 'Label font (CSS font shorthand)', 'label-font', 'font'), tab('labelFontSize', 'Label size', 'label-font-size', 'length'),
  tab('labelFontWeight', 'Active label weight', 'label-font-weight', 'weight'), tab('iconSize', 'Icon size', 'icon-size', 'length'),
  tab('paddingBlockStart', 'Top padding', 'padding-block-start', 'length'), tab('paddingBlockEnd', 'Bottom padding', 'padding-block-end', 'length'),
  tab('hoverStateLayerColor', 'Hover state layer color', 'hover-state-layer-color', 'color'), tab('focusStateLayerColor', 'Focus state layer color', 'focus-state-layer-color', 'color'),
  tab('pressedStateLayerColor', 'Pressed state layer color', 'pressed-state-layer-color', 'color'), tab('focusStateLayerOpacity', 'Focus state layer opacity', 'focus-state-layer-opacity', 'opacity'),
  tab('badgeColor', 'Badge color', 'badge-color', 'color'), tab('badgeOnColor', 'Badge text color', 'badge-on-color', 'color'),
  tab('disabledOpacity', 'Disabled opacity', 'disabled-opacity', 'opacity'), tab('slottedIconFont', 'Slotted icon font', 'slotted-icon-font', 'font'),
]);
export const NAVIGATION_BAR_APPEARANCE_FIELDS = Object.freeze([
  bar('containerColor', 'Container color', 'container-color', 'color'), bar('containerHeight', 'Container height', 'container-height', 'length'),
  bar('containerShape', 'Container corners', 'container-shape', 'corners'), bar('containerElevation', 'Elevation', 'container-elevation', 'shadow'),
  bar('dividerColor', 'Top divider color', 'divider-color', 'color'), bar('dividerWidth', 'Top divider width', 'divider-width', 'length'),
  bar('zIndex', 'Stacking order', 'z-index', 'integer'),
  ...NAVIGATION_TAB_APPEARANCE_FIELDS,
]);
function profile(fields, code, label) {
  const base = appearanceProfile(fields, code, label);
  return Object.freeze({
    fields, normalize: base.normalize.bind(base), css: base.css.bind(base), parseInput: base.parseInput.bind(base), formatInput: base.formatInput.bind(base),
    nativeValue: base.nativeValue.bind(base),
  });
}
export const navigationBarAppearance = profile(NAVIGATION_BAR_APPEARANCE_FIELDS, 'INVALID_NAVIGATION_BAR_APPEARANCE', 'Navigation Bar');
export const navigationTabAppearance = profile(NAVIGATION_TAB_APPEARANCE_FIELDS, 'INVALID_NAVIGATION_TAB_APPEARANCE', 'Navigation Tab');
