import { normalizeAccordionAppearance, normalizeAccordionItemAppearance } from './accordion-appearance.js';
import { normalizeCardAppearance } from './card-appearance.js';
import { normalizeAvatarAppearance } from './avatar-appearance.js';
import { searchAppearance } from './search-appearance.js';
import { textFieldAppearance } from './text-field-appearance.js';
import { selectAppearance, multiSelectAppearance } from './select-appearance.js';
import { colorPickerAppearance, timePickerAppearance } from './picker-appearance.js';
import { datePickerAppearance } from './date-picker-appearance.js';
import { numberFieldAppearance } from './number-field-appearance.js';
import { autocompleteAppearance } from './autocomplete-appearance.js';
import { otpFieldAppearance } from './otp-field-appearance.js';
import { rippleAppearance } from './ripple-appearance.js';
import { transferListAppearance } from './transferlist-appearance.js';
import { orgChartAppearance } from './orgchart-appearance.js';
import { stepperAppearance, stepAppearance } from './stepper-appearance.js';
import { sliderAppearance, ratingAppearance } from './sr-appearance.js';
import { TABLE_APPEARANCES } from './table-appearance.js';
import { menuAppearance } from './menu-appearance.js';
import { CHART_APPEARANCES } from './chart-appearance.js';
import { toolbarAppearance } from './toolbar-appearance.js';
import { appBarAppearance } from './appbar-appearance.js';
import { navigationRailAppearance, navigationRailTabAppearance } from './rail-appearance.js';
import { navigationBarAppearance, navigationTabAppearance } from './navbar-appearance.js';
import { tabsAppearance, tabAppearance } from './tabs-appearance.js';
import { breadcrumbsAppearance, breadcrumbItemAppearance } from './breadcrumbs-appearance.js';
import { switchAppearance, checkboxAppearance, radioAppearance, chipAppearance } from './selection-appearance.js';
import { normalizeListAppearance, normalizeListItemAppearance } from './list-appearance.js';
import { normalizeDialogAppearance, normalizeBottomSheetAppearance, normalizeSideSheetAppearance } from './modal-appearance.js';
import { normalizeTooltipAppearance } from './tooltip-appearance.js';
import { normalizeSnackbarAppearance } from './snackbar-appearance.js';
import { normalizeSkeletonAppearance } from './skeleton-appearance.js';
import { normalizeProgressIndicatorAppearance } from './progress-indicator-appearance.js';
import { normalizeMeterAppearance } from './meter-appearance.js';
import { normalizeThemeColorTokens } from './theme-color-tokens.js';
import { normalizeSplitButtonAppearance } from './split-button-appearance.js';
import { normalizeStatusDotAppearance } from './status-dot-appearance.js';
import { normalizeBadgeAppearance } from './badge-appearance.js';
import { normalizeFabMenuAppearance, normalizeFabMenuItemAppearance } from './fab-menu-appearance.js';
import { normalizeSegmentedButtonAppearance } from './segmented-button-appearance.js';
import { normalizeDividerAppearance } from './divider-appearance.js';
import { normalizeFabAppearance } from './fab-appearance.js';
import { normalizeButtonGroupAppearance } from './button-group-appearance.js';
import { normalizeButtonAppearance } from './button-appearance.js';
import { normalizeIconButtonAppearance } from './icon-button-appearance.js';

