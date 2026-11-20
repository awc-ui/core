import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-slider and md-rating in the Laboratory: their typed hooks (field order follows the native initializers —
// AWCSliderAppearance, AWCRatingAppearance), the retained property updates (every source property except the getLabel
// closure) and md-rating's method focusRating().
const invalid = (code, message) => Object.assign(new Error(message), { code });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
const numberText = text => new RegExp(`^${NUMBER}$`, 'i').test(text) ? Number(text) : NaN;
const cssNumber = value => { const text = String(value); return text.includes('e') ? String(Number(value.toPrecision(15))) : text; };
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
const double = value => { if (Object.is(value, -0)) return '-0.0'; const text = String(value); return /[.e]/i.test(text) ? text : `${text}.0`; };

/** Kinds the shared profile has no rule for: a signed length, a plain number, a `font` shorthand. */
const EXTRA = {
  signedLength: {
    hint: 'A signed length in px (points on SwiftUI, dp on Android).',
    normalize(value, code, label) { if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(code, `${label} must be a finite number.`); return Object.is(value, -0) ? 0 : value; },
    css: value => `${cssNumber(value)}px`,
    parse: (raw, code, label) => { const m = new RegExp(`^(${NUMBER})(px)?$`, 'i').exec(String(raw ?? '').trim()); if (!m) throw invalid(code, `${label} must be a px length.`); return Number(m[1]); },
    native: value => double(value),
  },
  number: {
    hint: 'A nonnegative number, for example 1.2.',
    normalize(value, code, label) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(code, `${label} must be a nonnegative number.`); return Object.is(value, -0) ? 0 : value; },
    css: value => cssNumber(value),
    parse: (raw, code, label) => { const n = numberText(String(raw ?? '').trim()); if (!Number.isFinite(n)) throw invalid(code, `${label} must be a number.`); return n; },
    native: value => double(value),
  },
  fontShorthand: {
    hint: 'A CSS font shorthand with a px size, for example 500 14px/20px Roboto.',
    normalize(value, code, label) {
      if (typeof value !== 'string' || value.length > 256 || /[;{}<>\\]/.test(value) || !/(?:^|\s)\d+(?:\.\d+)?px(?:\/\d+(?:\.\d+)?px)?\s+\S/.test(value.trim())) throw invalid(code, `${label} must be a CSS font shorthand with a px size.`);
      return value.trim();
    },
    css: value => value,
    parse: raw => String(raw ?? '').trim(),
    native: (value, platform) => quote(value, platform),
  },
};
const extraField = (prefix, name, label, suffix, kind) => Object.freeze({ name, label, cssProperty: `--md-${prefix}-${suffix}`, kind, hint: EXTRA[kind].hint });

function profile(fields, code, label) {
  const extras = new Map(fields.filter(f => EXTRA[f.kind]).map(f => [f.name, f]));
  const base = appearanceProfile(fields.filter(f => !extras.has(f.name)), code, label);
  const byName = new Map(fields.map(f => [f.name, f]));
  const normalize = value => {
    if (value === undefined) return {};
    if (!plain(value) || Reflect.ownKeys(value).some(key => !byName.has(key))) throw invalid(code, `Use a plain object containing only the ${fields.length} ${label} appearance fields.`);
    for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid(code, 'Appearance fields must contain data values.');
    const rest = Object.fromEntries(Object.entries(value).filter(([key]) => !extras.has(key)));
    const normalized = base.normalize(rest);
    for (const [name, f] of extras) if (Object.hasOwn(value, name)) normalized[name] = EXTRA[f.kind].normalize(value[name], code, f.label);
    return Object.fromEntries(fields.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.name, normalized[f.name]]));
  };
  return Object.freeze({
    fields,
    normalize,
    css(value) {
      const n = normalize(value);
      const rest = Object.fromEntries(Object.entries(n).filter(([key]) => !extras.has(key)));
      const out = base.css(rest);
      for (const [name, f] of extras) if (Object.hasOwn(n, name)) out[f.cssProperty] = EXTRA[f.kind].css(n[name]);
      return Object.fromEntries(fields.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
    },
    parseInput: (name, raw) => extras.has(name) ? EXTRA[extras.get(name).kind].parse(raw, code, extras.get(name).label) : base.parseInput(name, raw),
    formatInput: (name, value) => extras.has(name) ? (value === undefined ? '' : String(EXTRA[extras.get(name).kind].css(EXTRA[extras.get(name).kind].normalize(value, code, name)))) : base.formatInput(name, value),
    nativeValue: (name, value, platform) => extras.has(name) ? EXTRA[extras.get(name).kind].native(value, platform)
      : byName.get(name)?.kind === 'color' || byName.get(name)?.kind === 'font' ? quote(String(value), platform)
      : typeof value === 'number' ? double(value) : base.nativeValue(name, value, platform),
  });
}

