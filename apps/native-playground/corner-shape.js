// Physical CSS border-radius data shared by native appearance profiles.
const corners = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_CORNER_SHAPE' });
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function object(value, keys) {
  if (!plain(value) || Reflect.ownKeys(value).some(key => !keys.includes(key))) throw invalid(`Use a plain object containing only ${keys.join(', ')}.`);
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Appearance fields must contain data values.');
  return value;
}
const finite = (value, nonnegative = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || nonnegative && value < 0) throw invalid(`Use a finite${nonnegative ? ' nonnegative' : ''} number.`);
  return Object.is(value, -0) ? 0 : value;
};
export function normalizeCornerShape(value) {
  object(value, corners);
  return Object.fromEntries(corners.map(corner => {
    const radius = object(Object.hasOwn(value, corner) ? value[corner] : {}, ['x', 'y']);
    return [corner, Object.fromEntries(['x', 'y'].map(axis => {
      const length = object(Object.hasOwn(radius, axis) ? radius[axis] : {}, ['points', 'fraction']);
      return [axis, { points: finite(Object.hasOwn(length, 'points') ? length.points : 0), fraction: finite(Object.hasOwn(length, 'fraction') ? length.fraction : 0) }];
    }))];
  }));
}
const percentage = fraction => {
  const scaled = fraction * 100;
  if (Number.isFinite(scaled)) return String(scaled);
  const [coefficient, exponent] = fraction.toExponential().split('e');
  return `${coefficient}e${Number(exponent) + 2}`;
};
const radiusCSS = ({ points, fraction }) => {
  if (fraction && points) return `calc(${percentage(fraction)}% ${points < 0 ? '-' : '+'} ${Math.abs(points)}px)`;
  const value = fraction ? `${percentage(fraction)}%` : `${points}px`;
  // A negative calc result is clamped to zero by CSS radius range checking.
  return (fraction || points) < 0 ? `calc(${value})` : value;
};
const shorthand = values => {
  if (values[3] === values[1]) values.pop();
  if (values.length === 3 && values[2] === values[0]) values.pop();
  if (values.length === 2 && values[1] === values[0]) values.pop();
  return values.join(' ');
};
export function cornerShapeCSS(shape) {
  const x = shorthand(corners.map(corner => radiusCSS(shape[corner].x)));
  const y = shorthand(corners.map(corner => radiusCSS(shape[corner].y)));
  return x === y ? x : `${x} / ${y}`;
}
const numberPattern = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const coefficient = (raw, unit) => {
  if (unit !== '%') return finite(Number(raw));
  // Divide the decimal exponent before converting, so an emitted 1e310%
  // roundtrips to a finite 1e308 fraction without an intermediate Infinity.
  const [mantissa, exponent = '0'] = raw.toLowerCase().split('e');
  return finite(Number(`${mantissa}e${Number(exponent) - 2}`));
};
function parseLength(token) {
  const calc = /^calc\((.*)\)$/i.exec(token), raw = (calc ? calc[1] : token).trim();
  const single = new RegExp(`^(${numberPattern})(px|%)?$`, 'i').exec(raw);
  if (single) {
    const value = coefficient(single[1], single[2]);
    if (!calc && value < 0) throw invalid('A radius must be nonnegative; use calc() for mixed signed lengths.');
    return { points: single[2] === '%' ? 0 : value, fraction: single[2] === '%' ? value : 0 };
  }
  const pair = calc && new RegExp(`^(${numberPattern})(px|%)\\s*([+-])\\s*(${numberPattern})(px|%)$`, 'i').exec(raw);
  if (!pair) throw invalid('Use lengths or percentages, optionally calc(50% - 2px).');
  const result = { points: 0, fraction: 0 };
  for (const [rawValue, unit, sign] of [[pair[1], pair[2], 1], [pair[4], pair[5], pair[3] === '-' ? -1 : 1]]) {
    const key = unit === '%' ? 'fraction' : 'points';
    result[key] = finite(result[key] + coefficient(rawValue, unit) * sign);
  }
  return result;
}
export function parseCornerShape(raw) {
  const tokens = raw.match(/calc\([^()]*\)|\/|[^\s/]+/gi) || [];
  if (tokens.join('').replace(/\s/g, '') !== raw.replace(/\s/g, '')) throw invalid('Use CSS radius shorthand with one optional slash.');
  const slash = tokens.indexOf('/');
  if (!tokens.length || tokens.filter(token => token === '/').length > 1) throw invalid('Use one to four radii per axis.');
  const expand = values => {
    if (!values.length || values.length > 4) throw invalid('Use one to four radii per axis.');
    const lengths = values.map(parseLength);
    return [lengths[0], lengths[1] || lengths[0], lengths[2] || lengths[0], lengths[3] || lengths[1] || lengths[0]];
  };
  const x = expand(slash < 0 ? tokens : tokens.slice(0, slash));
  const y = slash < 0 ? x : expand(tokens.slice(slash + 1));
  return Object.fromEntries(corners.map((corner, index) => [corner, { x: x[index], y: y[index] }]));
}
const double = value => /[.e]/i.test(String(value)) ? String(value) : `${value}.0`;
export function cornerShapeNativeValue(value, platform) {
  const separator = platform === 'swift' ? ': ' : ' = ';
  const length = value => `AWCCornerLength(points${separator}${double(value.points)}, fraction${separator}${double(value.fraction)})`;
  return `AWCCornerShape(${corners.map(corner => `${corner}${separator}AWCCornerRadius(x${separator}${length(value[corner].x)}, y${separator}${length(value[corner].y)})`).join(', ')})`;
}
