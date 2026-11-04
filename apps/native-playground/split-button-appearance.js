const color = (name, label, part, cssProperty) => ({ name, label, part, cssProperty, kind: 'color' });
const length = (name, label, part, cssProperty) => ({ name, label, part, cssProperty, kind: 'number', min: 0, max: 2400, step: 1 });

export const SPLIT_BUTTON_APPEARANCE_FIELDS = Object.freeze([
  color('containerColor', 'Container color', 'surface', '--md-split-button-container-color'),
  color('labelColor', 'Label color', 'content', '--md-split-button-label-color'),
  color('iconColor', 'Leading icon color', 'content', '--md-split-button-icon-color'),
  color('outlineColor', 'Outline color', 'surface', '--md-split-button-outline-color'),
  length('cornerRadius', 'Outer corner radius', 'surface', '--md-split-button-container-shape'),
  length('iconSize', 'Leading icon size', 'content', '--md-split-button-icon-size'),
].map(Object.freeze));
const fields = new Map(SPLIT_BUTTON_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_SPLIT_BUTTON_APPEARANCE' });

export function normalizeSplitButtonAppearance(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid('Split button appearance must be a plain object.');
  const result = {};
  for (const name of Reflect.ownKeys(value)) {
    const field = fields.get(name), descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!field || !Object.hasOwn(descriptor, 'value')) throw invalid('Use supported split button appearance data fields.');
    const entry = descriptor.value;
    if (field.kind === 'color') {
      if (typeof entry !== 'string' || !/^#[\da-f]{6}$/i.test(entry)) throw invalid(`${field.label} must be a #RRGGBB color.`);
      result[name] = entry.toUpperCase();
    } else {
      if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < field.min || entry > field.max) throw invalid(`${field.label} must be a finite number from ${field.min} to ${field.max}.`);
      result[name] = Object.is(entry, -0) ? 0 : entry;
    }
  }
  return result;
}

export function splitButtonAppearanceCSS(value) {
  const normalized = normalizeSplitButtonAppearance(value);
  return Object.fromEntries(SPLIT_BUTTON_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name))
    .map(field => [field.cssProperty, field.kind === 'color' ? normalized[field.name] : `${normalized[field.name]}px`]));
}
