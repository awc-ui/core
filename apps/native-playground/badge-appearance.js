const color = (name, label, suffix) => ({ name, label, cssProperty: `--md-badge-${suffix}`, kind: 'color' });
const length = (name, label, suffix) => ({ name, label, cssProperty: `--md-badge-${suffix}`, kind: 'number', min: 0, hint: '0 or more px / pt / dp.' });
export const BADGE_APPEARANCE_FIELDS = Object.freeze([
  color('containerColor', 'Container color', 'container-color'),
  color('labelColor', 'Label color', 'label-color'),
  length('cornerRadius', 'Corner radius', 'container-shape'),
  color('iconColor', 'Icon color', 'icon-color'),
  length('iconSize', 'Icon size', 'icon-size'),
  { name: 'offsetX', label: 'Horizontal offset', cssProperty: '--md-badge-offset-x', kind: 'offset', hint: 'Pixels and percent of the badge width, for example 50% + 7px.' },
  { name: 'offsetY', label: 'Vertical offset', cssProperty: '--md-badge-offset-y', kind: 'offset', hint: 'Pixels and percent of the badge height, for example -50% - 2px.' },
  length('largeHeight', 'Large badge height', 'large-height'),
  { name: 'largePadding', label: 'Large badge padding', cssProperty: '--md-badge-large-padding', kind: 'padding', hint: '1–4 nonnegative lengths in top, right, bottom, left order, for example 0 4.' },
  length('smallSize', 'Small badge size', 'small-size'),
].map(Object.freeze));
const fields = new Map(BADGE_APPEARANCE_FIELDS.map(field => [field.name, field]));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_BADGE_APPEARANCE' });
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const number = (value, positive = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || positive && value < 0) throw invalid(`Use a finite${positive ? ' nonnegative' : ''} number.`);
  return Object.is(value, -0) ? 0 : value;
};
const data = (object, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw invalid('Appearance fields must contain data values.');
  return descriptor.value;
};

export function normalizeBadgeAppearance(value) {
  if (value === undefined) return {};
  if (!plain(value)) throw invalid('Badge appearance must be a plain object.');
  const result = {};
  for (const name of Reflect.ownKeys(value)) {
    const field = fields.get(name);
    if (!field) throw invalid('Unknown badge appearance field.');
    const item = data(value, name);
    if (field.kind === 'color') {
      if (typeof item !== 'string' || !/^#[\da-f]{6}$/i.test(item)) throw invalid(`${field.label} must be a #RRGGBB color.`);
      result[name] = item.toUpperCase();
    } else if (field.kind === 'offset') {
      if (!plain(item) || Reflect.ownKeys(item).some(key => !['points', 'fraction'].includes(key))) throw invalid('Offsets contain points and fraction only.');
      result[name] = Object.fromEntries(['points', 'fraction'].map(key => [key, Object.hasOwn(item, key) ? number(data(item, key)) : 0]));
    } else if (field.kind === 'padding') {
      if (!Array.isArray(item) || item.length !== 4 || Reflect.ownKeys(item).length !== 5) throw invalid('Padding requires four physical sides.');
      result[name] = Array.from({ length: 4 }, (_, index) => number(data(item, String(index)), true));
    } else result[name] = number(item, true);
  }
  return result;
}

// Keep a finite input's percentage serialization finite even above Number.MAX_VALUE / 100.
const percent = fraction => {
  const scaled = fraction * 100;
  if (Number.isFinite(scaled)) return String(scaled);
  const [coefficient, exponent] = fraction.toExponential().split('e');
  return `${coefficient}e${Number(exponent) + 2}`;
};
function offsetCSS({ points, fraction }) {
  if (!fraction) return `${points}px`;
  if (!points) return `${percent(fraction)}%`;
  return `calc(${percent(fraction)}% ${points < 0 ? '-' : '+'} ${Math.abs(points)}px)`;
}
export function badgeAppearanceCSS(value) {
  const normalized = normalizeBadgeAppearance(value);
  return Object.fromEntries(BADGE_APPEARANCE_FIELDS.filter(field => Object.hasOwn(normalized, field.name)).map(field => {
    const item = normalized[field.name];
    return [field.cssProperty, field.kind === 'offset' ? offsetCSS(item) : field.kind === 'padding' ? item.map(value => `${value}px`).join(' ') : field.kind === 'color' ? item : `${item}px`];
  }));
}

const numeric = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
export function parseBadgeAppearanceInput(name, raw) {
  const field = fields.get(name);
  if (field.kind === 'offset') {
    const mixed = new RegExp(`^(${numeric})%\\s*([+-])\\s*(${numeric})px$`, 'i').exec(raw);
    if (mixed) return { fraction: Number(mixed[1]) / 100, points: Number(mixed[3]) * (mixed[2] === '-' ? -1 : 1) };
    const single = new RegExp(`^(${numeric})(%|px)?$`, 'i').exec(raw);
    if (!single) throw invalid('Use a length, percentage, or percentage plus a length, such as 50% + 7px.');
    return single[2] === '%' ? { points: 0, fraction: Number(single[1]) / 100 } : { points: Number(single[1]), fraction: 0 };
  }
  if (field.kind === 'padding') {
    const values = raw.split(/\s+/).map(value => new RegExp(`^(${numeric})(?:px)?$`, 'i').exec(value)?.[1]);
    if (!values.length || values.length > 4 || values.some(value => value === undefined)) throw invalid('Use one to four nonnegative padding lengths.');
    const [top, right = top, bottom = top, left = right] = values.map(Number);
    return [top, right, bottom, left];
  }
  return field.kind === 'number' ? Number(raw) : raw;
}
export function formatBadgeAppearanceInput(name, value) {
  if (value === undefined) return '';
  const field = fields.get(name);
  return field.kind === 'offset' ? offsetCSS(value).replace(/^calc\((.*)\)$/, '$1') : field.kind === 'padding' ? value.join(' ') : String(value);
}
const double = value => /[.e]/i.test(String(value)) ? String(value) : `${value}.0`;
export function badgeAppearanceNativeValue(name, value, platform) {
  const type = fields.get(name)?.kind;
  if (!['offset', 'padding'].includes(type)) return undefined;
  const entries = type === 'offset' ? [['points', value.points], ['fraction', value.fraction]] : ['top', 'right', 'bottom', 'left'].map((key, index) => [key, value[index]]);
  return `AWCBadge${type === 'offset' ? 'Offset' : 'Padding'}(${entries.map(([key, item]) => `${key}${platform === 'swift' ? ': ' : ' = '}${double(item)}`).join(', ')})`;
}
