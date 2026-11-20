import { PROPERTY_TYPE, validPropertyValue } from './chart-appearance.js';
import { parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';

// md-app-bar in the Laboratory (n5): its thirty-eight typed hooks (--md-app-bar-*: the stylesheet's list; the CEM lists 32 —
// its generator drops the search colour / shape hooks), the retained updates of every source property and the typed part
// appearances of every exported part. The native appearance (AWCAppBarAppearance) takes CSS text per hook, so lengths are
// px numbers here and "Npx" natively, colours #RRGGBB[AA], shapes one px radius or a 1–4 value border-radius shorthand,
// elevation a box-shadow list or none. Field order follows the native initializers (Swift requires labelled arguments in order).
const CODE = 'INVALID_APP_BAR_APPEARANCE';
const invalid = message => Object.assign(new Error(message), { code: CODE });
const HINT = { color: '#RRGGBB or #RRGGBBAA.', length: 'px (0 or more).', corners: 'One px radius or a border-radius shorthand (1–4 px values).', shadow: 'A box-shadow list or none.' };
const f = (name, label, suffix, kind) => Object.freeze({ name, label, cssProperty: `--md-app-bar-${suffix}`, kind, hint: HINT[kind] });
export const APP_BAR_APPEARANCE_FIELDS = Object.freeze([
  f('containerColor', 'Container color', 'container-color', 'color'), f('containerColorScrolled', 'Scrolled container color', 'container-color-scrolled', 'color'),
  f('containerShape', 'Container corners', 'container-shape', 'corners'), f('headlineColor', 'Headline color', 'headline-color', 'color'),
  f('subtitleColor', 'Subtitle color', 'subtitle-color', 'color'), f('leadingIconColor', 'Leading icon color', 'leading-icon-color', 'color'),
  f('trailingIconColor', 'Trailing icon color', 'trailing-icon-color', 'color'), f('containerElevation', 'Elevation', 'container-elevation', 'shadow'),
  f('rowHeight', 'Row height', 'row-height', 'length'), f('paddingInlineStart', 'Inline start padding', 'padding-inline-start', 'length'),
  f('paddingInlineEnd', 'Inline end padding', 'padding-inline-end', 'length'), f('rowPaddingInline', 'Row inline padding', 'row-padding-inline', 'length'),
  f('rowPaddingBlockStart', 'Row top padding', 'row-padding-block-start', 'length'), f('trailingGap', 'Trailing gap', 'trailing-gap', 'length'),
  f('trailingIconTouchSize', 'Trailing icon target', 'trailing-icon-touch-size', 'length'), f('iconGap', 'Icon gap', 'icon-gap', 'length'),
  f('iconSize', 'Icon size', 'icon-size', 'length'), f('avatarSize', 'Avatar size', 'avatar-size', 'length'),
  f('expandedPaddingInline', 'Expanded inline padding', 'expanded-padding-inline', 'length'), f('expandedPaddingBlockEnd', 'Expanded bottom padding', 'expanded-padding-block-end', 'length'),
  f('mediumHeight', 'Medium height', 'medium-height', 'length'), f('mediumHeightWithSubtitle', 'Medium height with subtitle', 'medium-height-with-subtitle', 'length'),
  f('largeHeight', 'Large height', 'large-height', 'length'), f('largeHeightWithSubtitle', 'Large height with subtitle', 'large-height-with-subtitle', 'length'),
  f('iconButtonSize', 'Icon button size', 'icon-button-size', 'length'), f('searchContainerColor', 'Search container color', 'search-container-color', 'color'),
  f('searchContainerColorScrolled', 'Scrolled search container color', 'search-container-color-scrolled', 'color'),
  f('searchContainerShape', 'Search container corners', 'search-container-shape', 'corners'), f('searchContainerHeight', 'Search container height', 'search-container-height', 'length'),
  f('searchPaddingInlineStart', 'Search start padding', 'search-padding-inline-start', 'length'), f('searchPaddingInlineEnd', 'Search end padding', 'search-padding-inline-end', 'length'),
  f('searchRowGap', 'Search row gap', 'search-row-gap', 'length'), f('searchTrailingGap', 'Search trailing gap', 'search-trailing-gap', 'length'),
  f('searchFieldTrailingGap', 'Search field trailing gap', 'search-field-trailing-gap', 'length'), f('trailingTouchSize', 'Trailing target', 'trailing-touch-size', 'length'),
  f('searchPlaceholderColor', 'Search placeholder color', 'search-placeholder-color', 'color'), f('searchInputColor', 'Search input color', 'search-input-color', 'color'),
  f('searchTrailingIconColor', 'Search trailing icon color', 'search-trailing-icon-color', 'color'),
]);
const BY = new Map(APP_BAR_APPEARANCE_FIELDS.map(x => [x.name, x]));
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const bytes = s => new TextEncoder().encode(s).length;
const PX = /^(?:0|\d+(?:\.\d+)?px)$/;
function fieldValue(x, value) {
  switch (x.kind) {
    case 'color':
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value.trim())) throw invalid(`${x.label} must be #RRGGBB or #RRGGBBAA.`);
      return value.trim().toUpperCase();
    case 'length':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(`${x.label} must be a length of 0 px or more.`);
      return value;
    case 'corners': {
      if (typeof value === 'number') { if (!Number.isFinite(value) || value < 0) throw invalid(`${x.label} must be 0 px or more.`); return value; }
      const parts = typeof value === 'string' ? value.trim().split(/\s+/) : [];
      if (parts.length < 1 || parts.length > 4 || !parts.every(p => PX.test(p))) throw invalid(`${x.label} must be one px radius or a border-radius shorthand of 1–4 px values.`);
      return parts.length === 1 ? parseFloat(parts[0]) : parts.join(' ');
    }
    case 'shadow': {
      const t = typeof value === 'string' ? value.trim() : '';
      if (!t || bytes(t) > 4096 || /[;{}<>]/.test(t)) throw invalid(`${x.label} must be a box-shadow list or none.`);
      return t;
    }
  }
}
function normalize(value) {
  if (value === undefined) return {};
  if (!plain(value) || Reflect.ownKeys(value).some(k => !BY.has(k))) throw invalid(`Use a plain object containing only the ${BY.size} App Bar appearance fields.`);
  return Object.fromEntries(APP_BAR_APPEARANCE_FIELDS.filter(x => Object.hasOwn(value, x.name)).map(x => [x.name, fieldValue(x, value[x.name])]));
}
/** The hook's CSS text (what the native appearance takes). */
const cssText = (x, v) => typeof v === 'number' ? `${v}px` : v;
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'swift' ? /(?!)/g : /\$/g, '\\$');
export const appBarAppearance = Object.freeze({
  fields: APP_BAR_APPEARANCE_FIELDS,
  normalize,
  css(value) { const n = normalize(value); return Object.fromEntries(Object.entries(n).map(([k, v]) => [BY.get(k).cssProperty, cssText(BY.get(k), v)])); },
  parseInput(name, raw) {
    const x = BY.get(name); if (!x) throw invalid(`Unknown App Bar appearance field ${name}.`);
    const t = String(raw ?? '').trim();
    if (x.kind === 'length' || (x.kind === 'corners' && /^\d+(\.\d+)?(px)?$/.test(t))) { const n = Number(t.replace(/px$/, '')); return fieldValue(x, t === '' ? NaN : n); }
    return fieldValue(x, t);
  },
  formatInput: (name, value) => value === undefined ? '' : String(value),
  nativeValue: (name, value, platform) => quote(cssText(BY.get(name), fieldValue(BY.get(name), value)), platform),
});
export const APP_BAR_APPEARANCE_GROUPS = Object.freeze([
  ['Container', ['containerColor', 'containerColorScrolled', 'containerShape', 'containerElevation']],
  ['Text and icons', ['headlineColor', 'subtitleColor', 'leadingIconColor', 'trailingIconColor', 'iconSize', 'iconButtonSize', 'avatarSize']],
  ['Row', ['rowHeight', 'paddingInlineStart', 'paddingInlineEnd', 'rowPaddingInline', 'rowPaddingBlockStart', 'iconGap', 'trailingGap', 'trailingIconTouchSize', 'trailingTouchSize']],
  ['Medium and large', ['mediumHeight', 'mediumHeightWithSubtitle', 'largeHeight', 'largeHeightWithSubtitle', 'expandedPaddingInline', 'expandedPaddingBlockEnd']],
  ['Search', ['searchContainerColor', 'searchContainerColorScrolled', 'searchContainerShape', 'searchContainerHeight', 'searchPaddingInlineStart', 'searchPaddingInlineEnd',
    'searchRowGap', 'searchTrailingGap', 'searchFieldTrailingGap', 'searchPlaceholderColor', 'searchInputColor', 'searchTrailingIconColor']],
]);

