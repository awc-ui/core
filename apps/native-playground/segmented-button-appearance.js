const color = (name, label, part, cssProperty) => ({ name, label, part, cssProperty, kind: 'color' });
const length = (name, label, part, cssProperty, max = 2400) => ({ name, label, part, cssProperty, kind: 'number', min: 0, max, step: 1 });

/** Exact public Web hooks, expressed as portable native colors and lengths. */
export const SEGMENTED_BUTTON_APPEARANCE_FIELDS = Object.freeze([
  color('containerColor', 'Container color', 'container', '--md-segmented-button-container-color'),
  color('selectedContainerColor', 'Selected container color', 'container', '--md-segmented-button-selected-container-color'),
  color('labelColor', 'Label color', 'label', '--md-segmented-button-label-color'),
  color('selectedLabelColor', 'Selected label color', 'label', '--md-segmented-button-selected-label-color'),
  color('outlineColor', 'Outline color', 'outline', '--md-segmented-button-outline-color'),
  length('cornerRadius', 'Outer corner radius', 'container', '--md-segmented-button-container-shape'),
  length('iconSize', 'Icon size', 'icon', '--md-segmented-button-icon-size'),
].map(Object.freeze));

const fields = new Map(SEGMENTED_BUTTON_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_SEGMENTED_BUTTON_APPEARANCE' });

export function normalizeSegmentedButtonAppearance(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw invalid('Segmented button appearance must be a plain object.');
  }
  const normalized = {};
  for (const name of Reflect.ownKeys(value)) {
    const field = fields.get(name), descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!field) throw invalid(`Unknown Segmented button appearance field: ${String(name)}.`);
    if (!Object.hasOwn(descriptor, 'value')) throw invalid(`Segmented button appearance ${name} must be a data value.`);
    const entry = descriptor.value;
    if (field.kind === 'color') {
      if (typeof entry !== 'string' || !/^#[\da-f]{6}$/i.test(entry)) throw invalid(`${field.label} must be a #RRGGBB color.`);
      normalized[name] = entry.toUpperCase();
    } else {
      if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < field.min || entry > field.max) {
        throw invalid(`${field.label} must be a finite number from ${field.min} to ${field.max}.`);
      }
      normalized[name] = Object.is(entry, -0) ? 0 : entry;
    }
  }
  return normalized;
}

export function segmentedButtonAppearanceCSS(value) {
  const normalized = normalizeSegmentedButtonAppearance(value);
  return Object.fromEntries(SEGMENTED_BUTTON_APPEARANCE_FIELDS
    .filter(field => Object.hasOwn(normalized, field.name))
    .map(field => [field.cssProperty, field.kind === 'color' ? normalized[field.name] : `${normalized[field.name]}px`]));
}
