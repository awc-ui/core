import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-select's eight typed hooks (AWCSelectAppearance; field order follows the native initializers, Swift requires labelled
// arguments in order) and md-multi-select's thirty-eight hooks (AWCMultiSelectAppearance, a hook map: native snippets write
// `.init(["chip-height": "28px"])` / `AWCMultiSelectAppearance(mapOf("chip-height" to "28px"))`). Lengths are px (points on
// SwiftUI, dp on Android), colours #RRGGBB or #RRGGBBAA; the multi-select's paddings are CSS padding shorthands and its
// empty-state font a CSS font shorthand subset (`italic 500 15px/20px Roboto`: style, weight, size[/line height], family).
const sel = (name, label, suffix, kind) => appearanceField('select', name, label, suffix, kind);
export const SELECT_APPEARANCE_FIELDS = Object.freeze([
  sel('width', 'Width', 'width', 'length'),
  sel('minWidth', 'Minimum width', 'min-width', 'length'),
  sel('caretColor', 'Caret color', 'caret-color', 'color'),
  sel('caretSize', 'Caret size', 'caret-size', 'length'),
  sel('clearColor', 'Clear button color', 'clear-color', 'color'),
  sel('trailingGap', 'Trailing gap', 'trailing-gap', 'length'),
  sel('optionIconColor', 'Option icon color', 'option-icon-color', 'color'),
  sel('spinnerSize', 'Spinner size', 'spinner-size', 'length'),
]);
const selectProfile = appearanceProfile(SELECT_APPEARANCE_FIELDS, 'INVALID_SELECT_APPEARANCE', 'Select');
export const selectAppearance = Object.freeze({
  fields: SELECT_APPEARANCE_FIELDS,
  normalize: value => selectProfile.normalize(value),
  css: value => selectProfile.css(value),
  parseInput: (name, raw) => selectProfile.parseInput(name, raw),
  formatInput: (name, value) => selectProfile.formatInput(name, value),
  nativeValue: (name, value, platform) => selectProfile.nativeValue(name, value, platform),
});

const MS_KINDS = {
  length: ['width', 'min-width', 'trigger-width', 'frame-gap', 'chip-gap', 'chip-height', 'chip-radius', 'caret-size', 'caret-box-size', 'clear-size',
    'clear-icon-size', 'clear-radius', 'clear-focus-ring-width', 'clear-focus-ring-offset', 'option-icon-size', 'search-border-width', 'search-spinner-size',
    'select-all-divider-width', 'loading-padding', 'loader-size', 'spinner-size', 'inline-chips-block-start'],
  color: ['chip-outline', 'caret-color', 'clear-color', 'clear-bg', 'clear-hover-bg', 'clear-focus-ring-color', 'option-icon-color', 'search-bg', 'search-color',
    'search-placeholder-color', 'search-border-color', 'select-all-divider-color', 'empty-color'],
  insets: ['search-padding', 'empty-padding'],
  fontShorthand: ['empty-font'],
};
const camel = hook => hook.replace(/-bg$/, '-background').replace(/-bg-/, '-background-').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const words = hook => hook.replace(/-/g, ' ').replace(/\bbg\b/, 'background').replace(/^./, c => c.toUpperCase());
const FONT_HINT = 'A CSS font shorthand: optional italic and weight (100…900), a px size with an optional /line height, then a family, for example italic 500 15px/20px Roboto.';
export const MULTI_SELECT_APPEARANCE_FIELDS = Object.freeze(Object.entries(MS_KINDS).flatMap(([kind, hooks]) => hooks.map(hook =>
  kind === 'fontShorthand' ? Object.freeze({ name: camel(hook), label: words(hook), cssProperty: `--md-multi-select-${hook}`, kind, hint: FONT_HINT })
    : appearanceField('multi-select', camel(hook), words(hook), hook, kind)))
  .sort((a, b) => a.cssProperty.localeCompare(b.cssProperty)));