// ---- retained updates: every source property ----
const { string: S, boolean: B, enumOf: E, density: DENSITY } = PROPERTY_TYPE;
export const APP_BAR_PROPERTY_TYPES = Object.freeze({
  variant: E(['small', 'medium', 'large', 'search']), titleAlignment: E(['start', 'center']), searchPlaceholder: S, searchValue: S, searchAriaLabel: S,
  searchDisabled: B, headline: S, subtitle: S, scrolled: B, density: DENSITY, leadingIcon: S, leadingIconLabel: S,
});
export const APP_BAR_UPDATE_PROPERTIES = Object.freeze(Object.keys(APP_BAR_PROPERTY_TYPES));
export const validAppBarUpdate = (key, value) => validPropertyValue(APP_BAR_PROPERTY_TYPES[key], value);

// ---- typed native part appearances (the shared md-list / md-accordion vocabulary) ----
export const APP_BAR_PARTS = Object.freeze(['leading-icon', 'title', 'subtitle', 'expanded-headline', 'search-host', 'search', 'search-state-layer', 'search-field',
  'search-content', 'search-input', 'search-trailing', 'row', 'leading', 'trailing', 'expanded', 'icon', 'state-layer']);
const BOX = ['backgroundColor', 'cornerShape', 'opacity'], TEXT = ['color', 'backgroundColor', 'cornerShape', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'opacity'];
/** The fields each part honours (the native renderers apply exactly these; the paint suites verify them). */
export const APP_BAR_PART_FIELDS = Object.freeze({
  'leading-icon': BOX, title: TEXT, subtitle: TEXT, 'expanded-headline': TEXT, 'search-host': BOX, search: BOX, 'search-state-layer': ['backgroundColor', 'opacity'],
  'search-field': BOX, 'search-content': ['color', 'opacity'], 'search-input': ['color', 'fontSize', 'opacity'], 'search-trailing': BOX,
  row: BOX, leading: BOX, trailing: BOX, expanded: BOX, icon: ['color'], 'state-layer': ['backgroundColor', 'opacity'],
});
const R = px => parseCornerShape(`${px}px`);
const partValues = {
  'leading-icon': { backgroundColor: '#F3E5F5', cornerShape: R(6) }, title: { color: '#C62828', fontSize: 20, lineHeight: 26, fontWeight: 500, letterSpacing: 0.5 },
  subtitle: { color: '#2E7D32', fontSize: 13 }, 'expanded-headline': { color: '#BF360C', fontWeight: 600, letterSpacing: 1 }, 'search-host': { backgroundColor: '#ECEFF1', cornerShape: R(8) },
  search: { backgroundColor: '#FFEBEE', cornerShape: R(12) }, 'search-state-layer': { backgroundColor: '#000000', opacity: 0.1 }, 'search-field': { backgroundColor: '#F1F8E9' },
  'search-content': { color: '#6A1B9A', opacity: 0.8 }, 'search-input': { color: '#1A237E', fontSize: 18 }, 'search-trailing': { backgroundColor: '#FFFDE7', cornerShape: R(20) },
  row: { backgroundColor: '#FFF8E1', cornerShape: R(8) }, leading: { backgroundColor: '#EFEBE9' }, trailing: { backgroundColor: '#E3F2FD', cornerShape: R(12) },
  expanded: { backgroundColor: '#E8F5E9', cornerShape: R(16) }, icon: { color: '#E65100' }, 'state-layer': { backgroundColor: '#00897B', opacity: 0.12 },
};
export const appBarPartValuesFor = name => partValues[name];
const ORDER = ['color', 'backgroundColor', 'borderColor', 'borderWidth', 'cornerShape', 'padding', 'margin', 'width', 'height', 'minHeight', 'opacity', 'gap', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing'];
/** One example value per honoured field, as native initializer arguments (cornerShape: one radius on every corner). */
export function appBarPartFields(name, platform, literal) {
  const values = partValues[name], sep = platform === 'swift' ? ': ' : ' = ';
  const num = v => platform === 'android' ? (Number.isInteger(v) ? `${v}.0` : String(v)) : String(v);
  const value = (key, v) => key === 'cornerShape' ? cornerShapeNativeValue(v, platform) : typeof v === 'string' ? literal(v, platform) : num(v);
  return ORDER.filter(k => Object.hasOwn(values, k)).map(k => `${k}${sep}${value(k, values[k])}`).join(', ');
}
export const appBarPartVariant = name => name.startsWith('search') ? { variant: 'search' } : ['expanded', 'expanded-headline'].includes(name) ? { variant: 'medium', subtitle: '12 unread' }
  : name === 'subtitle' ? { subtitle: '12 unread' } : {};
