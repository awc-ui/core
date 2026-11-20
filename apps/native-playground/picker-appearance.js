import { appearanceField, appearanceProfile } from './accordion-appearance.js';
import { DATE_PICKER_UPDATE_PROPERTIES, validDatePickerUpdate, DATE_PICKER_ITEM_METHODS, DATE_PICKER_VALIDITY_METHODS } from './date-picker-appearance.js';

// md-color-picker and md-time-picker: the source hooks as native appearance fields, the retained property updates and the
// methods. Field order follows the native initializers (AWCColorPickerAppearance takes labelled arguments in order).
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
const utf8 = value => new TextEncoder().encode(value).length;

// ---- md-color-picker: eleven typed hooks (lengths in px, #RRGGBB / #RRGGBBAA colours, the popover's box-shadow as CSS text) ----
const cp = (name, label, suffix, kind) => appearanceField('color-picker', name, label, suffix, kind);
const CP_ELEVATION = cp('popoverElevation', 'Popover elevation', 'popover-elevation', 'shadow');
export const COLOR_PICKER_APPEARANCE_FIELDS = Object.freeze([
  cp('width', 'Panel width', 'width', 'length'), cp('plateHeight', 'Plate height', 'plate-height', 'length'),
  cp('radius', 'Corner radius', 'radius', 'length'), cp('surfaceColor', 'Surface color', 'surface-color', 'color'),
  cp('onSurface', 'On-surface color', 'on-surface', 'color'), cp('outlineColor', 'Outline color', 'outline-color', 'color'),
  cp('outlineStrong', 'Strong outline color', 'outline-strong', 'color'), cp('thumbSize', 'Thumb size', 'thumb-size', 'length'),
  cp('thumbBorder', 'Thumb border color', 'thumb-border', 'color'), cp('presetSize', 'Preset size', 'preset-size', 'length'),
  CP_ELEVATION,
]);
const CP_CODE = 'INVALID_COLOR_PICKER_APPEARANCE';
const cpInvalid = message => Object.assign(new Error(message), { code: CP_CODE });
const cpBase = appearanceProfile(COLOR_PICKER_APPEARANCE_FIELDS.filter(f => f !== CP_ELEVATION), CP_CODE, 'Color Picker');
const cpShadow = appearanceProfile([CP_ELEVATION], CP_CODE, 'Color Picker');
// The native type keeps the elevation as CSS box-shadow text (AWCBoxShadow.source parses it): canonical px text or none.
const elevationText = value => {
  if (typeof value !== 'string' || utf8(value) > 1024) throw cpInvalid('Popover elevation must be CSS box-shadow text (px lengths, #hex or rgb()/rgba() colours) or none.');
  return cpShadow.formatInput('popoverElevation', cpShadow.parseInput('popoverElevation', value));
};
function cpNormalize(value) {
  if (value === undefined) return {};
  if (!plain(value)) throw cpInvalid(`Use a plain object containing only the ${COLOR_PICKER_APPEARANCE_FIELDS.length} Color Picker appearance fields.`);
  const rest = {};
  for (const key of Reflect.ownKeys(value)) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw cpInvalid('Appearance fields must contain data values.');
    if (key !== 'popoverElevation') rest[key] = value[key];
  }
  const out = cpBase.normalize(rest);
  if (Object.hasOwn(value, 'popoverElevation')) out.popoverElevation = elevationText(value.popoverElevation);
  return Object.fromEntries(COLOR_PICKER_APPEARANCE_FIELDS.filter(f => Object.hasOwn(out, f.name)).map(f => [f.name, out[f.name]]));
}
export const colorPickerAppearance = Object.freeze({
  fields: COLOR_PICKER_APPEARANCE_FIELDS,
  normalize: cpNormalize,
  css(value) {
    const n = cpNormalize(value), { popoverElevation, ...rest } = n;
    const out = { ...cpBase.css(rest), ...(popoverElevation === undefined ? {} : { [CP_ELEVATION.cssProperty]: popoverElevation }) };
    return Object.fromEntries(COLOR_PICKER_APPEARANCE_FIELDS.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
  },
  parseInput: (name, raw) => name === 'popoverElevation' ? elevationText(String(raw ?? '')) : cpBase.parseInput(name, raw),
  formatInput: (name, value) => name === 'popoverElevation' ? (value === undefined ? '' : elevationText(value)) : cpBase.formatInput(name, value),
  nativeValue: (name, value, platform) => name === 'popoverElevation' ? quote(value, platform)
    : COLOR_PICKER_APPEARANCE_FIELDS.some(f => f.name === name && f.kind === 'length') ? (Number.isInteger(value) ? `${value}.0` : String(value))
    : cpBase.nativeValue(name, value, platform),
});

// ---- md-time-picker: the 81 hooks its stylesheet consumes, kept as CSS text (AWCTimePickerAppearance is a hook map) ----
const TP_KINDS = {
  color: ['action-cancel-bg', 'action-color', 'action-confirm-bg', 'action-primary-color', 'dial-bg', 'dial-hand-color', 'dial-number-active-color',
    'dial-number-color', 'dialog-color', 'dialog-on-color', 'headline-color', 'input-active-bg', 'input-active-color', 'input-active-outline-color',
    'input-bg', 'input-color', 'input-error-color', 'input-hint-color', 'input-outline-color', 'input-separator-color', 'period-active-bg',
    'period-active-color', 'period-bg', 'period-color', 'period-outline-color', 'scrim-color', 'toggle-bg', 'toggle-icon-color', 'trigger-color',
    'trigger-focus-color', 'trigger-hover-color', 'trigger-icon-color', 'trigger-outline-color'],
  length: ['action-shape', 'actions-gap', 'dial-center-size', 'dial-hand-width', 'dial-number-font-size', 'dial-size', 'dial-target-size',
    'dialog-horizontal-width-12h', 'dialog-horizontal-width-24h', 'dialog-min-width', 'dialog-padding', 'dialog-shape', 'footer-gap',
    'headline-font-size', 'headline-spacing', 'input-border-width', 'input-font-size', 'input-height', 'input-hint-gap', 'input-separator-width',
    'input-shape', 'input-width', 'period-font-size', 'period-horizontal-height', 'period-horizontal-width', 'period-outline-width', 'period-shape',
    'period-vertical-height', 'period-vertical-height-input', 'period-vertical-width', 'time-display-shape', 'toggle-icon-size', 'toggle-shape',
    'trigger-icon-size', 'trigger-min-width', 'trigger-shape'],
  weight: ['dial-number-active-font-weight', 'dial-number-font-weight', 'headline-font-weight', 'input-font-weight', 'period-font-weight'],
  opacity: ['input-hover-opacity', 'period-hover-opacity'],
  duration: ['dialog-enter-duration', 'mode-swap-duration'],
  shadow: ['dialog-elevation'],
  easing: ['motion-easing'],
  handLength: ['hand-length'],
};
const camel = hook => hook.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const words = hook => hook.replace(/-/g, ' ').replace(/\b12h\b/, '(12h)').replace(/\b24h\b/, '(24h)').replace(/\bbg\b/, 'background').replace(/^./, c => c.toUpperCase());
const TP_HINT = {
  easing: 'cubic-bezier(x1, y1, x2, y2) with x1 and x2 from 0 to 1 (the curve the dialog and mode motion use).',
  handLength: 'The hand length as a percentage of the dial radius, for example 80%.',
};
export const TIME_PICKER_APPEARANCE_FIELDS = Object.freeze(Object.entries(TP_KINDS).flatMap(([kind, hooks]) => hooks.map(hook =>
  ['easing', 'handLength'].includes(kind) ? Object.freeze({ name: camel(hook), label: words(hook), cssProperty: `--md-time-picker-${hook}`, kind: kind === 'easing' ? 'easing' : 'text', hint: TP_HINT[kind] })
    : appearanceField('time-picker', camel(hook), words(hook), hook, kind)))
  .sort((a, b) => a.cssProperty.localeCompare(b.cssProperty)));
/** The hook name (without the --md-time-picker- prefix) of a field: the key of AWCTimePickerAppearance's hook map. */
export const timePickerHook = name => TIME_PICKER_APPEARANCE_FIELDS.find(f => f.name === name)?.cssProperty.slice('--md-time-picker-'.length);
const TP_CODE = 'INVALID_TIME_PICKER_APPEARANCE';
const tpInvalid = message => Object.assign(new Error(message), { code: TP_CODE });
const tpFields = new Map(TIME_PICKER_APPEARANCE_FIELDS.map(f => [f.name, f]));
const tpProfiles = new Map(TIME_PICKER_APPEARANCE_FIELDS.filter(f => !['easing', 'text'].includes(f.kind)).map(f => [f.name, appearanceProfile([f], TP_CODE, 'Time Picker')]));
const HAND = /^(?:\d+(?:\.\d*)?|\.\d+)%$/;
const NUM = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const BEZIER = new RegExp(`^cubic-bezier\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)$`, 'i');
/** One hook as canonical CSS text (the native hook map stores what the stylesheet would read). */
function tpText(name, raw) {
  const f = tpFields.get(name);
  if (!f) throw tpInvalid(`Unknown Time Picker appearance field ${String(name)}.`);
  if (typeof raw !== 'string' || utf8(raw) > 1024) throw tpInvalid(`${f.label} must be CSS text.`);
  const text = raw.trim();
  // The natives read the curve as cubic-bezier() and the hand length as a percentage of the radius (as the source's defaults).
  if (f.kind === 'easing') {
    const m = BEZIER.exec(text), v = m ? m.slice(1).map(Number) : [];
    if (!m || !v.every(Number.isFinite) || v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) throw tpInvalid(`${f.label} must be cubic-bezier(x1, y1, x2, y2) with x1 and x2 from 0 to 1.`);
    return `cubic-bezier(${v.join(', ')})`;
  }
  if (f.kind === 'text') { if (!HAND.test(text)) throw tpInvalid(`${f.label} must be a percentage, for example 80%.`); return `${Number(text.slice(0, -1))}%`; }
  const p = tpProfiles.get(name);
  return p.formatInput(name, p.parseInput(name, text));
}
function tpNormalize(value) {
  if (value === undefined) return {};
  if (!plain(value) || Reflect.ownKeys(value).some(key => !tpFields.has(key))) throw tpInvalid(`Use a plain object containing only the ${TIME_PICKER_APPEARANCE_FIELDS.length} Time Picker appearance fields.`);
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw tpInvalid('Appearance fields must contain data values.');
  return Object.fromEntries(TIME_PICKER_APPEARANCE_FIELDS.filter(f => Object.hasOwn(value, f.name)).map(f => [f.name, tpText(f.name, value[f.name])]));
}
export const timePickerAppearance = Object.freeze({
  fields: TIME_PICKER_APPEARANCE_FIELDS,
  /** AWCTimePickerAppearance is a hook map: native snippets write `.init(["dial-hand-color": "#6750A4"])`. */
  hookPrefix: '--md-time-picker-',
  normalize: tpNormalize,
  css: value => Object.fromEntries(Object.entries(tpNormalize(value)).map(([name, text]) => [tpFields.get(name).cssProperty, text])),
  parseInput: (name, raw) => tpText(name, String(raw ?? '')),
  formatInput: (name, value) => value === undefined ? '' : tpText(name, value),
  nativeValue: (name, value, platform) => tpFields.has(name) ? quote(value, platform) : undefined,
});
/** Swift / Kotlin initializer text of a hook-map appearance (`["hook": "css"]` / `mapOf("hook" to "css")`). */
export function hookMapNative(profile, value, platform) {
  const entries = Object.entries(value).map(([name, text]) => [profile.fields.find(f => f.name === name).cssProperty.slice(profile.hookPrefix.length), text]);
  return platform === 'swift' ? `[${entries.map(([k, v]) => `${quote(k, 'swift')}: ${quote(v, 'swift')}`).join(', ') || ':'}]`
    : `mapOf(${entries.map(([k, v]) => `${quote(k, 'kotlin')} to ${quote(v, 'kotlin')}`).join(', ')})`;
}

// ---- retained property updates ----
const enumOf = values => value => values.includes(value);
const bool = value => typeof value === 'boolean';
const text = value => typeof value === 'string' && utf8(value) <= 4096;
const density = enumOf([0, -1, -2, -3, -4]);
export const COLOR_PICKER_UPDATE_PROPERTIES = Object.freeze(['locale', 'variant', 'value', 'format', 'alpha', 'showHex', 'showInputs', 'disabled', 'presets', 'ariaLabelProp', 'open', 'dismissOnOutsideClick', 'density']);
const CP_RULES = { variant: enumOf(['inline', 'popover']), format: enumOf(['hex', 'rgb', 'hsl']), alpha: bool, showHex: bool, showInputs: bool, disabled: bool, open: bool,
  dismissOnOutsideClick: bool, density,
  // presets: a string array or the source's comma-separated attribute text.
  presets: value => text(value) || Array.isArray(value) && value.length <= 256 && value.every(text) };
export const TIME_PICKER_UPDATE_PROPERTIES = Object.freeze(['variant', 'format', 'value', 'name', 'min', 'max', 'required', 'label', 'supportingText', 'error', 'errorText',
  'reserveSupportingSpace', 'headline', 'headlineInputLabel', 'headlineDialLabel', 'valueMissingLabel', 'rangeUnderflowLabel', 'rangeOverflowLabel', 'rangeOutsideLabel',
  'disabled', 'open', 'minuteStep', 'cancelLabel', 'okLabel', 'hideTrigger', 'amLabel', 'pmLabel', 'hourLabel', 'minuteLabel', 'toggleDialLabel', 'toggleInputLabel',
  'periodLabel', 'periodLayout', 'orientation', 'responsive', 'density']);
const TP_RULES = { variant: enumOf(['dial', 'input']), format: enumOf(['12h', '24h']), required: bool, error: bool, reserveSupportingSpace: bool, disabled: bool, open: bool,
  hideTrigger: bool, responsive: bool, periodLayout: enumOf(['vertical', 'horizontal']), orientation: enumOf(['auto', 'vertical', 'horizontal']), density,
  minuteStep: value => typeof value === 'number' && Number.isFinite(value) };
export const PICKER_UPDATE_PROPERTIES = Object.freeze({ 'md-color-picker': COLOR_PICKER_UPDATE_PROPERTIES, 'md-time-picker': TIME_PICKER_UPDATE_PROPERTIES, 'md-date-picker': DATE_PICKER_UPDATE_PROPERTIES });
export const PICKER_UPDATE_LABELS = Object.freeze({ 'md-color-picker': 'Color Picker', 'md-time-picker': 'Time Picker', 'md-date-picker': 'Date Picker' });
export function validPickerUpdate(tag, key, value) {
  if (tag === 'md-date-picker') return validDatePickerUpdate(key, value);
  const rule = (tag === 'md-color-picker' ? CP_RULES : TP_RULES)[key];
  return rule ? rule(value) : text(value);
}

// ---- methods: synchronous calls on the mounted picker (AWCColorPickerController / AWCTimePickerController) ----
export const PICKER_ITEM_METHODS = Object.freeze({ 'md-color-picker': ['show', 'close'], 'md-time-picker': ['show', 'hide'], 'md-date-picker': DATE_PICKER_ITEM_METHODS });
export const PICKER_VALIDITY_METHODS = Object.freeze({ 'md-time-picker': ['checkValidity', 'reportValidity', 'getValidity'], 'md-date-picker': DATE_PICKER_VALIDITY_METHODS });
