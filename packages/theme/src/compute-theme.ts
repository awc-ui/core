import {
  argbFromHex,
  hexFromArgb,
  Hct,
  TonalPalette,
  DynamicScheme,
  Variant,
} from '@material/material-color-utilities';
import {
  ROLE_KEYS,
  type PaletteKey,
  type RoleKey,
  type RoleMap,
  type ThemeComputeRequest,
  type ThemeComputeResult,
} from './types';

const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100] as const;
const NEUTRAL_CHROMA = 4;
const NEUTRAL_VARIANT_CHROMA = 8;

function paletteToTones(palette: TonalPalette): Record<number, string> {
  const out: Record<number, string> = {};
  for (const tone of TONES) {
    out[tone] = hexFromArgb(palette.tone(tone)).toUpperCase();
  }
  return out;
}

function rolesFromScheme(scheme: DynamicScheme): RoleMap {
  const out = {} as RoleMap;
  for (const key of ROLE_KEYS) {
    const argb = (scheme as unknown as Record<string, number>)[key];
    out[key] = hexFromArgb(argb).toUpperCase();
  }
  return out;
}

/** Generate MD3 tonal palettes and role-mapped tokens for light and dark mode. */
export function computeTheme(req: ThemeComputeRequest): ThemeComputeResult {
  const start = performance.now();

  const primaryArgb = argbFromHex(req.primaryHex);
  const primaryHct = Hct.fromInt(primaryArgb);
  const primary = TonalPalette.fromHct(primaryHct);

  const secondary = req.secondaryHex
    ? TonalPalette.fromHct(Hct.fromInt(argbFromHex(req.secondaryHex)))
    : TonalPalette.fromHueAndChroma(primaryHct.hue, 16);

  const tertiary = req.tertiaryHex
    ? TonalPalette.fromHct(Hct.fromInt(argbFromHex(req.tertiaryHex)))
    : TonalPalette.fromHueAndChroma(primaryHct.hue + 60, 24);

  const neutral = TonalPalette.fromHueAndChroma(primaryHct.hue, NEUTRAL_CHROMA);
  const neutralVariant = TonalPalette.fromHueAndChroma(
    primaryHct.hue,
    NEUTRAL_VARIANT_CHROMA,
  );

  const tones: Record<PaletteKey, Record<number, string>> = {
    primary: paletteToTones(primary),
    secondary: paletteToTones(secondary),
    tertiary: paletteToTones(tertiary),
    neutral: paletteToTones(neutral),
    neutralVariant: paletteToTones(neutralVariant),
  };

  const requestedLevel =
    typeof req.contrastLevel === 'number' && Number.isFinite(req.contrastLevel)
      ? req.contrastLevel
      : 0;
  const contrastLevel = Math.max(-1, Math.min(1, requestedLevel));

  const buildScheme = (isDark: boolean) =>
    new DynamicScheme({
      sourceColorHct: primaryHct,
      variant: Variant.TONAL_SPOT,
      contrastLevel,
      isDark,
      primaryPalette: primary,
      secondaryPalette: secondary,
      tertiaryPalette: tertiary,
      neutralPalette: neutral,
      neutralVariantPalette: neutralVariant,
    });

  const light = rolesFromScheme(buildScheme(false));
  const dark = rolesFromScheme(buildScheme(true));

  return {
    tones,
    roles: { light, dark },
    sources: {
      primary: req.primaryHex.toUpperCase(),
      secondary: req.secondaryHex?.toUpperCase() ?? '',
      tertiary: req.tertiaryHex?.toUpperCase() ?? '',
    },
    contrastLevel,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
  };
}
