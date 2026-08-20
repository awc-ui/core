import type { Entry } from '../index';

/** Status-dot demo strings — the user-facing presence copy in the Standalone
 *  showcase (status-legend rows, the "Live now" pill, and the status-picker
 *  menu labels + its "Set status to …" accessible prefix). The States legend
 *  labels (`online · away · busy · offline · invisible · neutral`) are the raw
 *  `state` enum values shown as a reference key and stay byte-for-byte, as do
 *  the Accessibility / RTL / Dark-theme showcases, all `caption()` /
 *  `sectionLabel()` docs prose, CSS-variable names, and Material Symbols icons.
 *  Keys are namespaced by the `statusDot.` slug. */
export const messages: Record<string, Entry> = {
  'statusDot.availableNow': { 'en-US': 'Available now', 'ar-SA': 'متاح الآن', 'he-IL': 'זמין עכשיו', 'ja-JP': '現在対応可能', 'de-DE': 'Jetzt verfügbar', 'fr-FR': 'Disponible maintenant', 'zh-CN': '现在有空' },
  'statusDot.awayFromDesk': { 'en-US': 'Away from desk', 'ar-SA': 'بعيد عن المكتب', 'he-IL': 'מרוחק מהשולחן', 'ja-JP': '離席中', 'de-DE': 'Nicht am Platz', 'fr-FR': 'Absent du bureau', 'zh-CN': '离开座位' },
  'statusDot.doNotDisturb': { 'en-US': 'Do not disturb', 'ar-SA': 'عدم الإزعاج', 'he-IL': 'נא לא להפריע', 'ja-JP': '応答不可', 'de-DE': 'Bitte nicht stören', 'fr-FR': 'Ne pas déranger', 'zh-CN': '请勿打扰' },
  'statusDot.signedOut': { 'en-US': 'Signed out', 'ar-SA': 'تم تسجيل الخروج', 'he-IL': 'מנותק', 'ja-JP': 'サインアウト済み', 'de-DE': 'Abgemeldet', 'fr-FR': 'Déconnecté', 'zh-CN': '已退出' },
  'statusDot.liveNow': { 'en-US': 'Live now', 'ar-SA': 'مباشر الآن', 'he-IL': 'בשידור חי', 'ja-JP': 'ライブ配信中', 'de-DE': 'Jetzt live', 'fr-FR': 'En direct', 'zh-CN': '正在直播' },
  'statusDot.online': { 'en-US': 'Online', 'ar-SA': 'متصل', 'he-IL': 'מחובר', 'ja-JP': 'オンライン', 'de-DE': 'Online', 'fr-FR': 'En ligne', 'zh-CN': '在线' },
  'statusDot.away': { 'en-US': 'Away', 'ar-SA': 'غائب', 'he-IL': 'מרוחק', 'ja-JP': '離席中', 'de-DE': 'Abwesend', 'fr-FR': 'Absent', 'zh-CN': '离开' },
  'statusDot.appearOffline': { 'en-US': 'Appear offline', 'ar-SA': 'الظهور بلا اتصال', 'he-IL': 'הצג כלא מחובר', 'ja-JP': 'オフラインとして表示', 'de-DE': 'Als offline anzeigen', 'fr-FR': 'Apparaître hors ligne', 'zh-CN': '显示为离线' },
  'statusDot.setStatusTo': { 'en-US': 'Set status to', 'ar-SA': 'تعيين الحالة إلى', 'he-IL': 'הגדר סטטוס ל', 'ja-JP': 'ステータスを設定:', 'de-DE': 'Status setzen auf', 'fr-FR': 'Définir le statut sur', 'zh-CN': '设置状态为' },
};
