import { normalizeCornerShape, cornerShapeCSS, parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';

const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-meter-${suffix}`, kind: 'color', hint: '#RRGGBB or #RRGGBBAA, with optional alpha.' });
const length = (name, label, suffix) => ({ name, label, cssProperty: `--md-meter-${suffix}`, kind: 'number', min: 0, hint: '0 or more px / pt / dp.' });
export const METER_APPEARANCE_FIELDS = Object.freeze([
  color('indicatorColor', 'Indicator color', 'indicator-color'),
  color('trackColor', 'Track color', 'track-color'),
  { name: 'trackShape', label: 'Track corners', cssProperty: '--md-meter-track-shape', kind: 'corners', hint: 'Linear only. CSS radius shorthand, for example 50%, 8px / 4px or calc(50% - 2px). Percentages resolve against each track/fill box.' },
  length('height', 'Linear track height', 'height'),
  color('labelColor', 'Label color', 'label-color'),
  color('valueColor', 'Value color', 'value-color'),
  length('size', 'Circular diameter', 'size'),
].map(Object.freeze));
const fields = new Map(METER_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_METER_APPEARANCE' });
const corner = (operation, value) => { try { return operation(value); } catch (error) { throw invalid(error.message); } };
export function normalizeMeterAppearance(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => !fields.has(key))) throw invalid('Use a plain object containing only the seven Meter appearance fields.');
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Appearance fields must contain data values.');
  return Object.fromEntries(Object.entries(value).map(([name, item]) => {
    const field = fields.get(name);
    if (field.kind === 'corners') return [name, corner(normalizeCornerShape, item)];
    if (field.kind === 'color') {
      if (typeof item !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(item)) throw invalid(`${field.label} must be #RRGGBB or #RRGGBBAA.`);
      return [name, item.toUpperCase()];
    }
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) throw invalid(`${field.label} must be a finite nonnegative number.`);
    return [name, Object.is(item, -0) ? 0 : item];
  }));
}
export function meterAppearanceCSS(value) {
  const normalized = normalizeMeterAppearance(value);
  return Object.fromEntries(METER_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field =>
    [field.cssProperty, field.kind === 'corners' ? cornerShapeCSS(normalized[field.name]) : field.kind === 'number' ? `${normalized[field.name]}px` : normalized[field.name]]));
}
export function parseMeterAppearanceInput(name, raw) {
  const field = fields.get(name);
  return field?.kind === 'corners' ? corner(parseCornerShape, raw) : field?.kind === 'number' ? Number(raw) : raw;
}
export function formatMeterAppearanceInput(name, value) {
  return value === undefined ? '' : fields.get(name)?.kind === 'corners' ? cornerShapeCSS(corner(normalizeCornerShape, value)) : String(value);
}
export function meterAppearanceNativeValue(name, value, platform) {
  return fields.get(name)?.kind === 'corners' ? cornerShapeNativeValue(value, platform) : undefined;
}
