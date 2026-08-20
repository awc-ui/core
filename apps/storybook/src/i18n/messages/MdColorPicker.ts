import type { Entry } from '../index';

/** Color-picker demo string labels — the user-visible form-field label that
 *  wraps a picker. Format/config section captions (Hex/RGB/HSL, "Hex only"),
 *  breakpoint labels, the event-log placeholder, hex/rgb/hsl sample values,
 *  CSS custom-property docs, and Material palette data stay byte-for-byte in
 *  the story (technical enum values / documentation, not end-user content). */
export const messages: Record<string, Entry> = {
  'color-picker.brand-color': { 'en-US': 'Brand color', 'ar-SA': 'لون العلامة التجارية', 'he-IL': 'צבע המותג', 'ja-JP': 'ブランドカラー', 'de-DE': 'Markenfarbe', 'fr-FR': 'Couleur de la marque', 'zh-CN': '品牌颜色' },
};
