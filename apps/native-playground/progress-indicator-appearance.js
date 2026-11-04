import { normalizeCornerShape, cornerShapeCSS, parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';

const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-progress-indicator-${suffix}`, kind: 'color', hint: '#RRGGBB or #RRGGBBAA, with optional alpha.' });
const corners = (name, label, suffix) => ({ name, label, cssProperty: `--md-progress-indicator-${suffix}`, kind: 'corners', hint: 'Linear only. CSS radius shorthand, such as 50%, 8px / 4px or calc(50% - 2px).' });
const length = (name, label, suffix, signed = false) => ({
  name, label, cssProperty: `--md-progress-indicator-${suffix}`, kind: 'number',
  ...(signed ? {} : { min: 0 }),
  hint: signed ? 'Signed px / pt / dp. Negative gaps overlap; negative trailing space moves the stop beyond the clip.' : '0 or more px / pt / dp.',
});

export const PROGRESS_INDICATOR_APPEARANCE_FIELDS = Object.freeze([
  color('activeIndicatorColor', 'Active color', 'active-indicator-color'),
  corners('activeIndicatorShape', 'Active corners', 'active-indicator-shape'),
  color('trackColor', 'Track color', 'track-color'),
  corners('trackShape', 'Track corners', 'track-shape'),
  color('stopIndicatorColor', 'Stop color', 'stop-indicator-color'),
  corners('stopIndicatorShape', 'Stop corners', 'stop-indicator-shape'),
  length('stopIndicatorSize', 'Stop size', 'stop-indicator-size'),
  length('stopIndicatorTrailingSpace', 'Stop trailing space', 'stop-indicator-trailing-space', true),
  length('trackActiveIndicatorSpace', 'Active to track gap', 'track-active-indicator-space', true),
  ...[1, 2, 3, 4].map(index => color(`fourColor${index}`, `Cycle color ${index}`, `four-color-${index}`)),
].map(Object.freeze));

const fields = new Map(PROGRESS_INDICATOR_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_PROGRESS_INDICATOR_APPEARANCE' });
const corner = (operation, value) => { try { return operation(value); } catch (error) { throw invalid(error.message); } };

export function normalizeProgressIndicatorAppearance(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => !fields.has(key))) throw invalid('Use a plain object containing only the thirteen Progress appearance fields.');
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Appearance fields must contain data values.');
  return Object.fromEntries(Object.entries(value).map(([name, item]) => {
    const field = fields.get(name);
    if (field.kind === 'corners') return [name, corner(normalizeCornerShape, item)];
    if (field.kind === 'color') {
      if (typeof item !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(item)) throw invalid(`${field.label} must be #RRGGBB or #RRGGBBAA.`);
      return [name, item.toUpperCase()];
    }
    if (typeof item !== 'number' || !Number.isFinite(item) || (field.min === 0 && item < 0)) {
      throw invalid(`${field.label} must be a finite ${field.min === 0 ? 'nonnegative ' : ''}number.`);
    }
    return [name, Object.is(item, -0) ? 0 : item];
  }));
}

export function progressIndicatorAppearanceCSS(value) {
  const normalized = normalizeProgressIndicatorAppearance(value);
  return Object.fromEntries(PROGRESS_INDICATOR_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field =>
    [field.cssProperty, field.kind === 'corners' ? cornerShapeCSS(normalized[field.name]) : field.kind === 'number' ? `${normalized[field.name]}px` : normalized[field.name]]));
}
export function parseProgressIndicatorAppearanceInput(name, raw) {
  const field = fields.get(name);
  return field?.kind === 'corners' ? corner(parseCornerShape, raw) : field?.kind === 'number' ? Number(raw) : raw;
}
export function formatProgressIndicatorAppearanceInput(name, value) {
  return value === undefined ? '' : fields.get(name)?.kind === 'corners' ? cornerShapeCSS(corner(normalizeCornerShape, value)) : String(value);
}
export function progressIndicatorAppearanceNativeValue(name, value, platform) {
  return fields.get(name)?.kind === 'corners' ? cornerShapeNativeValue(value, platform) : undefined;
}
