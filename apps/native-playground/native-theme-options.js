import { STUDIO_THEME_TOKEN_NAMES } from './studio-theme.js';

const allowed = new Set(STUDIO_THEME_TOKEN_NAMES);
export class NativeThemeOptionsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** The preview accepts only bounded MD3 color roles, never arbitrary CSS. */
export function nativeThemeOptions(value = {}) {
  const result = {};
  if (value.direction !== undefined) {
    if (!['ltr', 'rtl'].includes(value.direction)) throw new NativeThemeOptionsError('INVALID_DIRECTION', 'Direction must be ltr or rtl.');
    result.direction = value.direction;
  }
  if (value.themeTokens !== undefined) {
    const tokens = value.themeTokens;
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens) || Object.keys(tokens).length > allowed.size) throw new NativeThemeOptionsError('INVALID_THEME_TOKENS', 'Theme tokens must be a bounded object of MD3 color roles.');
    result.themeTokens = Object.fromEntries(Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b)).map(([name, color]) => {
      if (!allowed.has(name) || typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)) throw new NativeThemeOptionsError('INVALID_THEME_TOKENS', 'Theme tokens must use supported --md-sys-color names and six-digit hex colors.');
      return [name, color.toUpperCase()];
    }));
  }
  return result;
}
