import type { Entry } from '../index';

/** Demo strings for the Search stories. Only genuine, visible user-facing search
 *  chrome is localized: the plain "Search" placeholders (via the shared `search`
 *  verb from `common.ts`), the "Search animals" / "Search products" bar
 *  placeholders, the voice-query supporting line, and the empty-state
 *  no-results label. Everything else stays byte-for-byte: sample product /
 *  catalogue data (Wireless headphones, USB-C cable…) and email content (Eli,
 *  Adopt a pup?…), demo-mechanic placeholders that describe a CSS / motion demo
 *  (Hover / press me, 64dp tall, Rounded, Level 0…), CSS / ::part() / Icons
 *  demo labels and aria-labels, the developer prose + section headings, the
 *  imperative async-bootstrap status/log text, and the intentional static
 *  Localization + RTL locale demos. */
export const messages: Record<string, Entry> = {
  'search.searchAnimals': { 'en-US': 'Search animals', 'ar-SA': 'البحث عن الحيوانات', 'he-IL': 'חיפוש בעלי חיים', 'ja-JP': '動物を検索', 'de-DE': 'Tiere suchen', 'fr-FR': 'Rechercher des animaux', 'zh-CN': '搜索动物' },
  'search.searchProducts': { 'en-US': 'Search products', 'ar-SA': 'البحث عن المنتجات', 'he-IL': 'חיפוש מוצרים', 'ja-JP': '商品を検索', 'de-DE': 'Produkte suchen', 'fr-FR': 'Rechercher des produits', 'zh-CN': '搜索商品' },
  'search.noProductsMatch': { 'en-US': 'No products match', 'ar-SA': 'لا توجد منتجات مطابقة', 'he-IL': 'אין מוצרים תואמים', 'ja-JP': '一致する商品がありません', 'de-DE': 'Keine passenden Produkte', 'fr-FR': 'Aucun produit correspondant', 'zh-CN': '没有匹配的商品' },
  'search.tapMicSpeak': { 'en-US': 'Tap the mic and speak', 'ar-SA': 'انقر على الميكروفون وتحدث', 'he-IL': 'הקישו על המיקרופון ודברו', 'ja-JP': 'マイクをタップして話してください', 'de-DE': 'Auf das Mikrofon tippen und sprechen', 'fr-FR': 'Appuyez sur le micro et parlez', 'zh-CN': '点击麦克风说话' },
  'search.spokenQuery': { 'en-US': 'Spoken query', 'ar-SA': 'استعلام صوتي', 'he-IL': 'שאילתה קולית', 'ja-JP': '音声クエリ', 'de-DE': 'Gesprochene Anfrage', 'fr-FR': 'Requête vocale', 'zh-CN': '语音查询' },
};
