import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-ripple's six typed hooks. Field order follows the native initializers (Swift requires labelled arguments in order).
// Colour #RRGGBB or #RRGGBBAA (alpha kept); opacity 0…1; extents in px (points on SwiftUI, dp on Android);
// grow duration in ms; grow easing as CSS easing text (keywords, cubic-bezier(), steps() or linear()).
const rp = (name, label, suffix, kind) => appearanceField('ripple', name, label, suffix, kind);
const BASE = Object.freeze([
  rp('color', 'Wave color', 'color', 'color'), rp('opacity', 'Peak opacity', 'opacity', 'opacity'),
  rp('extendInline', 'Inline extent', 'extend-inline', 'length'), rp('extendBlock', 'Block extent', 'extend-block', 'length'),
  rp('growDuration', 'Grow duration', 'grow-duration', 'duration'),
]);
const EASING = Object.freeze({ name: 'growEasing', label: 'Grow easing', cssProperty: '--md-ripple-grow-easing', kind: 'easing',
  hint: 'A CSS easing: linear, ease, ease-in, ease-out, ease-in-out, step-start, step-end, cubic-bezier(x1, y1, x2, y2), steps(n, position) or linear(…).' });
export const RIPPLE_APPEARANCE_FIELDS = Object.freeze([...BASE, EASING]);
const CODE = 'INVALID_RIPPLE_APPEARANCE';
const invalid = message => Object.assign(new Error(message), { code: CODE });
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
const number = text => new RegExp(`^${NUMBER}$`, 'i').test(text) ? Number(text) : NaN;
/** True when Chrome accepts the value as an `<easing-function>` (the native parsers mirror this rule). */
export function validRippleEasing(raw) {
  if (typeof raw !== 'string' || raw.length > 512) return false;
  const s = raw.trim().toLowerCase();
  if (['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].includes(s)) return true;
  const args = name => s.startsWith(`${name}(`) && s.endsWith(')') ? s.slice(name.length + 1, -1).split(',').map(part => part.trim()) : null;
  let a = args('cubic-bezier');
  if (a) { const v = a.map(number); return a.length === 4 && v.every(Number.isFinite) && v[0] >= 0 && v[0] <= 1 && v[2] >= 0 && v[2] <= 1; }
  a = args('steps');
  if (a) {
    if (a.length < 1 || a.length > 2 || !/^\d+$/.test(a[0])) return false;
    const pos = { start: 'jump-start', end: 'jump-end', 'jump-start': 'jump-start', 'jump-end': 'jump-end', 'jump-none': 'jump-none', 'jump-both': 'jump-both' }[a[1] ?? 'end'];
    return Boolean(pos) && Number(a[0]) >= (pos === 'jump-none' ? 2 : 1);
  }
  a = args('linear');
  if (a) {
    let stops = 0;
    for (const part of a) {
      const tokens = part.split(/\s+/).filter(Boolean);
      if (!tokens.length || tokens.length > 3 || !Number.isFinite(number(tokens[0]))) return false;
      if (tokens.slice(1).some(t => !t.endsWith('%') || !Number.isFinite(number(t.slice(0, -1))))) return false;
      stops += Math.max(1, tokens.length - 1);
    }
    return stops >= 2;
  }
  return false;
}
const base = appearanceProfile(BASE, CODE, 'Ripple');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function normalize(value) {
  if (value === undefined) return {};
  if (!plain(value)) throw invalid('Use a plain object containing only the 6 Ripple appearance fields.');
  const { growEasing, ...rest } = value;
  const normalized = base.normalize(rest);
  if (Object.hasOwn(value, 'growEasing')) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, 'growEasing'), 'value')) throw invalid('Appearance fields must contain data values.');
    if (!validRippleEasing(growEasing)) throw invalid('Grow easing must be a CSS easing function.');
    normalized.growEasing = growEasing.trim();
  }
  return Object.fromEntries(RIPPLE_APPEARANCE_FIELDS.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.name, normalized[f.name]]));
}
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
export const rippleAppearance = Object.freeze({
  fields: RIPPLE_APPEARANCE_FIELDS,
  normalize,
  css(value) {
    const n = normalize(value), { growEasing, ...rest } = n;
    return { ...base.css(rest), ...(growEasing === undefined ? {} : { '--md-ripple-grow-easing': growEasing }) };
  },
  parseInput: (name, raw) => name === 'growEasing' ? String(raw ?? '').trim() : base.parseInput(name, raw),
  formatInput: (name, value) => name === 'growEasing' ? (value === undefined ? '' : String(value)) : base.formatInput(name, value),
  nativeValue: (name, value, platform) => name === 'growEasing' ? quote(String(value), platform) : base.nativeValue(name, value, platform),
});
