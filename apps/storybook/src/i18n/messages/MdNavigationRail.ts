import type { Entry } from '../index';

/** Navigation Rail demo strings — destination labels, FAB labels, menu items,
 *  and section headers. Shared verbs (home, search, settings, edit…) live in
 *  common.ts and are resolved via t(locale, '<verb>'); only rail-specific nouns
 *  are namespaced here under `nav-rail.*`. */
export const messages: Record<string, Entry> = {
  'nav-rail.favorites': { 'en-US': 'Favorites', 'ar-SA': 'المفضلة', 'he-IL': 'מועדפים', 'ja-JP': 'お気に入り', 'de-DE': 'Favoriten', 'fr-FR': 'Favoris', 'zh-CN': '收藏' },
  'nav-rail.inbox': { 'en-US': 'Inbox', 'ar-SA': 'البريد الوارد', 'he-IL': 'דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'nav-rail.sent': { 'en-US': 'Sent', 'ar-SA': 'المُرسَلة', 'he-IL': 'נשלחו', 'ja-JP': '送信済み', 'de-DE': 'Gesendet', 'fr-FR': 'Envoyés', 'zh-CN': '已发送' },
  'nav-rail.scheduled': { 'en-US': 'Scheduled', 'ar-SA': 'المجدولة', 'he-IL': 'מתוזמנים', 'ja-JP': '予定', 'de-DE': 'Geplant', 'fr-FR': 'Programmés', 'zh-CN': '已排定' },
  'nav-rail.drafts': { 'en-US': 'Drafts', 'ar-SA': 'المسودّات', 'he-IL': 'טיוטות', 'ja-JP': '下書き', 'de-DE': 'Entwürfe', 'fr-FR': 'Brouillons', 'zh-CN': '草稿' },
  'nav-rail.explore': { 'en-US': 'Explore', 'ar-SA': 'استكشاف', 'he-IL': 'גילוי', 'ja-JP': '探索', 'de-DE': 'Entdecken', 'fr-FR': 'Explorer', 'zh-CN': '探索' },
  'nav-rail.library': { 'en-US': 'Library', 'ar-SA': 'المكتبة', 'he-IL': 'ספרייה', 'ja-JP': 'ライブラリ', 'de-DE': 'Bibliothek', 'fr-FR': 'Bibliothèque', 'zh-CN': '媒体库' },
  'nav-rail.profile': { 'en-US': 'Profile', 'ar-SA': 'الملف الشخصي', 'he-IL': 'פרופיל', 'ja-JP': 'プロフィール', 'de-DE': 'Profil', 'fr-FR': 'Profil', 'zh-CN': '个人资料' },
  'nav-rail.dashboard': { 'en-US': 'Dashboard', 'ar-SA': 'لوحة التحكم', 'he-IL': 'לוח בקרה', 'ja-JP': 'ダッシュボード', 'de-DE': 'Dashboard', 'fr-FR': 'Tableau de bord', 'zh-CN': '仪表板' },
  'nav-rail.sign-out': { 'en-US': 'Sign out', 'ar-SA': 'تسجيل الخروج', 'he-IL': 'התנתקות', 'ja-JP': 'ログアウト', 'de-DE': 'Abmelden', 'fr-FR': 'Se déconnecter', 'zh-CN': '退出登录' },
  'nav-rail.create': { 'en-US': 'Create', 'ar-SA': 'إنشاء', 'he-IL': 'יצירה', 'ja-JP': '作成', 'de-DE': 'Erstellen', 'fr-FR': 'Créer', 'zh-CN': '创建' },
  'nav-rail.your-library': { 'en-US': 'Your library', 'ar-SA': 'مكتبتك', 'he-IL': 'הספרייה שלך', 'ja-JP': 'ライブラリ', 'de-DE': 'Deine Bibliothek', 'fr-FR': 'Votre bibliothèque', 'zh-CN': '你的媒体库' },
  'nav-rail.liked-songs': { 'en-US': 'Liked songs', 'ar-SA': 'الأغاني المفضّلة', 'he-IL': 'שירים שאהבתי', 'ja-JP': 'お気に入りの曲', 'de-DE': 'Lieblingssongs', 'fr-FR': 'Titres aimés', 'zh-CN': '喜欢的歌曲' },
  'nav-rail.browse': { 'en-US': 'Browse', 'ar-SA': 'تصفّح', 'he-IL': 'עיון', 'ja-JP': '見つける', 'de-DE': 'Durchsuchen', 'fr-FR': 'Parcourir', 'zh-CN': '浏览' },
  'nav-rail.your-music': { 'en-US': 'Your music', 'ar-SA': 'موسيقاك', 'he-IL': 'המוזיקה שלך', 'ja-JP': 'マイミュージック', 'de-DE': 'Deine Musik', 'fr-FR': 'Votre musique', 'zh-CN': '我的音乐' },
  'nav-rail.recently-played': { 'en-US': 'Recently played', 'ar-SA': 'المشغّلة مؤخرًا', 'he-IL': 'הושמעו לאחרונה', 'ja-JP': '最近再生した曲', 'de-DE': 'Zuletzt gespielt', 'fr-FR': 'Écoutés récemment', 'zh-CN': '最近播放' },
  'nav-rail.chats': { 'en-US': 'Chats', 'ar-SA': 'المحادثات', 'he-IL': "צ'אטים", 'ja-JP': 'チャット', 'de-DE': 'Chats', 'fr-FR': 'Discussions', 'zh-CN': '聊天' },
  'nav-rail.groups': { 'en-US': 'Groups', 'ar-SA': 'المجموعات', 'he-IL': 'קבוצות', 'ja-JP': 'グループ', 'de-DE': 'Gruppen', 'fr-FR': 'Groupes', 'zh-CN': '群组' },
  'nav-rail.alerts': { 'en-US': 'Alerts', 'ar-SA': 'التنبيهات', 'he-IL': 'התראות', 'ja-JP': '通知', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Alertes', 'zh-CN': '提醒' },
  'nav-rail.analytics': { 'en-US': 'Analytics', 'ar-SA': 'التحليلات', 'he-IL': 'ניתוח נתונים', 'ja-JP': '分析', 'de-DE': 'Analysen', 'fr-FR': 'Analyses', 'zh-CN': '数据分析' },
  'nav-rail.team': { 'en-US': 'Team', 'ar-SA': 'الفريق', 'he-IL': 'צוות', 'ja-JP': 'チーム', 'de-DE': 'Team', 'fr-FR': 'Équipe', 'zh-CN': '团队' },
};
