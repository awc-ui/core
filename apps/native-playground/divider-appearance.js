/** Public divider hooks. Insets are signed CSS margins, not padding. */
export const DIVIDER_APPEARANCE_FIELDS = Object.freeze([
  { name: 'color', label: 'Line color', part: 'divider', cssProperty: '--md-divider-color', kind: 'color' },
  { name: 'thickness', label: 'Thickness', part: 'divider', cssProperty: '--md-divider-thickness', kind: 'number', min: 0, step: 1, hint: '0 or more px / pt / dp.' },
  { name: 'insetStart', label: 'Start inset', part: 'divider', cssProperty: '--md-divider-inset-start', kind: 'number', step: 1, hint: 'Signed px / pt / dp. Negative values extend the line.' },
  { name: 'insetEnd', label: 'End inset', part: 'divider', cssProperty: '--md-divider-inset-end', kind: 'number', step: 1, hint: 'Signed px / pt / dp. Negative values extend the line.' },
].map(Object.freeze));

const fields = new Map(DIVIDER_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_DIVIDER_APPEARANCE' });

export function normalizeDividerAppearance(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw invalid('Divider appearance must be a plain object.');
  }
  const normalized = {};
  for (const name of Reflect.ownKeys(value)) {
    const field = fields.get(name), descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!field) throw invalid(`Unknown divider appearance field: ${String(name)}.`);
    if (!Object.hasOwn(descriptor, 'value')) throw invalid(`Divider appearance ${name} must be a data value.`);
    const entry = descriptor.value;
    if (field.kind === 'color') {
      if (typeof entry !== 'string' || !/^#[\da-f]{6}$/i.test(entry)) throw invalid(`${field.label} must be a #RRGGBB color.`);
      normalized[name] = entry.toUpperCase();
    } else {
      if (typeof entry !== 'number' || !Number.isFinite(entry) || field.min !== undefined && entry < field.min) {
        throw invalid(`${field.label} must be a finite number${field.min === 0 ? ' greater than or equal to zero' : ''}.`);
      }
      normalized[name] = Object.is(entry, -0) ? 0 : entry;
    }
  }
  return normalized;
}

export function dividerAppearanceCSS(value) {
  const normalized = normalizeDividerAppearance(value);
  return Object.fromEntries(DIVIDER_APPEARANCE_FIELDS
    .filter(field => Object.hasOwn(normalized, field.name))
    .map(field => [field.cssProperty, field.kind === 'color' ? normalized[field.name] : `${normalized[field.name]}px`]));
}
