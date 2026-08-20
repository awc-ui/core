import type { Entry } from '../index';

/** Demo strings for the Foundation/Icons stories. Only the user-facing labels
 *  in the "Icons in Components" demo are localized; icon names, size annotations
 *  and the developer usage notes stay in English. The FAB's "Edit" label reuses
 *  the shared `edit` verb from `common.ts`. */
export const messages: Record<string, Entry> = {
  'icons.addItem': { 'en-US': 'Add Item', 'ar-SA': 'إضافة عنصر', 'he-IL': 'הוספת פריט', 'ja-JP': 'アイテムを追加', 'de-DE': 'Element hinzufügen', 'fr-FR': 'Ajouter un élément', 'zh-CN': '添加项目' },
  'icons.download': { 'en-US': 'Download', 'ar-SA': 'تنزيل', 'he-IL': 'הורדה', 'ja-JP': 'ダウンロード', 'de-DE': 'Herunterladen', 'fr-FR': 'Télécharger', 'zh-CN': '下载' },
  'icons.share': { 'en-US': 'Share', 'ar-SA': 'مشاركة', 'he-IL': 'שיתוף', 'ja-JP': '共有', 'de-DE': 'Teilen', 'fr-FR': 'Partager', 'zh-CN': '分享' },
  'icons.favorite': { 'en-US': 'Favorite', 'ar-SA': 'المفضلة', 'he-IL': 'מועדף', 'ja-JP': 'お気に入り', 'de-DE': 'Favorit', 'fr-FR': 'Favori', 'zh-CN': '收藏' },
  'icons.bookmark': { 'en-US': 'Bookmark', 'ar-SA': 'إشارة مرجعية', 'he-IL': 'סימנייה', 'ja-JP': 'ブックマーク', 'de-DE': 'Lesezeichen', 'fr-FR': 'Signet', 'zh-CN': '书签' },
  'icons.moreOptions': { 'en-US': 'More options', 'ar-SA': 'المزيد من الخيارات', 'he-IL': 'אפשרויות נוספות', 'ja-JP': 'その他のオプション', 'de-DE': 'Weitere Optionen', 'fr-FR': "Plus d'options", 'zh-CN': '更多选项' },
  'icons.notifications': { 'en-US': 'Notifications', 'ar-SA': 'الإشعارات', 'he-IL': 'התראות', 'ja-JP': '通知', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Notifications', 'zh-CN': '通知' },
};
