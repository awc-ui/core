import type { Entry } from '../index';

/** Loading Indicator demo strings — the user-visible app content shown beside a
 *  spinner in the "In Context" scenarios (loading messages + list rows). The
 *  labelStyle demo captions (variant/size names like "Uncontained", "Small
 *  (32px)", "Page loading"), the Accessibility documentation prose + aria-label
 *  props, and the dedicated RTL showcase (its own inline Arabic content) stay
 *  byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'loading.loading-content': { 'en-US': 'Loading content…', 'ar-SA': 'جارٍ تحميل المحتوى…', 'he-IL': 'טוען תוכן…', 'ja-JP': 'コンテンツを読み込み中…', 'de-DE': 'Inhalt wird geladen…', 'fr-FR': 'Chargement du contenu…', 'zh-CN': '正在加载内容…' },
  'loading.fetching-results': { 'en-US': 'Fetching results…', 'ar-SA': 'جارٍ جلب النتائج…', 'he-IL': 'מאחזר תוצאות…', 'ja-JP': '結果を取得中…', 'de-DE': 'Ergebnisse werden abgerufen…', 'fr-FR': 'Récupération des résultats…', 'zh-CN': '正在获取结果…' },
  'loading.list-item-one': { 'en-US': 'List item one', 'ar-SA': 'عنصر القائمة الأول', 'he-IL': 'פריט רשימה ראשון', 'ja-JP': 'リスト項目 1', 'de-DE': 'Listenelement eins', 'fr-FR': 'Élément de liste un', 'zh-CN': '列表项一' },
  'loading.list-item-two': { 'en-US': 'List item two', 'ar-SA': 'عنصر القائمة الثاني', 'he-IL': 'פריט רשימה שני', 'ja-JP': 'リスト項目 2', 'de-DE': 'Listenelement zwei', 'fr-FR': 'Élément de liste deux', 'zh-CN': '列表项二' },
};
