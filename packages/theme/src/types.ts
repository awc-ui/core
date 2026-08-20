export type PaletteKey =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'neutral'
  | 'neutralVariant';

/** MD3 role names — matches --md-sys-color-* tokens and DynamicScheme getters. */
export const ROLE_KEYS = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'inversePrimary',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'background',
  'onBackground',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'surfaceDim',
  'surfaceBright',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'shadow',
  'scrim',
  'surfaceTint',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
export type RoleMap = Record<RoleKey, string>;

export type ThemeComputeRequest = {
  primaryHex: string;
  secondaryHex?: string;
  tertiaryHex?: string;
  /**
   * MD3 contrast level passed to DynamicScheme.
   * -1 reduced, 0 standard (default), 0.5 medium, 1 high contrast.
   */
  contrastLevel?: number;
};

export type ThemeComputeResult = {
  tones: Record<PaletteKey, Record<number, string>>;
  roles: { light: RoleMap; dark: RoleMap };
  sources: { primary: string; secondary: string; tertiary: string };
  contrastLevel: number;
  durationMs: number;
};

export type ThemeWorkerRequest = ThemeComputeRequest & { type: 'compute' };

export type ThemeWorkerResponse =
  | ({ type: 'palette' } & ThemeComputeResult)
  | { type: 'error'; message: string };

export const DEFAULT_SEED_COLORS = {
  primary: '#6750A4',
  secondary: '#625B71',
  tertiary: '#7D5260',
} as const;

export const DEFAULT_FONT_FAMILY = 'Roboto';

/** All 15 MD3 typescale slots that expose a font-family token. */
export const TYPESCALE_SLOTS = [
  'display-large',
  'display-medium',
  'display-small',
  'headline-large',
  'headline-medium',
  'headline-small',
  'title-large',
  'title-medium',
  'title-small',
  'label-large',
  'label-medium',
  'label-small',
  'body-large',
  'body-medium',
  'body-small',
] as const;
