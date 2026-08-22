import type { Entry } from '../index';

/** Demo strings for the FAB Menu stories. Only genuine user-facing content is
 *  localized: the anchor FAB accessible name (aria-label) and each menu item's
 *  visible `label`. Reuses the shared `edit` / `delete` verbs from `common.ts`.
 *  Left as-is: the variant/size caption spans (Primary/Secondary/Tertiary,
 *  Standard/Medium/Large 56/80/96px), Material Symbols icon names, CSS / custom-
 *  property demos, docs.description prose and explanatory demo copy, the live
 *  event-log panel chrome (Live log / Awaiting events… / Clear log), the
 *  responsive scaffold instructions and breakpoint labels, and the two
 *  intentional static multi-locale demos (RTL, Localization) whose whole point
 *  is showing several hardcoded languages side by side. */
export const messages: Record<string, Entry> = {
  'fabMenu.actions': { 'en-US': 'Actions', 'ar-SA': 'إجراءات', 'he-IL': 'פעולות', 'ja-JP': '操作', 'de-DE': 'Aktionen', 'fr-FR': 'Actions', 'zh-CN': '操作' },
  'fabMenu.createNew': { 'en-US': 'Create new', 'ar-SA': 'إنشاء جديد', 'he-IL': 'יצירת חדש', 'ja-JP': '新規作成', 'de-DE': 'Neu erstellen', 'fr-FR': 'Créer', 'zh-CN': '新建' },
  'fabMenu.dangerActions': { 'en-US': 'Danger actions', 'ar-SA': 'إجراءات خطيرة', 'he-IL': 'פעולות מסוכנות', 'ja-JP': '危険な操作', 'de-DE': 'Gefährliche Aktionen', 'fr-FR': 'Actions dangereuses', 'zh-CN': '危险操作' },
  'fabMenu.share': { 'en-US': 'Share', 'ar-SA': 'مشاركة', 'he-IL': 'שיתוף', 'ja-JP': '共有', 'de-DE': 'Teilen', 'fr-FR': 'Partager', 'zh-CN': '分享' },
  'fabMenu.photo': { 'en-US': 'Photo', 'ar-SA': 'صورة', 'he-IL': 'תמונה', 'ja-JP': '写真', 'de-DE': 'Foto', 'fr-FR': 'Photo', 'zh-CN': '照片' },
  'fabMenu.video': { 'en-US': 'Video', 'ar-SA': 'فيديو', 'he-IL': 'וידאו', 'ja-JP': '動画', 'de-DE': 'Video', 'fr-FR': 'Vidéo', 'zh-CN': '视频' },
  'fabMenu.audio': { 'en-US': 'Audio', 'ar-SA': 'صوت', 'he-IL': 'אודיו', 'ja-JP': '音声', 'de-DE': 'Audio', 'fr-FR': 'Audio', 'zh-CN': '音频' },
  'fabMenu.note': { 'en-US': 'Note', 'ar-SA': 'ملاحظة', 'he-IL': 'הערה', 'ja-JP': 'メモ', 'de-DE': 'Notiz', 'fr-FR': 'Note', 'zh-CN': '笔记' },
  'fabMenu.folder': { 'en-US': 'Folder', 'ar-SA': 'مجلد', 'he-IL': 'תיקייה', 'ja-JP': 'フォルダ', 'de-DE': 'Ordner', 'fr-FR': 'Dossier', 'zh-CN': '文件夹' },
  'fabMenu.upload': { 'en-US': 'Upload', 'ar-SA': 'رفع', 'he-IL': 'העלאה', 'ja-JP': 'アップロード', 'de-DE': 'Hochladen', 'fr-FR': 'Importer', 'zh-CN': '上传' },
  'fabMenu.copy': { 'en-US': 'Copy', 'ar-SA': 'نسخ', 'he-IL': 'העתקה', 'ja-JP': 'コピー', 'de-DE': 'Kopieren', 'fr-FR': 'Copier', 'zh-CN': '复制' },
  'fabMenu.download': { 'en-US': 'Download', 'ar-SA': 'تنزيل', 'he-IL': 'הורדה', 'ja-JP': 'ダウンロード', 'de-DE': 'Herunterladen', 'fr-FR': 'Télécharger', 'zh-CN': '下载' },
  'fabMenu.bookmark': { 'en-US': 'Bookmark', 'ar-SA': 'إشارة مرجعية', 'he-IL': 'סימנייה', 'ja-JP': 'ブックマーク', 'de-DE': 'Lesezeichen', 'fr-FR': 'Signet', 'zh-CN': '书签' },
  'fabMenu.document': { 'en-US': 'Document', 'ar-SA': 'مستند', 'he-IL': 'מסמך', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokument', 'fr-FR': 'Document', 'zh-CN': '文档' },
  'fabMenu.image': { 'en-US': 'Image', 'ar-SA': 'صورة', 'he-IL': 'תמונה', 'ja-JP': '画像', 'de-DE': 'Bild', 'fr-FR': 'Image', 'zh-CN': '图片' },
  'fabMenu.link': { 'en-US': 'Link', 'ar-SA': 'رابط', 'he-IL': 'קישור', 'ja-JP': 'リンク', 'de-DE': 'Link', 'fr-FR': 'Lien', 'zh-CN': '链接' },
  'fabMenu.star': { 'en-US': 'Star', 'ar-SA': 'نجمة', 'he-IL': 'כוכב', 'ja-JP': 'スター', 'de-DE': 'Stern', 'fr-FR': 'Étoile', 'zh-CN': '星标' },
  'fabMenu.rocket': { 'en-US': 'Rocket', 'ar-SA': 'صاروخ', 'he-IL': 'רקטה', 'ja-JP': 'ロケット', 'de-DE': 'Rakete', 'fr-FR': 'Fusée', 'zh-CN': '火箭' },
  'fabMenu.heart': { 'en-US': 'Heart', 'ar-SA': 'قلب', 'he-IL': 'לב', 'ja-JP': 'ハート', 'de-DE': 'Herz', 'fr-FR': 'Cœur', 'zh-CN': '爱心' },
  'fabMenu.block': { 'en-US': 'Block', 'ar-SA': 'حظر', 'he-IL': 'חסימה', 'ja-JP': 'ブロック', 'de-DE': 'Blockieren', 'fr-FR': 'Bloquer', 'zh-CN': '屏蔽' },
  'fabMenu.report': { 'en-US': 'Report', 'ar-SA': 'إبلاغ', 'he-IL': 'דיווח', 'ja-JP': '報告', 'de-DE': 'Melden', 'fr-FR': 'Signaler', 'zh-CN': '举报' },
  'fabMenu.deleteForever': { 'en-US': 'Delete forever', 'ar-SA': 'حذف نهائي', 'he-IL': 'מחיקה לצמיתות', 'ja-JP': '完全に削除', 'de-DE': 'Endgültig löschen', 'fr-FR': 'Supprimer définitivement', 'zh-CN': '永久删除' },
};
