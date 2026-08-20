import type { Entry } from '../index';

/** Checkbox demo strings — the user-facing option labels, group legends and
 *  supporting/error copy an end-user reads beside each checkbox. State/variant
 *  captions (Unchecked/Checked/Indeterminate/Enabled/Disabled/Soft-disabled,
 *  Error/Brand/Large/Round/Shadow), the behavioural-demo controls and event
 *  logs (Uncontrolled/Controlled/Programmatic/Event Emitters), developer/API
 *  prose, and the intentional static RTL / Localization / Responsiveness
 *  showcases (which carry their own inline per-locale content) stay
 *  byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'checkbox.acceptTerms': { 'en-US': 'Accept terms and conditions', 'ar-SA': 'أوافق على الشروط والأحكام', 'he-IL': 'אני מסכים לתנאים ולהגבלות', 'ja-JP': '利用規約に同意する', 'de-DE': 'Allgemeine Geschäftsbedingungen akzeptieren', 'fr-FR': 'Accepter les conditions générales', 'zh-CN': '接受条款和条件' },
  'checkbox.subscribeNewsletter': { 'en-US': 'Subscribe to newsletter', 'ar-SA': 'الاشتراك في النشرة الإخبارية', 'he-IL': 'הרשמה לניוזלטר', 'ja-JP': 'ニュースレターを購読する', 'de-DE': 'Newsletter abonnieren', 'fr-FR': 'S\'abonner à la newsletter', 'zh-CN': '订阅新闻通讯' },
  'checkbox.unavailableOption': { 'en-US': 'Unavailable option', 'ar-SA': 'خيار غير متاح', 'he-IL': 'אפשרות לא זמינה', 'ja-JP': '利用できないオプション', 'de-DE': 'Nicht verfügbare Option', 'fr-FR': 'Option indisponible', 'zh-CN': '不可用选项' },

  'checkbox.selectToppings': { 'en-US': 'Select toppings', 'ar-SA': 'اختر الإضافات', 'he-IL': 'בחירת תוספות', 'ja-JP': 'トッピングを選択', 'de-DE': 'Beläge auswählen', 'fr-FR': 'Choisir les garnitures', 'zh-CN': '选择配料' },
  'checkbox.pepperoni': { 'en-US': 'Pepperoni', 'ar-SA': 'بيبروني', 'he-IL': 'פפרוני', 'ja-JP': 'ペパロニ', 'de-DE': 'Pepperoni', 'fr-FR': 'Pepperoni', 'zh-CN': '意大利辣香肠' },
  'checkbox.mushrooms': { 'en-US': 'Mushrooms', 'ar-SA': 'فطر', 'he-IL': 'פטריות', 'ja-JP': 'マッシュルーム', 'de-DE': 'Champignons', 'fr-FR': 'Champignons', 'zh-CN': '蘑菇' },
  'checkbox.olives': { 'en-US': 'Olives', 'ar-SA': 'زيتون', 'he-IL': 'זיתים', 'ja-JP': 'オリーブ', 'de-DE': 'Oliven', 'fr-FR': 'Olives', 'zh-CN': '橄榄' },
  'checkbox.onions': { 'en-US': 'Onions', 'ar-SA': 'بصل', 'he-IL': 'בצל', 'ja-JP': '玉ねぎ', 'de-DE': 'Zwiebeln', 'fr-FR': 'Oignons', 'zh-CN': '洋葱' },
  'checkbox.bellPeppers': { 'en-US': 'Bell Peppers', 'ar-SA': 'فلفل حلو', 'he-IL': 'פלפלים', 'ja-JP': 'パプリカ', 'de-DE': 'Paprika', 'fr-FR': 'Poivrons', 'zh-CN': '甜椒' },

  'checkbox.installOptions': { 'en-US': 'Install options', 'ar-SA': 'خيارات التثبيت', 'he-IL': 'אפשרויות התקנה', 'ja-JP': 'インストールオプション', 'de-DE': 'Installationsoptionen', 'fr-FR': 'Options d\'installation', 'zh-CN': '安装选项' },
  'checkbox.selectAll': { 'en-US': 'Select all', 'ar-SA': 'تحديد الكل', 'he-IL': 'בחר הכול', 'ja-JP': 'すべて選択', 'de-DE': 'Alle auswählen', 'fr-FR': 'Tout sélectionner', 'zh-CN': '全选' },
  'checkbox.documentation': { 'en-US': 'Documentation', 'ar-SA': 'التوثيق', 'he-IL': 'תיעוד', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokumentation', 'fr-FR': 'Documentation', 'zh-CN': '文档' },
  'checkbox.codeSamples': { 'en-US': 'Code samples', 'ar-SA': 'نماذج التعليمات البرمجية', 'he-IL': 'דוגמאות קוד', 'ja-JP': 'コードサンプル', 'de-DE': 'Codebeispiele', 'fr-FR': 'Exemples de code', 'zh-CN': '代码示例' },
  'checkbox.developerTools': { 'en-US': 'Developer tools', 'ar-SA': 'أدوات المطور', 'he-IL': 'כלי פיתוח', 'ja-JP': '開発者ツール', 'de-DE': 'Entwicklertools', 'fr-FR': 'Outils de développement', 'zh-CN': '开发者工具' },

  'checkbox.agreeTos': { 'en-US': 'I agree to the terms of service', 'ar-SA': 'أوافق على شروط الخدمة', 'he-IL': 'אני מסכים לתנאי השירות', 'ja-JP': '利用規約に同意します', 'de-DE': 'Ich stimme den Nutzungsbedingungen zu', 'fr-FR': 'J\'accepte les conditions d\'utilisation', 'zh-CN': '我同意服务条款' },
  'checkbox.acceptPrivacy': { 'en-US': 'Accept privacy policy', 'ar-SA': 'قبول سياسة الخصوصية', 'he-IL': 'אישור מדיניות הפרטיות', 'ja-JP': 'プライバシーポリシーに同意する', 'de-DE': 'Datenschutzrichtlinie akzeptieren', 'fr-FR': 'Accepter la politique de confidentialité', 'zh-CN': '接受隐私政策' },
  'checkbox.privacyRequired': { 'en-US': 'You must accept the privacy policy before continuing.', 'ar-SA': 'يجب عليك قبول سياسة الخصوصية قبل المتابعة.', 'he-IL': 'עליך לאשר את מדיניות הפרטיות לפני שתמשיך.', 'ja-JP': '続行する前にプライバシーポリシーに同意する必要があります。', 'de-DE': 'Sie müssen die Datenschutzrichtlinie akzeptieren, bevor Sie fortfahren.', 'fr-FR': 'Vous devez accepter la politique de confidentialité avant de continuer.', 'zh-CN': '您必须先接受隐私政策才能继续。' },
  'checkbox.notificationPreferences': { 'en-US': 'Notification preferences', 'ar-SA': 'تفضيلات الإشعارات', 'he-IL': 'העדפות התראות', 'ja-JP': '通知設定', 'de-DE': 'Benachrichtigungseinstellungen', 'fr-FR': 'Préférences de notification', 'zh-CN': '通知偏好设置' },
  'checkbox.emailNotifications': { 'en-US': 'Email notifications', 'ar-SA': 'إشعارات البريد الإلكتروني', 'he-IL': 'התראות באימייל', 'ja-JP': 'メール通知', 'de-DE': 'E-Mail-Benachrichtigungen', 'fr-FR': 'Notifications par e-mail', 'zh-CN': '电子邮件通知' },
  'checkbox.smsNotifications': { 'en-US': 'SMS notifications', 'ar-SA': 'إشعارات الرسائل النصية', 'he-IL': 'התראות SMS', 'ja-JP': 'SMS通知', 'de-DE': 'SMS-Benachrichtigungen', 'fr-FR': 'Notifications par SMS', 'zh-CN': '短信通知' },
  'checkbox.pushNotifications': { 'en-US': 'Push notifications', 'ar-SA': 'الإشعارات الفورية', 'he-IL': 'התראות דחיפה', 'ja-JP': 'プッシュ通知', 'de-DE': 'Push-Benachrichtigungen', 'fr-FR': 'Notifications push', 'zh-CN': '推送通知' },
};
