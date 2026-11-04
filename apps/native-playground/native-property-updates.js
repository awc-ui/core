import { BUTTON_FAMILY_UPDATE_PROPERTIES, BUTTON_FAMILY_LABELS, validButtonFamilyUpdate } from './button-family-updates.js';
import { OTP_FIELD_UPDATE_PROPERTIES, validOTPFieldUpdate } from './otp-field-appearance.js';
import { NUMBER_FIELD_UPDATE_PROPERTIES, validNumberFieldUpdate } from './number-field-appearance.js';
import { TOOLBAR_UPDATE_PROPERTIES, validToolbarUpdate } from './toolbar-appearance.js';
import { STEPPER_UPDATE_PROPERTIES, validStepperUpdate } from './stepper-appearance.js';
import { SR_UPDATE_PROPERTIES, validSrUpdate } from './sr-appearance.js';
import { TABLE_UPDATE_PROPERTIES, TABLE_UPDATE_LABELS, validTableUpdate } from './table-appearance.js';
import { CHART_UPDATE_PROPERTIES, validChartUpdate } from './chart-appearance.js';
import { TEXT_FIELD_UPDATE_PROPERTIES, validTextFieldUpdate } from './text-field-appearance.js';
import { normalizeMeterFormatOptions } from './meter-format-options.js'; // R2-D6
// Retained preview updates are transport operations, not component methods.
export const PROGRESS_UPDATE_PROPERTIES = Object.freeze([
  'variant', 'value', 'max', 'indeterminate', 'thickness', 'wave',
  'waveAmplitude', 'waveLength', 'waveSpeed', 'size', 'fourColor',
  'label', 'complete', 'density',
]);
export const TOOLTIP_UPDATE_PROPERTIES = Object.freeze(['text', 'subhead', 'variant', 'position', 'autoPosition', 'offset', 'crossOffset', 'open', 'showDelay', 'hideDelay', 'disabled', 'density']);
export const SNACKBAR_UPDATE_PROPERTIES = Object.freeze([
  'open', 'message', 'action', 'closeable', 'autoHide', 'autoHideDuration',
  'position', 'stacked', 'politeness', 'dismissLabel', 'density',
]);
export const SKELETON_UPDATE_PROPERTIES = Object.freeze([
  'variant', 'animation', 'lines', 'width', 'height', 'fullWidth', 'fullHeight',
  'ariaLabelProp', 'announce', 'density',
]);
export const ACCORDION_UPDATE_PROPERTIES = Object.freeze([
  'variant', 'density', 'elevation', 'reorderable', 'floating', 'initialX', 'initialY', 'bringToFront',
  'exclusive', 'keepOneExpanded', 'headingLevel', 'region', 'regionThreshold', 'transition', 'defaultExpanded',
]);
export const ACCORDION_ITEM_UPDATE_PROPERTIES = Object.freeze([
  'headline', 'supportingText', 'icon', 'expanded', 'disabled', 'headingLevel', 'collapsible', 'regionRole', 'contentMaxHeight', 'density',
]);
export const LIST_UPDATE_PROPERTIES = Object.freeze(['listStyle', 'selectionMode', 'interactionMode', 'reorderable', 'label', 'labelledby', 'roleOverride', 'density']);
export const LIST_ITEM_UPDATE_PROPERTIES = Object.freeze(['type', 'headline', 'overline', 'supportingText', 'trailingSupportingText', 'leadingIcon', 'trailingIcon', 'leadingAvatar', 'leadingAvatarAlt',
  'leadingAvatarName', 'leadingAvatarLabel', 'leadingImage', 'leadingImageAlt', 'lines', 'href', 'target', 'disabled', 'softDisabled', 'selected', 'expandable', 'expanded', 'tabbable',
  'rovingFocusVisible', 'selectionMode', 'interactionMode', 'containerRole', 'reorderable', 'density']);
