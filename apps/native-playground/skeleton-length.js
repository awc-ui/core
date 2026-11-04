// Affine CSS lengths preserve parent- and font-relative sizing across renderers.
const terms = Object.freeze(['points', 'fraction', 'em', 'rem', 'ch']);
const units = { px: 'points', '%': 'fraction', em: 'em', rem: 'rem', ch: 'ch' };
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_SKELETON_LENGTH' });
const finite = value => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid('Length coefficients must be finite numbers.');
  return Object.is(value, -0) ? 0 : value;
};
export function normalizeSkeletonLength(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => !terms.includes(key))) {
    throw invalid('Use a length containing points, fraction, em, rem or ch.');
  }
  for (const key of Reflect.ownKeys(value)) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Lengths must contain data values.');
  }
  return Object.fromEntries(terms.map(term => [term, finite(Object.hasOwn(value, term) ? value[term] : 0)]));
}
const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const unsigned = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const coefficient = (raw, unit) => {
  if (unit !== '%') return finite(Number(raw));
  const [mantissa, exponent = '0'] = raw.toLowerCase().split('e');
  return finite(Number(`${mantissa}e${Number(exponent) - 2}`));
};
/** Deliberately bounded grammar: affine px/%/em/rem/ch, with additive calc().
 * Other CSS expressions remain valid Web inputs, but have no native translation. */
export function parseSkeletonLength(value) {
  if (typeof value !== 'string') throw invalid('Use a CSS length string.');
  const raw = value.trim();
  if (!raw || raw.length > 4096) throw invalid('Use a CSS length of at most 4096 characters.');
  const calc = /^calc\(([^()]*)\)$/i.exec(raw);
  const body = calc ? calc[1].trim() : raw;
  const result = normalizeSkeletonLength({});
  const first = new RegExp(`^(${number})(px|%|em|rem|ch)?`, 'i').exec(body);
  if (!first) throw invalid('Use px, %, em, rem or ch, optionally added or subtracted in calc().');
  const add = (numeric, unit, sign = 1) => {
    if (!unit && (calc || Number(numeric) !== 0)) throw invalid('Use px, %, em, rem or ch; only standalone zero may omit its unit.');
    const key = units[unit?.toLowerCase() || 'px'];
    result[key] = finite(result[key] + sign * coefficient(numeric, unit?.toLowerCase()));
  };
  add(first[1], first[2]);
  let rest = body.slice(first[0].length);
  if (!calc && (rest.trim() || Number(first[1]) < 0)) throw invalid('Use a nonnegative length, or calc() for signed terms.');
  while (rest.trim()) {
    // CSS addition/subtraction requires whitespace on both sides of the operator.
    const next = new RegExp(`^\\s+([+-])\\s+(${unsigned})(px|%|em|rem|ch)?`, 'i').exec(rest);
    if (!calc || !next) throw invalid('Use additive calc(), for example calc(100% - 32px + 1em).');
    add(next[2], next[3], next[1] === '-' ? -1 : 1);
    rest = rest.slice(next[0].length);
  }
  return result;
}
const percentage = fraction => {
  if (Number.isFinite(fraction * 100)) return String(fraction * 100);
  const [mantissa, exponent] = fraction.toExponential().split('e');
  return `${mantissa}e${Number(exponent) + 2}`;
};
export function skeletonLengthCSS(value) {
  const normalized = normalizeSkeletonLength(value);
  const active = terms.filter(term => normalized[term] !== 0);
  if (!active.length) return '0px';
  const termCSS = (term, absolute = false) => {
    const amount = absolute ? Math.abs(normalized[term]) : normalized[term];
    return term === 'fraction' ? `${percentage(amount)}%` : `${amount}${term === 'points' ? 'px' : term}`;
  };
  if (active.length === 1 && normalized[active[0]] >= 0) return termCSS(active[0]);
  return `calc(${active.map((term, index) => index
    ? `${normalized[term] < 0 ? '-' : '+'} ${termCSS(term, true)}` : termCSS(term)).join(' ')})`;
}
export function skeletonLengthNativeValue(value, platform) {
  const normalized = normalizeSkeletonLength(value), separator = platform === 'swift' ? ': ' : ' = ';
  const literal = value => /[.e]/i.test(String(value)) ? String(value) : `${value}.0`;
  return `AWCSkeletonLength(${terms.map(term => `${term}${separator}${literal(normalized[term])}`).join(', ')})`;
}
