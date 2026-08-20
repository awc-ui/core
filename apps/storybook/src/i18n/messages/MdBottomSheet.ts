import type { Entry } from '../index';

/** Per-component demo strings for the Bottom Sheet stories. Shared verbs
 *  (save, cancel, delete, edit, home) live in `common.ts` and are reused via
 *  `t(locale, '<verb>')` — only bottom-sheet-specific copy is defined here. */
export const messages: Record<string, Entry> = {
  // ── Trigger buttons ──────────────────────────────────────────────
  'bottomSheet.openBottomSheet': { 'en-US': 'Open Bottom Sheet', 'ar-SA': 'فتح الورقة السفلية', 'he-IL': 'פתיחת גיליון תחתון', 'ja-JP': 'ボトムシートを開く', 'de-DE': 'Bottom Sheet öffnen', 'fr-FR': 'Ouvrir la feuille inférieure', 'zh-CN': '打开底部动作条' },
  'bottomSheet.openStandard': { 'en-US': 'Open Standard Sheet', 'ar-SA': 'فتح الورقة القياسية', 'he-IL': 'פתיחת גיליון רגיל', 'ja-JP': '標準シートを開く', 'de-DE': 'Standard-Sheet öffnen', 'fr-FR': 'Ouvrir la feuille standard', 'zh-CN': '打开标准动作条' },
  'bottomSheet.openDetached': { 'en-US': 'Open Detached Sheet', 'ar-SA': 'فتح الورقة المنفصلة', 'he-IL': 'פתיחת גיליון מנותק', 'ja-JP': '分離シートを開く', 'de-DE': 'Losgelöstes Sheet öffnen', 'fr-FR': 'Ouvrir la feuille détachée', 'zh-CN': '打开分离式动作条' },
  'bottomSheet.openStandardShort': { 'en-US': 'Open Standard', 'ar-SA': 'فتح القياسية', 'he-IL': 'פתיחת רגיל', 'ja-JP': '標準を開く', 'de-DE': 'Standard öffnen', 'fr-FR': 'Ouvrir standard', 'zh-CN': '打开标准' },
  'bottomSheet.openDetachedShort': { 'en-US': 'Open Detached', 'ar-SA': 'فتح المنفصلة', 'he-IL': 'פתיחת מנותק', 'ja-JP': '分離を開く', 'de-DE': 'Losgelöst öffnen', 'fr-FR': 'Ouvrir détachée', 'zh-CN': '打开分离式' },
  'bottomSheet.openSheet': { 'en-US': 'Open Sheet', 'ar-SA': 'فتح الورقة', 'he-IL': 'פתיחת גיליון', 'ja-JP': 'シートを開く', 'de-DE': 'Sheet öffnen', 'fr-FR': 'Ouvrir la feuille', 'zh-CN': '打开动作条' },
  'bottomSheet.openWithActions': { 'en-US': 'Open With Actions', 'ar-SA': 'فتح مع الإجراءات', 'he-IL': 'פתיחה עם פעולות', 'ja-JP': 'アクション付きで開く', 'de-DE': 'Mit Aktionen öffnen', 'fr-FR': 'Ouvrir avec actions', 'zh-CN': '打开（含操作）' },
  'bottomSheet.openScrollable': { 'en-US': 'Open Scrollable', 'ar-SA': 'فتح القابلة للتمرير', 'he-IL': 'פתיחת גלילה', 'ja-JP': 'スクロール可能を開く', 'de-DE': 'Scrollbar öffnen', 'fr-FR': 'Ouvrir défilable', 'zh-CN': '打开可滚动' },
  'bottomSheet.openNonDismissible': { 'en-US': 'Open Non-Dismissible', 'ar-SA': 'فتح غير القابلة للإغلاق', 'he-IL': 'פתיחה ללא אפשרות סגירה', 'ja-JP': '閉じられないシートを開く', 'de-DE': 'Nicht schließbar öffnen', 'fr-FR': 'Ouvrir non fermable', 'zh-CN': '打开不可关闭' },
  'bottomSheet.openDraggable': { 'en-US': 'Open Draggable Sheet', 'ar-SA': 'فتح الورقة القابلة للسحب', 'he-IL': 'פתיחת גיליון נגרר', 'ja-JP': 'ドラッグ可能なシートを開く', 'de-DE': 'Ziehbares Sheet öffnen', 'fr-FR': 'Ouvrir la feuille déplaçable', 'zh-CN': '打开可拖动动作条' },
  'bottomSheet.openForm': { 'en-US': 'Open Form', 'ar-SA': 'فتح النموذج', 'he-IL': 'פתיחת טופס', 'ja-JP': 'フォームを開く', 'de-DE': 'Formular öffnen', 'fr-FR': 'Ouvrir le formulaire', 'zh-CN': '打开表单' },
  'bottomSheet.openDarkTheme': { 'en-US': 'Open in Dark Theme', 'ar-SA': 'فتح في السمة الداكنة', 'he-IL': 'פתיחה בערכת נושא כהה', 'ja-JP': 'ダークテーマで開く', 'de-DE': 'Im dunklen Design öffnen', 'fr-FR': 'Ouvrir en thème sombre', 'zh-CN': '以深色主题打开' },

  // ── Sheet headlines ──────────────────────────────────────────────
  'bottomSheet.share': { 'en-US': 'Share', 'ar-SA': 'مشاركة', 'he-IL': 'שיתוף', 'ja-JP': '共有', 'de-DE': 'Teilen', 'fr-FR': 'Partager', 'zh-CN': '分享' },
  'bottomSheet.notificationSettings': { 'en-US': 'Notification settings', 'ar-SA': 'إعدادات الإشعارات', 'he-IL': 'הגדרות התראות', 'ja-JP': '通知設定', 'de-DE': 'Benachrichtigungseinstellungen', 'fr-FR': 'Paramètres de notification', 'zh-CN': '通知设置' },
  'bottomSheet.customDismiss': { 'en-US': 'Custom dismiss', 'ar-SA': 'إغلاق مخصص', 'he-IL': 'סגירה מותאמת אישית', 'ja-JP': 'カスタム閉じる', 'de-DE': 'Benutzerdefiniertes Schließen', 'fr-FR': 'Fermeture personnalisée', 'zh-CN': '自定义关闭' },
  'bottomSheet.deleteItemQ': { 'en-US': 'Delete item?', 'ar-SA': 'حذف العنصر؟', 'he-IL': 'למחוק את הפריט?', 'ja-JP': 'アイテムを削除しますか？', 'de-DE': 'Element löschen?', 'fr-FR': 'Supprimer l\'élément ?', 'zh-CN': '删除项目？' },
  'bottomSheet.termsConditions': { 'en-US': 'Terms & Conditions', 'ar-SA': 'الشروط والأحكام', 'he-IL': 'תנאים והגבלות', 'ja-JP': '利用規約', 'de-DE': 'Geschäftsbedingungen', 'fr-FR': 'Conditions générales', 'zh-CN': '条款和条件' },
  'bottomSheet.requiredAction': { 'en-US': 'Required Action', 'ar-SA': 'إجراء مطلوب', 'he-IL': 'פעולה נדרשת', 'ja-JP': '必須の操作', 'de-DE': 'Erforderliche Aktion', 'fr-FR': 'Action requise', 'zh-CN': '必需操作' },
  'bottomSheet.dragMeDown': { 'en-US': 'Drag Me Down', 'ar-SA': 'اسحبني للأسفل', 'he-IL': 'גרור אותי למטה', 'ja-JP': '下にドラッグ', 'de-DE': 'Nach unten ziehen', 'fr-FR': 'Faites-moi glisser vers le bas', 'zh-CN': '向下拖动' },
  'bottomSheet.nowPlaying': { 'en-US': 'Now Playing', 'ar-SA': 'قيد التشغيل الآن', 'he-IL': 'מתנגן כעת', 'ja-JP': '再生中', 'de-DE': 'Wird gerade abgespielt', 'fr-FR': 'En cours de lecture', 'zh-CN': '正在播放' },
  'bottomSheet.filters': { 'en-US': 'Filters', 'ar-SA': 'عوامل التصفية', 'he-IL': 'מסננים', 'ja-JP': 'フィルタ', 'de-DE': 'Filter', 'fr-FR': 'Filtres', 'zh-CN': '筛选器' },
  'bottomSheet.options': { 'en-US': 'Options', 'ar-SA': 'خيارات', 'he-IL': 'אפשרויות', 'ja-JP': 'オプション', 'de-DE': 'Optionen', 'fr-FR': 'Options', 'zh-CN': '选项' },
  'bottomSheet.contactUs': { 'en-US': 'Contact Us', 'ar-SA': 'اتصل بنا', 'he-IL': 'צור קשר', 'ja-JP': 'お問い合わせ', 'de-DE': 'Kontakt', 'fr-FR': 'Contactez-nous', 'zh-CN': '联系我们' },

  // ── List items ───────────────────────────────────────────────────
  'bottomSheet.shareEmail': { 'en-US': 'Share via Email', 'ar-SA': 'المشاركة عبر البريد الإلكتروني', 'he-IL': 'שיתוף בדוא״ל', 'ja-JP': 'メールで共有', 'de-DE': 'Per E-Mail teilen', 'fr-FR': 'Partager par e-mail', 'zh-CN': '通过电子邮件分享' },
  'bottomSheet.copyLink': { 'en-US': 'Copy Link', 'ar-SA': 'نسخ الرابط', 'he-IL': 'העתקת קישור', 'ja-JP': 'リンクをコピー', 'de-DE': 'Link kopieren', 'fr-FR': 'Copier le lien', 'zh-CN': '复制链接' },
  'bottomSheet.saveToDrive': { 'en-US': 'Save to Drive', 'ar-SA': 'حفظ في درايف', 'he-IL': 'שמירה ב-Drive', 'ja-JP': 'ドライブに保存', 'de-DE': 'Auf Drive speichern', 'fr-FR': 'Enregistrer sur Drive', 'zh-CN': '保存到云端硬盘' },
  'bottomSheet.print': { 'en-US': 'Print', 'ar-SA': 'طباعة', 'he-IL': 'הדפסה', 'ja-JP': '印刷', 'de-DE': 'Drucken', 'fr-FR': 'Imprimer', 'zh-CN': '打印' },
  'bottomSheet.shareLink': { 'en-US': 'Share via Link', 'ar-SA': 'المشاركة عبر رابط', 'he-IL': 'שיתוף באמצעות קישור', 'ja-JP': 'リンクで共有', 'de-DE': 'Per Link teilen', 'fr-FR': 'Partager par lien', 'zh-CN': '通过链接分享' },
  'bottomSheet.copyClipboard': { 'en-US': 'Copy to Clipboard', 'ar-SA': 'نسخ إلى الحافظة', 'he-IL': 'העתקה ללוח', 'ja-JP': 'クリップボードにコピー', 'de-DE': 'In Zwischenablage kopieren', 'fr-FR': 'Copier dans le presse-papiers', 'zh-CN': '复制到剪贴板' },
  'bottomSheet.emailDigest': { 'en-US': 'Email digest', 'ar-SA': 'ملخص البريد الإلكتروني', 'he-IL': 'תקציר דוא״ל', 'ja-JP': 'メールダイジェスト', 'de-DE': 'E-Mail-Zusammenfassung', 'fr-FR': 'Résumé par e-mail', 'zh-CN': '电子邮件摘要' },
  'bottomSheet.pushNotifications': { 'en-US': 'Push notifications', 'ar-SA': 'الإشعارات الفورية', 'he-IL': 'התראות דחיפה', 'ja-JP': 'プッシュ通知', 'de-DE': 'Push-Benachrichtigungen', 'fr-FR': 'Notifications push', 'zh-CN': '推送通知' },
  'bottomSheet.smsAlerts': { 'en-US': 'SMS alerts', 'ar-SA': 'تنبيهات الرسائل النصية', 'he-IL': 'התראות SMS', 'ja-JP': 'SMS通知', 'de-DE': 'SMS-Benachrichtigungen', 'fr-FR': 'Alertes SMS', 'zh-CN': '短信提醒' },
  'bottomSheet.duplicate': { 'en-US': 'Duplicate', 'ar-SA': 'تكرار', 'he-IL': 'שכפול', 'ja-JP': '複製', 'de-DE': 'Duplizieren', 'fr-FR': 'Dupliquer', 'zh-CN': '复制' },

  // ── Filter panel ─────────────────────────────────────────────────
  'bottomSheet.category': { 'en-US': 'Category', 'ar-SA': 'الفئة', 'he-IL': 'קטגוריה', 'ja-JP': 'カテゴリ', 'de-DE': 'Kategorie', 'fr-FR': 'Catégorie', 'zh-CN': '类别' },
  'bottomSheet.electronics': { 'en-US': 'Electronics', 'ar-SA': 'إلكترونيات', 'he-IL': 'אלקטרוניקה', 'ja-JP': '電化製品', 'de-DE': 'Elektronik', 'fr-FR': 'Électronique', 'zh-CN': '电子产品' },
  'bottomSheet.clothing': { 'en-US': 'Clothing', 'ar-SA': 'ملابس', 'he-IL': 'ביגוד', 'ja-JP': '衣類', 'de-DE': 'Kleidung', 'fr-FR': 'Vêtements', 'zh-CN': '服装' },
  'bottomSheet.books': { 'en-US': 'Books', 'ar-SA': 'كتب', 'he-IL': 'ספרים', 'ja-JP': '書籍', 'de-DE': 'Bücher', 'fr-FR': 'Livres', 'zh-CN': '图书' },
  'bottomSheet.priceRange': { 'en-US': 'Price Range', 'ar-SA': 'نطاق السعر', 'he-IL': 'טווח מחירים', 'ja-JP': '価格帯', 'de-DE': 'Preisspanne', 'fr-FR': 'Gamme de prix', 'zh-CN': '价格范围' },
  'bottomSheet.availability': { 'en-US': 'Availability', 'ar-SA': 'التوفر', 'he-IL': 'זמינות', 'ja-JP': '在庫状況', 'de-DE': 'Verfügbarkeit', 'fr-FR': 'Disponibilité', 'zh-CN': '库存情况' },
  'bottomSheet.inStock': { 'en-US': 'In stock', 'ar-SA': 'متوفر', 'he-IL': 'במלאי', 'ja-JP': '在庫あり', 'de-DE': 'Auf Lager', 'fr-FR': 'En stock', 'zh-CN': '有货' },
  'bottomSheet.preOrder': { 'en-US': 'Pre-order', 'ar-SA': 'طلب مسبق', 'he-IL': 'הזמנה מוקדמת', 'ja-JP': '予約注文', 'de-DE': 'Vorbestellung', 'fr-FR': 'Précommande', 'zh-CN': '预订' },
  'bottomSheet.outOfStock': { 'en-US': 'Out of stock', 'ar-SA': 'نفد المخزون', 'he-IL': 'אזל מהמלאי', 'ja-JP': '在庫切れ', 'de-DE': 'Nicht auf Lager', 'fr-FR': 'En rupture de stock', 'zh-CN': '缺货' },
  'bottomSheet.apply': { 'en-US': 'Apply', 'ar-SA': 'تطبيق', 'he-IL': 'החלה', 'ja-JP': '適用', 'de-DE': 'Übernehmen', 'fr-FR': 'Appliquer', 'zh-CN': '应用' },
  'bottomSheet.clearAll': { 'en-US': 'Clear All', 'ar-SA': 'مسح الكل', 'he-IL': 'ניקוי הכול', 'ja-JP': 'すべてクリア', 'de-DE': 'Alle löschen', 'fr-FR': 'Tout effacer', 'zh-CN': '全部清除' },

  // ── Action buttons ───────────────────────────────────────────────
  'bottomSheet.done': { 'en-US': 'Done', 'ar-SA': 'تم', 'he-IL': 'סיום', 'ja-JP': '完了', 'de-DE': 'Fertig', 'fr-FR': 'Terminé', 'zh-CN': '完成' },
  'bottomSheet.accept': { 'en-US': 'Accept', 'ar-SA': 'قبول', 'he-IL': 'אישור', 'ja-JP': '同意する', 'de-DE': 'Akzeptieren', 'fr-FR': 'Accepter', 'zh-CN': '接受' },
  'bottomSheet.decline': { 'en-US': 'Decline', 'ar-SA': 'رفض', 'he-IL': 'דחייה', 'ja-JP': '拒否する', 'de-DE': 'Ablehnen', 'fr-FR': 'Refuser', 'zh-CN': '拒绝' },
  'bottomSheet.iUnderstand': { 'en-US': 'I Understand', 'ar-SA': 'أفهم ذلك', 'he-IL': 'הבנתי', 'ja-JP': '理解しました', 'de-DE': 'Ich verstehe', 'fr-FR': 'J\'ai compris', 'zh-CN': '我知道了' },
  'bottomSheet.send': { 'en-US': 'Send', 'ar-SA': 'إرسال', 'he-IL': 'שליחה', 'ja-JP': '送信', 'de-DE': 'Senden', 'fr-FR': 'Envoyer', 'zh-CN': '发送' },

  // ── Form fields ──────────────────────────────────────────────────
  'bottomSheet.fullName': { 'en-US': 'Full name', 'ar-SA': 'الاسم الكامل', 'he-IL': 'שם מלא', 'ja-JP': '氏名', 'de-DE': 'Vollständiger Name', 'fr-FR': 'Nom complet', 'zh-CN': '全名' },
  'bottomSheet.emailAddress': { 'en-US': 'Email address', 'ar-SA': 'عنوان البريد الإلكتروني', 'he-IL': 'כתובת דוא״ל', 'ja-JP': 'メールアドレス', 'de-DE': 'E-Mail-Adresse', 'fr-FR': 'Adresse e-mail', 'zh-CN': '电子邮件地址' },
  'bottomSheet.subject': { 'en-US': 'Subject', 'ar-SA': 'الموضوع', 'he-IL': 'נושא', 'ja-JP': '件名', 'de-DE': 'Betreff', 'fr-FR': 'Objet', 'zh-CN': '主题' },
  'bottomSheet.agreeTerms': { 'en-US': 'I agree to the terms and conditions', 'ar-SA': 'أوافق على الشروط والأحكام', 'he-IL': 'אני מסכים לתנאים ולהגבלות', 'ja-JP': '利用規約に同意します', 'de-DE': 'Ich stimme den Geschäftsbedingungen zu', 'fr-FR': 'J\'accepte les conditions générales', 'zh-CN': '我同意条款和条件' },

  // ── Body copy ────────────────────────────────────────────────────
  'bottomSheet.deleteItemBody': { 'en-US': 'This action cannot be undone. The item will be permanently removed.', 'ar-SA': 'لا يمكن التراجع عن هذا الإجراء. سيتم حذف العنصر نهائيًا.', 'he-IL': 'לא ניתן לבטל פעולה זו. הפריט יימחק לצמיתות.', 'ja-JP': 'この操作は取り消せません。アイテムは完全に削除されます。', 'de-DE': 'Diese Aktion kann nicht rückgängig gemacht werden. Das Element wird dauerhaft entfernt.', 'fr-FR': 'Cette action est irréversible. L\'élément sera définitivement supprimé.', 'zh-CN': '此操作无法撤消。该项目将被永久删除。' },
  'bottomSheet.requiredActionBody': { 'en-US': 'You must take an action. Clicking the scrim will not close this sheet.', 'ar-SA': 'يجب عليك اتخاذ إجراء. لن يؤدي النقر على الحاجب إلى إغلاق هذه الورقة.', 'he-IL': 'עליך לבצע פעולה. לחיצה על הרקע לא תסגור גיליון זה.', 'ja-JP': '操作を行う必要があります。スクリムをクリックしてもこのシートは閉じません。', 'de-DE': 'Sie müssen eine Aktion ausführen. Ein Klick auf den Schleier schließt dieses Sheet nicht.', 'fr-FR': 'Vous devez effectuer une action. Cliquer sur le voile ne fermera pas cette feuille.', 'zh-CN': '您必须执行操作。点击遮罩不会关闭此动作条。' },
  'bottomSheet.dragIntro': { 'en-US': 'Grab the drag handle and swipe down to dismiss. Drag past 100 px to close, or release earlier to snap back.', 'ar-SA': 'أمسك مقبض السحب واسحب للأسفل للإغلاق. اسحب لأكثر من 100 px للإغلاق، أو حرّر مبكرًا للعودة.', 'he-IL': 'אחוז בידית הגרירה והחלק מטה כדי לסגור. גרור מעבר ל-100 px כדי לסגור, או שחרר מוקדם יותר כדי לחזור.', 'ja-JP': 'ドラッグハンドルをつかんで下にスワイプすると閉じます。100 px を超えてドラッグすると閉じ、手前で離すと元に戻ります。', 'de-DE': 'Fassen Sie den Ziehgriff und wischen Sie nach unten, um zu schließen. Ziehen Sie über 100 px, um zu schließen, oder lassen Sie früher los, um zurückzuschnappen.', 'fr-FR': 'Saisissez la poignée de glissement et balayez vers le bas pour fermer. Faites glisser au-delà de 100 px pour fermer, ou relâchez plus tôt pour revenir.', 'zh-CN': '抓住拖动手柄并向下滑动即可关闭。拖动超过 100 px 即可关闭，或提前松开以弹回。' },
  'bottomSheet.dragInstruction': { 'en-US': 'Grab the handle above and drag downward. Release past the threshold to dismiss.', 'ar-SA': 'أمسك المقبض بالأعلى واسحب للأسفل. حرّر بعد تجاوز الحد للإغلاق.', 'he-IL': 'אחוז בידית שלמעלה וגרור מטה. שחרר מעבר לסף כדי לסגור.', 'ja-JP': '上のハンドルをつかんで下にドラッグします。しきい値を超えて離すと閉じます。', 'de-DE': 'Fassen Sie den Griff oben und ziehen Sie nach unten. Lassen Sie jenseits des Schwellenwerts los, um zu schließen.', 'fr-FR': 'Saisissez la poignée ci-dessus et faites glisser vers le bas. Relâchez au-delà du seuil pour fermer.', 'zh-CN': '抓住上方的手柄并向下拖动。超过阈值后松开即可关闭。' },
};
