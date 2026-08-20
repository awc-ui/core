import type { Entry } from '../index';

/** Demo strings for the md-select stories. Keys are namespaced under `select.`.
 *  Shared verbs (e.g. `submit`) come from `common.ts` — do not redefine them. */
export const messages: Record<string, Entry> = {
  // Field labels
  'select.colour': { 'en-US': 'Colour', 'ar-SA': 'اللون', 'he-IL': 'צבע', 'ja-JP': '色', 'de-DE': 'Farbe', 'fr-FR': 'Couleur', 'zh-CN': '颜色' },
  'select.country': { 'en-US': 'Country', 'ar-SA': 'الدولة', 'he-IL': 'מדינה', 'ja-JP': '国', 'de-DE': 'Land', 'fr-FR': 'Pays', 'zh-CN': '国家' },
  'select.account': { 'en-US': 'Account', 'ar-SA': 'الحساب', 'he-IL': 'חשבון', 'ja-JP': 'アカウント', 'de-DE': 'Konto', 'fr-FR': 'Compte', 'zh-CN': '账户' },
  'select.fruit': { 'en-US': 'Fruit', 'ar-SA': 'فاكهة', 'he-IL': 'פרי', 'ja-JP': '果物', 'de-DE': 'Obst', 'fr-FR': 'Fruit', 'zh-CN': '水果' },
  'select.month': { 'en-US': 'Month', 'ar-SA': 'الشهر', 'he-IL': 'חודש', 'ja-JP': '月', 'de-DE': 'Monat', 'fr-FR': 'Mois', 'zh-CN': '月份' },
  'select.option': { 'en-US': 'Option', 'ar-SA': 'خيار', 'he-IL': 'אפשרות', 'ja-JP': 'オプション', 'de-DE': 'Option', 'fr-FR': 'Option', 'zh-CN': '选项' },
  'select.item': { 'en-US': 'Item', 'ar-SA': 'عنصر', 'he-IL': 'פריט', 'ja-JP': 'アイテム', 'de-DE': 'Element', 'fr-FR': 'Élément', 'zh-CN': '项目' },
  'select.priority': { 'en-US': 'Priority', 'ar-SA': 'الأولوية', 'he-IL': 'עדיפות', 'ja-JP': '優先度', 'de-DE': 'Priorität', 'fr-FR': 'Priorité', 'zh-CN': '优先级' },
  'select.sort': { 'en-US': 'Sort', 'ar-SA': 'ترتيب', 'he-IL': 'מיון', 'ja-JP': '並べ替え', 'de-DE': 'Sortierung', 'fr-FR': 'Trier', 'zh-CN': '排序' },
  'select.firstName': { 'en-US': 'First name', 'ar-SA': 'الاسم الأول', 'he-IL': 'שם פרטי', 'ja-JP': '名', 'de-DE': 'Vorname', 'fr-FR': 'Prénom', 'zh-CN': '名字' },
  'select.lastName': { 'en-US': 'Last name', 'ar-SA': 'اسم العائلة', 'he-IL': 'שם משפחה', 'ja-JP': '姓', 'de-DE': 'Nachname', 'fr-FR': 'Nom', 'zh-CN': '姓氏' },

  // Placeholders
  'select.choose': { 'en-US': 'Choose', 'ar-SA': 'اختر', 'he-IL': 'בחירה', 'ja-JP': '選択', 'de-DE': 'Auswählen', 'fr-FR': 'Choisir', 'zh-CN': '选择' },
  'select.loadingAccounts': { 'en-US': 'Loading accounts…', 'ar-SA': 'جارٍ تحميل الحسابات…', 'he-IL': 'טוען חשבונות…', 'ja-JP': 'アカウントを読み込み中…', 'de-DE': 'Konten werden geladen…', 'fr-FR': 'Chargement des comptes…', 'zh-CN': '正在加载账户…' },
  'select.fetching': { 'en-US': 'Fetching…', 'ar-SA': 'جارٍ الجلب…', 'he-IL': 'מאחזר…', 'ja-JP': '取得中…', 'de-DE': 'Wird abgerufen…', 'fr-FR': 'Récupération…', 'zh-CN': '正在获取…' },

  // Colour option labels
  'select.red': { 'en-US': 'Red', 'ar-SA': 'أحمر', 'he-IL': 'אדום', 'ja-JP': '赤', 'de-DE': 'Rot', 'fr-FR': 'Rouge', 'zh-CN': '红色' },
  'select.green': { 'en-US': 'Green', 'ar-SA': 'أخضر', 'he-IL': 'ירוק', 'ja-JP': '緑', 'de-DE': 'Grün', 'fr-FR': 'Vert', 'zh-CN': '绿色' },
  'select.blue': { 'en-US': 'Blue', 'ar-SA': 'أزرق', 'he-IL': 'כחול', 'ja-JP': '青', 'de-DE': 'Blau', 'fr-FR': 'Bleu', 'zh-CN': '蓝色' },
  'select.purple': { 'en-US': 'Purple', 'ar-SA': 'بنفسجي', 'he-IL': 'סגול', 'ja-JP': '紫', 'de-DE': 'Lila', 'fr-FR': 'Violet', 'zh-CN': '紫色' },

  // Fruit option labels
  'select.apple': { 'en-US': 'Apple', 'ar-SA': 'تفاحة', 'he-IL': 'תפוח', 'ja-JP': 'りんご', 'de-DE': 'Apfel', 'fr-FR': 'Pomme', 'zh-CN': '苹果' },
  'select.kiwi': { 'en-US': 'Kiwi', 'ar-SA': 'كيوي', 'he-IL': 'קיווי', 'ja-JP': 'キウイ', 'de-DE': 'Kiwi', 'fr-FR': 'Kiwi', 'zh-CN': '猕猴桃' },
  'select.watermelon': { 'en-US': 'Watermelon', 'ar-SA': 'بطيخ', 'he-IL': 'אבטיח', 'ja-JP': 'スイカ', 'de-DE': 'Wassermelone', 'fr-FR': 'Pastèque', 'zh-CN': '西瓜' },

  // Account-type option labels
  'select.checking': { 'en-US': 'Checking', 'ar-SA': 'حساب جارٍ', 'he-IL': 'עובר ושב', 'ja-JP': '当座預金', 'de-DE': 'Girokonto', 'fr-FR': 'Compte courant', 'zh-CN': '支票账户' },
  'select.savings': { 'en-US': 'Savings', 'ar-SA': 'حساب توفير', 'he-IL': 'חיסכון', 'ja-JP': '普通預金', 'de-DE': 'Sparkonto', 'fr-FR': 'Épargne', 'zh-CN': '储蓄账户' },
  'select.creditCard': { 'en-US': 'Credit card', 'ar-SA': 'بطاقة ائتمان', 'he-IL': 'כרטיס אשראי', 'ja-JP': 'クレジットカード', 'de-DE': 'Kreditkarte', 'fr-FR': 'Carte de crédit', 'zh-CN': '信用卡' },

  // Priority option labels
  'select.low': { 'en-US': 'Low', 'ar-SA': 'منخفضة', 'he-IL': 'נמוכה', 'ja-JP': '低', 'de-DE': 'Niedrig', 'fr-FR': 'Faible', 'zh-CN': '低' },
  'select.medium': { 'en-US': 'Medium', 'ar-SA': 'متوسطة', 'he-IL': 'בינונית', 'ja-JP': '中', 'de-DE': 'Mittel', 'fr-FR': 'Moyenne', 'zh-CN': '中' },
  'select.high': { 'en-US': 'High', 'ar-SA': 'عالية', 'he-IL': 'גבוהה', 'ja-JP': '高', 'de-DE': 'Hoch', 'fr-FR': 'Élevée', 'zh-CN': '高' },

  // Supporting / error text
  'select.selectionRequired': { 'en-US': 'Selection required', 'ar-SA': 'الاختيار مطلوب', 'he-IL': 'נדרשת בחירה', 'ja-JP': '選択が必要です', 'de-DE': 'Auswahl erforderlich', 'fr-FR': 'Sélection requise', 'zh-CN': '必须选择' },
  'select.pickFavourite': { 'en-US': 'Pick your favourite', 'ar-SA': 'اختر المفضل لديك', 'he-IL': 'בחר את המועדף עליך', 'ja-JP': 'お気に入りを選択', 'de-DE': 'Wählen Sie Ihren Favoriten', 'fr-FR': 'Choisissez votre favori', 'zh-CN': '选择你喜欢的' },

  // Event-log empty state
  'select.interactPrompt': { 'en-US': 'Interact with the select…', 'ar-SA': 'تفاعل مع القائمة…', 'he-IL': 'בצע פעולה בבורר…', 'ja-JP': 'セレクトを操作してください…', 'de-DE': 'Mit dem Select interagieren…', 'fr-FR': 'Interagissez avec le sélecteur…', 'zh-CN': '与选择器交互…' },
};
