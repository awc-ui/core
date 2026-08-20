import type { Entry } from '../index';

/** Date-picker demo strings — the user-facing form-field labels (real
 *  booking / event / appointment fields a user reads), the required + validation
 *  supporting/error copy, and the "Pick a date" trigger button. State/variant
 *  captions (Default / Pre-selected / Required / With error / Constrained /
 *  Disabled, Modal input / Docked / Modal), the opened-panel interaction
 *  showcases, the CSS-var and ::part() styling labels, date-format hints
 *  (MM/DD/YYYY), the behavioural Event Emitters / Uncontrolled / Controlled demo
 *  controls and event logs, developer/API prose, and the intentional static
 *  Localization / RTL / Japanese / date-separator demos (which carry their own
 *  per-locale content) all stay byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'date-picker.event-date': { 'en-US': 'Event date', 'ar-SA': 'تاريخ الفعالية', 'he-IL': 'תאריך האירוע', 'ja-JP': 'イベントの日付', 'de-DE': 'Veranstaltungsdatum', 'fr-FR': 'Date de l\'événement', 'zh-CN': '活动日期' },
  'date-picker.start-date': { 'en-US': 'Start date', 'ar-SA': 'تاريخ البدء', 'he-IL': 'תאריך התחלה', 'ja-JP': '開始日', 'de-DE': 'Startdatum', 'fr-FR': 'Date de début', 'zh-CN': '开始日期' },
  'date-picker.end-date': { 'en-US': 'End date', 'ar-SA': 'تاريخ الانتهاء', 'he-IL': 'תאריך סיום', 'ja-JP': '終了日', 'de-DE': 'Enddatum', 'fr-FR': 'Date de fin', 'zh-CN': '结束日期' },
  'date-picker.report-date': { 'en-US': 'Report date', 'ar-SA': 'تاريخ التقرير', 'he-IL': 'תאריך הדוח', 'ja-JP': 'レポート日', 'de-DE': 'Berichtsdatum', 'fr-FR': 'Date du rapport', 'zh-CN': '报告日期' },
  'date-picker.check-in': { 'en-US': 'Check-in', 'ar-SA': 'تسجيل الوصول', 'he-IL': 'צ\'ק-אין', 'ja-JP': 'チェックイン', 'de-DE': 'Check-in', 'fr-FR': 'Arrivée', 'zh-CN': '入住' },
  'date-picker.check-out': { 'en-US': 'Check-out', 'ar-SA': 'تسجيل المغادرة', 'he-IL': 'צ\'ק-אאוט', 'ja-JP': 'チェックアウト', 'de-DE': 'Check-out', 'fr-FR': 'Départ', 'zh-CN': '退房' },
  'date-picker.pick-a-date': { 'en-US': 'Pick a date', 'ar-SA': 'اختر تاريخًا', 'he-IL': 'בחר תאריך', 'ja-JP': '日付を選択', 'de-DE': 'Datum auswählen', 'fr-FR': 'Choisir une date', 'zh-CN': '选择日期' },
  'date-picker.field-required': { 'en-US': 'This field is required', 'ar-SA': 'هذا الحقل مطلوب', 'he-IL': 'שדה זה הוא חובה', 'ja-JP': 'この項目は必須です', 'de-DE': 'Dieses Feld ist erforderlich', 'fr-FR': 'Ce champ est obligatoire', 'zh-CN': '此字段为必填项' },
  'date-picker.invalid-date': { 'en-US': 'Please pick a valid date', 'ar-SA': 'يرجى اختيار تاريخ صالح', 'he-IL': 'יש לבחור תאריך תקין', 'ja-JP': '有効な日付を選択してください', 'de-DE': 'Bitte wählen Sie ein gültiges Datum aus', 'fr-FR': 'Veuillez choisir une date valide', 'zh-CN': '请选择有效的日期' },
  'date-picker.june-only': { 'en-US': 'June 2025 only', 'ar-SA': 'يونيو 2025 فقط', 'he-IL': 'יוני 2025 בלבד', 'ja-JP': '2025年6月のみ', 'de-DE': 'Nur Juni 2025', 'fr-FR': 'Juin 2025 uniquement', 'zh-CN': '仅限2025年6月' },
};
