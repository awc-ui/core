/**
 * `@awc-ui/showcase-kit/dock`
 *
 * Importing this module registers `<awc-showcase-dock>` and, on the client,
 * immediately stamps the persisted/URL state onto `<html>`. That side effect is
 * intentional: it is what makes a bare `import '@awc-ui/showcase-kit/dock'` in an
 * app entry enough to wire the whole showcase up. It is a no-op on the server.
 */
import { AwcShowcaseDock, DOCK_TAG, defineShowcaseDock } from './element';
import { getShowcaseState } from './state';

export { AwcShowcaseDock, DOCK_CONTROLS, DOCK_TAG, defineShowcaseDock } from './element';
export type { DockControl } from './element';

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
  buildLocaleUrl,
  getShowcaseState,
  normalizeState,
  prefersDark,
  readShowcaseState,
  readStateFromSearch,
  resetShowcaseState,
  resolveTheme,
  setShowcaseState,
  splitLocalePath,
  subscribeShowcaseState,
  syncUrl,
  toSearchParams,
  withShowcaseParams,
} from './state';

export type {
  DensityRung,
  FrameworkUrlOptions,
  LocalePathOptions,
  SeedPreset,
  ShowcaseChangeDetail,
  ShowcaseListener,
  ShowcaseState,
  ThemeMode,
} from './state';

if (typeof window !== 'undefined') {
  defineShowcaseDock();
  // Reconcile before the app's first paint of its own markup. The preboot script
  // has usually done this already; this is the fallback for pages without it.
  getShowcaseState();
}

export default AwcShowcaseDock;
export { DOCK_TAG as tagName };
