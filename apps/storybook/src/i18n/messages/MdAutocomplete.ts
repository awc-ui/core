import type { Entry } from '../index';

/** Demo strings for the Text Input/Autocomplete stories. Only user-facing field
 *  labels, the instruction label and the validation message are localized; the
 *  sample option data (country/tag names), technical enum-demo labels
 *  (Top/Left/Right/Below, Enabled/Disabled/Error, Pill chips/Wide/Dark), the
 *  developer keyboard-contract notes and the intentional static RTL / German +
 *  Japanese locale demos stay as-is. The Submit button reuses the shared
 *  `submit` verb from `common.ts`. */
export const messages: Record<string, Entry> = {
  'autocomplete.country': { 'en-US': 'Country', 'ar-SA': 'الدولة', 'he-IL': 'מדינה', 'ja-JP': '国', 'de-DE': 'Land', 'fr-FR': 'Pays', 'zh-CN': '国家' },
  'autocomplete.tags': { 'en-US': 'Tags', 'ar-SA': 'الوسوم', 'he-IL': 'תגים', 'ja-JP': 'タグ', 'de-DE': 'Tags', 'fr-FR': 'Étiquettes', 'zh-CN': '标签' },
  'autocomplete.email': { 'en-US': 'Email', 'ar-SA': 'البريد الإلكتروني', 'he-IL': 'אימייל', 'ja-JP': 'メール', 'de-DE': 'E-Mail', 'fr-FR': 'E-mail', 'zh-CN': '电子邮件' },
  'autocomplete.users': { 'en-US': 'Users', 'ar-SA': 'المستخدمون', 'he-IL': 'משתמשים', 'ja-JP': 'ユーザー', 'de-DE': 'Benutzer', 'fr-FR': 'Utilisateurs', 'zh-CN': '用户' },
  'autocomplete.city': { 'en-US': 'City', 'ar-SA': 'المدينة', 'he-IL': 'עיר', 'ja-JP': '都市', 'de-DE': 'Stadt', 'fr-FR': 'Ville', 'zh-CN': '城市' },
  'autocomplete.item': { 'en-US': 'Item', 'ar-SA': 'عنصر', 'he-IL': 'פריט', 'ja-JP': 'アイテム', 'de-DE': 'Element', 'fr-FR': 'Élément', 'zh-CN': '项目' },
  'autocomplete.assignee': { 'en-US': 'Assignee', 'ar-SA': 'المكلَّف', 'he-IL': 'אחראי', 'ja-JP': '担当者', 'de-DE': 'Zuständiger', 'fr-FR': 'Responsable', 'zh-CN': '负责人' },
  'autocomplete.pickUpTo2': { 'en-US': 'Pick up to 2', 'ar-SA': 'اختر حتى 2', 'he-IL': 'בחר עד 2', 'ja-JP': '最大2件まで選択', 'de-DE': 'Bis zu 2 auswählen', 'fr-FR': 'Sélectionnez jusqu\'à 2', 'zh-CN': '最多选择2个' },
  'autocomplete.selectCountryError': { 'en-US': 'Please select a country', 'ar-SA': 'يرجى اختيار دولة', 'he-IL': 'יש לבחור מדינה', 'ja-JP': '国を選択してください', 'de-DE': 'Bitte wählen Sie ein Land aus', 'fr-FR': 'Veuillez sélectionner un pays', 'zh-CN': '请选择国家' },
};
