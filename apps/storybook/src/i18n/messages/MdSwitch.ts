import type { Entry } from '../index';

/** Switch demo strings — genuine product-UI labels shown next to switches
 *  (settings/form labels, a confirm prompt). Config-descriptor captions,
 *  CSS-demo labels, and API/debug scaffolding stay untranslated. Shared verbs
 *  (submit, …) come from common.ts. */
export const messages: Record<string, Entry> = {
  'switch.airplaneMode': { 'en-US': 'Airplane mode', 'ar-SA': 'وضع الطيران', 'he-IL': 'מצב טיסה', 'ja-JP': '機内モード', 'de-DE': 'Flugmodus', 'fr-FR': 'Mode avion', 'zh-CN': '飞行模式' },
  'switch.notifications': { 'en-US': 'Notifications', 'ar-SA': 'الإشعارات', 'he-IL': 'התראות', 'ja-JP': '通知', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Notifications', 'zh-CN': '通知' },
  'switch.lockedSetting': { 'en-US': 'Locked setting', 'ar-SA': 'إعداد مقفل', 'he-IL': 'הגדרה נעולה', 'ja-JP': 'ロックされた設定', 'de-DE': 'Gesperrte Einstellung', 'fr-FR': 'Paramètre verrouillé', 'zh-CN': '锁定的设置' },
  'switch.dangerousSetting': { 'en-US': 'Dangerous setting', 'ar-SA': 'إعداد خطير', 'he-IL': 'הגדרה מסוכנת', 'ja-JP': '危険な設定', 'de-DE': 'Gefährliche Einstellung', 'fr-FR': 'Paramètre dangereux', 'zh-CN': '危险的设置' },
  'switch.enableConfirm': { 'en-US': 'Enable this setting?', 'ar-SA': 'تفعيل هذا الإعداد؟', 'he-IL': 'להפעיל הגדרה זו?', 'ja-JP': 'この設定を有効にしますか？', 'de-DE': 'Diese Einstellung aktivieren?', 'fr-FR': 'Activer ce paramètre ?', 'zh-CN': '启用此设置？' },
  'switch.emailNotifications': { 'en-US': 'Email notifications', 'ar-SA': 'إشعارات البريد الإلكتروني', 'he-IL': 'התראות אימייל', 'ja-JP': 'メール通知', 'de-DE': 'E-Mail-Benachrichtigungen', 'fr-FR': 'Notifications par e-mail', 'zh-CN': '电子邮件通知' },
  'switch.smsNotifications': { 'en-US': 'SMS notifications', 'ar-SA': 'إشعارات الرسائل النصية', 'he-IL': 'התראות SMS', 'ja-JP': 'SMS通知', 'de-DE': 'SMS-Benachrichtigungen', 'fr-FR': 'Notifications par SMS', 'zh-CN': '短信通知' },
  'switch.marketingEmails': { 'en-US': 'Marketing emails', 'ar-SA': 'رسائل تسويقية', 'he-IL': 'אימיילים שיווקיים', 'ja-JP': 'マーケティングメール', 'de-DE': 'Marketing-E-Mails', 'fr-FR': 'E-mails marketing', 'zh-CN': '营销邮件' },
  'switch.reset': { 'en-US': 'Reset', 'ar-SA': 'إعادة تعيين', 'he-IL': 'איפוס', 'ja-JP': 'リセット', 'de-DE': 'Zurücksetzen', 'fr-FR': 'Réinitialiser', 'zh-CN': '重置' },
};
