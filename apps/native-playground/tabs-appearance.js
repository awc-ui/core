import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-tabs / md-tab typed hooks: the two tablist hooks (--md-tabs-*) and md-tab's nine public hooks (--md-tab-*), which the
// tablist passes down to every tab (custom properties inherit). On the md-tabs page the inherited md-tab container and
// divider hooks are named tabContainerColor / tabDividerColor. Field order follows the native initializers (Swift requires
// labelled arguments in order). The indicator height in px (points on SwiftUI, dp on Android); the glide duration in ms.
// --md-tab-glide-x / --md-tab-glide-scale are not hooks: md-tabs writes them inline on every indicator glide.
const tabs = (name, label, suffix, kind) => appearanceField('tabs', name, label, suffix, kind);
const tab = (name, label, suffix, kind) => appearanceField('tab', name, label, suffix, kind);
const shared = [
  tab('activeLabelColor', 'Active label color', 'active-label-color', 'color'), tab('inactiveLabelColor', 'Inactive label color', 'inactive-label-color', 'color'),
  tab('activeIconColor', 'Active icon color', 'active-icon-color', 'color'), tab('inactiveIconColor', 'Inactive icon color', 'inactive-icon-color', 'color'),
  tab('activeIndicatorColor', 'Active indicator color', 'active-indicator-color', 'color'), tab('activeIndicatorHeight', 'Active indicator height', 'active-indicator-height', 'length'),
];
const glide = tab('glideDuration', 'Indicator glide duration', 'glide-duration', 'duration');
export const TAB_APPEARANCE_FIELDS = Object.freeze([
  tab('containerColor', 'Container color', 'container-color', 'color'), ...shared, tab('dividerColor', 'Divider color', 'divider-color', 'color'), glide,
]);
export const TABS_APPEARANCE_FIELDS = Object.freeze([
  tabs('containerColor', 'Container color', 'container-color', 'color'), tabs('dividerColor', 'Divider color', 'divider-color', 'color'),
  tab('tabContainerColor', 'Tab container color', 'container-color', 'color'), ...shared, tab('tabDividerColor', 'Tab divider color', 'divider-color', 'color'), glide,
]);
function profile(fields, code, label) {
  const base = appearanceProfile(fields, code, label);
  return Object.freeze({
    fields, normalize: base.normalize.bind(base), css: base.css.bind(base), parseInput: base.parseInput.bind(base), formatInput: base.formatInput.bind(base),
    nativeValue: base.nativeValue.bind(base),
  });
}
export const tabsAppearance = profile(TABS_APPEARANCE_FIELDS, 'INVALID_TABS_APPEARANCE', 'Tabs');
export const tabAppearance = profile(TAB_APPEARANCE_FIELDS, 'INVALID_TAB_APPEARANCE', 'Tab');