const MS_CODE = 'INVALID_MULTI_SELECT_APPEARANCE';
const msInvalid = message => Object.assign(new Error(message), { code: MS_CODE });
const msFields = new Map(MULTI_SELECT_APPEARANCE_FIELDS.map(f => [f.name, f]));
const msProfiles = new Map(MULTI_SELECT_APPEARANCE_FIELDS.filter(f => f.kind !== 'fontShorthand').map(f => [f.name, appearanceProfile([f], MS_CODE, 'Multi Select')]));
const utf8 = text => new TextEncoder().encode(text).length;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const NUM = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const FONT = new RegExp(`^(?:(italic)\\s+)?(?:([1-9]00)\\s+)?(${NUM})px(?:\\/(${NUM})px)?(?:\\s+([^;{}<>\\\\]{1,200}))?$`, 'i');
/** One hook as canonical CSS text (the native hook map stores what the stylesheet would read). */
function msText(name, raw) {
  const f = msFields.get(name);
  if (!f) throw msInvalid(`Unknown Multi Select appearance field ${String(name)}.`);
  if (typeof raw !== 'string' || utf8(raw) > 1024) throw msInvalid(`${f.label} must be CSS text.`);
  const text = raw.trim().replace(/\s+/g, ' ');
  if (f.kind === 'fontShorthand') {
    const m = FONT.exec(text);
    if (!m) throw msInvalid(`${f.label} must be a CSS font shorthand with a px size, for example italic 500 15px/20px Roboto.`);
    return [m[1] && 'italic', m[2], `${Number(m[3])}px${m[4] !== undefined ? `/${Number(m[4])}px` : ''}`, m[5]?.trim()].filter(Boolean).join(' ');
  }
  const p = msProfiles.get(name);
  return p.formatInput(name, p.parseInput(name, text));
}
function msNormalize(value) {
  if (value === undefined) return {};
  if (!plain(value) || Reflect.ownKeys(value).some(key => !msFields.has(key))) throw msInvalid(`Use a plain object containing only the ${MULTI_SELECT_APPEARANCE_FIELDS.length} Multi Select appearance fields.`);
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw msInvalid('Appearance fields must contain data values.');
  return Object.fromEntries(MULTI_SELECT_APPEARANCE_FIELDS.filter(f => Object.hasOwn(value, f.name)).map(f => [f.name, msText(f.name, typeof value[f.name] === 'number' && f.kind === 'length' ? `${value[f.name]}px` : value[f.name])]));
}
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
export const multiSelectAppearance = Object.freeze({
  fields: MULTI_SELECT_APPEARANCE_FIELDS,
  hookPrefix: '--md-multi-select-',
  normalize: msNormalize,
  css: value => Object.fromEntries(Object.entries(msNormalize(value)).map(([name, text]) => [msFields.get(name).cssProperty, text])),
  parseInput: (name, raw) => msText(name, String(raw ?? '')),
  formatInput: (name, value) => value === undefined ? '' : msText(name, value),
  nativeValue: (name, value, platform) => msFields.has(name) ? quote(value, platform) : undefined,
});

// ---- retained property updates ----
// Every source property the natives support: md-select leaves out virtualize / filterMode / rowHeight / searchingLabel and
// md-multi-select also countFormatter (a closure) — the support policies list them as unsupported.
export const SELECT_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'reserveSupportingSpace', 'variant', 'label', 'placeholder', 'value', 'disabled',
  'required', 'error', 'errorText', 'supportingText', 'density', 'clearable', 'matchTriggerWidth', 'placement', 'maxHeight', 'options', 'filterable', 'name',
  'searchPlaceholder', 'filterLabel', 'noResultsText', 'noOptionsText', 'clearLabel', 'loadingText', 'clearIcon', 'dropdownIcon', 'loading', 'fullWidth', 'open']);
export const MULTI_SELECT_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'reserveSupportingSpace', 'variant', 'label', 'placeholder', 'supportingText',
  'error', 'errorText', 'disabled', 'softDisabled', 'required', 'density', 'options', 'filterable', 'value', 'maxSelected', 'showSelectAll', 'selectAllLabel',
  'placement', 'maxHeight', 'matchTriggerWidth', 'displayMode', 'chipOverflow', 'chipPosition', 'trigger', 'triggerIcon', 'triggerLabel', 'searchPlaceholder',
  'filterLabel', 'noResultsText', 'noOptionsText', 'loadingText', 'loading', 'clearable', 'clearIcon', 'clearLabel', 'dropdownIcon', 'name', 'open']);
const BOOLEANS = new Set(['reserveSupportingSpace', 'disabled', 'softDisabled', 'required', 'error', 'clearable', 'matchTriggerWidth', 'filterable', 'loading',
  'fullWidth', 'open', 'showSelectAll']);