export const DIALOG_UPDATE_PROPERTIES = Object.freeze(['open', 'headline', 'dialogAriaLabel', 'icon', 'fullscreen', 'scrimDismissible', 'locale', 'closeLabel', 'cancelLabel', 'okLabel', 'divider', 'headerDivider', 'density']);
export const BOTTOM_SHEET_UPDATE_PROPERTIES = Object.freeze(['open', 'variant', 'headline', 'showDragHandle', 'closeable', 'scrimDismissible', 'topDivider', 'bottomDivider', 'sheetAriaLabel', 'scrollShadow', 'headlineAlign', 'contentAlign', 'density']);
export const SIDE_SHEET_UPDATE_PROPERTIES = Object.freeze(['open', 'variant', 'side', 'headline', 'closeable', 'showBack', 'scrimDismissible', 'topDivider', 'bottomDivider', 'detached', 'sheetAriaLabel', 'density']);
export const AVATAR_UPDATE_PROPERTIES = Object.freeze(['src', 'alt', 'name', 'initials', 'size', 'shape', 'label', 'colorFromName', 'loading', 'crossorigin', 'density']);
export const SWITCH_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'selected', 'disabled', 'softDisabled', 'required', 'name', 'value', 'icons', 'showOnlySelectedIcon', 'selectedIcon', 'unselectedIcon', 'density']);
export const CHECKBOX_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'error', 'errorText', 'supportingText', 'checked', 'indeterminate', 'disabled', 'softDisabled', 'required', 'name', 'value', 'density']);
export const RADIO_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'checked', 'disabled', 'softDisabled', 'required', 'name', 'value', 'density']);
export const CHIP_UPDATE_PROPERTIES = Object.freeze(['variant', 'icon', 'trailingIcon', 'selected', 'selectable', 'appearance', 'color', 'elevated', 'disabled', 'softDisabled', 'removable', 'label', 'contentAlign', 'density']);
export const RIPPLE_UPDATE_PROPERTIES = Object.freeze(['disabled']);
export const NAVIGATION_BAR_UPDATE_PROPERTIES = Object.freeze(['activeIndex', 'labelBehavior', 'manualActivation', 'density']);
export const NAVIGATION_TAB_UPDATE_PROPERTIES = Object.freeze(['active', 'disabled', 'softDisabled', 'label', 'icon', 'activeIcon', 'badge', 'badgeValue', 'badgeMax', 'href', 'target', 'labelBehavior', 'density']);
const NAVIGATION_TAGS = new Set(['md-navigation-bar', 'md-navigation-tab']);
const navigationPropertyValid = (key, value) => ['activeIndex', 'badgeMax'].includes(key) ? typeof value === 'number' && Number.isFinite(value)
  : key === 'labelBehavior' ? ['always', 'selected', 'none'].includes(value)
  : ['manualActivation', 'active', 'disabled', 'softDisabled', 'badge'].includes(key) ? typeof value === 'boolean'
  : key === 'density' ? [0, -1, -2, -3, -4].includes(value)
  : typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
export const TABS_UPDATE_PROPERTIES = Object.freeze(['activeTabIndex', 'variant', 'divider', 'ariaLabelProp', 'tabWidth', 'width']);
export const TAB_UPDATE_PROPERTIES = Object.freeze(['label', 'icon', 'active', 'disabled', 'inlineIcon', 'variant', 'badge', 'controls', 'density']);
export const TAB_PANELS_UPDATE_PROPERTIES = Object.freeze(['for', 'sizing']);
export const TAB_PANEL_UPDATE_PROPERTIES = Object.freeze(['active']);
const TAB_TAGS = new Set(['md-tabs', 'md-tab', 'md-tab-panels', 'md-tab-panel']);
/** md-tabs family values: activeTabIndex any finite number (sanitized and clamped by the tablist), enums, booleans, strings. */
const tabsPropertyValid = (key, value) => key === 'activeTabIndex' ? typeof value === 'number' && Number.isFinite(value)
  : key === 'variant' ? ['primary', 'secondary'].includes(value)
  : key === 'divider' ? ['auto', 'full'].includes(value)
  : key === 'sizing' ? ['stable', 'active'].includes(value)
  : ['active', 'disabled', 'inlineIcon'].includes(key) ? typeof value === 'boolean'
  : key === 'density' ? [0, -1, -2, -3, -4].includes(value)
  : typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
