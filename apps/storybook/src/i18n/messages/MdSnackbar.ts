import type { Entry } from '../index';

/** Demo strings for the Snackbar stories. Only genuine user-facing snackbar
 *  content is localized: the "Show Snackbar" trigger button, the snackbar
 *  messages, and the action-button labels (Undo / View / Retry / …). The
 *  position-name labels in the Positions story ("Top-start", "Bottom-end", …)
 *  are direct echoes of the `position` enum and stay as-is, as do the
 *  intentional static-locale RTL / Localization demos, the slotted-HTML
 *  "report.pdf" fragment, the event-log debug output, and the explanatory demo
 *  prose. */
export const messages: Record<string, Entry> = {
  'snackbar.show': { 'en-US': 'Show Snackbar', 'ar-SA': 'عرض الإشعار', 'he-IL': 'הצג הודעה', 'ja-JP': 'スナックバーを表示', 'de-DE': 'Snackbar anzeigen', 'fr-FR': 'Afficher la snackbar', 'zh-CN': '显示消息条' },
  'snackbar.file-saved': { 'en-US': 'File saved', 'ar-SA': 'تم حفظ الملف', 'he-IL': 'הקובץ נשמר', 'ja-JP': 'ファイルを保存しました', 'de-DE': 'Datei gespeichert', 'fr-FR': 'Fichier enregistré', 'zh-CN': '文件已保存' },
  'snackbar.item-deleted': { 'en-US': 'Item deleted', 'ar-SA': 'تم حذف العنصر', 'he-IL': 'הפריט נמחק', 'ja-JP': '項目を削除しました', 'de-DE': 'Element gelöscht', 'fr-FR': 'Élément supprimé', 'zh-CN': '项目已删除' },
  'snackbar.undo': { 'en-US': 'Undo', 'ar-SA': 'تراجع', 'he-IL': 'ביטול', 'ja-JP': '元に戻す', 'de-DE': 'Rückgängig', 'fr-FR': 'Annuler', 'zh-CN': '撤销' },
  'snackbar.wrap-long': { 'en-US': 'This message is long enough to wrap onto a second line when displayed inside the snackbar container', 'ar-SA': 'هذه الرسالة طويلة بما يكفي لتنتقل إلى سطر ثانٍ عند عرضها داخل حاوية الإشعار', 'he-IL': 'הודעה זו ארוכה מספיק כדי לעבור לשורה שנייה כאשר היא מוצגת בתוך מיכל ההודעה', 'ja-JP': 'このメッセージはスナックバーのコンテナ内に表示されると2行目に折り返されるほど長くなっています', 'de-DE': 'Diese Nachricht ist lang genug, um in einer zweiten Zeile umzubrechen, wenn sie im Snackbar-Container angezeigt wird', 'fr-FR': "Ce message est assez long pour passer à une deuxième ligne lorsqu'il est affiché dans le conteneur de la snackbar", 'zh-CN': '这条消息足够长，在消息条容器内显示时会换行到第二行' },
  'snackbar.wrap-long-action': { 'en-US': 'This message is long enough to wrap onto a second line when displayed inside the snackbar', 'ar-SA': 'هذه الرسالة طويلة بما يكفي لتنتقل إلى سطر ثانٍ عند عرضها داخل الإشعار', 'he-IL': 'הודעה זו ארוכה מספיק כדי לעבור לשורה שנייה כאשר היא מוצגת בתוך ההודעה', 'ja-JP': 'このメッセージはスナックバー内に表示されると2行目に折り返されるほど長くなっています', 'de-DE': 'Diese Nachricht ist lang genug, um in einer zweiten Zeile umzubrechen, wenn sie in der Snackbar angezeigt wird', 'fr-FR': "Ce message est assez long pour passer à une deuxième ligne lorsqu'il est affiché dans la snackbar", 'zh-CN': '这条消息足够长，在消息条内显示时会换行到第二行' },
  'snackbar.moved-to-trash': { 'en-US': 'This item has been moved to trash', 'ar-SA': 'تم نقل هذا العنصر إلى المهملات', 'he-IL': 'הפריט הועבר לאשפה', 'ja-JP': 'この項目をゴミ箱に移動しました', 'de-DE': 'Dieses Element wurde in den Papierkorb verschoben', 'fr-FR': 'Cet élément a été déplacé vers la corbeille', 'zh-CN': '该项目已移至回收站' },
  'snackbar.undo-action': { 'en-US': 'Undo this action', 'ar-SA': 'التراجع عن هذا الإجراء', 'he-IL': 'בטל פעולה זו', 'ja-JP': 'この操作を元に戻す', 'de-DE': 'Diese Aktion rückgängig machen', 'fr-FR': 'Annuler cette action', 'zh-CN': '撤销此操作' },
  'snackbar.connection-restored': { 'en-US': 'Connection restored', 'ar-SA': 'تمت استعادة الاتصال', 'he-IL': 'החיבור שוחזר', 'ja-JP': '接続が回復しました', 'de-DE': 'Verbindung wiederhergestellt', 'fr-FR': 'Connexion rétablie', 'zh-CN': '连接已恢复' },
  'snackbar.message-archived': { 'en-US': 'Message archived', 'ar-SA': 'تمت أرشفة الرسالة', 'he-IL': 'ההודעה הועברה לארכיון', 'ja-JP': 'メッセージをアーカイブしました', 'de-DE': 'Nachricht archiviert', 'fr-FR': 'Message archivé', 'zh-CN': '消息已归档' },
  'snackbar.view': { 'en-US': 'View', 'ar-SA': 'عرض', 'he-IL': 'הצגה', 'ja-JP': '表示', 'de-DE': 'Ansehen', 'fr-FR': 'Afficher', 'zh-CN': '查看' },
  'snackbar.no-connection': { 'en-US': 'No internet connection', 'ar-SA': 'لا يوجد اتصال بالإنترنت', 'he-IL': 'אין חיבור לאינטרנט', 'ja-JP': 'インターネット接続がありません', 'de-DE': 'Keine Internetverbindung', 'fr-FR': 'Aucune connexion Internet', 'zh-CN': '无网络连接' },
  'snackbar.retry': { 'en-US': 'Retry', 'ar-SA': 'إعادة المحاولة', 'he-IL': 'נסה שוב', 'ja-JP': '再試行', 'de-DE': 'Wiederholen', 'fr-FR': 'Réessayer', 'zh-CN': '重试' },
  'snackbar.error-style': { 'en-US': 'Error Style', 'ar-SA': 'نمط الخطأ', 'he-IL': 'סגנון שגיאה', 'ja-JP': 'エラースタイル', 'de-DE': 'Fehler-Stil', 'fr-FR': "Style d'erreur", 'zh-CN': '错误样式' },
  'snackbar.brand-style': { 'en-US': 'Brand Style', 'ar-SA': 'نمط العلامة التجارية', 'he-IL': 'סגנון מותג', 'ja-JP': 'ブランドスタイル', 'de-DE': 'Marken-Stil', 'fr-FR': 'Style de marque', 'zh-CN': '品牌样式' },
  'snackbar.upload-failed': { 'en-US': 'Failed to upload file', 'ar-SA': 'فشل تحميل الملف', 'he-IL': 'העלאת הקובץ נכשלה', 'ja-JP': 'ファイルのアップロードに失敗しました', 'de-DE': 'Datei-Upload fehlgeschlagen', 'fr-FR': 'Échec du téléchargement du fichier', 'zh-CN': '文件上传失败' },
  'snackbar.welcome': { 'en-US': 'Welcome to the app', 'ar-SA': 'مرحبًا بك في التطبيق', 'he-IL': 'ברוכים הבאים לאפליקציה', 'ja-JP': 'アプリへようこそ', 'de-DE': 'Willkommen in der App', 'fr-FR': "Bienvenue dans l'application", 'zh-CN': '欢迎使用本应用' },
  'snackbar.explore': { 'en-US': 'Explore', 'ar-SA': 'استكشاف', 'he-IL': 'גלה', 'ja-JP': '探索', 'de-DE': 'Entdecken', 'fr-FR': 'Explorer', 'zh-CN': '探索' },
  'snackbar.styled-parts': { 'en-US': 'Styled with CSS parts', 'ar-SA': 'مُنسَّق باستخدام أجزاء CSS', 'he-IL': 'מעוצב באמצעות CSS parts', 'ja-JP': 'CSS parts でスタイル設定', 'de-DE': 'Mit CSS Parts gestaltet', 'fr-FR': 'Stylé avec des CSS parts', 'zh-CN': '使用 CSS part 设置样式' },
  'snackbar.nice': { 'en-US': 'Nice', 'ar-SA': 'رائع', 'he-IL': 'מעולה', 'ja-JP': 'いいね', 'de-DE': 'Schön', 'fr-FR': 'Super', 'zh-CN': '不错' },
  'snackbar.message-events': { 'en-US': 'Message with events', 'ar-SA': 'رسالة مع أحداث', 'he-IL': 'הודעה עם אירועים', 'ja-JP': 'イベント付きメッセージ', 'de-DE': 'Nachricht mit Ereignissen', 'fr-FR': 'Message avec événements', 'zh-CN': '带事件的消息' },
  'snackbar.action': { 'en-US': 'Action', 'ar-SA': 'إجراء', 'he-IL': 'פעולה', 'ja-JP': 'アクション', 'de-DE': 'Aktion', 'fr-FR': 'Action', 'zh-CN': '操作' },
  'snackbar.changes-saved': { 'en-US': 'Changes saved', 'ar-SA': 'تم حفظ التغييرات', 'he-IL': 'השינויים נשמרו', 'ja-JP': '変更を保存しました', 'de-DE': 'Änderungen gespeichert', 'fr-FR': 'Modifications enregistrées', 'zh-CN': '更改已保存' },
  'snackbar.compact-fills': { 'en-US': 'On compact screens the snackbar fills the available width', 'ar-SA': 'على الشاشات الصغيرة يملأ الإشعار العرض المتاح', 'he-IL': 'במסכים קומפקטיים ההודעה ממלאת את הרוחב הזמין', 'ja-JP': 'コンパクトな画面では、スナックバーが利用可能な幅いっぱいに広がります', 'de-DE': 'Auf kompakten Bildschirmen füllt die Snackbar die verfügbare Breite aus', 'fr-FR': "Sur les écrans compacts, la snackbar occupe toute la largeur disponible", 'zh-CN': '在紧凑屏幕上，消息条会填满可用宽度' },
};
