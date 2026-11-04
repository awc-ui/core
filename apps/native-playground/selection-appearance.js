import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// Typed source hooks of the selection controls: md-switch (twelve), md-checkbox (fourteen), md-radio (seven) and
// md-chip (twelve). Field order follows the native initializers (Swift requires labelled arguments in order).
// Lengths are px (points on SwiftUI, dp on Android); colours #RRGGBB or #RRGGBBAA.
const profileFor = (prefix, label, code, fields) => {
  const profile = appearanceProfile(fields, code, label);
  return {
    fields,
    normalize: value => profile.normalize(value),
    css: value => profile.css(value),
    parseInput: (name, raw) => profile.parseInput(name, raw),
    formatInput: (name, value) => profile.formatInput(name, value),
    nativeValue: (name, value, platform) => profile.nativeValue(name, value, platform),
  };
};
const f = prefix => (name, label, suffix, kind) => appearanceField(prefix, name, label, suffix, kind);

const sw = f('switch');
export const SWITCH_APPEARANCE_FIELDS = Object.freeze([
  sw('trackWidth', 'Track width', 'track-width', 'length'), sw('trackHeight', 'Track height', 'track-height', 'length'), sw('handleSize', 'Handle size', 'handle-size', 'length'),
  sw('trackColor', 'Track color', 'track-color', 'color'), sw('trackOutlineColor', 'Track outline color', 'track-outline-color', 'color'), sw('handleColor', 'Handle color', 'handle-color', 'color'),
  sw('selectedTrackColor', 'Selected track color', 'selected-track-color', 'color'), sw('selectedHandleColor', 'Selected handle color', 'selected-handle-color', 'color'),
  sw('iconColor', 'Icon color', 'icon-color', 'color'), sw('selectedIconColor', 'Selected icon color', 'selected-icon-color', 'color'),
  sw('stateLayerColor', 'State layer color', 'state-layer-color', 'color'), sw('focusRingColor', 'Focus ring color', 'focus-ring-color', 'color'),
]);
const cb = f('checkbox');
export const CHECKBOX_APPEARANCE_FIELDS = Object.freeze([
  cb('containerColor', 'Container color', 'container-color', 'color'), cb('containerShape', 'Container corners', 'container-shape', 'corners'),
  cb('containerSize', 'Container size', 'container-size', 'length'), cb('selectedContainerColor', 'Selected container color', 'selected-container-color', 'color'),
  cb('outlineColor', 'Outline color', 'outline-color', 'color'), cb('outlineWidth', 'Outline width', 'outline-width', 'length'),
  cb('iconColor', 'Icon color', 'icon-color', 'color'), cb('iconSize', 'Icon size', 'icon-size', 'length'),
  cb('stateLayerColor', 'State layer color', 'state-layer-color', 'color'), cb('selectedStateLayerColor', 'Selected state layer color', 'selected-state-layer-color', 'color'),
  cb('stateLayerSize', 'State layer size', 'state-layer-size', 'length'), cb('touchTargetSize', 'Touch target size', 'touch-target-size', 'length'),
  cb('supportingTextColor', 'Supporting text color', 'supporting-text-color', 'color'), cb('errorTextColor', 'Error text color', 'error-text-color', 'color'),
]);
const rd = f('radio');
export const RADIO_APPEARANCE_FIELDS = Object.freeze([
  rd('iconColor', 'Icon color', 'icon-color', 'color'), rd('selectedIconColor', 'Selected icon color', 'selected-icon-color', 'color'),
  rd('iconSize', 'Icon size', 'icon-size', 'length'), rd('innerCircleSize', 'Inner circle size', 'inner-circle-size', 'length'),
  rd('stateLayerSize', 'State layer size', 'state-layer-size', 'length'), rd('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  rd('selectedStateLayerColor', 'Selected state layer color', 'selected-state-layer-color', 'color'),
]);
const ch = f('chip');
export const CHIP_APPEARANCE_FIELDS = Object.freeze([
  ch('containerColor', 'Container color', 'container-color', 'color'), ch('containerColorSelected', 'Selected container color', 'container-color-selected', 'color'),
  ch('labelColor', 'Label color', 'label-color', 'color'), ch('labelColorSelected', 'Selected label color', 'label-color-selected', 'color'),
  ch('iconColor', 'Icon color', 'icon-color', 'color'), ch('iconSize', 'Icon size', 'icon-size', 'length'),
  ch('containerShape', 'Container corners', 'container-shape', 'corners'), ch('containerHeight', 'Container height', 'container-height', 'length'),
  ch('outlineColor', 'Outline color', 'outline-color', 'color'), ch('outlineWidth', 'Outline width', 'outline-width', 'length'),
  ch('stateLayerColor', 'State layer color', 'state-layer-color', 'color'), ch('elevation', 'Elevation', 'elevation', 'shadow'),
]);
/** The source's ::part names; each has typed native part fields. */
export const SELECTION_PARTS = Object.freeze({
  'md-switch': ['track', 'state-layer', 'handle', 'icon'],
  'md-checkbox': ['target', 'state-layer', 'container', 'icon', 'supporting-text'],
  'md-radio': ['state-layer', 'container', 'outer-circle', 'inner-circle'],
  'md-chip': ['state-layer', 'outline', 'primary', 'checkmark', 'icon', 'label', 'remove', 'trailing-icon'],
});
export const switchAppearance = profileFor('switch', 'Switch', 'INVALID_SWITCH_APPEARANCE', SWITCH_APPEARANCE_FIELDS);
export const checkboxAppearance = profileFor('checkbox', 'Checkbox', 'INVALID_CHECKBOX_APPEARANCE', CHECKBOX_APPEARANCE_FIELDS);
export const radioAppearance = profileFor('radio', 'Radio', 'INVALID_RADIO_APPEARANCE', RADIO_APPEARANCE_FIELDS);
const chipBase = profileFor('chip', 'Chip', 'INVALID_CHIP_APPEARANCE', CHIP_APPEARANCE_FIELDS);
const double = value => { const text = String(value); return /[.e]/i.test(text) ? text : `${text}.0`; };
// The chip's icon size and container height are AWCChipLength (= AWCSkeletonLength) on SwiftUI and dp on Compose.
export const chipAppearance = Object.freeze({ ...chipBase,
  nativeValue: (name, value, platform) => ['iconSize', 'containerHeight'].includes(name) && typeof value === 'number' && platform === 'swift' ? `.points(${double(value)})` : chipBase.nativeValue(name, value, platform) });