export const BREADCRUMBS_UPDATE_PROPERTIES = Object.freeze(['label', 'expandLabel', 'separator', 'maxItems', 'itemsBeforeCollapse', 'itemsAfterCollapse', 'density']);
export const BREADCRUMB_ITEM_UPDATE_PROPERTIES = Object.freeze(['href', 'target', 'rel', 'current', 'icon', 'disabled', 'density']);
export const ORG_CHART_UPDATE_PROPERTIES = Object.freeze(['nodes', 'selectionMode', 'selectedIds', 'collapsible', 'orientation', 'label', 'expandLabel', 'collapseLabel', 'density']);
export const CARD_UPDATE_PROPERTIES = Object.freeze(['variant', 'interactive', 'dragEnabled', 'disabled', 'softDisabled', 'ripple', 'fullWidth', 'fullHeight', 'density']);
export const MENU_UPDATE_PROPERTIES = Object.freeze(['open', 'anchor', 'placement', 'quick', 'variant', 'layout', 'useGap', 'emptyText', 'matchAnchorWidth', 'responsive', 'persistent', 'autoFocus', 'maxHeight', 'listLabel', 'listbox', 'density']);
export const MENU_ITEM_UPDATE_PROPERTIES = Object.freeze(['headline', 'supportingText', 'trailingText', 'disabled', 'selected', 'indeterminate', 'keepOpen', 'divider', 'gap', 'badge', 'type', 'checkPosition', 'presentation', 'roleOverride', 'density']);
export const SUB_MENU_ITEM_UPDATE_PROPERTIES = Object.freeze(['headline', 'supportingText', 'disabled', 'divider', 'gap', 'badge', 'openDelay', 'closeDelay', 'density']);
export const MENU_ITEM_GROUP_UPDATE_PROPERTIES = Object.freeze(['label', 'density']);
const MENU_TAGS = new Set(['md-menu', 'md-menu-item', 'md-sub-menu-item', 'md-menu-item-group']);

// Retained Laboratory updates for the communication leaves (gate-7 R2-D6). A restart would hide the source's
// property-change behaviour: md-meter's value glide, md-status-dot's colour transition and the continuous
// md-loading-indicator morph. Unset restores the source default, as removing the attribute does.
export const BADGE_UPDATE_PROPERTIES = Object.freeze(['variant', 'value', 'max', 'icon', 'shape', 'density']);
export const LOADING_INDICATOR_UPDATE_PROPERTIES = Object.freeze(['variant', 'label', 'density']);
export const METER_UPDATE_PROPERTIES = Object.freeze(['value', 'min', 'max', 'label', 'showLabel', 'showValue', 'valueText', 'locale', 'formatOptions', 'color', 'variant', 'size', 'thickness', 'density']);
export const STATUS_DOT_UPDATE_PROPERTIES = Object.freeze(['state', 'size', 'inline', 'shape', 'live', 'label', 'density']);
const COMMUNICATION_TAGS = new Set(['md-badge', 'md-loading-indicator', 'md-meter', 'md-status-dot']);
const COMMUNICATION_DEFAULTS = Object.freeze({
  'md-badge': { variant: 'large', value: '', max: 999, icon: '', shape: 'rect', density: 0 },
  'md-loading-indicator': { variant: 'uncontained', label: 'Loading', density: 0 },
  'md-meter': { value: 0, min: 0, max: 100, label: '', showLabel: false, showValue: false, valueText: '', locale: '', formatOptions: null, color: 'primary', variant: 'linear', size: 48, thickness: 4, density: 0 },
  'md-status-dot': { state: 'neutral', size: 'medium', inline: false, shape: 'rect', live: false, label: '', density: 0 },
});
function communicationPropertyValid(tag, key, value) {
  const text = item => typeof item === 'string' && new TextEncoder().encode(item).length <= 4096;
  const finite = item => typeof item === 'number' && Number.isFinite(item);
  if (key === 'density') return [0, -1, -2, -3, -4].includes(value);
  if (tag === 'md-badge') return key === 'variant' ? ['small', 'large'].includes(value) : key === 'shape' ? ['rect', 'circle'].includes(value)
    : key === 'max' ? finite(value) : text(value);
  if (tag === 'md-loading-indicator') return key === 'variant' ? ['uncontained', 'contained'].includes(value) : text(value);
  if (tag === 'md-status-dot') return key === 'state' ? ['online', 'away', 'busy', 'offline', 'invisible', 'neutral'].includes(value)
    : key === 'size' ? ['small', 'medium', 'large'].includes(value) : key === 'shape' ? ['rect', 'circle'].includes(value)
    : ['inline', 'live'].includes(key) ? typeof value === 'boolean' : text(value);
  // md-meter: formatOptions null = absent (localized percentage); an object is validated like the Studio editor.
  if (key === 'formatOptions') {
    if (value === null) return true;
    try { return normalizeMeterFormatOptions(value) !== undefined; } catch { return false; }
  }
  return key === 'variant' ? ['linear', 'circular'].includes(value) : ['showLabel', 'showValue'].includes(key) ? typeof value === 'boolean'
    : ['value', 'min', 'max', 'size', 'thickness'].includes(key) ? finite(value) : text(value);
}
const MENU_BOOLEANS = new Set(['open', 'quick', 'useGap', 'matchAnchorWidth', 'responsive', 'persistent', 'autoFocus', 'listbox', 'disabled', 'selected', 'indeterminate', 'keepOpen', 'divider', 'gap']);
const MENU_ENUMS = { placement: ['bottom-start', 'bottom-end', 'top-start', 'top-end'], variant: ['baseline', 'standard', 'vibrant'], layout: ['standard', 'grouped'], type: ['button', 'checkbox', 'radio'], checkPosition: ['start', 'end'], presentation: ['menuitem', 'option'] };
/** md-menu family values as the source types them: booleans, enums, density 0 to -4, delays in ms, max-height a number or CSS text. */
const menuPropertyValid = (key, value) => MENU_BOOLEANS.has(key) ? typeof value === 'boolean'
  : Object.hasOwn(MENU_ENUMS, key) ? MENU_ENUMS[key].includes(value)
  : key === 'density' ? [0, -1, -2, -3, -4].includes(value)
  : ['openDelay', 'closeDelay'].includes(key) ? typeof value === 'number' && Number.isFinite(value) && value >= 0
  : key === 'maxHeight' ? typeof value === 'number' && Number.isFinite(value) && value >= 0 || typeof value === 'string' && new TextEncoder().encode(value).length <= 4096
  : typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
