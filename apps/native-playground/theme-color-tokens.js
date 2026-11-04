/** Bounded color-token data, including source-defined roles such as brand. */
export function normalizeThemeColorTokens(value) {
  const invalid = () => Object.assign(new Error('Use at most 128 --md-sys-color-<role> entries with #RRGGBB or #RRGGBBAA colors.'), { code: 'INVALID_THEME_TOKENS' });
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length > 128) throw invalid();
  for (const key of keys) {
    if (typeof key !== 'string' || key.length > 96 || !/^--md-sys-color-[a-z][a-z0-9-]*$/i.test(key)) throw invalid();
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid();
    if (typeof value[key] !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value[key])) throw invalid();
  }
  // Token names retain case: CSS custom-property names are case-sensitive.
  return Object.fromEntries(keys.sort().map(key => [key, value[key].toUpperCase()]));
}
