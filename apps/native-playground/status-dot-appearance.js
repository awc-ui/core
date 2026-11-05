const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-status-dot-${suffix}`, kind: 'color', hint: '#RRGGBB or #RRGGBBAA, with optional alpha.' });
const length = (name, label, suffix) => ({ name, label, cssProperty: `--md-status-dot-${suffix}`, kind: 'number', min: 0, hint: '0 or more px / pt / dp.' });
export const STATUS_DOT_APPEARANCE_FIELDS = Object.freeze([
  length('size', 'Diameter', 'size'),
  color('color', 'Dot color', 'color'),
  color('pulseColor', 'Pulse color', 'pulse-color'),
  color('outlineColor', 'Outline color', 'outline-color'),
  length('outlineWidth', 'Outline width', 'outline-width'),
  { name: 'insetEnd', label: 'Inline end inset', cssProperty: '--md-status-dot-inset-end', kind: 'inset', hint: 'Length and percent of parent width, for example 25% - 2px. Mirrors in RTL; ignored in inline mode.' },
  { name: 'insetBlockEnd', label: 'Bottom inset', cssProperty: '--md-status-dot-inset-block-end', kind: 'inset', hint: 'Length and percent of parent height, for example 25% - 2px. Ignored in inline mode.' },
  { name: 'pulseDuration', label: 'Pulse duration', cssProperty: '--md-status-dot-pulse-duration', kind: 'number', min: 0, hint: '0 or more seconds. Live must be enabled; reduced motion keeps the dot static.' },
].map(Object.freeze));
const fields = new Map(STATUS_DOT_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_STATUS_DOT_APPEARANCE' });
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const data = (object, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw invalid('Appearance fields must contain data values.');
  return descriptor.value;
};
const number = (value, nonnegative = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || nonnegative && value < 0) throw invalid(`Use a finite${nonnegative ? ' nonnegative' : ''} number.`);
  return Object.is(value, -0) ? 0 : value;
};
export function normalizeStatusDotAppearance(value) {
  if (value === undefined) return {};
  if (!plain(value)) throw invalid('Status dot appearance must be a plain object.');
  const result = {};
  for (const name of Reflect.ownKeys(value)) {
    const field = fields.get(name);
    if (!field) throw invalid('Unknown status dot appearance field.');
    const item = data(value, name);
    if (field.kind === 'color') {
      if (typeof item !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(item)) throw invalid(`${field.label} must be #RRGGBB or #RRGGBBAA.`);
      result[name] = item.toUpperCase();
    } else if (field.kind === 'inset') {
      if (!plain(item) || Reflect.ownKeys(item).some(key => !['points', 'fraction'].includes(key))) throw invalid('Insets contain points and fraction only.');
      result[name] = Object.fromEntries(['points', 'fraction'].map(key => [key, Object.hasOwn(item, key) ? number(data(item, key)) : 0]));
    } else result[name] = number(item, true);
  }
  return result;
}
const percent = fraction => {
  const scaled = fraction * 100;
  if (Number.isFinite(scaled)) return String(scaled);
  const [coefficient, exponent] = fraction.toExponential().split('e');
  return `${coefficient}e${Number(exponent) + 2}`;
};
const insetCSS = ({ points, fraction }) => !fraction ? `${points}px` : !points ? `${percent(fraction)}%` : `calc(${percent(fraction)}% ${points < 0 ? '-' : '+'} ${Math.abs(points)}px)`;
export function statusDotAppearanceCSS(value) {
  const normalized = normalizeStatusDotAppearance(value);
  return Object.fromEntries(STATUS_DOT_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field => {
    const item = normalized[field.name];
    return [field.cssProperty, field.kind === 'inset' ? insetCSS(item) : field.kind === 'color' ? item : `${item}${field.name === 'pulseDuration' ? 's' : 'px'}`];
  }));
}
const numeric = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
export function parseStatusDotAppearanceInput(name, raw) {
  const field = fields.get(name);
  if (field?.kind === 'inset') {
    const mixed = new RegExp(`^(${numeric})%\\s*([+-])\\s*(${numeric})px$`, 'i').exec(raw);
    if (mixed) return { fraction: Number(mixed[1]) / 100, points: Number(mixed[3]) * (mixed[2] === '-' ? -1 : 1) };
    const single = new RegExp(`^(${numeric})(%|px)?$`, 'i').exec(raw);
    if (!single) throw invalid('Use a length, percentage, or percentage plus a length, such as 25% - 2px.');
    return single[2] === '%' ? { points: 0, fraction: Number(single[1]) / 100 } : { points: Number(single[1]), fraction: 0 };
  }
  return field?.kind === 'number' ? Number(raw) : raw;
}
export function formatStatusDotAppearanceInput(name, value) {
  if (value === undefined) return '';
  return fields.get(name)?.kind === 'inset' ? insetCSS(value).replace(/^calc\((.*)\)$/, '$1') : String(value);
}
const double = value => /[.e]/i.test(String(value)) ? String(value) : `${value}.0`;
export function statusDotAppearanceNativeValue(name, value, platform) {
  if (fields.get(name)?.kind !== 'inset') return undefined;
  return `AWCStatusDotInset(${['points', 'fraction'].map(key => `${key}${platform === 'swift' ? ': ' : ' = '}${double(value[key])}`).join(', ')})`;
}
