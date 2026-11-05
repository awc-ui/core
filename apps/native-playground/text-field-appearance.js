import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-text-field's seventeen typed hooks and its retained property updates. Field order follows the native initializers
// (Swift requires labelled arguments in order). Lengths are px (points on SwiftUI, dp on Android); colours #RRGGBB or
// #RRGGBBAA. Three hooks are not plain lengths: the focus inset and the optical nudge are signed (the source moves the
// focus ring and the outlined input text by these px), and the cursor is a CSS cursor keyword.
const tf = (name, label, suffix, kind) => appearanceField('text-field', name, label, suffix, kind);
const signed = (name, label, suffix) => Object.freeze({ name, label, cssProperty: `--md-text-field-${suffix}`, kind: 'signedLength',
  hint: 'Signed length in px (points on SwiftUI, dp on Android); negative values move inward.' });
const keyword = (name, label, suffix) => Object.freeze({ name, label, cssProperty: `--md-text-field-${suffix}`, kind: 'keyword',
  hint: 'A CSS cursor keyword, for example text, pointer or crosshair (macOS maps it to the matching pointer; touch platforms ignore it).' });
export const TEXT_FIELD_APPEARANCE_FIELDS = Object.freeze([
  tf('activeIndicatorColor', 'Active indicator color', 'active-indicator-color', 'color'),
  tf('containerColor', 'Container color', 'container-color', 'color'),
  tf('containerShape', 'Container corner radius', 'container-shape', 'length'),
  keyword('cursor', 'Cursor', 'cursor'),
  tf('errorColor', 'Error color', 'error-color', 'color'),
  tf('filledPill', 'Filled pill (0 to 1)', 'filled-pill', 'opacity'),
  tf('focusBorderWidth', 'Focus border width', 'focus-border-width', 'length'),
  signed('focusInset', 'Focus inset', 'focus-inset'),
  tf('iconColor', 'Icon color', 'icon-color', 'color'),
  tf('iconSize', 'Icon size', 'icon-size', 'length'),
  tf('inputColor', 'Input text color', 'input-color', 'color'),
  tf('labelColor', 'Label color', 'label-color', 'color'),
  signed('opticalNudge', 'Optical nudge (outlined)', 'optical-nudge'),
  tf('outlineColor', 'Outline color', 'outline-color', 'color'),
  tf('paddingInlineStart', 'Inline start padding', 'padding-inline-start', 'length'),
  tf('paddingInlineEnd', 'Inline end padding', 'padding-inline-end', 'length'),
  tf('supportingTextColor', 'Supporting text color', 'supporting-text-color', 'color'),
]);
/** The source's ::part names with their typed native part fields (AWCTextFieldPartAppearance). */
export const TEXT_FIELD_PARTS = Object.freeze({
  container: ['containerColor'], label: ['labelColor'], input: ['inputColor', 'caretColor'],
  'supporting-text': ['supportingTextColor'], counter: ['counterColor'], chips: [],
});
const CODE = 'INVALID_TEXT_FIELD_APPEARANCE';
const invalid = message => Object.assign(new Error(message), { code: CODE });
const special = new Set(['cursor', 'focusInset', 'opticalNudge']);
const base = appearanceProfile(TEXT_FIELD_APPEARANCE_FIELDS.filter(f => !special.has(f.name)), CODE, 'Text Field');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const CURSOR = /^[a-z][a-z-]{0,39}$/;
const css = value => { const text = String(value); return text.includes('e') ? String(Number(value.toPrecision(15))) : text; };
function special1(name, value) {
  if (name === 'cursor') { if (typeof value !== 'string' || !CURSOR.test(value)) throw invalid('Cursor must be a CSS cursor keyword.'); return value; }
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(`${name === 'focusInset' ? 'Focus inset' : 'Optical nudge'} must be a finite number.`);
  return value;
}
function normalize(value) {
  if (value === undefined) return {};
  if (!plain(value)) throw invalid(`Use a plain object containing only the ${TEXT_FIELD_APPEARANCE_FIELDS.length} Text Field appearance fields.`);
  const rest = {}, extra = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw invalid('Appearance fields must contain data values.');
    if (special.has(key)) extra[key] = special1(key, value[key]); else rest[key] = value[key];
  }
  const normalized = { ...base.normalize(rest), ...extra };
  return Object.fromEntries(TEXT_FIELD_APPEARANCE_FIELDS.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.name, normalized[f.name]]));
}
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
export const textFieldAppearance = Object.freeze({
  fields: TEXT_FIELD_APPEARANCE_FIELDS,
  normalize,
  css(value) {
    const n = normalize(value), rest = Object.fromEntries(Object.entries(n).filter(([k]) => !special.has(k)));
    const out = base.css(rest);
    for (const f of TEXT_FIELD_APPEARANCE_FIELDS) if (special.has(f.name) && Object.hasOwn(n, f.name)) out[f.cssProperty] = f.name === 'cursor' ? n.cursor : `${css(n[f.name])}px`;
    return Object.fromEntries(TEXT_FIELD_APPEARANCE_FIELDS.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
  },
  parseInput(name, raw) {
    const text = String(raw ?? '').trim();
    if (name === 'cursor') return text;
    if (name === 'focusInset' || name === 'opticalNudge') {
      const match = /^(.*?)(px)?$/i.exec(text);
      if (!NUMBER.test(match[1]) || (!match[2] && Number(match[1]) !== 0)) throw invalid(`${name === 'focusInset' ? 'Focus inset' : 'Optical nudge'} must be a px length.`);
      return Number(match[1]);
    }
    return base.parseInput(name, raw);
  },
  formatInput(name, value) {
    if (!special.has(name)) return base.formatInput(name, value);
    if (value === undefined) return '';
    const v = special1(name, value);
    return name === 'cursor' ? v : `${css(v)}px`;
  },
  nativeValue: (name, value, platform) => name === 'cursor' ? quote(String(value), platform) : special.has(name) ? undefined : base.nativeValue(name, value, platform),
});

// ---- retained property updates (every source property except the formatter/parser closures) ----
export const TEXT_FIELD_UPDATE_PROPERTIES = Object.freeze(['reserveSupportingSpace', 'variant', 'label', 'value', 'placeholder', 'type', 'name', 'pattern',
  'minLength', 'min', 'max', 'step', 'autocomplete', 'inputMode', 'enterKeyHint', 'autoCapitalize', 'spellcheck', 'disabled', 'readOnly', 'required',
  'error', 'errorText', 'supportingText', 'prefixText', 'suffixText', 'maxLength', 'clearable', 'passwordToggle', 'showPasswordLabel',
  'hidePasswordLabel', 'density', 'multiline', 'rows', 'speechToText', 'speechLang', 'restrict', 'formatOn', 'focusBorderWidth', 'appearFocused',
  'chipsWrap', 'debounce', 'throttle', 'inputRole', 'inputExpanded', 'inputAriaAutocomplete']);
const BOOLEANS = new Set(['reserveSupportingSpace', 'spellcheck', 'disabled', 'readOnly', 'required', 'error', 'appearFocused', 'chipsWrap', 'inputExpanded']);
const MODES = new Set(['clearable', 'passwordToggle', 'speechToText']);
const COUNTS = new Set(['minLength', 'maxLength', 'rows', 'debounce', 'throttle']);
const text = value => typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
/** True when `value` is a valid retained update of md-text-field `key` (the source property types). */
export function validTextFieldUpdate(key, value) {
  if (BOOLEANS.has(key)) return typeof value === 'boolean';
  if (MODES.has(key)) return typeof value === 'boolean' || ['internal', 'external'].includes(value);
  if (COUNTS.has(key)) return value === null || typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1e6;
  switch (key) {
    case 'variant': return ['filled', 'outlined'].includes(value);
    case 'density': return [0, -1, -2, -3, -4].includes(value);
    case 'multiline': return value === false || ['auto-grow', 'fixed'].includes(value);
    case 'formatOn': return ['blur', 'input'].includes(value);
    case 'focusBorderWidth': return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 64;
    case 'inputRole': return ['', 'combobox'].includes(value);
    case 'inputAriaAutocomplete': return ['', 'none', 'inline', 'list', 'both'].includes(value);
    case 'min': case 'max': case 'step': return value === null || typeof value === 'number' && Number.isFinite(value) || text(value);
    default: return text(value);
  }
}
