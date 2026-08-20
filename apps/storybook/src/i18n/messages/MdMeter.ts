import type { Entry } from '../index';

/** User-facing labels in the Meter demos: the meter readings shown in the
 *  Localization story (storage / battery / password strength). Namespaced
 *  under the `meter` slug. */
export const messages: Record<string, Entry> = {
  'meter.storageUsed': { 'en-US': 'Storage used', 'ar-SA': 'مساحة التخزين المستخدمة', 'he-IL': 'אחסון בשימוש', 'ja-JP': '使用済みストレージ', 'de-DE': 'Belegter Speicher', 'fr-FR': 'Stockage utilisé', 'zh-CN': '已用存储空间' },
  'meter.batteryLevel': { 'en-US': 'Battery level', 'ar-SA': 'مستوى البطارية', 'he-IL': 'רמת סוללה', 'ja-JP': 'バッテリー残量', 'de-DE': 'Akkustand', 'fr-FR': 'Niveau de batterie', 'zh-CN': '电池电量' },
  'meter.passwordStrength': { 'en-US': 'Password strength', 'ar-SA': 'قوة كلمة المرور', 'he-IL': 'חוזק הסיסמה', 'ja-JP': 'パスワードの強度', 'de-DE': 'Passwortstärke', 'fr-FR': 'Robustesse du mot de passe', 'zh-CN': '密码强度' },
};
