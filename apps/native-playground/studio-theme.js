import { computeTheme, generateCss, tokenName, ROLE_KEYS, DEFAULT_SEED_COLORS } from './theme-vendor/awc-theme.js';

export const STUDIO_THEME_STORAGE_KEY = 'awc-component-studio-theme-v1';
export const DEFAULT_STUDIO_THEME = Object.freeze({ version: 1, primaryHex: DEFAULT_SEED_COLORS.primary, secondaryHex: null, tertiaryHex: null, contrastLevel: 0, mode: 'light' });
export const STUDIO_THEME_TOKEN_NAMES = Object.freeze(ROLE_KEYS.map(role => `--md-sys-color-${tokenName(role)}`));

function normalizeHex(value, name, optional = false) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') throw new Error(`${name} must be a hex color.`);
  let hex = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(char => char + char).join('');
  if (!/^[\da-f]{6}$/i.test(hex)) throw new Error(`${name} must contain 6 hex digits, for example #6750A4.`);
  return `#${hex.toUpperCase()}`;
}

export function normalizeStudioTheme(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Theme configuration must be an object.');
  if (config.version !== undefined && config.version !== 1) throw new Error('Unsupported theme configuration version.');
  const level = config.contrastLevel ?? DEFAULT_STUDIO_THEME.contrastLevel;
  if (typeof level !== 'number' || !Number.isFinite(level)) throw new Error('Theme contrast must be a finite number.');
  const mode = config.mode ?? 'light';
  if (!['light', 'dark'].includes(mode)) throw new Error('Theme mode must be light or dark.');
  return {
    version: 1,
    primaryHex: normalizeHex(config.primaryHex ?? DEFAULT_STUDIO_THEME.primaryHex, 'Primary seed'),
    secondaryHex: normalizeHex(config.secondaryHex, 'Secondary override', true),
    tertiaryHex: normalizeHex(config.tertiaryHex, 'Tertiary override', true),
    contrastLevel: Math.max(-1, Math.min(1, level)), mode,
  };
}

/** Uses the same HCT / DynamicScheme computation as @awc-ui/theme's generator. */
export function computeStudioTheme(config = {}) {
  const normalized = normalizeStudioTheme(config);
  const theme = computeTheme({ primaryHex: normalized.primaryHex, secondaryHex: normalized.secondaryHex || undefined, tertiaryHex: normalized.tertiaryHex || undefined, contrastLevel: normalized.contrastLevel });
  const tokens = Object.fromEntries(['light', 'dark'].map(mode => [mode, Object.fromEntries(ROLE_KEYS.map(role => [`--md-sys-color-${tokenName(role)}`, theme.roles[mode][role]]))]));
  return { config: normalized, theme, roles: theme.roles, tokens, swatches: { primary: normalized.primaryHex, secondary: theme.roles.light.secondary, tertiary: theme.roles.light.tertiary } };
}

export function nativeThemeTokens(result, mode = result.config.mode) {
  if (!['light', 'dark'].includes(mode)) throw new Error('Theme mode must be light or dark.');
  return { ...result.tokens[mode] };
}

const aliases = {
  '--bg': 'surfaceContainerLowest', '--panel': 'surface', '--ink': 'onSurface', '--muted': 'onSurfaceVariant',
  '--border': 'outlineVariant', '--primary': 'primary', '--primary-soft': 'primaryContainer',
  '--surface': 'surfaceContainerLow', '--code': 'inverseSurface', '--amber': 'tertiary', '--amber-soft': 'tertiaryContainer',
};

/** Applies colors only; authored typography, dimensions and density stay intact. */
export function applyStudioTheme(result, options = {}) {
  const root = options.root || globalThis.document?.documentElement;
  if (!root?.style?.setProperty) throw new Error('A theme root element is required.');
  const mode = options.mode ?? result.config.mode, tokens = nativeThemeTokens(result, mode), roles = result.roles[mode];
  const targets = [...new Set([root, options.preview].filter(Boolean))];
  for (const target of targets) {
    for (const [name, value] of Object.entries(tokens)) target.style.setProperty(name, value);
    target.setAttribute?.('data-theme', mode);
    if (target.dataset) target.dataset.theme = mode;
    target.style.setProperty('color-scheme', mode);
  }
  for (const [name, role] of Object.entries(aliases)) root.style.setProperty(name, roles[role]);
  // The real theme package generates this stylesheet. Its mutation also lets
  // chart components observe seed/contrast changes and refresh their canvases.
  const doc = root.ownerDocument;
  if (doc?.head && doc.createElement) {
    const id = options.styleId || 'awc-component-studio-theme';
    let style = doc.getElementById(id);
    if (!style) { style = doc.createElement('style'); style.id = id; doc.head.appendChild(style); }
    style.textContent = generateCss(result.theme);
  }
  return tokens;
}

export function serializeStudioThemeConfig(config) { return JSON.stringify(normalizeStudioTheme(config), null, 2); }
export function exportStudioTheme(result, format = 'css') {
  if (format === 'css') return generateCss(result.theme);
  if (format === 'json') return JSON.stringify({ generator: '@awc-ui/theme', config: result.config, roles: result.roles, tokens: result.tokens }, null, 2);
  if (format === 'config') return serializeStudioThemeConfig(result.config);
  throw new Error('Choose css, json or config export.');
}

export function loadStudioTheme(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const saved = target?.getItem(STUDIO_THEME_STORAGE_KEY);
    if (saved) return normalizeStudioTheme(JSON.parse(saved));
    return normalizeStudioTheme({ mode: target?.getItem('awc-native-theme') === 'dark' ? 'dark' : 'light' });
  } catch { return { ...DEFAULT_STUDIO_THEME }; }
}

export function saveStudioTheme(config, storage) {
  const serialized = serializeStudioThemeConfig(config);
  try { const target = storage ?? globalThis.localStorage; if (!target) return false; target.setItem(STUDIO_THEME_STORAGE_KEY, serialized); return true; }
  catch { return false; }
}
