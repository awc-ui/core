/** Locale registry shared by the apps, the dock and the preboot script. */

export type LocaleCode = 'en' | 'ro' | 'ar';

export type Direction = 'ltr' | 'rtl';

export interface LocaleMeta {
  /** Short code, also the value written to `html[lang]` and the `lang` URL param. */
  code: LocaleCode;
  /** Endonym — how the language names itself. Never translated. */
  nativeName: string;
  /** English name, for a11y labels in an English-only context. */
  englishName: string;
  /** The script direction this locale defaults to. */
  dir: Direction;
  /** BCP 47 tag handed to `Intl`. */
  intlTag: string;
  /** ISO 4217 code a currency field defaults to for this market. */
  defaultCurrency: string;
}

/** The three showcase locales, in display order. */
export const LOCALES: readonly LocaleMeta[] = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
    intlTag: 'en-GB',
    defaultCurrency: 'EUR',
  },
  {
    code: 'ro',
    nativeName: 'Română',
    englishName: 'Romanian',
    dir: 'ltr',
    intlTag: 'ro-RO',
    defaultCurrency: 'EUR',
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic',
    dir: 'rtl',
    intlTag: 'ar-AE',
    defaultCurrency: 'AED',
  },
] as const;

export const DEFAULT_LOCALE: LocaleCode = 'en';

/** Every supported code, for validating a URL param. */
export const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code);

export function getLocaleMeta(locale: string): LocaleMeta {
  return LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
}

/** `true` when the value is one of the three supported codes. */
export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && LOCALE_CODES.includes(value as LocaleCode);
}

/** The direction a locale defaults to. A user may still override it in the dock. */
export function getDirection(locale: string): Direction {
  return getLocaleMeta(locale).dir;
}
