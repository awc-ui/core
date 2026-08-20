import type { Entry } from '../index';

/** FAB demo strings — only the VISIBLE extended-FAB `label` text an end-user
 *  reads. Per the established convention (see MdIconButton / MdAppBar), the
 *  icon-only FABs' `aria-label` accessible names stay byte-for-byte and are NOT
 *  localized here, as do technical enum/size/variant labels, Material Symbols
 *  icon names, the demo section headings and documentation prose, the event-log
 *  placeholders, and the inline per-locale Localization / RTL showcases. The
 *  shared verb `edit` comes from common.ts and is not redefined here. */
export const messages: Record<string, Entry> = {
  'fab.create': { 'en-US': 'Create', 'ar-SA': 'إنشاء', 'he-IL': 'יצירה', 'ja-JP': '作成', 'de-DE': 'Erstellen', 'fr-FR': 'Créer', 'zh-CN': '创建' },
  'fab.reroute': { 'en-US': 'Reroute', 'ar-SA': 'تغيير المسار', 'he-IL': 'שינוי מסלול', 'ja-JP': '経路変更', 'de-DE': 'Route ändern', 'fr-FR': 'Nouvel itinéraire', 'zh-CN': '重新规划路线' },
  'fab.navigate': { 'en-US': 'Navigate', 'ar-SA': 'تنقل', 'he-IL': 'ניווט', 'ja-JP': 'ナビゲート', 'de-DE': 'Navigieren', 'fr-FR': 'Naviguer', 'zh-CN': '导航' },
  'fab.bookmark': { 'en-US': 'Bookmark', 'ar-SA': 'إشارة مرجعية', 'he-IL': 'סימנייה', 'ja-JP': 'ブックマーク', 'de-DE': 'Lesezeichen', 'fr-FR': 'Signet', 'zh-CN': '书签' },
  'fab.extended': { 'en-US': 'Extended', 'ar-SA': 'موسّع', 'he-IL': 'מורחב', 'ja-JP': '拡張', 'de-DE': 'Erweitert', 'fr-FR': 'Étendu', 'zh-CN': '扩展' },
  'fab.celebrate': { 'en-US': 'Celebrate', 'ar-SA': 'احتفال', 'he-IL': 'חגיגה', 'ja-JP': 'お祝い', 'de-DE': 'Feiern', 'fr-FR': 'Célébrer', 'zh-CN': '庆祝' },
  'fab.compose': { 'en-US': 'Compose', 'ar-SA': 'كتابة', 'he-IL': 'כתיבה', 'ja-JP': '作成', 'de-DE': 'Verfassen', 'fr-FR': 'Rédiger', 'zh-CN': '撰写' },
};