const propertiesByTag = { ...BUTTON_FAMILY_UPDATE_PROPERTIES, 'md-otp-field': OTP_FIELD_UPDATE_PROPERTIES, 'md-number-field': NUMBER_FIELD_UPDATE_PROPERTIES, 'md-toolbar': TOOLBAR_UPDATE_PROPERTIES, 'md-stepper': STEPPER_UPDATE_PROPERTIES['md-stepper'], 'md-step': STEPPER_UPDATE_PROPERTIES['md-step'], 'md-slider': SR_UPDATE_PROPERTIES['md-slider'], 'md-rating': SR_UPDATE_PROPERTIES['md-rating'], ...TABLE_UPDATE_PROPERTIES, 'md-menu': MENU_UPDATE_PROPERTIES, 'md-menu-item': MENU_ITEM_UPDATE_PROPERTIES, 'md-sub-menu-item': SUB_MENU_ITEM_UPDATE_PROPERTIES, 'md-menu-item-group': MENU_ITEM_GROUP_UPDATE_PROPERTIES, 'md-line-chart': CHART_UPDATE_PROPERTIES['md-line-chart'], 'md-area-chart': CHART_UPDATE_PROPERTIES['md-area-chart'], 'md-bar-chart': CHART_UPDATE_PROPERTIES['md-bar-chart'], 'md-pie-chart': CHART_UPDATE_PROPERTIES['md-pie-chart'], 'md-sparkline': CHART_UPDATE_PROPERTIES['md-sparkline'], 'md-navigation-bar': NAVIGATION_BAR_UPDATE_PROPERTIES, 'md-navigation-tab': NAVIGATION_TAB_UPDATE_PROPERTIES, 'md-tabs': TABS_UPDATE_PROPERTIES, 'md-tab': TAB_UPDATE_PROPERTIES, 'md-tab-panels': TAB_PANELS_UPDATE_PROPERTIES, 'md-tab-panel': TAB_PANEL_UPDATE_PROPERTIES, 'md-text-field': TEXT_FIELD_UPDATE_PROPERTIES, 'md-breadcrumbs': BREADCRUMBS_UPDATE_PROPERTIES, 'md-breadcrumb-item': BREADCRUMB_ITEM_UPDATE_PROPERTIES, 'md-ripple': RIPPLE_UPDATE_PROPERTIES, 'md-switch': SWITCH_UPDATE_PROPERTIES, 'md-checkbox': CHECKBOX_UPDATE_PROPERTIES, 'md-radio': RADIO_UPDATE_PROPERTIES, 'md-chip': CHIP_UPDATE_PROPERTIES, 'md-avatar': AVATAR_UPDATE_PROPERTIES, 'md-organization-chart': ORG_CHART_UPDATE_PROPERTIES, 'md-dialog': DIALOG_UPDATE_PROPERTIES, 'md-bottom-sheet': BOTTOM_SHEET_UPDATE_PROPERTIES, 'md-side-sheet': SIDE_SHEET_UPDATE_PROPERTIES, 'md-list': LIST_UPDATE_PROPERTIES, 'md-list-item': LIST_ITEM_UPDATE_PROPERTIES, 'md-card': CARD_UPDATE_PROPERTIES, 'md-accordion': ACCORDION_UPDATE_PROPERTIES, 'md-accordion-item': ACCORDION_ITEM_UPDATE_PROPERTIES, 'md-tooltip': TOOLTIP_UPDATE_PROPERTIES, 'md-progress-indicator': PROGRESS_UPDATE_PROPERTIES, 'md-snackbar': SNACKBAR_UPDATE_PROPERTIES, 'md-skeleton': SKELETON_UPDATE_PROPERTIES, 'md-badge': BADGE_UPDATE_PROPERTIES, 'md-loading-indicator': LOADING_INDICATOR_UPDATE_PROPERTIES, 'md-meter': METER_UPDATE_PROPERTIES, 'md-status-dot': STATUS_DOT_UPDATE_PROPERTIES };
export const supportsRetainedUpdateTag = tag => Object.hasOwn(propertiesByTag, tag);
const booleans = new Set(['required', 'icons', 'showOnlySelectedIcon', 'checked', 'error', 'selectable', 'elevated', 'removable', 'colorFromName', 'fullscreen', 'scrimDismissible', 'divider', 'headerDivider', 'showDragHandle', 'topDivider', 'bottomDivider', 'scrollShadow', 'showBack', 'detached', 'reorderable', 'floating', 'bringToFront', 'exclusive', 'keepOneExpanded', 'expanded', 'collapsible', 'disabled', 'autoPosition', 'indeterminate', 'wave', 'fourColor', 'complete', 'open', 'closeable', 'autoHide', 'stacked', 'fullWidth', 'fullHeight', 'announce', 'interactive', 'dragEnabled', 'softDisabled', 'ripple', 'selected', 'expandable', 'tabbable', 'rovingFocusVisible']);
const numbers = new Set(['initialX', 'initialY', 'regionThreshold', 'offset', 'crossOffset', 'showDelay', 'hideDelay', 'value', 'max', 'thickness', 'waveAmplitude', 'waveLength', 'waveSpeed', 'size', 'autoHideDuration', 'lines']);
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_PROPERTY_UPDATE' });