// ---- slider ----------------------------------------------------------------------------------------------------------
const sl = (name, label, suffix, kind) => appearanceField('slider', name, label, suffix, kind);
export const SLIDER_APPEARANCE_FIELDS = Object.freeze([
  sl('trackLength', 'Track length', 'track-length', 'length'), sl('activeColor', 'Active track color', 'active-color', 'color'),
  sl('inactiveColor', 'Inactive track color', 'inactive-color', 'color'), sl('trackShape', 'Track corner radius', 'track-shape', 'length'),
  sl('trackHeight', 'Track height', 'track-height', 'length'), sl('tickActiveColor', 'Active stop color', 'tick-active-color', 'color'),
  sl('tickFilledColor', 'Filled stop color', 'tick-filled-color', 'color'), sl('tickInactiveColor', 'Inactive stop color', 'tick-inactive-color', 'color'),
  sl('thumbColor', 'Handle color', 'thumb-color', 'color'), sl('thumbWidth', 'Handle width', 'thumb-width', 'length'), sl('thumbHeight', 'Handle height', 'thumb-height', 'length'),
  sl('valueBackground', 'Value indicator background', 'value-bg', 'color'), sl('valueColor', 'Value indicator text color', 'value-color', 'color'),
  sl('valueShape', 'Value indicator corner radius', 'value-shape', 'length'), sl('valueFontFamily', 'Value indicator font family', 'value-font-family', 'font'),
  sl('valueFontSize', 'Value indicator font size', 'value-font-size', 'length'), sl('valueFontWeight', 'Value indicator font weight', 'value-font-weight', 'weight'),
  sl('valueLineHeight', 'Value indicator line height', 'value-line-height', 'length'), sl('valuePaddingInline', 'Value indicator inline padding', 'value-padding-inline', 'length'),
  sl('valuePaddingBlock', 'Value indicator block padding', 'value-padding-block', 'length'), sl('insetIconColor', 'Inset icon color', 'inset-icon-color', 'color'),
  sl('insetIconActiveColor', 'Inset icon color on the active track', 'inset-icon-active-color', 'color'), sl('minTrackLength', 'Minimum track length', 'min-track-length', 'length'),
  sl('valueIndicatorReserve', 'Value indicator reserve (labeled host)', 'value-indicator-reserve', 'length'),
]);
export const sliderAppearance = profile(SLIDER_APPEARANCE_FIELDS, 'INVALID_SLIDER_APPEARANCE', 'Slider');
export const SLIDER_APPEARANCE_GROUPS = Object.freeze([['Track', ['trackLength', 'minTrackLength', 'trackHeight', 'trackShape', 'activeColor', 'inactiveColor']],
  ['Stops', ['tickActiveColor', 'tickFilledColor', 'tickInactiveColor']], ['Handle', ['thumbColor', 'thumbWidth', 'thumbHeight']],
  ['Value indicator', ['valueIndicatorReserve', 'valueBackground', 'valueColor', 'valueShape', 'valueFontFamily', 'valueFontSize', 'valueFontWeight', 'valueLineHeight', 'valuePaddingInline', 'valuePaddingBlock']],
  ['Inset icon', ['insetIconColor', 'insetIconActiveColor']]]);

