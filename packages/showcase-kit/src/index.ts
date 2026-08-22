/**
 * `@awc-ui/showcase-kit`
 *
 * Convenience barrel. Prefer the subpath entries — `/data`, `/i18n`, `/dock`,
 * `/preboot` — so a server bundle never pulls the dock's DOM side effects in.
 * This root entry deliberately re-exports the *state* half of the dock and not
 * the custom element, keeping it safe to import anywhere.
 */
export * from './data/index';
export * from './i18n/index';
export * from './preboot/index';

export {
  DEFAULT_SEED_PRESET,
  DEFAULT_STATE,
  DENSITY_RUNGS,
  SEED_PRESETS,
  SHOWCASE_EVENT,
  STORAGE_KEY,
  THEME_MODES,
  URL_PARAMS,
  applySeedPreset,
  applyShowcaseState,
  buildFrameworkUrl,
  getShowcaseState,
  normalizeState,
  prefersDark,
  readShowcaseState,
  readStateFromSearch,
  resetShowcaseState,
  resolveTheme,
  setShowcaseState,
  subscribeShowcaseState,
  syncUrl,
  toSearchParams,
  withShowcaseParams,
} from './dock/state';

export type {
  DensityRung,
  FrameworkUrlOptions,
  SeedPreset,
  ShowcaseChangeDetail,
  ShowcaseListener,
  ShowcaseState,
  ThemeMode,
} from './dock/state';
