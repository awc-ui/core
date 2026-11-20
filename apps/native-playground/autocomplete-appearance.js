import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-autocomplete in the Laboratory: its eleven typed hooks, retained property updates and the method wire contract.
// Field order follows the native initializers (Swift requires labelled arguments in order). Lengths are px (points on
// SwiftUI, dp on Android); colours #RRGGBB or #RRGGBBAA. The inner md-text-field and the md-menu popup keep their own
// registry entries (textFieldAppearance / menuAppearance style the composed field and listbox).
const ac = (name, label, suffix, kind) => appearanceField('autocomplete', name, label, suffix, kind);
export const AUTOCOMPLETE_APPEARANCE_FIELDS = Object.freeze([
  ac('width', 'Width', 'width', 'length'),
  ac('minWidth', 'Minimum width', 'min-width', 'length'),
  ac('chipGap', 'Chip gap', 'chip-gap', 'length'),
  ac('chipRadius', 'Chip corner radius', 'chip-radius', 'length'),
  ac('caretColor', 'Caret color', 'caret-color', 'color'),
  ac('caretSize', 'Caret size', 'caret-size', 'length'),
  ac('clearColor', 'Clear button color', 'clear-color', 'color'),
  ac('optionIconColor', 'Option icon color', 'option-icon-color', 'color'),
  ac('optionIconSize', 'Option icon size', 'option-icon-size', 'length'),
  ac('loadingColor', 'Loading color', 'loading-color', 'color'),
  ac('spinnerSize', 'Spinner size', 'spinner-size', 'length'),
]);
export const autocompleteAppearance = appearanceProfile(AUTOCOMPLETE_APPEARANCE_FIELDS, 'INVALID_AUTOCOMPLETE_APPEARANCE', 'Autocomplete');

// ---- retained property updates: every source property except the filterer closure (native API only) and the three
// virtualization properties the native lists do not have (virtualize, filterMode, rowHeight) ----
export const AUTOCOMPLETE_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'reserveSupportingSpace', 'variant', 'label', 'placeholder',
  'supportingText', 'error', 'errorText', 'disabled', 'softDisabled', 'required', 'density', 'options', 'multiple', 'chipPosition', 'value',
  'inputValue', 'freeSolo', 'maxSelected', 'loading', 'noOptionsText', 'noResultsText', 'loadingText', 'statusTemplate', 'disableCloseOnSelect',
  'clearOnBlur', 'clearable', 'clearIcon', 'dropdownIcon', 'limitResults', 'open', 'placement', 'matchTriggerWidth', 'maxHeight', 'name']);
const BOOLEANS = new Set(['reserveSupportingSpace', 'error', 'disabled', 'softDisabled', 'required', 'multiple', 'freeSolo', 'loading',
  'disableCloseOnSelect', 'clearOnBlur', 'clearable', 'open', 'matchTriggerWidth']);
const bytes = value => new TextEncoder().encode(value).length;
const text = value => typeof value === 'string' && bytes(value) <= 4096;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const dataValue = (value, key) => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value');
const OPTION_KEYS = { value: 'string', label: 'string', disabled: 'boolean', supportingText: 'string', description: 'string', icon: 'string', iconColor: 'string' };
/** One `MdAutocompleteOption`: { value, label?, disabled?, supportingText? (or the legacy description), icon?, iconColor? }. */
export function validAutocompleteOption(option) {
  if (!plain(option) || !Object.hasOwn(option, 'value')) return false;
  return Reflect.ownKeys(option).every(key => typeof key === 'string' && Object.hasOwn(OPTION_KEYS, key) && dataValue(option, key)
    && (OPTION_KEYS[key] === 'boolean' ? typeof option[key] === 'boolean' : text(option[key])));
}
/** A data array of at most 1000 option inits (the native lists are not virtualized). */
export const validAutocompleteOptions = value => Array.isArray(value) && value.length <= 1000 && Reflect.ownKeys(value).length === value.length + 1
  && value.every((option, index) => dataValue(value, String(index)) && validAutocompleteOption(option));
/** True when `value` is a valid retained update of md-autocomplete `key` (the source property types). */
export function validAutocompleteUpdate(key, value) {
  if (!AUTOCOMPLETE_UPDATE_PROPERTIES.includes(key)) return false;
  if (BOOLEANS.has(key)) return typeof value === 'boolean';
  switch (key) {
    case 'variant': return ['filled', 'outlined'].includes(value);
    case 'density': return [0, -1, -2, -3, -4].includes(value);
    case 'chipPosition': return ['below', 'top', 'left', 'right', 'inline'].includes(value);
    case 'placement': return ['bottom-start', 'bottom-end', 'top-start', 'top-end'].includes(value);
    // A string value (single), or a list of strings (multiple).
    case 'value': return text(value) || Array.isArray(value) && value.length <= 1000 && value.every(text);
    // The options array, or its JSON text (the attribute form).
    case 'options': return validAutocompleteOptions(value) || text(value);
    case 'maxSelected': case 'limitResults': return Number.isSafeInteger(value) && value >= 0;
    case 'maxHeight': return value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
    default: return text(value);
  }
}

// ---- methods: focusInput / showMenu / closeMenu / loadOptions(options) / getLabels(values) and the validity API, all
// synchronous through AWCAutocompleteController; getLabels returns { value: label } as { awcAutocompleteLabels } ----
export const AUTOCOMPLETE_METHODS = Object.freeze(['focusInput', 'showMenu', 'closeMenu', 'loadOptions', 'getLabels', 'getValidity',
  'checkValidity', 'reportValidity', 'setCustomValidity']);
export const nativeAutocompleteMethod = (tag, method) => tag === 'md-autocomplete' && AUTOCOMPLETE_METHODS.includes(method);
export function autocompleteMethodArguments(tag, method, args) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_METHOD' }); };
  switch (method) {
    case 'loadOptions':
      if (args.length !== 1 || !validAutocompleteOptions(args[0])) fail('loadOptions requires one array of at most 1000 options ({ value, label, disabled, supportingText, icon, iconColor }).');
      return [args[0].map(option => ({ ...option }))];
    case 'getLabels':
      if (args.length !== 1 || !Array.isArray(args[0]) || args[0].length > 1000 || !args[0].every(text)) fail('getLabels requires one array of at most 1000 value strings.');
      return [[...args[0]]];
    case 'setCustomValidity':
      if (args.length !== 1 || !text(args[0])) fail('setCustomValidity requires one string up to 4096 UTF-8 bytes.');
      return [args[0]];
    default:
      if (args.length) fail(`${method} requires no arguments.`);
      return [];
  }
}
/** getLabels' result envelope: { awcAutocompleteLabels: { value: label } } (validated, at most 1000 entries). */
export function autocompleteMethodValue(envelope) {
  if (!plain(envelope) || Reflect.ownKeys(envelope).join() !== 'awcAutocompleteLabels') return undefined;
  const labels = envelope.awcAutocompleteLabels;
  if (!plain(labels)) return undefined;
  const entries = Object.entries(labels);
  if (entries.length > 1000 || Reflect.ownKeys(labels).some(key => typeof key !== 'string' || !text(key)) || !entries.every(([, label]) => text(label))) return undefined;
  return { value: Object.fromEntries(entries) };
}
