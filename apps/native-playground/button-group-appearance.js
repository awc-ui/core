/** Public group lengths; the source _unset sentinel is intentionally excluded. */
export const BUTTON_GROUP_APPEARANCE_FIELDS = Object.freeze([
  ['gap', 'Gap'], ['width', 'Width'], ['minWidth', 'Minimum width'], ['maxWidth', 'Maximum width'],
  ['height', 'Height'], ['minHeight', 'Minimum height'], ['maxHeight', 'Maximum height'],
].map(([name, label]) => Object.freeze({ name, label, part: 'group', kind: 'number', min: 0, max: 2400, step: 1,
  cssProperty: `--md-button-group-${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}` })));
const fields = new Set(BUTTON_GROUP_APPEARANCE_FIELDS.map(field => field.name));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_BUTTON_GROUP_APPEARANCE' });
export function normalizeButtonGroupAppearance(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid('Button group appearance must be a plain object.');
  const result = {};
  for (const name of Reflect.ownKeys(value)) {
    if (!fields.has(name)) throw invalid(`Unknown button group appearance field: ${String(name)}.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!Object.hasOwn(descriptor, 'value')) throw invalid('Button group appearance must contain data values.');
    const entry = descriptor.value;
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 2400) throw invalid(`${name} must be a finite length from 0 to 2400.`);
    result[name] = Object.is(entry, -0) ? 0 : entry;
  }
  return result;
}
export function buttonGroupAppearanceCSS(value) {
  const normalized = normalizeButtonGroupAppearance(value);
  return Object.fromEntries(BUTTON_GROUP_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field => [field.cssProperty, `${normalized[field.name]}px`]));
}
