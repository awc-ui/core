import type { Entry } from '../index';

/** Tooltip demo strings — only the genuine user-facing popup content is localized:
 *  the plain-tooltip labels (PlainTooltips), the camera-permission rich tooltip
 *  (RichTooltip), and the realistic rich-tooltip messages + their action buttons
 *  (RichConfigurations). The "Save/Delete/Edit" plain tooltips reuse the shared
 *  verbs from `common.ts`.
 *
 *  Left byte-for-byte in the story (NOT localized here): every `aria-label`
 *  accessible name (per the MdIconButton/MdAppBar convention); the technical /
 *  mechanic demo descriptors (placement `Position: top`, offset `offset=8`,
 *  auto-position, CSS-var and `::part` demos, dark-theme / slot descriptor copy,
 *  the RichConfigurations trigger labels like `Subhead + text + 2 buttons`); the
 *  `top`/`bottom`/… enum values and prop names; and the dedicated Localization,
 *  RTL, Responsiveness and Accessibility showcases, which carry their own inline
 *  per-locale content or documentation prose. */
export const messages: Record<string, Entry> = {
  'tooltip.share': { 'en-US': 'Share', 'ar-SA': 'مشاركة', 'he-IL': 'שיתוף', 'ja-JP': '共有', 'de-DE': 'Teilen', 'fr-FR': 'Partager', 'zh-CN': '分享' },
  'tooltip.favoriteThisItem': { 'en-US': 'Favorite this item', 'ar-SA': 'إضافة هذا العنصر إلى المفضلة', 'he-IL': 'הוספת פריט זה למועדפים', 'ja-JP': 'このアイテムをお気に入りに追加', 'de-DE': 'Dieses Element zu Favoriten hinzufügen', 'fr-FR': 'Ajouter cet élément aux favoris', 'zh-CN': '收藏此项' },

  'tooltip.grantCameraAccess': { 'en-US': 'Grant camera access', 'ar-SA': 'منح إذن الوصول إلى الكاميرا', 'he-IL': 'מתן גישה למצלמה', 'ja-JP': 'カメラへのアクセスを許可', 'de-DE': 'Kamerazugriff gewähren', 'fr-FR': "Autoriser l'accès à la caméra", 'zh-CN': '授予相机访问权限' },
  'tooltip.cameraAccessBody': { 'en-US': 'This lets the app take photos and record videos. You can change this in Settings.', 'ar-SA': 'يتيح ذلك للتطبيق التقاط الصور وتسجيل مقاطع الفيديو. يمكنك تغيير ذلك في الإعدادات.', 'he-IL': 'כך האפליקציה תוכל לצלם תמונות ולהקליט סרטונים. אפשר לשנות זאת בהגדרות.', 'ja-JP': 'これにより、アプリで写真の撮影と動画の録画ができるようになります。設定で変更できます。', 'de-DE': 'Dadurch kann die App Fotos aufnehmen und Videos aufzeichnen. Sie können dies in den Einstellungen ändern.', 'fr-FR': "Cela permet à l'application de prendre des photos et d'enregistrer des vidéos. Vous pouvez modifier ce réglage dans les Paramètres.", 'zh-CN': '这将允许应用拍摄照片和录制视频。您可以在设置中更改此权限。' },

  'tooltip.autoSave': { 'en-US': 'Auto-save', 'ar-SA': 'الحفظ التلقائي', 'he-IL': 'שמירה אוטומטית', 'ja-JP': '自動保存', 'de-DE': 'Automatisches Speichern', 'fr-FR': 'Enregistrement automatique', 'zh-CN': '自动保存' },
  'tooltip.autoSaveBody': { 'en-US': 'Your work is saved automatically every 5 minutes to prevent data loss.', 'ar-SA': 'يتم حفظ عملك تلقائيًا كل 5 دقائق لمنع فقدان البيانات.', 'he-IL': 'העבודה שלך נשמרת אוטומטית כל 5 דקות כדי למנוע אובדן נתונים.', 'ja-JP': 'データの損失を防ぐため、作業内容は5分ごとに自動的に保存されます。', 'de-DE': 'Ihre Arbeit wird alle 5 Minuten automatisch gespeichert, um Datenverlust zu vermeiden.', 'fr-FR': 'Votre travail est enregistré automatiquement toutes les 5 minutes pour éviter toute perte de données.', 'zh-CN': '系统每 5 分钟自动保存您的工作，以防数据丢失。' },
  'tooltip.learnMore': { 'en-US': 'Learn more', 'ar-SA': 'معرفة المزيد', 'he-IL': 'מידע נוסף', 'ja-JP': '詳細', 'de-DE': 'Mehr erfahren', 'fr-FR': 'En savoir plus', 'zh-CN': '了解详情' },
  'tooltip.gotIt': { 'en-US': 'Got it', 'ar-SA': 'فهمت', 'he-IL': 'הבנתי', 'ja-JP': '了解', 'de-DE': 'Verstanden', 'fr-FR': 'Compris', 'zh-CN': '知道了' },

  'tooltip.newFeature': { 'en-US': 'New feature', 'ar-SA': 'ميزة جديدة', 'he-IL': 'תכונה חדשה', 'ja-JP': '新機能', 'de-DE': 'Neue Funktion', 'fr-FR': 'Nouvelle fonctionnalité', 'zh-CN': '新功能' },
  'tooltip.newFeatureBody': { 'en-US': 'Try the new drag-and-drop editor for faster workflow.', 'ar-SA': 'جرّب محرر السحب والإفلات الجديد لسير عمل أسرع.', 'he-IL': 'נסו את עורך הגרירה והשחרור החדש לזרימת עבודה מהירה יותר.', 'ja-JP': '新しいドラッグ&ドロップ エディタで作業をより速く。', 'de-DE': 'Testen Sie den neuen Drag-and-drop-Editor für einen schnelleren Arbeitsablauf.', 'fr-FR': 'Essayez le nouvel éditeur glisser-déposer pour un travail plus rapide.', 'zh-CN': '试试新的拖放编辑器，让工作流程更快捷。' },

  'tooltip.keyboardShortcut': { 'en-US': 'Keyboard shortcut', 'ar-SA': 'اختصار لوحة المفاتيح', 'he-IL': 'קיצור מקלדת', 'ja-JP': 'キーボード ショートカット', 'de-DE': 'Tastenkürzel', 'fr-FR': 'Raccourci clavier', 'zh-CN': '键盘快捷键' },
  'tooltip.ctrlSBody': { 'en-US': 'Press Ctrl+S to save your document at any time.', 'ar-SA': 'اضغط Ctrl+S لحفظ مستندك في أي وقت.', 'he-IL': 'הקישו Ctrl+S כדי לשמור את המסמך בכל עת.', 'ja-JP': 'Ctrl+S を押すと、いつでもドキュメントを保存できます。', 'de-DE': 'Drücken Sie Strg+S, um Ihr Dokument jederzeit zu speichern.', 'fr-FR': 'Appuyez sur Ctrl+S pour enregistrer votre document à tout moment.', 'zh-CN': '随时按 Ctrl+S 保存文档。' },

  'tooltip.undoneBody': { 'en-US': 'This action cannot be undone. Proceed with caution.', 'ar-SA': 'لا يمكن التراجع عن هذا الإجراء. تابع بحذر.', 'he-IL': 'לא ניתן לבטל פעולה זו. יש להמשיך בזהירות.', 'ja-JP': 'この操作は元に戻せません。慎重に続行してください。', 'de-DE': 'Diese Aktion kann nicht rückgängig gemacht werden. Fahren Sie mit Vorsicht fort.', 'fr-FR': 'Cette action est irréversible. Procédez avec prudence.', 'zh-CN': '此操作无法撤消。请谨慎操作。' },
  'tooltip.dismiss': { 'en-US': 'Dismiss', 'ar-SA': 'تجاهل', 'he-IL': 'סגירה', 'ja-JP': '閉じる', 'de-DE': 'Schließen', 'fr-FR': 'Ignorer', 'zh-CN': '关闭' },

  'tooltip.enableNotificationsBody': { 'en-US': 'Enable notifications to stay updated on project changes.', 'ar-SA': 'فعّل الإشعارات لتبقى على اطّلاع بتغييرات المشروع.', 'he-IL': 'הפעילו התראות כדי להתעדכן בשינויים בפרויקט.', 'ja-JP': '通知を有効にして、プロジェクトの変更を常に把握しましょう。', 'de-DE': 'Aktivieren Sie Benachrichtigungen, um über Projektänderungen auf dem Laufenden zu bleiben.', 'fr-FR': 'Activez les notifications pour rester informé des modifications du projet.', 'zh-CN': '启用通知，及时了解项目变更。' },
  'tooltip.notNow': { 'en-US': 'Not now', 'ar-SA': 'ليس الآن', 'he-IL': 'לא עכשיו', 'ja-JP': '後で', 'de-DE': 'Nicht jetzt', 'fr-FR': 'Pas maintenant', 'zh-CN': '暂不' },
  'tooltip.enable': { 'en-US': 'Enable', 'ar-SA': 'تفعيل', 'he-IL': 'הפעלה', 'ja-JP': '有効にする', 'de-DE': 'Aktivieren', 'fr-FR': 'Activer', 'zh-CN': '启用' },
};
