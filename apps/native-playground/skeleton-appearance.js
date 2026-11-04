import { normalizeCornerShape, cornerShapeCSS, parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';
import { normalizeSkeletonLength, skeletonLengthCSS, parseSkeletonLength, skeletonLengthNativeValue } from './skeleton-length.js';

const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-skeleton-${suffix}`, kind: 'color', hint: '#RRGGBB or #RRGGBBAA; alpha keeps the underlying surface visible.' });
const corners = (name, label, suffix) => ({ name, label, cssProperty: `--md-skeleton-${suffix}`, kind: 'corners', hint: 'Physical CSS radius shorthand, including percentages and elliptical corners.' });
const length = (name, label, suffix) => ({ name, label, cssProperty: `--md-skeleton-${suffix}`, kind: 'length', hint: 'px, %, em, rem or ch; additive calc(), for example calc(100% - 32px). Font-relative lengths use the actual native font context.' });
const duration = (name, label, suffix) => ({ name, label, cssProperty: `--md-skeleton-${suffix}`, kind: 'number', min: 0, hint: 'Seconds, including 0. Reduced motion suppresses the animations.' });
export const SKELETON_APPEARANCE_FIELDS = Object.freeze([
  color('color', 'Base color', 'color'),
  color('highlight', 'Wave highlight', 'highlight'),
  corners('radius', 'Text / rectangular corners', 'radius'),
  corners('roundedRadius', 'Rounded corners', 'rounded-radius'),
  length('width', 'Width', 'width'),
  length('height', 'Height / text row height', 'height'),
  length('size', 'Circular size', 'size'),
  length('lineGap', 'Text row gap', 'line-gap'),
  duration('pulseDuration', 'Pulse duration', 'pulse-duration'),
  duration('waveDuration', 'Wave duration', 'wave-duration'),
  duration('bloomDuration', 'Entrance duration', 'bloom-duration'),
].map(Object.freeze));
const fields = new Map(SKELETON_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_SKELETON_APPEARANCE' });
const adapt = (operation, value) => { try { return operation(value); } catch (error) { throw invalid(error.message); } };
export function normalizeSkeletonAppearance(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => !fields.has(key))) throw invalid('Use a plain object containing only the eleven Skeleton appearance fields.');
  for (const key of Reflect.ownKeys(value)) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Appearance fields must contain data values.');
  }
  return Object.fromEntries(Object.entries(value).map(([name, item]) => {
    const field = fields.get(name);
    if (field.kind === 'corners') return [name, adapt(normalizeCornerShape, item)];
    if (field.kind === 'length') return [name, adapt(normalizeSkeletonLength, item)];
    if (field.kind === 'color') {
      if (typeof item !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(item)) throw invalid(`${field.label} must be #RRGGBB or #RRGGBBAA.`);
      return [name, item.toUpperCase()];
    }
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) throw invalid(`${field.label} must be finite, nonnegative seconds.`);
    return [name, Object.is(item, -0) ? 0 : item];
  }));
}
export function skeletonAppearanceCSS(value) {
  const normalized = normalizeSkeletonAppearance(value);
  return Object.fromEntries(SKELETON_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field => {
    const item = normalized[field.name];
    return [field.cssProperty, field.kind === 'corners' ? cornerShapeCSS(item)
      : field.kind === 'length' ? skeletonLengthCSS(item) : field.kind === 'number' ? `${item}s` : item];
  }));
}
export function parseSkeletonAppearanceInput(name, raw) {
  const field = fields.get(name);
  return field?.kind === 'corners' ? adapt(parseCornerShape, raw) : field?.kind === 'length' ? adapt(parseSkeletonLength, raw)
    : field?.kind === 'number' ? Number(raw) : raw;
}
export function formatSkeletonAppearanceInput(name, value) {
  const field = fields.get(name);
  return value === undefined ? '' : field?.kind === 'corners' ? cornerShapeCSS(adapt(normalizeCornerShape, value))
    : field?.kind === 'length' ? skeletonLengthCSS(adapt(normalizeSkeletonLength, value)) : String(value);
}
export function skeletonAppearanceNativeValue(name, value, platform) {
  return fields.get(name)?.kind === 'corners' ? cornerShapeNativeValue(value, platform)
    : fields.get(name)?.kind === 'length' ? skeletonLengthNativeValue(value, platform) : undefined;
}
/** Native adapters accept these source strings, not arbitrary executable CSS. */
export function validateSkeletonLengths(properties = {}) {
  for (const name of ['width', 'height']) {
    if (!Object.hasOwn(properties, name) || properties[name] === '') continue;
    try { parseSkeletonLength(properties[name]); } catch (error) {
      throw Object.assign(new Error(`Skeleton ${name}: ${error.message}`), { code: 'UNSUPPORTED_SKELETON_LENGTH' });
    }
  }
}