export function nativePropertyUpdate(tag, properties) {
  if (!supportsRetainedUpdateTag(tag)) throw invalid('Retained property updates are unavailable for this component.');
  const declared = propertiesByTag[tag], label = { ...BUTTON_FAMILY_LABELS, 'md-otp-field': 'OTP Field', 'md-number-field': 'Number Field', 'md-stepper': 'Stepper', 'md-step': 'Step', 'md-slider': 'Slider', 'md-rating': 'Rating', 'md-stepper': 'Stepper', 'md-step': 'Step', 'md-slider': 'Slider', 'md-rating': 'Rating', 'md-toolbar': 'Toolbar', 'md-slider': 'Slider', 'md-rating': 'Rating', 'md-stepper': 'Stepper', 'md-step': 'Step', 'md-slider': 'Slider', 'md-rating': 'Rating', ...TABLE_UPDATE_LABELS, 'md-menu': 'Menu', 'md-menu-item': 'Menu Item', 'md-sub-menu-item': 'Sub Menu Item', 'md-menu-item-group': 'Menu Item Group', 'md-line-chart': 'Line Chart', 'md-area-chart': 'Area Chart', 'md-bar-chart': 'Bar Chart', 'md-pie-chart': 'Pie Chart', 'md-sparkline': 'Sparkline', 'md-navigation-bar': 'Navigation Bar', 'md-navigation-tab': 'Navigation Tab', 'md-tabs': 'Tabs', 'md-tab': 'Tab', 'md-tab-panels': 'Tab Panels', 'md-tab-panel': 'Tab Panel', 'md-text-field': 'Text Field', 'md-breadcrumbs': 'Breadcrumbs', 'md-breadcrumb-item': 'Breadcrumb Item', 'md-ripple': 'Ripple', 'md-switch': 'Switch', 'md-checkbox': 'Checkbox', 'md-radio': 'Radio', 'md-chip': 'Chip', 'md-avatar': 'Avatar', 'md-organization-chart': 'Organization Chart', 'md-dialog': 'Dialog', 'md-bottom-sheet': 'Bottom Sheet', 'md-side-sheet': 'Side Sheet', 'md-list': 'List', 'md-list-item': 'List Item', 'md-card': 'Card', 'md-accordion': 'Accordion', 'md-accordion-item': 'Accordion Item', 'md-tooltip': 'Tooltip', 'md-snackbar': 'Snackbar', 'md-skeleton': 'Skeleton', 'md-progress-indicator': 'Progress Indicator', 'md-badge': 'Badge', 'md-loading-indicator': 'Loading Indicator', 'md-meter': 'Meter', 'md-status-dot': 'Status Dot' }[tag];
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(properties))) {
    throw invalid(`Send a plain object containing ${label} properties.`);
  }
  const keys = Reflect.ownKeys(properties);
  if (!keys.length || keys.length > declared.length) throw invalid(`Send between one and ${declared.length} ${label} properties.`);
  const result = {};
  for (const key of keys) {
    if (!declared.includes(key)
        || !Object.hasOwn(Object.getOwnPropertyDescriptor(properties, key), 'value')) {
      throw invalid(`Only declared ${label} data properties can be updated.`);
    }
    const value = properties[key] === undefined && COMMUNICATION_TAGS.has(tag) ? COMMUNICATION_DEFAULTS[tag][key] : properties[key];
    const valid = Object.hasOwn(BUTTON_FAMILY_UPDATE_PROPERTIES, tag) ? validButtonFamilyUpdate(tag, key, value)
      : MENU_TAGS.has(tag) ? menuPropertyValid(key, value)
      : COMMUNICATION_TAGS.has(tag) ? communicationPropertyValid(tag, key, value)
      : tag === 'md-toolbar' ? validToolbarUpdate(key, value)
      : Object.hasOwn(CHART_UPDATE_PROPERTIES, tag) ? validChartUpdate(tag, key, value)
      : tag === 'md-otp-field' ? validOTPFieldUpdate(key, value)
      : tag === 'md-number-field' ? validNumberFieldUpdate(key, value)
      : tag === 'md-text-field' ? validTextFieldUpdate(key, value)
      : Object.hasOwn(TABLE_UPDATE_PROPERTIES, tag) ? validTableUpdate(tag, key, value)
      : NAVIGATION_TAGS.has(tag) ? navigationPropertyValid(key, value)
      : TAB_TAGS.has(tag) ? tabsPropertyValid(key, value)
      : Object.hasOwn(SR_UPDATE_PROPERTIES, tag) ? validSrUpdate(tag, key, value)
      : Object.hasOwn(STEPPER_UPDATE_PROPERTIES, tag) ? validStepperUpdate(tag, key, value)
      : booleans.has(key) ? typeof value === 'boolean'
      // md-avatar size: a preset, any CSS length or a unitless number (px), as in the source.
      : key === 'size' && tag === 'md-avatar' ? typeof value === 'string' && new TextEncoder().encode(value).length <= 4096 || typeof value === 'number' && Number.isFinite(value)
      : key === 'shape' && tag === 'md-avatar' ? ['circle', 'rounded', 'square'].includes(value)
      : key === 'loading' && tag === 'md-avatar' ? ['eager', 'lazy'].includes(value)
      : key === 'crossorigin' && tag === 'md-avatar' ? ['', 'anonymous', 'use-credentials'].includes(value)
      // md-organization-chart: nodes is an array, a single node object or their JSON string, as in the source.
      : key === 'nodes' && tag === 'md-organization-chart' ? (Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string') && new TextEncoder().encode(JSON.stringify(value)).length <= 262144
      : key === 'selectedIds' && tag === 'md-organization-chart' ? Array.isArray(value) && value.length <= 4096 && value.every(id => typeof id === 'string' && new TextEncoder().encode(id).length <= 4096)
      : key === 'collapsible' && tag === 'md-organization-chart' ? typeof value === 'boolean'
      : key === 'selectionMode' && tag === 'md-organization-chart' ? ['none', 'single', 'multiple'].includes(value)
      : key === 'orientation' && tag === 'md-organization-chart' ? ['vertical', 'horizontal'].includes(value)
      : key === 'lines' && tag === 'md-list-item' ? [1, 2, 3].includes(value)
      : ['maxItems', 'itemsBeforeCollapse', 'itemsAfterCollapse'].includes(key) && tag === 'md-breadcrumbs' ? Number.isInteger(value) && value >= 0
      : key === 'current' && tag === 'md-breadcrumb-item' ? typeof value === 'boolean'
      : key === 'variant' && tag === 'md-chip' ? ['assist', 'filter', 'input', 'suggestion'].includes(value)
      : key === 'appearance' && tag === 'md-chip' ? ['outlined', 'filled', 'elevated'].includes(value)
      : key === 'value' && ['md-switch', 'md-checkbox', 'md-radio'].includes(tag) ? typeof value === 'string' && new TextEncoder().encode(value).length <= 4096
      : numbers.has(key) ? typeof value === 'number' && Number.isFinite(value)
      : key === 'elevation' ? [0, 1, 2, 3, 4, 5].includes(value)
      : key === 'headingLevel' ? [1, 2, 3, 4, 5, 6].includes(value)
      : key === 'region' ? ['auto', 'always', 'never'].includes(value)
      : key === 'regionRole' ? ['region', 'group', 'none'].includes(value)
      : key === 'transition' ? ['expressive', 'standard', 'fade', 'collapse', 'none'].includes(value)
      : key === 'variant' ? (tag === 'md-bottom-sheet' ? ['standard', 'detached'] : tag === 'md-side-sheet' ? ['standard', 'modal'] : tag === 'md-card' ? ['elevated', 'filled', 'outlined'] : tag === 'md-accordion' ? ['filled', 'outlined'] : tag === 'md-tooltip' ? ['plain', 'rich'] : tag === 'md-skeleton' ? ['text', 'rectangular', 'rounded', 'circular'] : ['linear', 'circular']).includes(value)
      : key === 'animation' ? ['none', 'pulse', 'wave'].includes(value)
      : key === 'side' ? ['start', 'end'].includes(value)
      : ['headlineAlign', 'contentAlign'].includes(key) ? ['start', 'center', 'end'].includes(value)
      : key === 'listStyle' ? ['standard', 'segmented'].includes(value)
      : key === 'selectionMode' ? ['none', 'single-select', 'multi-select'].includes(value)
      : key === 'interactionMode' ? ['single-action', 'multi-action'].includes(value)
      : key === 'type' ? ['text', 'button', 'link'].includes(value)
      : key === 'position' ? (tag === 'md-tooltip' ? ['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'left', 'left-start', 'left-end', 'right', 'right-start', 'right-end'] : ['bottom', 'bottom-start', 'bottom-end', 'top', 'top-start', 'top-end', 'start', 'end', 'center']).includes(value)
      : key === 'politeness' ? ['polite', 'assertive'].includes(value)
      : key === 'density' ? [0, -1, -2, -3, -4].includes(value)
      : typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
    if (!valid) throw invalid(`Invalid ${label} ${key}.`);
    result[key] = value;
  }
  return { command: 'update', properties: result };
}

export function supportsRetainedPropertyUpdates(component, platform) {
  if (!supportsRetainedUpdateTag(component?.tag) || !['ios', 'android'].includes(platform)) return false;
  const policy = component.support?.[platform];
  if (['md-snackbar', 'md-tooltip'].includes(component.tag) && !['show', 'hide'].every(name => policy?.methods?.includes(name) && !policy?.unsupportedMethods?.includes(name))) return false;
  return propertiesByTag[component.tag].every(name => policy?.properties?.includes(name)
    && !policy?.unsupportedProperties?.includes(name));
}

/** Preserve each change edge; collapsing false → true would lose watcher semantics. */
export function dispatchRetainedPropertyEdit({ component, platform, client, name, value, onError = () => {} }) {
  if (!supportsRetainedPropertyUpdates(component, platform) || !client.canUpdate(component.tag)) return false;
  try {
    const command = nativePropertyUpdate(component.tag, { [name]: value });
    void client.update(command.properties).catch(error => {
      if (error?.code !== 'SESSION_CLOSED') onError(error);
    });
  } catch (error) { onError(error); }
  // A rejected live update must not silently remount or replay a lifecycle edge.
  return true;
}
