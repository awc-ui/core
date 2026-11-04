import { appearanceField } from './accordion-appearance.js';
import { hookProfile, PROPERTY_TYPE, validPropertyValue } from './chart-appearance.js';

// md-toolbar in the Laboratory: its eleven typed hooks (--md-toolbar-*; field order follows the native initializer
// AWCToolbarAppearance), the retained property updates and setFocus(). Lengths are px (points on SwiftUI, dp on Android);
// the container shape is one corner radius (9999 = full); the overflow hooks are the source's opt-in keywords.
const invalid = (code, message) => Object.assign(new Error(message), { code });
const field = (name, label, suffix, kind) => appearanceField('toolbar', name, label, suffix, kind);
const keyword = (name, label, suffix, words) => Object.freeze({ name, label, cssProperty: `--md-toolbar-${suffix}`, kind: 'keyword', words: Object.freeze(words),
  hint: `One of ${words.join(', ')}.` });
const OVERFLOW = ['visible', 'hidden', 'clip', 'scroll', 'auto'];
export const TOOLBAR_APPEARANCE_FIELDS = Object.freeze([
  field('containerColor', 'Container color', 'container-color', 'color'), field('iconColor', 'Icon color', 'icon-color', 'color'),
  field('containerShape', 'Container corner radius', 'container-shape', 'length'), field('containerHeight', 'Container height', 'container-height', 'length'),
  field('padding', 'Padding', 'padding', 'length'), field('gap', 'Item gap', 'gap', 'length'), field('fabGap', 'FAB gap', 'fab-gap', 'length'),
  keyword('overflowX', 'Horizontal overflow', 'overflow-x', OVERFLOW), keyword('overflowY', 'Vertical overflow', 'overflow-y', OVERFLOW),
  keyword('flexWrap', 'Wrapping', 'flex-wrap', ['nowrap', 'wrap', 'wrap-reverse']), keyword('scrollbarWidth', 'Scrollbar width', 'scrollbar-width', ['thin', 'auto', 'none']),
]);
// Keyword fields: validated against their word list, emitted verbatim (CSS) and quoted (native).
const keywords = new Map(TOOLBAR_APPEARANCE_FIELDS.filter(f => f.kind === 'keyword').map(f => [f.name, f]));
const CODE = 'INVALID_TOOLBAR_APPEARANCE';
const base = hookProfile(TOOLBAR_APPEARANCE_FIELDS.filter(f => f.kind !== 'keyword'), CODE, 'Toolbar');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const word = (f, value) => {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (!f.words.includes(text)) throw invalid(CODE, `${f.label} must be one of ${f.words.join(', ')}.`);
  return text;
};
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
function normalize(value) {
  if (value === undefined) return {};
  const names = new Set(TOOLBAR_APPEARANCE_FIELDS.map(f => f.name));
  if (!plain(value) || Reflect.ownKeys(value).some(key => !names.has(key))) throw invalid(CODE, `Use a plain object containing only the ${names.size} Toolbar appearance fields.`);
  const rest = Object.fromEntries(Object.entries(value).filter(([key]) => !keywords.has(key)));
  const out = base.normalize(rest);
  for (const [name, f] of keywords) if (Object.hasOwn(value, name)) out[name] = word(f, value[name]);
  return Object.fromEntries(TOOLBAR_APPEARANCE_FIELDS.filter(f => Object.hasOwn(out, f.name)).map(f => [f.name, out[f.name]]));
}
export const toolbarAppearance = Object.freeze({
  fields: TOOLBAR_APPEARANCE_FIELDS,
  normalize,
  css(value) {
    const n = normalize(value);
    const out = base.css(Object.fromEntries(Object.entries(n).filter(([key]) => !keywords.has(key))));
    for (const [name, f] of keywords) if (Object.hasOwn(n, name)) out[f.cssProperty] = n[name];
    return Object.fromEntries(TOOLBAR_APPEARANCE_FIELDS.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
  },
  parseInput: (name, raw) => keywords.has(name) ? word(keywords.get(name), String(raw ?? '')) : base.parseInput(name, raw),
  formatInput: (name, value) => keywords.has(name) ? (value === undefined ? '' : word(keywords.get(name), value)) : base.formatInput(name, value),
  nativeValue: (name, value, platform) => keywords.has(name) ? quote(value, platform) : base.nativeValue(name, value, platform),
});
export const TOOLBAR_APPEARANCE_GROUPS = Object.freeze([
  ['Container', ['containerColor', 'iconColor', 'containerShape', 'containerHeight', 'padding']],
  ['Spacing', ['gap', 'fabGap']],
  ['Overflow', ['overflowX', 'overflowY', 'flexWrap', 'scrollbarWidth']],
]);

// Retained updates: every md-toolbar property (the source watches all of them and re-syncs its roving group).
const { string: S, boolean: B, enumOf: E, density: DENSITY } = PROPERTY_TYPE;
export const TOOLBAR_PROPERTY_TYPES = Object.freeze({
  variant: E(['docked', 'floating']), color: E(['standard', 'vibrant']), layout: E(['horizontal', 'vertical']),
  alignment: E(['start', 'center', 'end', 'space-between']), containerSemantics: E(['toolbar', 'generic']),
  ariaLabelProp: S, ariaLabelledby: S, density: DENSITY,
});
export const TOOLBAR_UPDATE_PROPERTIES = Object.freeze(Object.keys(TOOLBAR_PROPERTY_TYPES));
export const validToolbarUpdate = (key, value) => validPropertyValue(TOOLBAR_PROPERTY_TYPES[key], value);
// setFocus(): no arguments; the result is whether a member took focus (the Web method resolves void, so the studio shows
// it as completed either way).
export const nativeToolbarMethod = (tag, method) => tag === 'md-toolbar' && method === 'setFocus';
