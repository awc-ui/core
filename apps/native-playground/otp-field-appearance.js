import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-otp-field's seven typed hooks and its retained property updates. Field order follows the native initializers
// (Swift requires labelled arguments in order). Lengths are px (points on SwiftUI, dp on Android); colours #RRGGBB or #RRGGBBAA.
const otp = (name, label, suffix, kind) => appearanceField('otp-field', name, label, suffix, kind);
export const OTP_FIELD_APPEARANCE_FIELDS = Object.freeze([
  otp('cellGap', 'Cell gap', 'cell-gap', 'length'),
  otp('cellHeight', 'Cell height', 'cell-height', 'length'),
  otp('cellShape', 'Cell shape', 'cell-shape', 'length'),
  otp('cellWidth', 'Cell width', 'cell-width', 'length'),
  otp('focusColor', 'Focus color', 'focus-color', 'color'),
  otp('fontSize', 'Font size', 'font-size', 'length'),
  otp('outlineColor', 'Outline color', 'outline-color', 'color'),
]);
/** The source's ::part names with their typed native part fields (AWCOTPFieldPartAppearance). */
export const OTP_FIELD_PARTS = Object.freeze({
  cells: ['cellsGap'], cell: ['cellBorderColor', 'cellBorderWidth', 'cellBackgroundColor', 'cellTextColor', 'caretColor'],
  separator: ['separatorColor', 'separatorOpacity'], 'supporting-text': ['supportingTextColor'],
});
export const otpFieldAppearance = appearanceProfile(OTP_FIELD_APPEARANCE_FIELDS, 'INVALID_OTP_FIELD_APPEARANCE', 'OTP Field');

// ---- retained property updates (every source property) ----
export const OTP_FIELD_UPDATE_PROPERTIES = Object.freeze(['length', 'value', 'validationType', 'transform', 'mask', 'autoSubmit', 'groupSize', 'inputMode',
  'name', 'disabled', 'readOnly', 'required', 'error', 'errorText', 'supportingText', 'label', 'cellLabelTemplate', 'valueMissingLabel', 'incompleteLabel',
  'density', 'reserveSupportingSpace']);
const BOOLEANS = new Set(['mask', 'autoSubmit', 'disabled', 'readOnly', 'required', 'error', 'reserveSupportingSpace']);
const text = value => typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
const count = value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 64;
/** True when `value` is a valid retained update of md-otp-field `key` (the source property types). */
export function validOTPFieldUpdate(key, value) {
  if (BOOLEANS.has(key)) return typeof value === 'boolean';
  switch (key) {
    case 'length': return count(value) && value >= 1;
    case 'groupSize': return count(value);
    case 'validationType': return ['numeric', 'alpha', 'alphanumeric', 'none'].includes(value);
    case 'transform': return ['none', 'uppercase'].includes(value);
    case 'density': return [0, -1, -2, -3, -4].includes(value);
    default: return text(value);
  }
}
