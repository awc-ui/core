import type { Entry } from '../index';

/** Demo strings for the Chip stories. Only genuine user-facing chip content is
 *  localized (category / action / suggestion labels). Technical enum-demo labels
 *  (Assist/Filter/Input/Suggestion, Elevated/Disabled/Selected/Enabled/
 *  Soft-disabled), CSS / ::part() demo labels (Brand/Danger/Uppercase/Dashed…),
 *  icon-mechanism labels (SVG Icon/Emoji Icon/Prop Icon), the explanatory demo
 *  prose/headings, sample data (Jane Doe, emails, Material Design), and the
 *  intentional static Arabic RTL demo all stay as-is. The "Search" chip reuses
 *  the shared `search` verb from `common.ts`. */
export const messages: Record<string, Entry> = {
  'chip.directions': { 'en-US': 'Directions', 'ar-SA': 'الاتجاهات', 'he-IL': 'מסלול', 'ja-JP': '経路', 'de-DE': 'Route', 'fr-FR': 'Itinéraire', 'zh-CN': '路线' },
  'chip.all': { 'en-US': 'All', 'ar-SA': 'الكل', 'he-IL': 'הכול', 'ja-JP': 'すべて', 'de-DE': 'Alle', 'fr-FR': 'Tout', 'zh-CN': '全部' },
  'chip.restaurants': { 'en-US': 'Restaurants', 'ar-SA': 'مطاعم', 'he-IL': 'מסעדות', 'ja-JP': 'レストラン', 'de-DE': 'Restaurants', 'fr-FR': 'Restaurants', 'zh-CN': '餐厅' },
  'chip.priceLowToHigh': { 'en-US': 'Price: Low to High', 'ar-SA': 'السعر: من الأقل إلى الأعلى', 'he-IL': 'מחיר: מהנמוך לגבוה', 'ja-JP': '価格: 安い順', 'de-DE': 'Preis: aufsteigend', 'fr-FR': 'Prix : croissant', 'zh-CN': '价格：从低到高' },
  'chip.priceHighToLow': { 'en-US': 'Price: High to Low', 'ar-SA': 'السعر: من الأعلى إلى الأقل', 'he-IL': 'מחיר: מהגבוה לנמוך', 'ja-JP': '価格: 高い順', 'de-DE': 'Preis: absteigend', 'fr-FR': 'Prix : décroissant', 'zh-CN': '价格：从高到低' },
  'chip.add': { 'en-US': 'Add', 'ar-SA': 'إضافة', 'he-IL': 'הוספה', 'ja-JP': '追加', 'de-DE': 'Hinzufügen', 'fr-FR': 'Ajouter', 'zh-CN': '添加' },
  'chip.verified': { 'en-US': 'Verified', 'ar-SA': 'موثّق', 'he-IL': 'מאומת', 'ja-JP': '認証済み', 'de-DE': 'Verifiziert', 'fr-FR': 'Vérifié', 'zh-CN': '已验证' },
  'chip.contact': { 'en-US': 'Contact', 'ar-SA': 'جهة اتصال', 'he-IL': 'איש קשר', 'ja-JP': '連絡先', 'de-DE': 'Kontakt', 'fr-FR': 'Contact', 'zh-CN': '联系人' },
  'chip.documents': { 'en-US': 'Documents', 'ar-SA': 'مستندات', 'he-IL': 'מסמכים', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokumente', 'fr-FR': 'Documents', 'zh-CN': '文档' },
  'chip.images': { 'en-US': 'Images', 'ar-SA': 'صور', 'he-IL': 'תמונות', 'ja-JP': '画像', 'de-DE': 'Bilder', 'fr-FR': 'Images', 'zh-CN': '图片' },
  'chip.videos': { 'en-US': 'Videos', 'ar-SA': 'مقاطع فيديو', 'he-IL': 'סרטונים', 'ja-JP': '動画', 'de-DE': 'Videos', 'fr-FR': 'Vidéos', 'zh-CN': '视频' },
  'chip.audio': { 'en-US': 'Audio', 'ar-SA': 'صوت', 'he-IL': 'אודיו', 'ja-JP': 'オーディオ', 'de-DE': 'Audio', 'fr-FR': 'Audio', 'zh-CN': '音频' },
  'chip.archives': { 'en-US': 'Archives', 'ar-SA': 'أرشيفات', 'he-IL': 'ארכיונים', 'ja-JP': 'アーカイブ', 'de-DE': 'Archive', 'fr-FR': 'Archives', 'zh-CN': '归档' },
  'chip.spreadsheets': { 'en-US': 'Spreadsheets', 'ar-SA': 'جداول بيانات', 'he-IL': 'גיליונות אלקטרוניים', 'ja-JP': 'スプレッドシート', 'de-DE': 'Tabellen', 'fr-FR': 'Feuilles de calcul', 'zh-CN': '电子表格' },
  'chip.presentations': { 'en-US': 'Presentations', 'ar-SA': 'عروض تقديمية', 'he-IL': 'מצגות', 'ja-JP': 'プレゼンテーション', 'de-DE': 'Präsentationen', 'fr-FR': 'Présentations', 'zh-CN': '演示文稿' },
  'chip.addToCalendar': { 'en-US': 'Add to calendar', 'ar-SA': 'إضافة إلى التقويم', 'he-IL': 'הוספה ליומן', 'ja-JP': 'カレンダーに追加', 'de-DE': 'Zum Kalender hinzufügen', 'fr-FR': 'Ajouter au calendrier', 'zh-CN': '添加到日历' },
  'chip.filters': { 'en-US': 'Filters', 'ar-SA': 'عوامل التصفية', 'he-IL': 'מסננים', 'ja-JP': 'フィルタ', 'de-DE': 'Filter', 'fr-FR': 'Filtres', 'zh-CN': '筛选' },
  'chip.newTag': { 'en-US': 'New tag', 'ar-SA': 'علامة جديدة', 'he-IL': 'תגית חדשה', 'ja-JP': '新しいタグ', 'de-DE': 'Neuer Tag', 'fr-FR': 'Nouveau tag', 'zh-CN': '新标签' },
};