export class NativeThemeOptionsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** The preview accepts bounded color-token data and typed appearance, never arbitrary CSS. */
export function nativeThemeOptions(value = {}) {
  const result = {};
  for (const [key, normalize] of [['datePickerAppearance', datePickerAppearance.normalize], ['colorPickerAppearance', colorPickerAppearance.normalize], ['timePickerAppearance', timePickerAppearance.normalize], ['selectAppearance', selectAppearance.normalize], ['multiSelectAppearance', multiSelectAppearance.normalize], ['accordionAppearance', normalizeAccordionAppearance], ['accordionItemAppearance', normalizeAccordionItemAppearance], ['cardAppearance', normalizeCardAppearance], ['listAppearance', normalizeListAppearance], ['listItemAppearance', normalizeListItemAppearance], ['dialogAppearance', normalizeDialogAppearance], ['bottomSheetAppearance', normalizeBottomSheetAppearance], ['sideSheetAppearance', normalizeSideSheetAppearance], ['avatarAppearance', normalizeAvatarAppearance], ['searchAppearance', searchAppearance.normalize], ['textFieldAppearance', textFieldAppearance.normalize], ['numberFieldAppearance', numberFieldAppearance.normalize], ['autocompleteAppearance', autocompleteAppearance.normalize], ['otpFieldAppearance', otpFieldAppearance.normalize], ['toolbarAppearance', toolbarAppearance.normalize], ['appBarAppearance', appBarAppearance.normalize], ['navigationRailAppearance', navigationRailAppearance.normalize], ['navigationRailTabAppearance', navigationRailTabAppearance.normalize], ['stepperAppearance', stepperAppearance.normalize], ['stepAppearance', stepAppearance.normalize], ['sliderAppearance', sliderAppearance.normalize], ['ratingAppearance', ratingAppearance.normalize], ['tableAppearance', TABLE_APPEARANCES['md-table'].normalize], ['tableCellAppearance', TABLE_APPEARANCES['md-table-cell'].normalize], ['tableContainerAppearance', TABLE_APPEARANCES['md-table-container'].normalize], ['tableExpandToggleAppearance', TABLE_APPEARANCES['md-table-expand-toggle'].normalize], ['tablePaginationAppearance', TABLE_APPEARANCES['md-table-pagination'].normalize], ['tableRowAppearance', TABLE_APPEARANCES['md-table-row'].normalize], ['tableSortLabelAppearance', TABLE_APPEARANCES['md-table-sort-label'].normalize], ['tableToolbarAppearance', TABLE_APPEARANCES['md-table-toolbar'].normalize], ['lineChartAppearance', CHART_APPEARANCES['md-line-chart'].normalize], ['areaChartAppearance', CHART_APPEARANCES['md-area-chart'].normalize], ['barChartAppearance', CHART_APPEARANCES['md-bar-chart'].normalize], ['pieChartAppearance', CHART_APPEARANCES['md-pie-chart'].normalize], ['sparklineAppearance', CHART_APPEARANCES['md-sparkline'].normalize], ['switchAppearance', switchAppearance.normalize], ['checkboxAppearance', checkboxAppearance.normalize], ['radioAppearance', radioAppearance.normalize], ['chipAppearance', chipAppearance.normalize], ['rippleAppearance', rippleAppearance.normalize], ['transferListAppearance', transferListAppearance.normalize], ['orgChartAppearance', orgChartAppearance.normalize], ['menuAppearance', menuAppearance.normalize], ['navigationBarAppearance', navigationBarAppearance.normalize], ['navigationTabAppearance', navigationTabAppearance.normalize], ['tabsAppearance', tabsAppearance.normalize], ['tabAppearance', tabAppearance.normalize], ['breadcrumbsAppearance', breadcrumbsAppearance.normalize], ['breadcrumbItemAppearance', breadcrumbItemAppearance.normalize]]) {
    for (const name of [`${key}Defaults`, key]) if (value[name] !== undefined) result[name] = normalize(value[name]);
  }
  for (const key of ['tooltipAppearanceDefaults', 'tooltipAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeTooltipAppearance(value[key]);
  }
  for (const key of ['snackbarAppearanceDefaults', 'snackbarAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeSnackbarAppearance(value[key]);
  }
  for (const key of ['skeletonAppearanceDefaults', 'skeletonAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeSkeletonAppearance(value[key]);
  }
  for (const key of ['progressIndicatorAppearanceDefaults', 'progressIndicatorAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeProgressIndicatorAppearance(value[key]);
  }
  for (const key of ['meterAppearanceDefaults', 'meterAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeMeterAppearance(value[key]);
  }
  for (const key of ['loadingIndicatorAppearanceDefaults', 'loadingIndicatorAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeLoadingIndicatorAppearance(value[key]);
  }
  for (const key of ['splitButtonAppearanceDefaults', 'splitButtonAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeSplitButtonAppearance(value[key]);
  }
  for (const key of ['statusDotAppearanceDefaults', 'statusDotAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeStatusDotAppearance(value[key]);
  }
  for (const key of ['badgeAppearanceDefaults', 'badgeAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeBadgeAppearance(value[key]);
  }
  for (const [key, normalize] of [['fabMenuAppearance', normalizeFabMenuAppearance], ['fabMenuItemAppearance', normalizeFabMenuItemAppearance]]) {
    for (const name of [key, `${key}Defaults`]) if (value[name] !== undefined) result[name] = normalize(value[name]);
  }
  for (const key of ['segmentedButtonAppearanceDefaults', 'segmentedButtonAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeSegmentedButtonAppearance(value[key]);
  }
  for (const key of ['dividerAppearanceDefaults', 'dividerAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeDividerAppearance(value[key]);
  }
  for (const key of ['fabAppearanceDefaults', 'fabAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeFabAppearance(value[key]);
  }
  for (const key of ['buttonGroupAppearanceDefaults', 'buttonGroupAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeButtonGroupAppearance(value[key]);
  }
  for (const key of ['buttonAppearanceDefaults', 'buttonAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeButtonAppearance(value[key]);
  }
  for (const key of ['iconButtonAppearanceDefaults', 'iconButtonAppearance']) {
    if (value[key] !== undefined) result[key] = normalizeIconButtonAppearance(value[key]);
  }
  if (value.direction !== undefined) {
    if (!['ltr', 'rtl'].includes(value.direction)) throw new NativeThemeOptionsError('INVALID_DIRECTION', 'Direction must be ltr or rtl.');
    result.direction = value.direction;
  }
  if (value.themeTokens !== undefined) {
    result.themeTokens = normalizeThemeColorTokens(value.themeTokens);
  }
  return result;
}
import { normalizeLoadingIndicatorAppearance } from './loading-indicator-appearance.js';
