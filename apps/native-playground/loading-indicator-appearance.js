import { normalizeCornerShape, cornerShapeCSS, parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';
const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-loading-indicator-${suffix}`, kind: 'color', hint: '#RRGGBB or #RRGGBBAA, with optional alpha.' });
const size = (name, label, suffix) => ({ name, label, cssProperty: `--md-loading-indicator-${suffix}`, kind: 'number', min: 0, hint: '0 or more px / pt / dp.' });
export const LOADING_INDICATOR_APPEARANCE_FIELDS = Object.freeze([
  color('color', 'Shape color', 'color'),
  size('size', 'Container size', 'size'),
  size('shapeSize', 'Shape size', 'shape-size'),
  color('containerColor', 'Container color', 'container-color'),
  { name: 'containerShape', label: 'Container corners', cssProperty: '--md-loading-indicator-container-shape', kind: 'corners',
    hint: 'CSS radius shorthand: 25%, 4px 12px, or 10px / 20px. Supports calc(50% - 2px). Contained variant only.' },
].map(Object.freeze));
const fields = new Map(LOADING_INDICATOR_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_LOADING_INDICATOR_APPEARANCE' });
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function object(value, keys) {
  if (!plain(value) || Reflect.ownKeys(value).some(key => !keys.includes(key))) throw invalid(`Use a plain object containing only ${keys.join(', ')}.`);
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Appearance fields must contain data values.');
  return value;
}
const finite = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid('Use a finite nonnegative number.');
  return Object.is(value, -0) ? 0 : value;
};
const corner = (operation, value) => { try { return operation(value); } catch (error) { throw invalid(error.message); } };
export function normalizeLoadingIndicatorAppearance(value) {
  if (value === undefined) return {};
  object(value, [...fields.keys()]);
  return Object.fromEntries(Object.entries(value).map(([name, item]) => {
    const field = fields.get(name);
    if (field.kind === 'color') {
      if (typeof item !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(item)) throw invalid(`${field.label} must be #RRGGBB or #RRGGBBAA.`);
      return [name, item.toUpperCase()];
    }
    return [name, field.kind === 'corners' ? corner(normalizeCornerShape, item) : finite(item, true)];
  }));
}
export function loadingIndicatorAppearanceCSS(value) {
  const normalized = normalizeLoadingIndicatorAppearance(value);
  return Object.fromEntries(LOADING_INDICATOR_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field =>
    [field.cssProperty, field.kind === 'corners' ? cornerShapeCSS(normalized[field.name]) : field.kind === 'number' ? `${normalized[field.name]}px` : normalized[field.name]]));
}
export function parseLoadingIndicatorAppearanceInput(name, raw) {
  const field = fields.get(name);
  return field?.kind === 'corners' ? corner(parseCornerShape, raw) : field?.kind === 'number' ? Number(raw) : raw;
}
export function formatLoadingIndicatorAppearanceInput(name, value) {
  return value === undefined ? '' : fields.get(name)?.kind === 'corners' ? cornerShapeCSS(corner(normalizeCornerShape, value)) : String(value);
}
export function loadingIndicatorAppearanceNativeValue(name, value, platform) {
  return fields.get(name)?.kind === 'corners' ? cornerShapeNativeValue(value, platform) : undefined;
}
