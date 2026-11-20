import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-number-field's five typed hooks and its retained property updates. Field order follows the native initializers
// (Swift requires labelled arguments in order). Lengths are px (points on SwiftUI, dp on Android); colours #RRGGBB or
// #RRGGBBAA. The md-text-field hooks pass through to the inner field (its own registry entry styles them).
const nf = (name, label, suffix, kind) => appearanceField('number-field', name, label, suffix, kind);
export const NUMBER_FIELD_APPEARANCE_FIELDS = Object.freeze([
  nf('width', 'Width', 'width', 'length'),
  nf('minWidth', 'Minimum width', 'min-width', 'length'),
  nf('stepperIconSize', 'Stepper icon size', 'stepper-icon-size', 'length'),
  nf('stepperColor', 'Stepper color', 'stepper-color', 'color'),
  nf('splitStepperSize', 'Split stepper size', 'split-stepper-size', 'length'),
]);
/** The source's ::part names with their typed native part fields (AWCNumberFieldPartAppearance). */
export const NUMBER_FIELD_PARTS = Object.freeze({ field: ['field', 'fieldBackgroundColor', 'fieldOpacity'] });
export const numberFieldAppearance = appearanceProfile(NUMBER_FIELD_APPEARANCE_FIELDS, 'INVALID_NUMBER_FIELD_APPEARANCE', 'Number Field');

// ---- retained property updates (every source property) ----
export const NUMBER_FIELD_UPDATE_PROPERTIES = Object.freeze(['variant', 'label', 'placeholder', 'supportingText', 'error', 'errorText', 'disabled',
  'readOnly', 'required', 'name', 'density', 'value', 'locale', 'formatOptions', 'min', 'max', 'step', 'smallStep', 'largeStep', 'snapOnStep',
  'allowOutOfRange', 'allowWheelScrub', 'steppers', 'incrementLabel', 'decrementLabel', 'valueMissingLabel', 'reserveSupportingSpace']);
const BOOLEANS = new Set(['error', 'disabled', 'readOnly', 'required', 'snapOnStep', 'allowOutOfRange', 'allowWheelScrub', 'reserveSupportingSpace']);
const text = value => typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
const finite = value => typeof value === 'number' && Number.isFinite(value);
/** Intl.NumberFormat options as data: a plain object of strings, numbers and booleans (or the attribute's JSON text). */
function formatOptions(value) {
  if (text(value)) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length <= 32 && keys.every(k => typeof k === 'string' && /^[a-zA-Z]{1,40}$/.test(k) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), 'value')
    && (text(value[k]) || finite(value[k]) || typeof value[k] === 'boolean'));
}
/** True when `value` is a valid retained update of md-number-field `key` (the source property types). */
export function validNumberFieldUpdate(key, value) {
  if (BOOLEANS.has(key)) return typeof value === 'boolean';
  switch (key) {
    case 'variant': return ['filled', 'outlined'].includes(value);
    case 'density': return [0, -1, -2, -3, -4].includes(value);
    case 'steppers': return ['inline', 'split', 'none'].includes(value);
    case 'value': case 'min': case 'max': return value === null || finite(value);
    case 'step': case 'smallStep': case 'largeStep': return finite(value);
    case 'formatOptions': return value === null || formatOptions(value);
    default: return text(value);
  }
}
