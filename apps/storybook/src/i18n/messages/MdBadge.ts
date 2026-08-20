import type { Entry } from '../index';

/** Badge demo string labels — the short, user-visible UI badges an end-user
 *  reads. Numeric values, Material Symbols icon names, proper-noun/sample data,
 *  and the dedicated Localization / RTL / Accessibility showcases (which carry
 *  their own inline per-locale content) stay byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'badge.new': { 'en-US': 'NEW', 'ar-SA': 'جديد', 'he-IL': 'חדש', 'ja-JP': '新着', 'de-DE': 'NEU', 'fr-FR': 'NOUVEAU', 'zh-CN': '新' },
  'badge.sale': { 'en-US': 'SALE', 'ar-SA': 'خصم', 'he-IL': 'מבצע', 'ja-JP': 'セール', 'de-DE': 'Angebot', 'fr-FR': 'PROMO', 'zh-CN': '促销' },
  'badge.beta': { 'en-US': 'BETA', 'ar-SA': 'بيتا', 'he-IL': 'בטא', 'ja-JP': 'ベータ', 'de-DE': 'Beta', 'fr-FR': 'Bêta', 'zh-CN': '测试' },
};
