import type { Entry } from '../index';

/** Demo strings for the App Bar stories. Only the user-facing visible copy is
 *  localized: headlines, subtitles and the inline search-field placeholders that
 *  represent real app content. The `Search`/`Settings` placeholders reuse the
 *  shared verbs from `common.ts`. Left as-is: icon-button `aria-label`s
 *  (accessible names, not visible text), the CSS-demo documentation headlines
 *  (`Resting surface`, `Ocean preset`, `CSS parts tour`, …) that explain the
 *  component, and the intentional static RTL (Arabic) / pseudo-localization /
 *  long-German locale demos in the RTL and Localization stories. */
export const messages: Record<string, Entry> = {
  'appbar.inbox': { 'en-US': 'Inbox', 'ar-SA': 'البريد الوارد', 'he-IL': 'דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'appbar.unreadMessages': { 'en-US': '12 unread messages', 'ar-SA': '١٢ رسالة غير مقروءة', 'he-IL': '12 הודעות שלא נקראו', 'ja-JP': '未読メッセージ 12 件', 'de-DE': '12 ungelesene Nachrichten', 'fr-FR': '12 messages non lus', 'zh-CN': '12 条未读消息' },
  'appbar.unreadShort': { 'en-US': '12 unread', 'ar-SA': '١٢ غير مقروءة', 'he-IL': '12 שלא נקראו', 'ja-JP': '未読 12 件', 'de-DE': '12 ungelesen', 'fr-FR': '12 non lus', 'zh-CN': '12 条未读' },
  'appbar.products': { 'en-US': 'Products', 'ar-SA': 'المنتجات', 'he-IL': 'מוצרים', 'ja-JP': '製品', 'de-DE': 'Produkte', 'fr-FR': 'Produits', 'zh-CN': '产品' },
  'appbar.browseCatalog': { 'en-US': 'Browse catalog', 'ar-SA': 'تصفح الكتالوج', 'he-IL': 'עיון בקטלוג', 'ja-JP': 'カタログを見る', 'de-DE': 'Katalog durchsuchen', 'fr-FR': 'Parcourir le catalogue', 'zh-CN': '浏览目录' },
  'appbar.searchProducts': { 'en-US': 'Search products', 'ar-SA': 'البحث عن المنتجات', 'he-IL': 'חיפוש מוצרים', 'ja-JP': '製品を検索', 'de-DE': 'Produkte suchen', 'fr-FR': 'Rechercher des produits', 'zh-CN': '搜索产品' },
  'appbar.pageTitle': { 'en-US': 'Page title', 'ar-SA': 'عنوان الصفحة', 'he-IL': 'כותרת הדף', 'ja-JP': 'ページタイトル', 'de-DE': 'Seitentitel', 'fr-FR': 'Titre de la page', 'zh-CN': '页面标题' },
  'appbar.subtitle': { 'en-US': 'Subtitle', 'ar-SA': 'عنوان فرعي', 'he-IL': 'כותרת משנה', 'ja-JP': 'サブタイトル', 'de-DE': 'Untertitel', 'fr-FR': 'Sous-titre', 'zh-CN': '副标题' },
};
