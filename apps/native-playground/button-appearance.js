const color = (name, label, part, cssProperty) => ({ name, label, kind: 'color', part, cssProperty });
const number = (name, label, part, cssProperty, min, max, step = 1) => ({ name, label, kind: 'number', min, max, step, part, cssProperty });

/** Shared, sparse appearance contract for the Web and native button previews. */
export const BUTTON_APPEARANCE_FIELDS = Object.freeze([
  color('containerColor', 'Container color', 'container', '--md-button-container-color'),
  color('labelColor', 'Label color', 'label', '--md-button-label-color'),
  color('iconColor', 'Leading icon color', 'icon', '--md-button-icon-color'),
  color('trailingIconColor', 'Trailing icon color', 'trailing-icon', '--md-button-trailing-icon-color'),
  color('loadingColor', 'Loading indicator color', 'loading', '--md-button-loading-color'),
  color('stateLayerColor', 'State layer color', 'state-layer', '--md-button-state-layer-color'),
  color('outlineColor', 'Outline color', 'outline', '--md-button-outline-color'),
  number('iconSize', 'Leading icon size', 'icon', '--md-button-icon-size', 8, 128),
  number('trailingIconSize', 'Trailing icon size', 'trailing-icon', '--md-button-trailing-icon-size', 8, 128),
  number('loadingSize', 'Loading indicator size', 'loading', '--md-button-loading-size', 8, 128),
  number('fontSize', 'Font size', 'label', '--md-button-font-size', 8, 96),
  number('fontWeight', 'Font weight', 'label', '--md-button-font-weight', 100, 900),
  number('lineHeight', 'Line height', 'label', '--md-button-line-height', 8, 160),
  number('letterSpacing', 'Letter spacing', 'label', '--md-button-letter-spacing', -5, 20, 0.1),
  number('cornerRadius', 'Corner radius', 'container', '--md-button-container-shape', 0, 200),
  number('outlineWidth', 'Outline width', 'outline', '--md-button-outline-width', 0, 16),
  number('paddingInline', 'Horizontal padding', 'container', '--md-button-padding-inline', 0, 128),
  number('paddingBlock', 'Vertical padding', 'container', '--md-button-padding-block', 0, 128),
  number('gap', 'Content gap', 'container', '--md-button-gap', 0, 64),
  number('hoverOpacity', 'Hover opacity', 'state-layer', '--md-button-hover-opacity', 0, 1, 0.01),
  number('focusOpacity', 'Focus opacity', 'state-layer', '--md-button-focus-opacity', 0, 1, 0.01),
  number('pressedOpacity', 'Pressed opacity', 'state-layer', '--md-button-pressed-opacity', 0, 1, 0.01),
  // Not a CSS custom property: `md-button::part(state-layer) { opacity }`, which outranks the per-state opacities and so
  // fixes the layer's opacity in every state (native: AWCButtonAppearance.stateLayerOpacity).
  Object.assign(number('stateLayerOpacity', 'Fixed state layer opacity', 'state-layer', undefined, 0, 1, 0.01), { cssPart: Object.freeze({ part: 'state-layer', property: 'opacity' }) }),
  color('focusRingColor', 'Focus ring color', 'container', '--md-button-focus-ring-color'),
  number('width', 'Width', 'container', '--md-button-width', 0, 2400),
  number('minWidth', 'Minimum width', 'container', '--md-button-min-width', 0, 2400),
  number('maxWidth', 'Maximum width', 'container', '--md-button-max-width', 0, 2400),
  number('height', 'Height', 'container', '--md-button-height', 0, 2400),
  number('minHeight', 'Minimum height', 'container', '--md-button-min-height', 0, 2400),
].map(field => Object.freeze(field)));

const fieldsByName = new Map(BUTTON_APPEARANCE_FIELDS.map(field => [field.name, field]));
const unitlessFields = new Set(['fontWeight', 'hoverOpacity', 'focusOpacity', 'pressedOpacity', 'stateLayerOpacity']);
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_BUTTON_APPEARANCE' });

/** Omitted fields inherit defaults. Values are never coerced from UI strings. */
export function normalizeButtonAppearance(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw invalid('Button appearance must be a plain object.');
  }
  const normalized = {};
  for (const name of Reflect.ownKeys(value)) {
    const field = fieldsByName.get(name);
    if (!field) throw invalid(`Unknown button appearance field: ${String(name)}.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!Object.hasOwn(descriptor, 'value')) throw invalid(`Button appearance ${name} must be a value.`);
    const entry = descriptor.value;
    if (field.kind === 'color') {
      if (typeof entry !== 'string' || !/^#[\da-f]{6}$/i.test(entry)) {
        throw invalid(`Button appearance ${name} must be a #RRGGBB color.`);
      }
      normalized[name] = entry.toUpperCase();
    } else {
      if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < field.min || entry > field.max
          || (name === 'fontWeight' && !Number.isInteger(entry))) {
        throw invalid(`Button appearance ${name} must be ${name === 'fontWeight' ? 'an integer' : 'a finite number'} from ${field.min} to ${field.max}.`);
      }
      normalized[name] = Object.is(entry, -0) ? 0 : entry;
    }
  }
  return normalized;
}

/** Local fields replace matching defaults; neither input is mutated. */
export function mergeButtonAppearance(defaults, local) {
  return { ...normalizeButtonAppearance(defaults), ...normalizeButtonAppearance(local) };
}

/** Sparse CSS map; inherited fields only inform a width-only stroke color. */
export function buttonAppearanceCSS(value, inherited = {}) {
  const normalized = normalizeButtonAppearance(value);
  const defaults = normalizeButtonAppearance(inherited);
  const css = Object.fromEntries(BUTTON_APPEARANCE_FIELDS
    .filter(field => field.cssProperty && Object.hasOwn(normalized, field.name))
    .map(field => [field.cssProperty, field.kind === 'color' || unitlessFields.has(field.name)
      ? String(normalized[field.name]) : `${normalized[field.name]}px`]));
  // An explicit stroke remains visible in every variant and selected state.
  // Preserve a provided theme color without duplicating its other fields.
  if (normalized.outlineWidth > 0 && normalized.outlineColor === undefined) {
    css['--md-button-outline-color'] = defaults.outlineColor ?? 'var(--md-sys-color-outline)';
  }
  return css;
}

/** `::part()` declarations for fields that are not custom properties: [{ part, property, value }]. */
export function buttonAppearancePartCSS(value) {
  const normalized = normalizeButtonAppearance(value);
  return BUTTON_APPEARANCE_FIELDS.filter(field => field.cssPart && Object.hasOwn(normalized, field.name))
    .map(field => ({ ...field.cssPart, value: unitlessFields.has(field.name) ? String(normalized[field.name]) : `${normalized[field.name]}px` }));
}
