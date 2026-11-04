import { normalizeCornerShape, cornerShapeCSS, parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';
import { normalizeSkeletonLength, skeletonLengthCSS, parseSkeletonLength, skeletonLengthNativeValue } from './skeleton-length.js';

const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-tooltip-${suffix}`, kind: 'color', hint: '#RRGGBB or #RRGGBBAA; alpha preserves the underlying surface.' });
const width = (name, label, suffix) => ({ name, label, cssProperty: `--md-tooltip-${suffix}`, kind: 'length', hint: 'px, %, em, rem or ch; additive calc(). Relative terms use the actual overlay and font context.' });
export const TOOLTIP_APPEARANCE_FIELDS = Object.freeze([
  color('plainContainerColor', 'Plain container color', 'plain-container-color'),
  color('plainTextColor', 'Plain text color', 'plain-text-color'),
  color('richContainerColor', 'Rich container color', 'rich-container-color'),
  color('richSubheadColor', 'Rich subhead color', 'rich-subhead-color'),
  color('richTextColor', 'Rich text color', 'rich-text-color'),
  color('richActionColor', 'Rich action color', 'rich-action-color'),
  { name: 'plainShape', label: 'Plain corners', cssProperty: '--md-tooltip-container-shape', kind: 'corners', hint: 'Physical CSS radius shorthand, including asymmetric, elliptical and percentage corners.' },
  width('plainMaxWidth', 'Plain maximum width', 'plain-max-inline-size'),
  { name: 'richShape', label: 'Rich corners', cssProperty: '--md-tooltip-rich-container-shape', kind: 'corners', hint: 'Physical CSS radius shorthand, including asymmetric, elliptical and percentage corners.' },
  width('richMinWidth', 'Rich minimum width', 'rich-min-inline-size'),
  width('richMaxWidth', 'Rich maximum width', 'rich-max-inline-size'),
].map(Object.freeze));
const fields = new Map(TOOLTIP_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_TOOLTIP_APPEARANCE' });
const adapt = (operation, value) => { try { return operation(value); } catch (error) { throw invalid(error.message); } };

export function normalizeTooltipAppearance(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => !fields.has(key))) throw invalid('Use a plain object containing only the eleven Tooltip appearance fields.');
  for (const key of Reflect.ownKeys(value)) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Appearance fields must contain data values.');
  }
  return Object.fromEntries(Object.entries(value).map(([name, item]) => {
    const field = fields.get(name);
    if (field.kind === 'corners') return [name, adapt(normalizeCornerShape, item)];
    if (field.kind === 'length') return [name, adapt(normalizeSkeletonLength, item)];
    if (typeof item !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(item)) throw invalid(`${field.label} must be #RRGGBB or #RRGGBBAA.`);
    return [name, item.toUpperCase()];
  }));
}
export function tooltipAppearanceCSS(value) {
  const normalized = normalizeTooltipAppearance(value);
  return Object.fromEntries(TOOLTIP_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field => {
    const item = normalized[field.name];
    return [field.cssProperty, field.kind === 'corners' ? cornerShapeCSS(item) : field.kind === 'length' ? skeletonLengthCSS(item) : item];
  }));
}
export function parseTooltipAppearanceInput(name, raw) {
  const field = fields.get(name);
  return field?.kind === 'corners' ? adapt(parseCornerShape, raw) : field?.kind === 'length' ? adapt(parseSkeletonLength, raw) : raw;
}
export function formatTooltipAppearanceInput(name, value) {
  const field = fields.get(name);
  return value === undefined ? '' : field?.kind === 'corners' ? cornerShapeCSS(adapt(normalizeCornerShape, value))
    : field?.kind === 'length' ? skeletonLengthCSS(adapt(normalizeSkeletonLength, value)) : String(value);
}
export function tooltipAppearanceNativeValue(name, value, platform) {
  return fields.get(name)?.kind === 'corners' ? cornerShapeNativeValue(value, platform)
    : fields.get(name)?.kind === 'length' ? skeletonLengthNativeValue(value, platform).replace(/^AWCSkeletonLength\(/, 'AWCTooltipLength(') : undefined;
}
