import type { Entry } from '../index';

/** Time-picker demo strings — the realistic form-field labels a user reads
 *  (Meeting / Departure / Appointment / Booking / Pick time), the "Enter time"
 *  dialog headline, and the "Open time picker" programmatic trigger button.
 *  State/variant captions (Enabled / Pre-filled / Disabled, Dial / Input,
 *  12h / 24h), the CSS-var + ::part() styling labels (Brand teal / Sharp /
 *  Compact / Custom parts …), the AM/PM + Cancel/OK meta args, the Event
 *  Emitters demo controls and console-output copy, the keyboard/accessibility
 *  developer prose, and the intentional static Localization (French) / RTL
 *  (Arabic) demos all stay byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'time-picker.meeting': { 'en-US': 'Meeting', 'ar-SA': 'اجتماع', 'he-IL': 'פגישה', 'ja-JP': '会議', 'de-DE': 'Besprechung', 'fr-FR': 'Réunion', 'zh-CN': '会议' },
  'time-picker.departure': { 'en-US': 'Departure', 'ar-SA': 'المغادرة', 'he-IL': 'יציאה', 'ja-JP': '出発', 'de-DE': 'Abfahrt', 'fr-FR': 'Départ', 'zh-CN': '出发' },
  'time-picker.enter-time': { 'en-US': 'Enter time', 'ar-SA': 'أدخل الوقت', 'he-IL': 'הזן שעה', 'ja-JP': '時刻を入力', 'de-DE': 'Uhrzeit eingeben', 'fr-FR': 'Saisir l\'heure', 'zh-CN': '输入时间' },
  'time-picker.appointment': { 'en-US': 'Appointment', 'ar-SA': 'موعد', 'he-IL': 'תור', 'ja-JP': '予約', 'de-DE': 'Termin', 'fr-FR': 'Rendez-vous', 'zh-CN': '预约' },
  'time-picker.booking': { 'en-US': 'Booking', 'ar-SA': 'حجز', 'he-IL': 'הזמנה', 'ja-JP': '予約', 'de-DE': 'Buchung', 'fr-FR': 'Réservation', 'zh-CN': '预订' },
  'time-picker.pick-time': { 'en-US': 'Pick time', 'ar-SA': 'اختر الوقت', 'he-IL': 'בחר שעה', 'ja-JP': '時刻を選択', 'de-DE': 'Uhrzeit wählen', 'fr-FR': 'Choisir l\'heure', 'zh-CN': '选择时间' },
  'time-picker.open-picker': { 'en-US': 'Open time picker', 'ar-SA': 'فتح منتقي الوقت', 'he-IL': 'פתיחת בורר השעה', 'ja-JP': '時刻選択を開く', 'de-DE': 'Zeitauswahl öffnen', 'fr-FR': 'Ouvrir le sélecteur d\'heure', 'zh-CN': '打开时间选择器' },
};
