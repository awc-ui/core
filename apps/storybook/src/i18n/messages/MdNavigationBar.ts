import type { Entry } from '../index';

/** Navigation Bar demo strings — bottom-nav destination labels plus a couple of
 *  badge labels. Shared verbs (home, search, settings) live in common.ts and are
 *  resolved via t(locale, '<verb>'); only bar-specific nouns are namespaced here
 *  under `navbar.*`. Values mirror the sibling MdNavigationRail catalog where the
 *  destination overlaps (library, profile, inbox, drafts, favorites). */
export const messages: Record<string, Entry> = {
  'navbar.library': { 'en-US': 'Library', 'ar-SA': 'المكتبة', 'he-IL': 'ספרייה', 'ja-JP': 'ライブラリ', 'de-DE': 'Bibliothek', 'fr-FR': 'Bibliothèque', 'zh-CN': '媒体库' },
  'navbar.profile': { 'en-US': 'Profile', 'ar-SA': 'الملف الشخصي', 'he-IL': 'פרופיל', 'ja-JP': 'プロフィール', 'de-DE': 'Profil', 'fr-FR': 'Profil', 'zh-CN': '个人资料' },
  'navbar.inbox': { 'en-US': 'Inbox', 'ar-SA': 'البريد الوارد', 'he-IL': 'דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'navbar.messages': { 'en-US': 'Messages', 'ar-SA': 'الرسائل', 'he-IL': 'הודעות', 'ja-JP': 'メッセージ', 'de-DE': 'Nachrichten', 'fr-FR': 'Messages', 'zh-CN': '消息' },
  'navbar.notifications': { 'en-US': 'Notifications', 'ar-SA': 'الإشعارات', 'he-IL': 'התראות', 'ja-JP': '通知', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Notifications', 'zh-CN': '通知' },
  'navbar.comments': { 'en-US': 'Comments', 'ar-SA': 'التعليقات', 'he-IL': 'תגובות', 'ja-JP': 'コメント', 'de-DE': 'Kommentare', 'fr-FR': 'Commentaires', 'zh-CN': '评论' },
  'navbar.drafts': { 'en-US': 'Drafts', 'ar-SA': 'المسودّات', 'he-IL': 'טיוטות', 'ja-JP': '下書き', 'de-DE': 'Entwürfe', 'fr-FR': 'Brouillons', 'zh-CN': '草稿' },
  'navbar.spam': { 'en-US': 'Spam', 'ar-SA': 'البريد العشوائي', 'he-IL': 'ספאם', 'ja-JP': '迷惑メール', 'de-DE': 'Spam', 'fr-FR': 'Spam', 'zh-CN': '垃圾邮件' },
  'navbar.favorites': { 'en-US': 'Favorites', 'ar-SA': 'المفضلة', 'he-IL': 'מועדפים', 'ja-JP': 'お気に入り', 'de-DE': 'Favoriten', 'fr-FR': 'Favoris', 'zh-CN': '收藏' },
  'navbar.new': { 'en-US': 'New', 'ar-SA': 'جديد', 'he-IL': 'חדש', 'ja-JP': '新着', 'de-DE': 'Neu', 'fr-FR': 'Nouveau', 'zh-CN': '新' },
  'navbar.star': { 'en-US': 'Star', 'ar-SA': 'نجمة', 'he-IL': 'כוכב', 'ja-JP': 'スター', 'de-DE': 'Stern', 'fr-FR': 'Étoile', 'zh-CN': '星标' },
  'navbar.heart': { 'en-US': 'Heart', 'ar-SA': 'قلب', 'he-IL': 'לב', 'ja-JP': 'ハート', 'de-DE': 'Herz', 'fr-FR': 'Cœur', 'zh-CN': '爱心' },
  'navbar.smile': { 'en-US': 'Smile', 'ar-SA': 'ابتسامة', 'he-IL': 'חיוך', 'ja-JP': 'スマイル', 'de-DE': 'Lächeln', 'fr-FR': 'Sourire', 'zh-CN': '笑脸' },
};
