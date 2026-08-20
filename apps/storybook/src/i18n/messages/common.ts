import type { Entry } from '../index';

/** Shared UI verbs/nouns reused across many components. Component-specific
 *  catalogs live in sibling files and namespace their keys (e.g. `dialog.title`). */
export const messages: Record<string, Entry> = {
  save: { 'en-US': 'Save', 'ar-SA': 'حفظ', 'he-IL': 'שמירה', 'ja-JP': '保存', 'de-DE': 'Speichern', 'fr-FR': 'Enregistrer', 'zh-CN': '保存' },
  cancel: { 'en-US': 'Cancel', 'ar-SA': 'إلغاء', 'he-IL': 'ביטול', 'ja-JP': 'キャンセル', 'de-DE': 'Abbrechen', 'fr-FR': 'Annuler', 'zh-CN': '取消' },
  submit: { 'en-US': 'Submit', 'ar-SA': 'إرسال', 'he-IL': 'שליחה', 'ja-JP': '送信', 'de-DE': 'Absenden', 'fr-FR': 'Envoyer', 'zh-CN': '提交' },
  delete: { 'en-US': 'Delete', 'ar-SA': 'حذف', 'he-IL': 'מחיקה', 'ja-JP': '削除', 'de-DE': 'Löschen', 'fr-FR': 'Supprimer', 'zh-CN': '删除' },
  edit: { 'en-US': 'Edit', 'ar-SA': 'تعديل', 'he-IL': 'עריכה', 'ja-JP': '編集', 'de-DE': 'Bearbeiten', 'fr-FR': 'Modifier', 'zh-CN': '编辑' },
  next: { 'en-US': 'Next', 'ar-SA': 'التالي', 'he-IL': 'הבא', 'ja-JP': '次へ', 'de-DE': 'Weiter', 'fr-FR': 'Suivant', 'zh-CN': '下一步' },
  back: { 'en-US': 'Back', 'ar-SA': 'رجوع', 'he-IL': 'חזרה', 'ja-JP': '戻る', 'de-DE': 'Zurück', 'fr-FR': 'Retour', 'zh-CN': '返回' },
  search: { 'en-US': 'Search', 'ar-SA': 'بحث', 'he-IL': 'חיפוש', 'ja-JP': '検索', 'de-DE': 'Suchen', 'fr-FR': 'Rechercher', 'zh-CN': '搜索' },
  settings: { 'en-US': 'Settings', 'ar-SA': 'الإعدادات', 'he-IL': 'הגדרות', 'ja-JP': '設定', 'de-DE': 'Einstellungen', 'fr-FR': 'Paramètres', 'zh-CN': '设置' },
  home: { 'en-US': 'Home', 'ar-SA': 'الرئيسية', 'he-IL': 'בית', 'ja-JP': 'ホーム', 'de-DE': 'Startseite', 'fr-FR': 'Accueil', 'zh-CN': '主页' },
};
