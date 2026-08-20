import type { Entry } from '../index';

/** Icon Button demo strings. Icon buttons are icon-only, so their labels live in
 *  `aria-label` — accessible names, which (per the established convention, see
 *  MdAppBar) stay byte-for-byte and are NOT localized here. The only genuine
 *  visible content in the stories is the placeholder document title in the
 *  Responsiveness toolbar demo (mirrors MdAppBar's translated `Page title`).
 *  Everything else — technical enum/size/shape/variant labels, the demo section
 *  headings and documentation prose, the event-log placeholders, and the inline
 *  per-locale Localization / RTL showcases — is left as-is in the story. */
export const messages: Record<string, Entry> = {
  'icon-button.documentTitle': { 'en-US': 'Document title', 'ar-SA': 'عنوان المستند', 'he-IL': 'כותרת המסמך', 'ja-JP': 'ドキュメントタイトル', 'de-DE': 'Dokumenttitel', 'fr-FR': 'Titre du document', 'zh-CN': '文档标题' },
};
