import type { Entry } from '../index';

/** Radio demo strings — the user-facing option labels, group legends and
 *  supporting copy an end-user reads beside each radio. State/variant captions
 *  (Unchecked/Checked/Disabled/Soft-disabled, Default/Error/Brand/Large), the
 *  behavioural-demo controls and event logs (Event demo Alpha/Beta/Gamma,
 *  Programmatic First/Second/Third + select()/setFocus() button copy),
 *  ::part()/CSS-var demo captions, developer/API prose, and the intentional
 *  static RTL / Localization / DarkTheme showcases (which carry their own inline
 *  per-locale or theme-test content) stay byte-for-byte in the story. Brand
 *  names (Wi-Fi, Bluetooth) and universal size codes (S/M/L/XL) are also left
 *  as-is. */
export const messages: Record<string, Entry> = {
  'radio.labelText': { 'en-US': 'Label text', 'ar-SA': 'نص التسمية', 'he-IL': 'טקסט תווית', 'ja-JP': 'ラベルテキスト', 'de-DE': 'Beschriftungstext', 'fr-FR': 'Texte du libellé', 'zh-CN': '标签文本' },

  'radio.favoriteFruit': { 'en-US': 'Favorite fruit', 'ar-SA': 'الفاكهة المفضلة', 'he-IL': 'פרי אהוב', 'ja-JP': '好きな果物', 'de-DE': 'Lieblingsobst', 'fr-FR': 'Fruit préféré', 'zh-CN': '喜欢的水果' },
  'radio.apple': { 'en-US': 'Apple', 'ar-SA': 'تفاح', 'he-IL': 'תפוח', 'ja-JP': 'リンゴ', 'de-DE': 'Apfel', 'fr-FR': 'Pomme', 'zh-CN': '苹果' },
  'radio.banana': { 'en-US': 'Banana', 'ar-SA': 'موز', 'he-IL': 'בננה', 'ja-JP': 'バナナ', 'de-DE': 'Banane', 'fr-FR': 'Banane', 'zh-CN': '香蕉' },
  'radio.cherry': { 'en-US': 'Cherry', 'ar-SA': 'كرز', 'he-IL': 'דובדבן', 'ja-JP': 'サクランボ', 'de-DE': 'Kirsche', 'fr-FR': 'Cerise', 'zh-CN': '樱桃' },
  'radio.dragonfruit': { 'en-US': 'Dragonfruit', 'ar-SA': 'فاكهة التنين', 'he-IL': 'פרי דרקון', 'ja-JP': 'ドラゴンフルーツ', 'de-DE': 'Drachenfrucht', 'fr-FR': 'Fruit du dragon', 'zh-CN': '火龙果' },

  'radio.shippingMethod': { 'en-US': 'Shipping method', 'ar-SA': 'طريقة الشحن', 'he-IL': 'שיטת משלוח', 'ja-JP': '配送方法', 'de-DE': 'Versandart', 'fr-FR': 'Méthode de livraison', 'zh-CN': '配送方式' },
  'radio.standard': { 'en-US': 'Standard', 'ar-SA': 'قياسي', 'he-IL': 'רגיל', 'ja-JP': '通常', 'de-DE': 'Standard', 'fr-FR': 'Standard', 'zh-CN': '标准' },
  'radio.standardDesc': { 'en-US': '5-7 business days', 'ar-SA': '5-7 أيام عمل', 'he-IL': '5-7 ימי עסקים', 'ja-JP': '5-7 営業日', 'de-DE': '5-7 Werktage', 'fr-FR': '5-7 jours ouvrés', 'zh-CN': '5-7 个工作日' },
  'radio.express': { 'en-US': 'Express', 'ar-SA': 'سريع', 'he-IL': 'מהיר', 'ja-JP': '速達', 'de-DE': 'Express', 'fr-FR': 'Express', 'zh-CN': '快速' },
  'radio.expressDesc': { 'en-US': '2-3 business days', 'ar-SA': '2-3 أيام عمل', 'he-IL': '2-3 ימי עסקים', 'ja-JP': '2-3 営業日', 'de-DE': '2-3 Werktage', 'fr-FR': '2-3 jours ouvrés', 'zh-CN': '2-3 个工作日' },
  'radio.overnight': { 'en-US': 'Overnight', 'ar-SA': 'ليلي', 'he-IL': 'בן לילה', 'ja-JP': '翌日', 'de-DE': 'Über Nacht', 'fr-FR': 'De nuit', 'zh-CN': '隔夜达' },
  'radio.overnightDesc': { 'en-US': 'Next business day', 'ar-SA': 'يوم العمل التالي', 'he-IL': 'יום העסקים הבא', 'ja-JP': '翌営業日', 'de-DE': 'Nächster Werktag', 'fr-FR': 'Jour ouvré suivant', 'zh-CN': '下一个工作日' },

  'radio.size': { 'en-US': 'Size', 'ar-SA': 'المقاس', 'he-IL': 'מידה', 'ja-JP': 'サイズ', 'de-DE': 'Größe', 'fr-FR': 'Taille', 'zh-CN': '尺码' },

  'radio.connections': { 'en-US': 'Connections', 'ar-SA': 'الاتصالات', 'he-IL': 'חיבורים', 'ja-JP': '接続', 'de-DE': 'Verbindungen', 'fr-FR': 'Connexions', 'zh-CN': '连接' },
  'radio.wifiDesc': { 'en-US': 'Connect to a wireless network', 'ar-SA': 'الاتصال بشبكة لاسلكية', 'he-IL': 'התחברות לרשת אלחוטית', 'ja-JP': 'ワイヤレスネットワークに接続', 'de-DE': 'Mit einem WLAN verbinden', 'fr-FR': 'Se connecter à un réseau sans fil', 'zh-CN': '连接到无线网络' },
  'radio.bluetoothDesc': { 'en-US': 'Pair with nearby devices', 'ar-SA': 'الإقران بالأجهزة القريبة', 'he-IL': 'צימוד עם מכשירים סמוכים', 'ja-JP': '近くのデバイスとペアリング', 'de-DE': 'Mit Geräten in der Nähe koppeln', 'fr-FR': 'Associer des appareils à proximité', 'zh-CN': '与附近的设备配对' },
  'radio.mobileData': { 'en-US': 'Mobile data', 'ar-SA': 'بيانات الجوال', 'he-IL': 'נתונים סלולריים', 'ja-JP': 'モバイルデータ', 'de-DE': 'Mobile Daten', 'fr-FR': 'Données mobiles', 'zh-CN': '移动数据' },
  'radio.mobileDataDesc': { 'en-US': 'Use your carrier\'s data connection', 'ar-SA': 'استخدام اتصال البيانات الخاص بمشغل الشبكة', 'he-IL': 'שימוש בחיבור הנתונים של הספק שלך', 'ja-JP': '通信事業者のデータ接続を使用', 'de-DE': 'Datenverbindung Ihres Mobilfunkanbieters verwenden', 'fr-FR': 'Utiliser la connexion de données de votre opérateur', 'zh-CN': '使用运营商的数据连接' },
};
