import type { Entry } from '../index';

/** md-menu demo strings — menu-item labels, group labels, badges, and the few
 *  generic trigger/form labels shown to the end user. Shared verbs (save, delete,
 *  edit, settings) come from common.ts and are referenced by the story directly. */
export const messages: Record<string, Entry> = {
  // ── Edit / clipboard actions ─────────────────────────────
  'menu.cut': { 'en-US': 'Cut', 'ar-SA': 'قص', 'he-IL': 'גזירה', 'ja-JP': '切り取り', 'de-DE': 'Ausschneiden', 'fr-FR': 'Couper', 'zh-CN': '剪切' },
  'menu.copy': { 'en-US': 'Copy', 'ar-SA': 'نسخ', 'he-IL': 'העתקה', 'ja-JP': 'コピー', 'de-DE': 'Kopieren', 'fr-FR': 'Copier', 'zh-CN': '复制' },
  'menu.paste': { 'en-US': 'Paste', 'ar-SA': 'لصق', 'he-IL': 'הדבקה', 'ja-JP': '貼り付け', 'de-DE': 'Einfügen', 'fr-FR': 'Coller', 'zh-CN': '粘贴' },
  'menu.undo': { 'en-US': 'Undo', 'ar-SA': 'تراجع', 'he-IL': 'ביטול פעולה', 'ja-JP': '元に戻す', 'de-DE': 'Rückgängig', 'fr-FR': 'Annuler', 'zh-CN': '撤销' },
  'menu.redo': { 'en-US': 'Redo', 'ar-SA': 'إعادة', 'he-IL': 'ביצוע חוזר', 'ja-JP': 'やり直し', 'de-DE': 'Wiederholen', 'fr-FR': 'Rétablir', 'zh-CN': '重做' },
  'menu.selectAll': { 'en-US': 'Select all', 'ar-SA': 'تحديد الكل', 'he-IL': 'בחירת הכול', 'ja-JP': 'すべて選択', 'de-DE': 'Alles auswählen', 'fr-FR': 'Tout sélectionner', 'zh-CN': '全选' },
  'menu.duplicate': { 'en-US': 'Duplicate', 'ar-SA': 'تكرار', 'he-IL': 'שכפול', 'ja-JP': '複製', 'de-DE': 'Duplizieren', 'fr-FR': 'Dupliquer', 'zh-CN': '复制副本' },
  'menu.rename': { 'en-US': 'Rename', 'ar-SA': 'إعادة تسمية', 'he-IL': 'שינוי שם', 'ja-JP': '名前を変更', 'de-DE': 'Umbenennen', 'fr-FR': 'Renommer', 'zh-CN': '重命名' },

  // ── File actions ─────────────────────────────────────────
  'menu.new': { 'en-US': 'New', 'ar-SA': 'جديد', 'he-IL': 'חדש', 'ja-JP': '新規', 'de-DE': 'Neu', 'fr-FR': 'Nouveau', 'zh-CN': '新建' },
  'menu.newFile': { 'en-US': 'New file', 'ar-SA': 'ملف جديد', 'he-IL': 'קובץ חדש', 'ja-JP': '新規ファイル', 'de-DE': 'Neue Datei', 'fr-FR': 'Nouveau fichier', 'zh-CN': '新建文件' },
  'menu.newFolder': { 'en-US': 'New folder', 'ar-SA': 'مجلد جديد', 'he-IL': 'תיקייה חדשה', 'ja-JP': '新規フォルダ', 'de-DE': 'Neuer Ordner', 'fr-FR': 'Nouveau dossier', 'zh-CN': '新建文件夹' },
  'menu.open': { 'en-US': 'Open', 'ar-SA': 'فتح', 'he-IL': 'פתיחה', 'ja-JP': '開く', 'de-DE': 'Öffnen', 'fr-FR': 'Ouvrir', 'zh-CN': '打开' },
  'menu.openRecent': { 'en-US': 'Open recent', 'ar-SA': 'فتح الأخيرة', 'he-IL': 'פתיחת אחרונים', 'ja-JP': '最近使ったものを開く', 'de-DE': 'Zuletzt geöffnet', 'fr-FR': 'Ouvrir récent', 'zh-CN': '打开最近的文件' },
  'menu.export': { 'en-US': 'Export', 'ar-SA': 'تصدير', 'he-IL': 'ייצוא', 'ja-JP': 'エクスポート', 'de-DE': 'Exportieren', 'fr-FR': 'Exporter', 'zh-CN': '导出' },
  'menu.exportAs': { 'en-US': 'Export as', 'ar-SA': 'تصدير بصيغة', 'he-IL': 'ייצוא בתור', 'ja-JP': 'エクスポート形式', 'de-DE': 'Exportieren als', 'fr-FR': 'Exporter en', 'zh-CN': '导出为' },
  'menu.exportAsPdf': { 'en-US': 'Export as PDF', 'ar-SA': 'تصدير بصيغة PDF', 'he-IL': 'ייצוא כ-PDF', 'ja-JP': 'PDFとしてエクスポート', 'de-DE': 'Als PDF exportieren', 'fr-FR': 'Exporter au format PDF', 'zh-CN': '导出为 PDF' },
  'menu.print': { 'en-US': 'Print', 'ar-SA': 'طباعة', 'he-IL': 'הדפסה', 'ja-JP': '印刷', 'de-DE': 'Drucken', 'fr-FR': 'Imprimer', 'zh-CN': '打印' },
  'menu.import': { 'en-US': 'Import', 'ar-SA': 'استيراد', 'he-IL': 'ייבוא', 'ja-JP': 'インポート', 'de-DE': 'Importieren', 'fr-FR': 'Importer', 'zh-CN': '导入' },
  'menu.upload': { 'en-US': 'Upload', 'ar-SA': 'رفع', 'he-IL': 'העלאה', 'ja-JP': 'アップロード', 'de-DE': 'Hochladen', 'fr-FR': 'Téléverser', 'zh-CN': '上传' },
  'menu.uploadFile': { 'en-US': 'Upload file', 'ar-SA': 'رفع ملف', 'he-IL': 'העלאת קובץ', 'ja-JP': 'ファイルをアップロード', 'de-DE': 'Datei hochladen', 'fr-FR': 'Téléverser un fichier', 'zh-CN': '上传文件' },
  'menu.download': { 'en-US': 'Download', 'ar-SA': 'تنزيل', 'he-IL': 'הורדה', 'ja-JP': 'ダウンロード', 'de-DE': 'Herunterladen', 'fr-FR': 'Télécharger', 'zh-CN': '下载' },
  'menu.close': { 'en-US': 'Close', 'ar-SA': 'إغلاق', 'he-IL': 'סגירה', 'ja-JP': '閉じる', 'de-DE': 'Schließen', 'fr-FR': 'Fermer', 'zh-CN': '关闭' },
  'menu.saveAs': { 'en-US': 'Save as…', 'ar-SA': 'حفظ باسم…', 'he-IL': 'שמירה בשם…', 'ja-JP': '名前を付けて保存…', 'de-DE': 'Speichern unter…', 'fr-FR': 'Enregistrer sous…', 'zh-CN': '另存为…' },
  'menu.saveACopy': { 'en-US': 'Save a copy', 'ar-SA': 'حفظ نسخة', 'he-IL': 'שמירת עותק', 'ja-JP': 'コピーを保存', 'de-DE': 'Kopie speichern', 'fr-FR': 'Enregistrer une copie', 'zh-CN': '保存副本' },
  'menu.moveTo': { 'en-US': 'Move to…', 'ar-SA': 'نقل إلى…', 'he-IL': 'העברה אל…', 'ja-JP': '移動先…', 'de-DE': 'Verschieben nach…', 'fr-FR': 'Déplacer vers…', 'zh-CN': '移动到…' },
  'menu.moveToTrash': { 'en-US': 'Move to trash', 'ar-SA': 'نقل إلى سلة المهملات', 'he-IL': 'העברה לאשפה', 'ja-JP': 'ゴミ箱に移動', 'de-DE': 'In den Papierkorb verschieben', 'fr-FR': 'Mettre à la corbeille', 'zh-CN': '移到回收站' },

  // ── Share / send ─────────────────────────────────────────
  'menu.share': { 'en-US': 'Share', 'ar-SA': 'مشاركة', 'he-IL': 'שיתוף', 'ja-JP': '共有', 'de-DE': 'Teilen', 'fr-FR': 'Partager', 'zh-CN': '分享' },
  'menu.shareWith': { 'en-US': 'Share with', 'ar-SA': 'مشاركة مع', 'he-IL': 'שיתוף עם', 'ja-JP': '共有先', 'de-DE': 'Teilen mit', 'fr-FR': 'Partager avec', 'zh-CN': '共享给' },
  'menu.sendTo': { 'en-US': 'Send to', 'ar-SA': 'إرسال إلى', 'he-IL': 'שליחה אל', 'ja-JP': '送信先', 'de-DE': 'Senden an', 'fr-FR': 'Envoyer à', 'zh-CN': '发送到' },
  'menu.copyLink': { 'en-US': 'Copy link', 'ar-SA': 'نسخ الرابط', 'he-IL': 'העתקת קישור', 'ja-JP': 'リンクをコピー', 'de-DE': 'Link kopieren', 'fr-FR': 'Copier le lien', 'zh-CN': '复制链接' },
  'menu.embed': { 'en-US': 'Embed', 'ar-SA': 'تضمين', 'he-IL': 'הטמעה', 'ja-JP': '埋め込み', 'de-DE': 'Einbetten', 'fr-FR': 'Intégrer', 'zh-CN': '嵌入' },
  'menu.social': { 'en-US': 'Social', 'ar-SA': 'التواصل الاجتماعي', 'he-IL': 'רשתות חברתיות', 'ja-JP': 'ソーシャル', 'de-DE': 'Soziale Medien', 'fr-FR': 'Réseaux sociaux', 'zh-CN': '社交' },
  'menu.more': { 'en-US': 'More', 'ar-SA': 'المزيد', 'he-IL': 'עוד', 'ja-JP': 'その他', 'de-DE': 'Mehr', 'fr-FR': 'Plus', 'zh-CN': '更多' },
  'menu.moreOptions': { 'en-US': 'More options', 'ar-SA': 'خيارات أخرى', 'he-IL': 'אפשרויות נוספות', 'ja-JP': 'その他のオプション', 'de-DE': 'Weitere Optionen', 'fr-FR': 'Plus d\'options', 'zh-CN': '更多选项' },
  'menu.image': { 'en-US': 'Image', 'ar-SA': 'صورة', 'he-IL': 'תמונה', 'ja-JP': '画像', 'de-DE': 'Bild', 'fr-FR': 'Image', 'zh-CN': '图片' },

  // ── Mail actions ─────────────────────────────────────────
  'menu.reply': { 'en-US': 'Reply', 'ar-SA': 'رد', 'he-IL': 'מענה', 'ja-JP': '返信', 'de-DE': 'Antworten', 'fr-FR': 'Répondre', 'zh-CN': '回复' },
  'menu.replyAll': { 'en-US': 'Reply all', 'ar-SA': 'رد على الكل', 'he-IL': 'מענה לכולם', 'ja-JP': '全員に返信', 'de-DE': 'Allen antworten', 'fr-FR': 'Répondre à tous', 'zh-CN': '全部回复' },
  'menu.forward': { 'en-US': 'Forward', 'ar-SA': 'إعادة توجيه', 'he-IL': 'העברה', 'ja-JP': '転送', 'de-DE': 'Weiterleiten', 'fr-FR': 'Transférer', 'zh-CN': '转发' },
  'menu.forwardAsAttachment': { 'en-US': 'Forward as attachment', 'ar-SA': 'إعادة توجيه كمرفق', 'he-IL': 'העברה כקובץ מצורף', 'ja-JP': '添付ファイルとして転送', 'de-DE': 'Als Anhang weiterleiten', 'fr-FR': 'Transférer en pièce jointe', 'zh-CN': '作为附件转发' },
  'menu.archive': { 'en-US': 'Archive', 'ar-SA': 'أرشفة', 'he-IL': 'ארכיון', 'ja-JP': 'アーカイブ', 'de-DE': 'Archivieren', 'fr-FR': 'Archiver', 'zh-CN': '归档' },
  'menu.refresh': { 'en-US': 'Refresh', 'ar-SA': 'تحديث', 'he-IL': 'רענון', 'ja-JP': '更新', 'de-DE': 'Aktualisieren', 'fr-FR': 'Actualiser', 'zh-CN': '刷新' },
  'menu.email': { 'en-US': 'Email', 'ar-SA': 'البريد الإلكتروني', 'he-IL': 'אימייל', 'ja-JP': 'メール', 'de-DE': 'E-Mail', 'fr-FR': 'E-mail', 'zh-CN': '电子邮件' },
  'menu.messages': { 'en-US': 'Messages', 'ar-SA': 'الرسائل', 'he-IL': 'הודעות', 'ja-JP': 'メッセージ', 'de-DE': 'Nachrichten', 'fr-FR': 'Messages', 'zh-CN': '消息' },

  // ── Navigation / destinations ────────────────────────────
  'menu.profile': { 'en-US': 'Profile', 'ar-SA': 'الملف الشخصي', 'he-IL': 'פרופיל', 'ja-JP': 'プロフィール', 'de-DE': 'Profil', 'fr-FR': 'Profil', 'zh-CN': '个人资料' },
  'menu.help': { 'en-US': 'Help', 'ar-SA': 'مساعدة', 'he-IL': 'עזרה', 'ja-JP': 'ヘルプ', 'de-DE': 'Hilfe', 'fr-FR': 'Aide', 'zh-CN': '帮助' },
  'menu.signOut': { 'en-US': 'Sign out', 'ar-SA': 'تسجيل الخروج', 'he-IL': 'התנתקות', 'ja-JP': 'ログアウト', 'de-DE': 'Abmelden', 'fr-FR': 'Se déconnecter', 'zh-CN': '退出登录' },
  'menu.inbox': { 'en-US': 'Inbox', 'ar-SA': 'صندوق الوارد', 'he-IL': 'תיבת דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'menu.starred': { 'en-US': 'Starred', 'ar-SA': 'المميزة بنجمة', 'he-IL': 'מסומן בכוכב', 'ja-JP': 'スター付き', 'de-DE': 'Markiert', 'fr-FR': 'Suivis', 'zh-CN': '已加星标' },
  'menu.sent': { 'en-US': 'Sent', 'ar-SA': 'المرسلة', 'he-IL': 'נשלחו', 'ja-JP': '送信済み', 'de-DE': 'Gesendet', 'fr-FR': 'Envoyés', 'zh-CN': '已发送' },
  'menu.drafts': { 'en-US': 'Drafts', 'ar-SA': 'المسودات', 'he-IL': 'טיוטות', 'ja-JP': '下書き', 'de-DE': 'Entwürfe', 'fr-FR': 'Brouillons', 'zh-CN': '草稿' },
  'menu.dashboard': { 'en-US': 'Dashboard', 'ar-SA': 'لوحة التحكم', 'he-IL': 'לוח בקרה', 'ja-JP': 'ダッシュボード', 'de-DE': 'Dashboard', 'fr-FR': 'Tableau de bord', 'zh-CN': '仪表板' },
  'menu.analytics': { 'en-US': 'Analytics', 'ar-SA': 'التحليلات', 'he-IL': 'ניתוח נתונים', 'ja-JP': '分析', 'de-DE': 'Analysen', 'fr-FR': 'Analyses', 'zh-CN': '分析' },
  'menu.reports': { 'en-US': 'Reports', 'ar-SA': 'التقارير', 'he-IL': 'דוחות', 'ja-JP': 'レポート', 'de-DE': 'Berichte', 'fr-FR': 'Rapports', 'zh-CN': '报告' },
  'menu.notifications': { 'en-US': 'Notifications', 'ar-SA': 'الإشعارات', 'he-IL': 'התראות', 'ja-JP': '通知', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Notifications', 'zh-CN': '通知' },
  'menu.updates': { 'en-US': 'Updates', 'ar-SA': 'التحديثات', 'he-IL': 'עדכונים', 'ja-JP': '更新情報', 'de-DE': 'Updates', 'fr-FR': 'Mises à jour', 'zh-CN': '更新' },
  'menu.labels': { 'en-US': 'Labels', 'ar-SA': 'التصنيفات', 'he-IL': 'תוויות', 'ja-JP': 'ラベル', 'de-DE': 'Labels', 'fr-FR': 'Libellés', 'zh-CN': '标签' },
  'menu.projects': { 'en-US': 'Projects', 'ar-SA': 'المشاريع', 'he-IL': 'פרויקטים', 'ja-JP': 'プロジェクト', 'de-DE': 'Projekte', 'fr-FR': 'Projets', 'zh-CN': '项目' },

  // ── View / sort / filter options ─────────────────────────
  'menu.view': { 'en-US': 'View', 'ar-SA': 'عرض', 'he-IL': 'תצוגה', 'ja-JP': '表示', 'de-DE': 'Ansicht', 'fr-FR': 'Affichage', 'zh-CN': '视图' },
  'menu.viewOptions': { 'en-US': 'View options', 'ar-SA': 'خيارات العرض', 'he-IL': 'אפשרויות תצוגה', 'ja-JP': '表示オプション', 'de-DE': 'Anzeigeoptionen', 'fr-FR': 'Options d\'affichage', 'zh-CN': '查看选项' },
  'menu.sortByName': { 'en-US': 'Sort by name', 'ar-SA': 'الترتيب حسب الاسم', 'he-IL': 'מיון לפי שם', 'ja-JP': '名前順', 'de-DE': 'Nach Name sortieren', 'fr-FR': 'Trier par nom', 'zh-CN': '按名称排序' },
  'menu.sortByDate': { 'en-US': 'Sort by date', 'ar-SA': 'الترتيب حسب التاريخ', 'he-IL': 'מיון לפי תאריך', 'ja-JP': '日付順', 'de-DE': 'Nach Datum sortieren', 'fr-FR': 'Trier par date', 'zh-CN': '按日期排序' },
  'menu.sortBySize': { 'en-US': 'Sort by size', 'ar-SA': 'الترتيب حسب الحجم', 'he-IL': 'מיון לפי גודל', 'ja-JP': 'サイズ順', 'de-DE': 'Nach Größe sortieren', 'fr-FR': 'Trier par taille', 'zh-CN': '按大小排序' },
  'menu.listView': { 'en-US': 'List view', 'ar-SA': 'عرض القائمة', 'he-IL': 'תצוגת רשימה', 'ja-JP': 'リスト表示', 'de-DE': 'Listenansicht', 'fr-FR': 'Vue liste', 'zh-CN': '列表视图' },
  'menu.gridView': { 'en-US': 'Grid view', 'ar-SA': 'عرض الشبكة', 'he-IL': 'תצוגת רשת', 'ja-JP': 'グリッド表示', 'de-DE': 'Rasteransicht', 'fr-FR': 'Vue grille', 'zh-CN': '网格视图' },
  'menu.columnView': { 'en-US': 'Column view', 'ar-SA': 'عرض الأعمدة', 'he-IL': 'תצוגת עמודות', 'ja-JP': '列表示', 'de-DE': 'Spaltenansicht', 'fr-FR': 'Vue colonnes', 'zh-CN': '分栏视图' },
  'menu.showHidden': { 'en-US': 'Show hidden', 'ar-SA': 'إظهار المخفي', 'he-IL': 'הצגת פריטים מוסתרים', 'ja-JP': '非表示を表示', 'de-DE': 'Ausgeblendete anzeigen', 'fr-FR': 'Afficher les éléments masqués', 'zh-CN': '显示隐藏项' },
  'menu.showPreview': { 'en-US': 'Show preview', 'ar-SA': 'إظهار المعاينة', 'he-IL': 'הצגת תצוגה מקדימה', 'ja-JP': 'プレビューを表示', 'de-DE': 'Vorschau anzeigen', 'fr-FR': 'Afficher l\'aperçu', 'zh-CN': '显示预览' },
  'menu.showThumbnails': { 'en-US': 'Show thumbnails', 'ar-SA': 'إظهار الصور المصغرة', 'he-IL': 'הצגת תמונות ממוזערות', 'ja-JP': 'サムネイルを表示', 'de-DE': 'Miniaturansichten anzeigen', 'fr-FR': 'Afficher les miniatures', 'zh-CN': '显示缩略图' },
  'menu.showSize': { 'en-US': 'Show size', 'ar-SA': 'إظهار الحجم', 'he-IL': 'הצגת גודל', 'ja-JP': 'サイズを表示', 'de-DE': 'Größe anzeigen', 'fr-FR': 'Afficher la taille', 'zh-CN': '显示大小' },
  'menu.groupByType': { 'en-US': 'Group by type', 'ar-SA': 'تجميع حسب النوع', 'he-IL': 'קיבוץ לפי סוג', 'ja-JP': '種類でグループ化', 'de-DE': 'Nach Typ gruppieren', 'fr-FR': 'Grouper par type', 'zh-CN': '按类型分组' },
  'menu.ascending': { 'en-US': 'Ascending', 'ar-SA': 'تصاعدي', 'he-IL': 'סדר עולה', 'ja-JP': '昇順', 'de-DE': 'Aufsteigend', 'fr-FR': 'Croissant', 'zh-CN': '升序' },
  'menu.descending': { 'en-US': 'Descending', 'ar-SA': 'تنازلي', 'he-IL': 'סדר יורד', 'ja-JP': '降順', 'de-DE': 'Absteigend', 'fr-FR': 'Décroissant', 'zh-CN': '降序' },
  'menu.newestFirst': { 'en-US': 'Newest first', 'ar-SA': 'الأحدث أولاً', 'he-IL': 'החדש ביותר תחילה', 'ja-JP': '新しい順', 'de-DE': 'Neueste zuerst', 'fr-FR': 'Plus récents d\'abord', 'zh-CN': '最新优先' },
  'menu.oldestFirst': { 'en-US': 'Oldest first', 'ar-SA': 'الأقدم أولاً', 'he-IL': 'הישן ביותר תחילה', 'ja-JP': '古い順', 'de-DE': 'Älteste zuerst', 'fr-FR': 'Plus anciens d\'abord', 'zh-CN': '最旧优先' },
  'menu.unreadOnly': { 'en-US': 'Unread only', 'ar-SA': 'غير المقروءة فقط', 'he-IL': 'לא נקראו בלבד', 'ja-JP': '未読のみ', 'de-DE': 'Nur ungelesene', 'fr-FR': 'Non lus uniquement', 'zh-CN': '仅未读' },
  'menu.starredOnly': { 'en-US': 'Starred only', 'ar-SA': 'المميزة بنجمة فقط', 'he-IL': 'מסומנים בכוכב בלבד', 'ja-JP': 'スター付きのみ', 'de-DE': 'Nur markierte', 'fr-FR': 'Suivis uniquement', 'zh-CN': '仅加星标' },

  // ── View / zoom ──────────────────────────────────────────
  'menu.zoom': { 'en-US': 'Zoom', 'ar-SA': 'تكبير/تصغير', 'he-IL': 'זום', 'ja-JP': 'ズーム', 'de-DE': 'Zoom', 'fr-FR': 'Zoom', 'zh-CN': '缩放' },
  'menu.zoomIn': { 'en-US': 'Zoom in', 'ar-SA': 'تكبير', 'he-IL': 'הגדלה', 'ja-JP': '拡大', 'de-DE': 'Vergrößern', 'fr-FR': 'Zoom avant', 'zh-CN': '放大' },
  'menu.zoomOut': { 'en-US': 'Zoom out', 'ar-SA': 'تصغير', 'he-IL': 'הקטנה', 'ja-JP': '縮小', 'de-DE': 'Verkleinern', 'fr-FR': 'Zoom arrière', 'zh-CN': '缩小' },
  'menu.fitToScreen': { 'en-US': 'Fit to screen', 'ar-SA': 'ملاءمة الشاشة', 'he-IL': 'התאמה למסך', 'ja-JP': '画面に合わせる', 'de-DE': 'An Bildschirm anpassen', 'fr-FR': 'Ajuster à l\'écran', 'zh-CN': '适应屏幕' },
  'menu.fullScreen': { 'en-US': 'Full screen', 'ar-SA': 'ملء الشاشة', 'he-IL': 'מסך מלא', 'ja-JP': '全画面', 'de-DE': 'Vollbild', 'fr-FR': 'Plein écran', 'zh-CN': '全屏' },

  // ── Toggles / settings items ─────────────────────────────
  'menu.darkMode': { 'en-US': 'Dark mode', 'ar-SA': 'الوضع الداكن', 'he-IL': 'מצב כהה', 'ja-JP': 'ダークモード', 'de-DE': 'Dunkelmodus', 'fr-FR': 'Mode sombre', 'zh-CN': '深色模式' },
  'menu.compactView': { 'en-US': 'Compact view', 'ar-SA': 'العرض المضغوط', 'he-IL': 'תצוגה קומפקטית', 'ja-JP': 'コンパクト表示', 'de-DE': 'Kompakte Ansicht', 'fr-FR': 'Vue compacte', 'zh-CN': '紧凑视图' },
  'menu.airplaneMode': { 'en-US': 'Airplane mode', 'ar-SA': 'وضع الطيران', 'he-IL': 'מצב טיסה', 'ja-JP': '機内モード', 'de-DE': 'Flugmodus', 'fr-FR': 'Mode avion', 'zh-CN': '飞行模式' },

  // ── Text formatting ──────────────────────────────────────
  'menu.bold': { 'en-US': 'Bold', 'ar-SA': 'عريض', 'he-IL': 'מודגש', 'ja-JP': '太字', 'de-DE': 'Fett', 'fr-FR': 'Gras', 'zh-CN': '粗体' },
  'menu.italic': { 'en-US': 'Italic', 'ar-SA': 'مائل', 'he-IL': 'נטוי', 'ja-JP': '斜体', 'de-DE': 'Kursiv', 'fr-FR': 'Italique', 'zh-CN': '斜体' },
  'menu.underline': { 'en-US': 'Underline', 'ar-SA': 'تسطير', 'he-IL': 'קו תחתון', 'ja-JP': '下線', 'de-DE': 'Unterstrichen', 'fr-FR': 'Souligné', 'zh-CN': '下划线' },

  // ── Sizes (as menu labels) ───────────────────────────────
  'menu.small': { 'en-US': 'Small', 'ar-SA': 'صغير', 'he-IL': 'קטן', 'ja-JP': '小', 'de-DE': 'Klein', 'fr-FR': 'Petit', 'zh-CN': '小' },
  'menu.medium': { 'en-US': 'Medium', 'ar-SA': 'متوسط', 'he-IL': 'בינוני', 'ja-JP': '中', 'de-DE': 'Mittel', 'fr-FR': 'Moyen', 'zh-CN': '中' },
  'menu.large': { 'en-US': 'Large', 'ar-SA': 'كبير', 'he-IL': 'גדול', 'ja-JP': '大', 'de-DE': 'Groß', 'fr-FR': 'Grand', 'zh-CN': '大' },

  // ── Theme options ────────────────────────────────────────
  'menu.light': { 'en-US': 'Light', 'ar-SA': 'فاتح', 'he-IL': 'בהיר', 'ja-JP': 'ライト', 'de-DE': 'Hell', 'fr-FR': 'Clair', 'zh-CN': '浅色' },
  'menu.dark': { 'en-US': 'Dark', 'ar-SA': 'داكن', 'he-IL': 'כהה', 'ja-JP': 'ダーク', 'de-DE': 'Dunkel', 'fr-FR': 'Sombre', 'zh-CN': '深色' },
  'menu.system': { 'en-US': 'System', 'ar-SA': 'النظام', 'he-IL': 'מערכת', 'ja-JP': 'システム', 'de-DE': 'System', 'fr-FR': 'Système', 'zh-CN': '系统' },

  // ── Colors ───────────────────────────────────────────────
  'menu.red': { 'en-US': 'Red', 'ar-SA': 'أحمر', 'he-IL': 'אדום', 'ja-JP': '赤', 'de-DE': 'Rot', 'fr-FR': 'Rouge', 'zh-CN': '红色' },
  'menu.blue': { 'en-US': 'Blue', 'ar-SA': 'أزرق', 'he-IL': 'כחול', 'ja-JP': '青', 'de-DE': 'Blau', 'fr-FR': 'Bleu', 'zh-CN': '蓝色' },
  'menu.green': { 'en-US': 'Green', 'ar-SA': 'أخضر', 'he-IL': 'ירוק', 'ja-JP': '緑', 'de-DE': 'Grün', 'fr-FR': 'Vert', 'zh-CN': '绿色' },

  // ── Priority ─────────────────────────────────────────────
  'menu.low': { 'en-US': 'Low', 'ar-SA': 'منخفض', 'he-IL': 'נמוך', 'ja-JP': '低', 'de-DE': 'Niedrig', 'fr-FR': 'Faible', 'zh-CN': '低' },
  'menu.high': { 'en-US': 'High', 'ar-SA': 'مرتفع', 'he-IL': 'גבוה', 'ja-JP': '高', 'de-DE': 'Hoch', 'fr-FR': 'Élevé', 'zh-CN': '高' },
  'menu.critical': { 'en-US': 'Critical', 'ar-SA': 'حرج', 'he-IL': 'קריטי', 'ja-JP': '重大', 'de-DE': 'Kritisch', 'fr-FR': 'Critique', 'zh-CN': '严重' },

  // ── Language names (as radio labels) ─────────────────────
  'menu.english': { 'en-US': 'English', 'ar-SA': 'الإنجليزية', 'he-IL': 'אנגלית', 'ja-JP': '英語', 'de-DE': 'Englisch', 'fr-FR': 'Anglais', 'zh-CN': '英语' },
  'menu.french': { 'en-US': 'French', 'ar-SA': 'الفرنسية', 'he-IL': 'צרפתית', 'ja-JP': 'フランス語', 'de-DE': 'Französisch', 'fr-FR': 'Français', 'zh-CN': '法语' },
  'menu.german': { 'en-US': 'German', 'ar-SA': 'الألمانية', 'he-IL': 'גרמנית', 'ja-JP': 'ドイツ語', 'de-DE': 'Deutsch', 'fr-FR': 'Allemand', 'zh-CN': '德语' },
  'menu.japanese': { 'en-US': 'Japanese', 'ar-SA': 'اليابانية', 'he-IL': 'יפנית', 'ja-JP': '日本語', 'de-DE': 'Japanisch', 'fr-FR': 'Japonais', 'zh-CN': '日语' },

  // ── State-demo item labels ───────────────────────────────
  'menu.enabled': { 'en-US': 'Enabled', 'ar-SA': 'مُفعّل', 'he-IL': 'מופעל', 'ja-JP': '有効', 'de-DE': 'Aktiviert', 'fr-FR': 'Activé', 'zh-CN': '已启用' },
  'menu.selected': { 'en-US': 'Selected', 'ar-SA': 'محدد', 'he-IL': 'נבחר', 'ja-JP': '選択済み', 'de-DE': 'Ausgewählt', 'fr-FR': 'Sélectionné', 'zh-CN': '已选择' },
  'menu.disabled': { 'en-US': 'Disabled', 'ar-SA': 'معطّل', 'he-IL': 'מושבת', 'ja-JP': '無効', 'de-DE': 'Deaktiviert', 'fr-FR': 'Désactivé', 'zh-CN': '已禁用' },
  'menu.withDivider': { 'en-US': 'With divider', 'ar-SA': 'مع فاصل', 'he-IL': 'עם מפריד', 'ja-JP': '区切り線あり', 'de-DE': 'Mit Trennlinie', 'fr-FR': 'Avec séparateur', 'zh-CN': '带分隔线' },
  'menu.afterDivider': { 'en-US': 'After divider', 'ar-SA': 'بعد الفاصل', 'he-IL': 'אחרי המפריד', 'ja-JP': '区切り線の後', 'de-DE': 'Nach Trennlinie', 'fr-FR': 'Après séparateur', 'zh-CN': '分隔线之后' },

  // ── Gmail-style label names ──────────────────────────────
  'menu.work': { 'en-US': 'Work', 'ar-SA': 'العمل', 'he-IL': 'עבודה', 'ja-JP': '仕事', 'de-DE': 'Arbeit', 'fr-FR': 'Travail', 'zh-CN': '工作' },
  'menu.personal': { 'en-US': 'Personal', 'ar-SA': 'شخصي', 'he-IL': 'אישי', 'ja-JP': '個人', 'de-DE': 'Persönlich', 'fr-FR': 'Personnel', 'zh-CN': '个人' },
  'menu.travel': { 'en-US': 'Travel', 'ar-SA': 'السفر', 'he-IL': 'נסיעות', 'ja-JP': '旅行', 'de-DE': 'Reisen', 'fr-FR': 'Voyage', 'zh-CN': '旅行' },

  // ── Group labels ─────────────────────────────────────────
  'menu.file': { 'en-US': 'File', 'ar-SA': 'ملف', 'he-IL': 'קובץ', 'ja-JP': 'ファイル', 'de-DE': 'Datei', 'fr-FR': 'Fichier', 'zh-CN': '文件' },
  'menu.overview': { 'en-US': 'Overview', 'ar-SA': 'نظرة عامة', 'he-IL': 'סקירה', 'ja-JP': '概要', 'de-DE': 'Übersicht', 'fr-FR': 'Vue d\'ensemble', 'zh-CN': '概览' },
  'menu.tools': { 'en-US': 'Tools', 'ar-SA': 'الأدوات', 'he-IL': 'כלים', 'ja-JP': 'ツール', 'de-DE': 'Werkzeuge', 'fr-FR': 'Outils', 'zh-CN': '工具' },
  'menu.actions': { 'en-US': 'Actions', 'ar-SA': 'الإجراءات', 'he-IL': 'פעולות', 'ja-JP': '操作', 'de-DE': 'Aktionen', 'fr-FR': 'Actions', 'zh-CN': '操作' },
  'menu.manage': { 'en-US': 'Manage', 'ar-SA': 'إدارة', 'he-IL': 'ניהול', 'ja-JP': '管理', 'de-DE': 'Verwalten', 'fr-FR': 'Gérer', 'zh-CN': '管理' },
  'menu.mail': { 'en-US': 'Mail', 'ar-SA': 'البريد', 'he-IL': 'דואר', 'ja-JP': 'メール', 'de-DE': 'E-Mail', 'fr-FR': 'Courrier', 'zh-CN': '邮件' },
  'menu.folders': { 'en-US': 'Folders', 'ar-SA': 'المجلدات', 'he-IL': 'תיקיות', 'ja-JP': 'フォルダ', 'de-DE': 'Ordner', 'fr-FR': 'Dossiers', 'zh-CN': '文件夹' },
  'menu.history': { 'en-US': 'History', 'ar-SA': 'السجل', 'he-IL': 'היסטוריה', 'ja-JP': '履歴', 'de-DE': 'Verlauf', 'fr-FR': 'Historique', 'zh-CN': '历史记录' },
  'menu.clipboard': { 'en-US': 'Clipboard', 'ar-SA': 'الحافظة', 'he-IL': 'לוח', 'ja-JP': 'クリップボード', 'de-DE': 'Zwischenablage', 'fr-FR': 'Presse-papiers', 'zh-CN': '剪贴板' },
  'menu.other': { 'en-US': 'Other', 'ar-SA': 'أخرى', 'he-IL': 'אחר', 'ja-JP': 'その他', 'de-DE': 'Sonstiges', 'fr-FR': 'Autre', 'zh-CN': '其他' },
  'menu.create': { 'en-US': 'Create', 'ar-SA': 'إنشاء', 'he-IL': 'יצירה', 'ja-JP': '作成', 'de-DE': 'Erstellen', 'fr-FR': 'Créer', 'zh-CN': '创建' },

  // ── Generic trigger / action buttons ─────────────────────
  'menu.theme': { 'en-US': 'Theme', 'ar-SA': 'المظهر', 'he-IL': 'ערכת נושא', 'ja-JP': 'テーマ', 'de-DE': 'Design', 'fr-FR': 'Thème', 'zh-CN': '主题' },
  'menu.clear': { 'en-US': 'Clear', 'ar-SA': 'مسح', 'he-IL': 'ניקוי', 'ja-JP': 'クリア', 'de-DE': 'Leeren', 'fr-FR': 'Effacer', 'zh-CN': '清除' },

  // ── Badge labels ─────────────────────────────────────────
  'menu.badgeNew': { 'en-US': 'New', 'ar-SA': 'جديد', 'he-IL': 'חדש', 'ja-JP': '新着', 'de-DE': 'Neu', 'fr-FR': 'Nouveau', 'zh-CN': '新' },
  'menu.badgeBeta': { 'en-US': 'Beta', 'ar-SA': 'تجريبي', 'he-IL': 'בטא', 'ja-JP': 'ベータ', 'de-DE': 'Beta', 'fr-FR': 'Bêta', 'zh-CN': '测试版' },
  'menu.badgeUpdated': { 'en-US': 'Updated', 'ar-SA': 'محدَّث', 'he-IL': 'עודכן', 'ja-JP': '更新済み', 'de-DE': 'Aktualisiert', 'fr-FR': 'Mis à jour', 'zh-CN': '已更新' },

  // ── Controlled-dropdown form field (label / placeholder) ─
  'menu.country': { 'en-US': 'Country', 'ar-SA': 'الدولة', 'he-IL': 'מדינה', 'ja-JP': '国', 'de-DE': 'Land', 'fr-FR': 'Pays', 'zh-CN': '国家/地区' },
  'menu.selectCountry': { 'en-US': 'Select a country', 'ar-SA': 'اختر دولة', 'he-IL': 'בחירת מדינה', 'ja-JP': '国を選択', 'de-DE': 'Land auswählen', 'fr-FR': 'Sélectionner un pays', 'zh-CN': '选择国家/地区' },

  // ── Responsive-clamp demo item labels ────────────────────
  'menu.staysOnScreen': { 'en-US': 'Stays on screen', 'ar-SA': 'يبقى على الشاشة', 'he-IL': 'נשאר במסך', 'ja-JP': '画面内に収まる', 'de-DE': 'Bleibt auf dem Bildschirm', 'fr-FR': 'Reste à l\'écran', 'zh-CN': '保持在屏幕内' },
  'menu.pinsToEdge': { 'en-US': 'Pins to the viewport edge', 'ar-SA': 'يثبت عند حافة الإطار', 'he-IL': 'מוצמד לקצה חלון התצוגה', 'ja-JP': 'ビューポートの端に固定', 'de-DE': 'Am Viewport-Rand fixiert', 'fr-FR': 'Épinglé au bord de la fenêtre', 'zh-CN': '固定到视口边缘' },
  'menu.neverClipped': { 'en-US': 'Never clipped or off-screen', 'ar-SA': 'لا يُقتطع أو يخرج عن الشاشة أبداً', 'he-IL': 'לעולם לא נחתך או יוצא מהמסך', 'ja-JP': '切れたり画面外に出たりしない', 'de-DE': 'Nie abgeschnitten oder außerhalb des Bildschirms', 'fr-FR': 'Jamais tronqué ni hors écran', 'zh-CN': '绝不裁剪或超出屏幕' },

  // ── Supporting text (baseline user-menu) ─────────────────
  'menu.viewYourProfile': { 'en-US': 'View your profile', 'ar-SA': 'عرض ملفك الشخصي', 'he-IL': 'הצגת הפרופיל שלך', 'ja-JP': 'プロフィールを表示', 'de-DE': 'Dein Profil ansehen', 'fr-FR': 'Voir votre profil', 'zh-CN': '查看你的个人资料' },
  'menu.appPreferences': { 'en-US': 'App preferences', 'ar-SA': 'تفضيلات التطبيق', 'he-IL': 'העדפות האפליקציה', 'ja-JP': 'アプリの設定', 'de-DE': 'App-Einstellungen', 'fr-FR': 'Préférences de l\'application', 'zh-CN': '应用偏好设置' },
  'menu.docsAndSupport': { 'en-US': 'Documentation & support', 'ar-SA': 'التوثيق والدعم', 'he-IL': 'תיעוד ותמיכה', 'ja-JP': 'ドキュメントとサポート', 'de-DE': 'Dokumentation & Support', 'fr-FR': 'Documentation et assistance', 'zh-CN': '文档与支持' },

  // ── Supporting text (nested-submenu two-line items) ──────
  'menu.last5Files': { 'en-US': 'Last 5 files', 'ar-SA': 'آخر 5 ملفات', 'he-IL': '5 קבצים אחרונים', 'ja-JP': '最近の5件のファイル', 'de-DE': 'Letzte 5 Dateien', 'fr-FR': '5 derniers fichiers', 'zh-CN': '最近的 5 个文件' },
  'menu.browseAll': { 'en-US': 'Browse all', 'ar-SA': 'تصفح الكل', 'he-IL': 'עיון בהכול', 'ja-JP': 'すべて表示', 'de-DE': 'Alle durchsuchen', 'fr-FR': 'Tout parcourir', 'zh-CN': '浏览全部' },
  'menu.saveToDisk': { 'en-US': 'Save to disk', 'ar-SA': 'حفظ على القرص', 'he-IL': 'שמירה לדיסק', 'ja-JP': 'ディスクに保存', 'de-DE': 'Auf Datenträger speichern', 'fr-FR': 'Enregistrer sur le disque', 'zh-CN': '保存到磁盘' },
  'menu.rasterVector': { 'en-US': 'Raster & vector', 'ar-SA': 'نقطية ومتجهة', 'he-IL': 'רסטר ווקטור', 'ja-JP': 'ラスターとベクター', 'de-DE': 'Raster & Vektor', 'fr-FR': 'Matriciel et vectoriel', 'zh-CN': '位图与矢量图' },
  'menu.toClipboard': { 'en-US': 'To clipboard', 'ar-SA': 'إلى الحافظة', 'he-IL': 'ללוח', 'ja-JP': 'クリップボードへ', 'de-DE': 'In die Zwischenablage', 'fr-FR': 'Dans le presse-papiers', 'zh-CN': '到剪贴板' },
  'menu.postToNetwork': { 'en-US': 'Post to a network', 'ar-SA': 'النشر على شبكة', 'he-IL': 'פרסום ברשת', 'ja-JP': 'ネットワークに投稿', 'de-DE': 'In einem Netzwerk posten', 'fr-FR': 'Publier sur un réseau', 'zh-CN': '发布到社交网络' },
  'menu.shareWithNetwork': { 'en-US': 'Share with network', 'ar-SA': 'المشاركة مع الشبكة', 'he-IL': 'שיתוף עם הרשת', 'ja-JP': 'ネットワークで共有', 'de-DE': 'Mit Netzwerk teilen', 'fr-FR': 'Partager avec le réseau', 'zh-CN': '与网络分享' },
  'menu.otherPlatforms': { 'en-US': 'Other platforms', 'ar-SA': 'منصات أخرى', 'he-IL': 'פלטפורמות אחרות', 'ja-JP': '他のプラットフォーム', 'de-DE': 'Andere Plattformen', 'fr-FR': 'Autres plateformes', 'zh-CN': '其他平台' },
  'menu.directMessage': { 'en-US': 'Direct message', 'ar-SA': 'رسالة مباشرة', 'he-IL': 'הודעה ישירה', 'ja-JP': 'ダイレクトメッセージ', 'de-DE': 'Direktnachricht', 'fr-FR': 'Message direct', 'zh-CN': '私信' },
  'menu.composeMessage': { 'en-US': 'Compose a message', 'ar-SA': 'كتابة رسالة', 'he-IL': 'כתיבת הודעה', 'ja-JP': 'メッセージを作成', 'de-DE': 'Nachricht verfassen', 'fr-FR': 'Rédiger un message', 'zh-CN': '撰写消息' },
  'menu.nearbyDevices': { 'en-US': 'Nearby devices', 'ar-SA': 'الأجهزة القريبة', 'he-IL': 'מכשירים בקרבת מקום', 'ja-JP': '近くのデバイス', 'de-DE': 'Geräte in der Nähe', 'fr-FR': 'Appareils à proximité', 'zh-CN': '附近的设备' },
  'menu.getEmbedCode': { 'en-US': 'Get embed code', 'ar-SA': 'الحصول على كود التضمين', 'he-IL': 'קבלת קוד הטמעה', 'ja-JP': '埋め込みコードを取得', 'de-DE': 'Einbettungscode abrufen', 'fr-FR': 'Obtenir le code d\'intégration', 'zh-CN': '获取嵌入代码' },
};
