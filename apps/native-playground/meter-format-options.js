// Data-only editor validation for the source's Intl.NumberFormatOptions object.
// Formatting itself remains inside each real renderer, never a preview string.
const choices = {
  localeMatcher: ['lookup', 'best fit'],
  style: ['decimal', 'currency', 'percent', 'unit'],
  currencyDisplay: ['symbol', 'narrowSymbol', 'code', 'name'],
  currencySign: ['standard', 'accounting'],
  unitDisplay: ['short', 'narrow', 'long'],
  notation: ['standard', 'scientific', 'engineering', 'compact'],
  compactDisplay: ['short', 'long'],
  signDisplay: ['auto', 'never', 'always', 'exceptZero', 'negative'],
  roundingMode: ['ceil', 'floor', 'expand', 'trunc', 'halfCeil', 'halfFloor', 'halfExpand', 'halfTrunc', 'halfEven'],
  roundingPriority: ['auto', 'morePrecision', 'lessPrecision'],
  trailingZeroDisplay: ['auto', 'stripIfInteger'],
};
const digitRanges = { minimumIntegerDigits: [1, 21], minimumFractionDigits: [0, 100], maximumFractionDigits: [0, 100], minimumSignificantDigits: [1, 21], maximumSignificantDigits: [1, 21] };
const increments = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
const names = new Set([...Object.keys(choices), ...Object.keys(digitRanges), 'currency', 'unit', 'numberingSystem', 'useGrouping', 'roundingIncrement']);
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_METER_FORMAT_OPTIONS' });
export function normalizeMeterFormatOptions(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid('formatOptions must be a JSON object; leave blank to use percentage formatting.');
  for (const key of Reflect.ownKeys(value)) {
    if (!names.has(key)) throw invalid(`Unknown number-format option: ${String(key)}.`);
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid('Number-format options must contain data values.');
  }
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (choices[key] && !choices[key].includes(item)) throw invalid(`Choose a declared ${key} value.`);
    if (digitRanges[key] && (typeof item !== 'number' || !Number.isInteger(item) || item < digitRanges[key][0] || item > digitRanges[key][1])) throw invalid(`${key} must be an integer from ${digitRanges[key][0]} to ${digitRanges[key][1]}.`);
    if (key === 'useGrouping' && ![true, false, 'auto', 'always', 'min2'].includes(item)) throw invalid('useGrouping must be a boolean, auto, always or min2.');
    if (key === 'roundingIncrement' && !increments.includes(item)) throw invalid('Choose a supported roundingIncrement.');
    if (key === 'currency' && (typeof item !== 'string' || !/^[A-Za-z]{3}$/.test(item))) throw invalid('currency must be a three-letter currency code.');
    if (key === 'unit' && (typeof item !== 'string' || item.length > 80 || !/^[a-z]+(?:-[a-z]+)*$/.test(item))) throw invalid('unit must be a Unicode unit identifier, for example gigabyte or kilometer-per-hour.');
    if (key === 'numberingSystem' && (typeof item !== 'string' || item.length > 80 || !/^[a-z0-9]{3,8}(?:-[a-z0-9]{3,8})*$/i.test(item))) throw invalid('numberingSystem must be a Unicode numbering-system identifier.');
    return [key, item];
  }));
  try { new Intl.NumberFormat(undefined, result); }
  catch (error) { throw invalid(`Invalid number-format options: ${error.message}`); }
  return result;
}
