import type { Entry } from '../index';

/** Avatar demo strings. Proper-noun sample names (Ada Lovelace, …) and API
 *  documentation prose stay untranslated; only descriptive, user-facing UI copy
 *  (presence states, account/label descriptors, a button label, a demo heading)
 *  is localized here. Keys are namespaced by the `avatar.` slug. */
export const messages: Record<string, Entry> = {
  'avatar.online': { 'en-US': 'Online', 'ar-SA': 'متصل', 'he-IL': 'מחובר', 'ja-JP': 'オンライン', 'de-DE': 'Online', 'fr-FR': 'En ligne', 'zh-CN': '在线' },
  'avatar.offline': { 'en-US': 'Offline', 'ar-SA': 'غير متصل', 'he-IL': 'לא מחובר', 'ja-JP': 'オフライン', 'de-DE': 'Offline', 'fr-FR': 'Hors ligne', 'zh-CN': '离线' },
  'avatar.idle': { 'en-US': 'Idle', 'ar-SA': 'خامل', 'he-IL': 'לא פעיל', 'ja-JP': '離席中', 'de-DE': 'Inaktiv', 'fr-FR': 'Inactif', 'zh-CN': '空闲' },
  'avatar.doNotDisturb': { 'en-US': 'Do not disturb', 'ar-SA': 'عدم الإزعاج', 'he-IL': 'נא לא להפריע', 'ja-JP': '応答不可', 'de-DE': 'Bitte nicht stören', 'fr-FR': 'Ne pas déranger', 'zh-CN': '请勿打扰' },
  'avatar.lastSeen': { 'en-US': 'Last seen 9:42 AM', 'ar-SA': 'آخر ظهور 9:42 AM', 'he-IL': 'נראה לאחרונה 9:42 AM', 'ja-JP': '最終アクセス 9:42 AM', 'de-DE': 'Zuletzt gesehen 9:42 AM', 'fr-FR': 'Vu pour la dernière fois à 9:42 AM', 'zh-CN': '最后在线 9:42 AM' },
  'avatar.awayBack': { 'en-US': 'Away — back at 11:00', 'ar-SA': 'غائب — يعود في 11:00', 'he-IL': 'לא נמצא — חוזר ב-11:00', 'ja-JP': '退席中 — 11:00に戻ります', 'de-DE': 'Abwesend — zurück um 11:00', 'fr-FR': 'Absent — de retour à 11:00', 'zh-CN': '离开 — 11:00 返回' },
  'avatar.onlineLower': { 'en-US': 'online', 'ar-SA': 'متصل', 'he-IL': 'מחובר', 'ja-JP': 'オンライン', 'de-DE': 'online', 'fr-FR': 'en ligne', 'zh-CN': '在线' },
  'avatar.rocketAccount': { 'en-US': 'Rocket account', 'ar-SA': 'حساب الصاروخ', 'he-IL': 'חשבון רקטה', 'ja-JP': 'ロケットアカウント', 'de-DE': 'Raketen-Konto', 'fr-FR': 'Compte fusée', 'zh-CN': '火箭账户' },
  'avatar.alphaCohort': { 'en-US': 'Alpha cohort', 'ar-SA': 'مجموعة ألفا', 'he-IL': 'קבוצת אלפא', 'ja-JP': 'アルファコホート', 'de-DE': 'Alpha-Kohorte', 'fr-FR': 'Cohorte alpha', 'zh-CN': 'Alpha 群组' },
  'avatar.robotAccount': { 'en-US': 'Robot account', 'ar-SA': 'حساب روبوت', 'he-IL': 'חשבון רובוט', 'ja-JP': 'ロボットアカウント', 'de-DE': 'Roboter-Konto', 'fr-FR': 'Compte robot', 'zh-CN': '机器人账户' },
  'avatar.verifiedAccount': { 'en-US': 'Verified account', 'ar-SA': 'حساب موثّق', 'he-IL': 'חשבון מאומת', 'ja-JP': '認証済みアカウント', 'de-DE': 'Verifiziertes Konto', 'fr-FR': 'Compte vérifié', 'zh-CN': '已验证账户' },
  'avatar.system': { 'en-US': 'System', 'ar-SA': 'النظام', 'he-IL': 'מערכת', 'ja-JP': 'システム', 'de-DE': 'System', 'fr-FR': 'Système', 'zh-CN': '系统' },
  'avatar.partyEmoji': { 'en-US': 'Party emoji', 'ar-SA': 'إيموجي الاحتفال', 'he-IL': 'אימוג׳י מסיבה', 'ja-JP': 'パーティー絵文字', 'de-DE': 'Party-Emoji', 'fr-FR': 'Emoji fête', 'zh-CN': '派对表情' },
  'avatar.rocketProject': { 'en-US': 'Rocket project', 'ar-SA': 'مشروع الصاروخ', 'he-IL': 'פרויקט רקטה', 'ja-JP': 'ロケットプロジェクト', 'de-DE': 'Raketen-Projekt', 'fr-FR': 'Projet fusée', 'zh-CN': '火箭项目' },
  'avatar.euTeam': { 'en-US': 'EU team', 'ar-SA': 'فريق الاتحاد الأوروبي', 'he-IL': 'צוות האיחוד האירופי', 'ja-JP': 'EUチーム', 'de-DE': 'EU-Team', 'fr-FR': 'Équipe UE', 'zh-CN': '欧盟团队' },
  'avatar.greeter': { 'en-US': 'Greeter', 'ar-SA': 'المُرحِّب', 'he-IL': 'מקבל פנים', 'ja-JP': '受付担当', 'de-DE': 'Begrüßer', 'fr-FR': "Hôte d'accueil", 'zh-CN': '迎宾' },
  'avatar.familyAccount': { 'en-US': 'Family account', 'ar-SA': 'حساب العائلة', 'he-IL': 'חשבון משפחתי', 'ja-JP': '家族アカウント', 'de-DE': 'Familienkonto', 'fr-FR': 'Compte familial', 'zh-CN': '家庭账户' },
  'avatar.prideChannel': { 'en-US': 'Pride channel', 'ar-SA': 'قناة برايد', 'he-IL': 'ערוץ גאווה', 'ja-JP': 'プライドチャンネル', 'de-DE': 'Pride-Kanal', 'fr-FR': 'Canal Pride', 'zh-CN': '骄傲频道' },
  'avatar.moreMembers': { 'en-US': '5 more members', 'ar-SA': '5 أعضاء آخرين', 'he-IL': 'עוד 5 חברים', 'ja-JP': '他5人のメンバー', 'de-DE': '5 weitere Mitglieder', 'fr-FR': '5 autres membres', 'zh-CN': '还有5位成员' },
  'avatar.unknownUser': { 'en-US': 'Unknown user', 'ar-SA': 'مستخدم غير معروف', 'he-IL': 'משתמש לא ידוע', 'ja-JP': '不明なユーザー', 'de-DE': 'Unbekannter Nutzer', 'fr-FR': 'Utilisateur inconnu', 'zh-CN': '未知用户' },
  'avatar.teamMembers': { 'en-US': 'Team members:', 'ar-SA': 'أعضاء الفريق:', 'he-IL': 'חברי הצוות:', 'ja-JP': 'チームメンバー:', 'de-DE': 'Teammitglieder:', 'fr-FR': "Membres de l'équipe :", 'zh-CN': '团队成员：' },
  'avatar.switchAccount': { 'en-US': 'Switch account', 'ar-SA': 'تبديل الحساب', 'he-IL': 'החלפת חשבון', 'ja-JP': 'アカウントを切り替え', 'de-DE': 'Konto wechseln', 'fr-FR': 'Changer de compte', 'zh-CN': '切换账户' },
};