const text = value => typeof value === 'string' && utf8(value) <= 4096;
const enumOf = values => value => values.includes(value);
const OPTION_KEYS = new Set(['value', 'label', 'disabled', 'icon', 'iconColor', 'supportingText', 'selected', 'hidden']);
/** SelectOptionInit[] (at most 500 plain objects with string value / label and the optional row fields) or its JSON text. */
export function validSelectOptions(value) {
  if (typeof value === 'string') return utf8(value) <= 65536;
  if (!Array.isArray(value) || value.length > 500) return false;
  return value.every(o => plain(o) && Object.keys(o).every(k => OPTION_KEYS.has(k)) && typeof o.value === 'string' && utf8(o.value) <= 1024
    && (o.label === undefined || text(o.label)) && ['disabled', 'selected', 'hidden'].every(k => o[k] === undefined || typeof o[k] === 'boolean')
    && ['icon', 'iconColor', 'supportingText'].every(k => o[k] === undefined || text(o[k])));
}
const RULES = {
  variant: enumOf(['filled', 'outlined']), density: enumOf([0, -1, -2, -3, -4]), placement: enumOf(['bottom-start', 'bottom-end', 'top-start', 'top-end']),
  displayMode: enumOf(['chips', 'chips-inline', 'count', 'text']), chipOverflow: enumOf(['count', 'wrap']), chipPosition: enumOf(['bottom', 'top', 'left', 'right']),
  trigger: enumOf(['field', 'button']), maxSelected: value => Number.isSafeInteger(value) && value >= 0 && value <= 1e6, options: validSelectOptions,
};
/** True when `value` is a valid retained update of `tag` (md-select / md-multi-select) property `key` (the source property types). */
export function validSelectUpdate(tag, key, value) {
  if (BOOLEANS.has(key)) return typeof value === 'boolean';
  if (RULES[key]) return RULES[key](value);
  if (key === 'maxHeight') return value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e5 || tag === 'md-select' && text(value);
  if (key === 'value' && tag === 'md-multi-select') return Array.isArray(value) && value.length <= 500 && value.every(v => typeof v === 'string' && utf8(v) <= 1024);
  return text(value);
}

// ---- methods (AWCSelectController / AWCMultiSelectController) ----
const SELECT_METHOD_NAMES = Object.freeze(['show', 'close', 'focusTrigger', 'reset', 'loadOptions', 'setQuery', 'getLabels', 'getValidity', 'checkValidity',
  'reportValidity', 'setCustomValidity']);
export const SELECT_METHODS = Object.freeze({ 'md-select': SELECT_METHOD_NAMES, 'md-multi-select': SELECT_METHOD_NAMES });
export const nativeSelectMethod = (tag, method) => Boolean(SELECT_METHODS[tag]?.includes(method));
/** Wire arguments: setCustomValidity(message) and setQuery(text) take one string (≤ 4096 UTF-8 bytes); loadOptions(options) a
 *  SelectOptionInit array (≤ 500 rows; the source's OptionRowSource is a browser object, natives take the array); getLabels(values)
 *  an array of value strings (≤ 500). The other methods take no arguments. */
export function selectMethodArguments(tag, method, args) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_METHOD' }); };
  switch (method) {
    case 'setCustomValidity': case 'setQuery':
      if (args.length !== 1 || !text(args[0])) fail(`${method} requires one string up to 4096 UTF-8 bytes.`);
      return [args[0]];
    case 'loadOptions':
      if (args.length !== 1 || !Array.isArray(args[0]) || !validSelectOptions(args[0])) fail('loadOptions requires one array of at most 500 options ({ value, label?, disabled?, icon?, iconColor?, supportingText?, selected?, hidden? }).');
      return [args[0].map(o => ({ ...o }))];
    case 'getLabels':
      if (args.length !== 1 || !Array.isArray(args[0]) || args[0].length > 500 || !args[0].every(v => typeof v === 'string' && utf8(v) <= 1024)) fail('getLabels requires one array of at most 500 value strings.');
      return [[...args[0]]];
    default:
      if (args.length) fail(`${method} requires no arguments.`);
      return [];
  }
}
/** getLabels() result: the live hosts send { awcSelectLabels: { value: label } } (values without an option are left out). */
export function selectMethodValue(envelope) {
  if (!plain(envelope) || Reflect.ownKeys(envelope).join() !== 'awcSelectLabels') return undefined;
  const labels = envelope.awcSelectLabels;
  if (!plain(labels)) return undefined;
  const entries = Object.entries(labels);
  if (entries.length > 500 || !entries.every(([k, v]) => utf8(k) <= 1024 && text(v))) return undefined;
  return { value: Object.fromEntries(entries) };
}