// ---- rating ----------------------------------------------------------------------------------------------------------
const rt = (name, label, suffix, kind) => (EXTRA[kind] ? extraField : appearanceField)('rating', name, label, suffix, kind);
export const RATING_APPEARANCE_FIELDS = Object.freeze([
  rt('itemSize', 'Item size', 'item-size', 'length'), rt('itemGap', 'Item gap', 'item-gap', 'length'), rt('activeColor', 'Filled color', 'active-color', 'color'),
  rt('inactiveColor', 'Empty color', 'inactive-color', 'color'), rt('focusRingColor', 'Focus ring color', 'focus-ring-color', 'color'),
  rt('focusRingWidth', 'Focus ring width', 'focus-ring-width', 'length'), rt('focusRingOffset', 'Focus ring offset', 'focus-ring-offset', 'signedLength'),
  rt('stateLayerColor', 'State layer color', 'state-layer-color', 'color'), rt('valueLabelColor', 'Value label color', 'value-label-color', 'color'),
  rt('valueLabelFont', 'Value label font', 'value-label-font', 'fontShorthand'), rt('popScale', 'Pop scale', 'pop-scale', 'number'),
  rt('duration', 'Motion duration', 'duration', 'duration'), rt('iconFontFamily', 'Icon font family', 'icon-font-family', 'font'),
]);
export const ratingAppearance = profile(RATING_APPEARANCE_FIELDS, 'INVALID_RATING_APPEARANCE', 'Rating');
export const RATING_APPEARANCE_GROUPS = Object.freeze([['Items', ['itemSize', 'itemGap', 'activeColor', 'inactiveColor', 'iconFontFamily']],
  ['Focus and states', ['focusRingColor', 'focusRingWidth', 'focusRingOffset', 'stateLayerColor']], ['Value label', ['valueLabelColor', 'valueLabelFont']], ['Motion', ['popScale', 'duration']]]);

// ---- retained property updates --------------------------------------------------------------------------------------
const E = values => ({ enum: values });
const DENSITY = E([0, -1, -2, -3, -4]);
const SIZE = E(['xs', 'sm', 'md', 'lg', 'xl']);
const S = 'string', N = 'number', B = 'boolean';
export const SR_PROPERTY_TYPES = Object.freeze({
  'md-slider': { min: N, max: N, value: N, step: N, disabled: B, name: S, nameStart: S, nameEnd: S, variant: E(['standard', 'centered']), range: B, stops: B,
    valueStart: N, valueEnd: N, size: SIZE, orientation: E(['horizontal', 'vertical']), fullHeight: B, valueIndicator: B, labeled: B,
    insetIcon: B, icon: S, sliderAriaLabel: S, ariaLabelStart: S, ariaLabelEnd: S, valueText: S, valueStartText: S, valueEndText: S, controlled: B, density: DENSITY },
  'md-rating': { value: N, defaultValue: N, max: N, precision: E([1, 0.5]), size: SIZE, readonly: B, disabled: B, softDisabled: B, icon: S,
    emptyIcon: S, outlineEmpty: B, showValueLabel: B, ratingLabel: S, name: S, hover: E(['preview', 'off']), density: DENSITY },
});
/** Retained updates: every source property except the getLabel closure (native API: AWCRatingController.getLabel). */
export const SR_UPDATE_PROPERTIES = Object.freeze(Object.fromEntries(Object.entries(SR_PROPERTY_TYPES).map(([tag, types]) => [tag, Object.freeze(Object.keys(types))])));
const bytes = value => new TextEncoder().encode(value).length;
export function validSrUpdate(tag, key, value) {
  const type = SR_PROPERTY_TYPES[tag]?.[key];
  if (type === undefined) return false;
  if (type.enum) return type.enum.includes(value);
  switch (type) {
    case B: return typeof value === 'boolean';
    case N: return typeof value === 'number' && Number.isFinite(value);
    case S: return typeof value === 'string' && bytes(value) <= 4096;
    default: return false;
  }
}

// ---- methods with results -------------------------------------------------------------------------------------------
export const SR_METHODS = Object.freeze({ 'md-rating': ['focusRating'] });
export const nativeSrMethod = (tag, method) => Boolean(SR_METHODS[tag]?.includes(method));
/** focusRating() takes no arguments. */
export function srMethodArguments(tag, method, args) {
  if (args.length) throw Object.assign(new Error(`${method} requires no arguments.`), { code: 'INVALID_METHOD' });
  return [];
}
