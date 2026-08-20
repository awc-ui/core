import type { Entry } from '../index';

/** Demo strings for the Button Group stories. Only genuine user-facing button
 *  content is localized: time ranges (Day/Week/Month/Year), view modes
 *  (List/Grid/Module), text formatting (Bold/Italic/Underline/Strike),
 *  confirmations (Yes/No), weekday chips (Mon–Fri), file types
 *  (Documents/Images/Videos), email folders (All/Inbox/Drafts/…), state labels
 *  (Selected/Unselected/Active/Compact) and a few actions (Share, Launch,
 *  Schedule, Clear log). The shared verbs `edit`, `back`, `next` and `save`
 *  reuse `common.ts`. Left as-is: icon-button `aria-label`s (accessible names,
 *  not visible text), positional/enum filler labels (Option A/B/C,
 *  First/Second/Third, Label A/C, Only), the pedagogical Accessibility-story
 *  labels that explain ARIA behaviour, the live-event debug log scaffolding, and
 *  the intentional static Localization (multi-locale table) and RTL (Arabic)
 *  demos. */
export const messages: Record<string, Entry> = {
  'buttonGroup.day': { 'en-US': 'Day', 'ar-SA': 'يوم', 'he-IL': 'יום', 'ja-JP': '日', 'de-DE': 'Tag', 'fr-FR': 'Jour', 'zh-CN': '日' },
  'buttonGroup.week': { 'en-US': 'Week', 'ar-SA': 'أسبوع', 'he-IL': 'שבוע', 'ja-JP': '週', 'de-DE': 'Woche', 'fr-FR': 'Semaine', 'zh-CN': '周' },
  'buttonGroup.month': { 'en-US': 'Month', 'ar-SA': 'شهر', 'he-IL': 'חודש', 'ja-JP': '月', 'de-DE': 'Monat', 'fr-FR': 'Mois', 'zh-CN': '月' },
  'buttonGroup.year': { 'en-US': 'Year', 'ar-SA': 'سنة', 'he-IL': 'שנה', 'ja-JP': '年', 'de-DE': 'Jahr', 'fr-FR': 'Année', 'zh-CN': '年' },
  'buttonGroup.list': { 'en-US': 'List', 'ar-SA': 'قائمة', 'he-IL': 'רשימה', 'ja-JP': 'リスト', 'de-DE': 'Liste', 'fr-FR': 'Liste', 'zh-CN': '列表' },
  'buttonGroup.grid': { 'en-US': 'Grid', 'ar-SA': 'شبكة', 'he-IL': 'רשת', 'ja-JP': 'グリッド', 'de-DE': 'Raster', 'fr-FR': 'Grille', 'zh-CN': '网格' },
  'buttonGroup.module': { 'en-US': 'Module', 'ar-SA': 'وحدة', 'he-IL': 'מודול', 'ja-JP': 'モジュール', 'de-DE': 'Modul', 'fr-FR': 'Module', 'zh-CN': '模块' },
  'buttonGroup.bold': { 'en-US': 'Bold', 'ar-SA': 'عريض', 'he-IL': 'מודגש', 'ja-JP': '太字', 'de-DE': 'Fett', 'fr-FR': 'Gras', 'zh-CN': '粗体' },
  'buttonGroup.italic': { 'en-US': 'Italic', 'ar-SA': 'مائل', 'he-IL': 'נטוי', 'ja-JP': '斜体', 'de-DE': 'Kursiv', 'fr-FR': 'Italique', 'zh-CN': '斜体' },
  'buttonGroup.underline': { 'en-US': 'Underline', 'ar-SA': 'تسطير', 'he-IL': 'קו תחתון', 'ja-JP': '下線', 'de-DE': 'Unterstrichen', 'fr-FR': 'Souligné', 'zh-CN': '下划线' },
  'buttonGroup.strike': { 'en-US': 'Strike', 'ar-SA': 'يتوسطه خط', 'he-IL': 'קו חוצה', 'ja-JP': '取り消し線', 'de-DE': 'Durchgestrichen', 'fr-FR': 'Barré', 'zh-CN': '删除线' },
  'buttonGroup.yes': { 'en-US': 'Yes', 'ar-SA': 'نعم', 'he-IL': 'כן', 'ja-JP': 'はい', 'de-DE': 'Ja', 'fr-FR': 'Oui', 'zh-CN': '是' },
  'buttonGroup.no': { 'en-US': 'No', 'ar-SA': 'لا', 'he-IL': 'לא', 'ja-JP': 'いいえ', 'de-DE': 'Nein', 'fr-FR': 'Non', 'zh-CN': '否' },
  'buttonGroup.mon': { 'en-US': 'Mon', 'ar-SA': 'الإثنين', 'he-IL': 'ב׳', 'ja-JP': '月', 'de-DE': 'Mo', 'fr-FR': 'Lun', 'zh-CN': '周一' },
  'buttonGroup.tue': { 'en-US': 'Tue', 'ar-SA': 'الثلاثاء', 'he-IL': 'ג׳', 'ja-JP': '火', 'de-DE': 'Di', 'fr-FR': 'Mar', 'zh-CN': '周二' },
  'buttonGroup.wed': { 'en-US': 'Wed', 'ar-SA': 'الأربعاء', 'he-IL': 'ד׳', 'ja-JP': '水', 'de-DE': 'Mi', 'fr-FR': 'Mer', 'zh-CN': '周三' },
  'buttonGroup.thu': { 'en-US': 'Thu', 'ar-SA': 'الخميس', 'he-IL': 'ה׳', 'ja-JP': '木', 'de-DE': 'Do', 'fr-FR': 'Jeu', 'zh-CN': '周四' },
  'buttonGroup.fri': { 'en-US': 'Fri', 'ar-SA': 'الجمعة', 'he-IL': 'ו׳', 'ja-JP': '金', 'de-DE': 'Fr', 'fr-FR': 'Ven', 'zh-CN': '周五' },
  'buttonGroup.share': { 'en-US': 'Share', 'ar-SA': 'مشاركة', 'he-IL': 'שיתוף', 'ja-JP': '共有', 'de-DE': 'Teilen', 'fr-FR': 'Partager', 'zh-CN': '分享' },
  'buttonGroup.selected': { 'en-US': 'Selected', 'ar-SA': 'محدد', 'he-IL': 'נבחר', 'ja-JP': '選択中', 'de-DE': 'Ausgewählt', 'fr-FR': 'Sélectionné', 'zh-CN': '已选择' },
  'buttonGroup.unselected': { 'en-US': 'Unselected', 'ar-SA': 'غير محدد', 'he-IL': 'לא נבחר', 'ja-JP': '未選択', 'de-DE': 'Nicht ausgewählt', 'fr-FR': 'Non sélectionné', 'zh-CN': '未选择' },
  'buttonGroup.active': { 'en-US': 'Active', 'ar-SA': 'نشط', 'he-IL': 'פעיל', 'ja-JP': 'アクティブ', 'de-DE': 'Aktiv', 'fr-FR': 'Actif', 'zh-CN': '活动' },
  'buttonGroup.compact': { 'en-US': 'Compact', 'ar-SA': 'مضغوط', 'he-IL': 'קומפקטי', 'ja-JP': 'コンパクト', 'de-DE': 'Kompakt', 'fr-FR': 'Compact', 'zh-CN': '紧凑' },
  'buttonGroup.launch': { 'en-US': 'Launch', 'ar-SA': 'إطلاق', 'he-IL': 'הפעלה', 'ja-JP': '起動', 'de-DE': 'Starten', 'fr-FR': 'Lancer', 'zh-CN': '启动' },
  'buttonGroup.schedule': { 'en-US': 'Schedule', 'ar-SA': 'جدولة', 'he-IL': 'תזמון', 'ja-JP': 'スケジュール', 'de-DE': 'Planen', 'fr-FR': 'Planifier', 'zh-CN': '日程' },
  'buttonGroup.documents': { 'en-US': 'Documents', 'ar-SA': 'مستندات', 'he-IL': 'מסמכים', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokumente', 'fr-FR': 'Documents', 'zh-CN': '文档' },
  'buttonGroup.images': { 'en-US': 'Images', 'ar-SA': 'صور', 'he-IL': 'תמונות', 'ja-JP': '画像', 'de-DE': 'Bilder', 'fr-FR': 'Images', 'zh-CN': '图片' },
  'buttonGroup.videos': { 'en-US': 'Videos', 'ar-SA': 'مقاطع فيديو', 'he-IL': 'סרטונים', 'ja-JP': '動画', 'de-DE': 'Videos', 'fr-FR': 'Vidéos', 'zh-CN': '视频' },
  'buttonGroup.clearLog': { 'en-US': 'Clear log', 'ar-SA': 'مسح السجل', 'he-IL': 'ניקוי היומן', 'ja-JP': 'ログをクリア', 'de-DE': 'Protokoll löschen', 'fr-FR': 'Effacer le journal', 'zh-CN': '清除日志' },
  'buttonGroup.all': { 'en-US': 'All', 'ar-SA': 'الكل', 'he-IL': 'הכול', 'ja-JP': 'すべて', 'de-DE': 'Alle', 'fr-FR': 'Tous', 'zh-CN': '全部' },
  'buttonGroup.inbox': { 'en-US': 'Inbox', 'ar-SA': 'البريد الوارد', 'he-IL': 'דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'buttonGroup.drafts': { 'en-US': 'Drafts', 'ar-SA': 'المسودات', 'he-IL': 'טיוטות', 'ja-JP': '下書き', 'de-DE': 'Entwürfe', 'fr-FR': 'Brouillons', 'zh-CN': '草稿' },
  'buttonGroup.sent': { 'en-US': 'Sent', 'ar-SA': 'المرسلة', 'he-IL': 'נשלחו', 'ja-JP': '送信済み', 'de-DE': 'Gesendet', 'fr-FR': 'Envoyés', 'zh-CN': '已发送' },
  'buttonGroup.spam': { 'en-US': 'Spam', 'ar-SA': 'البريد المزعج', 'he-IL': 'ספאם', 'ja-JP': '迷惑メール', 'de-DE': 'Spam', 'fr-FR': 'Spam', 'zh-CN': '垃圾邮件' },
  'buttonGroup.trash': { 'en-US': 'Trash', 'ar-SA': 'المهملات', 'he-IL': 'אשפה', 'ja-JP': 'ゴミ箱', 'de-DE': 'Papierkorb', 'fr-FR': 'Corbeille', 'zh-CN': '垃圾箱' },
  'buttonGroup.archive': { 'en-US': 'Archive', 'ar-SA': 'الأرشيف', 'he-IL': 'ארכיון', 'ja-JP': 'アーカイブ', 'de-DE': 'Archiv', 'fr-FR': 'Archives', 'zh-CN': '归档' },
  'buttonGroup.starred': { 'en-US': 'Starred', 'ar-SA': 'المميزة بنجمة', 'he-IL': 'מסומן בכוכב', 'ja-JP': 'スター付き', 'de-DE': 'Markiert', 'fr-FR': 'Suivis', 'zh-CN': '已加星标' },
};
