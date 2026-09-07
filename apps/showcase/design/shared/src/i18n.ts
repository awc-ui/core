import { en, ar, ro, interpolate, type TranslateParams } from '@awc-ui/showcase-kit/i18n';
import { PICTOR_AR } from './messages-ar';

// Source messages are used as message IDs, as in gettext. Existing showcase
// terms keep their established translations; new studio copy lives beside
// the framework-free model so every renderer uses the same vocabulary.
const existing = new Map(Object.entries(en).filter(([key]) => key.startsWith('design.')).map(([key, message]) => [message, key]));
const arabic: Readonly<Record<string, string | undefined>> = ar;
const romanian: Readonly<Record<string, string | undefined>> = ro;
export function pictorText(locale: string, message: string, params?: TranslateParams): string {
  const language = locale.trim().toLowerCase().split('-')[0];
  const key = existing.get(message);
  const studioMessage = Object.prototype.hasOwnProperty.call(PICTOR_AR, message) ? PICTOR_AR[message] : undefined;
  const translated = language === 'ar'
    ? studioMessage ?? (key ? arabic[key] : undefined)
    : language === 'ro' && key ? romanian[key] : undefined;
  return interpolate(translated ?? message, params);
}

export function hasPictorArabic(message: string): boolean {
  const key = existing.get(message);
  return Object.prototype.hasOwnProperty.call(PICTOR_AR, message) || Boolean(key && arabic[key]);
}

/** Match ordinary Arabic typing against copy with optional vowel marks. */
export function pictorSearchText(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\u0640/g, '').toLocaleLowerCase().trim();
}
