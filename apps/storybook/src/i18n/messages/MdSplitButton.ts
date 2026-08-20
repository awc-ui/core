import type { Entry } from '../index';

/** Split Button demo strings — only genuine VISIBLE `label` / menu-item content
 *  an end-user reads: the primary "Create" action and its md-menu items, plus the
 *  full-width responsive labels (Upload / Save changes / Save and continue…) and
 *  the custom-CSS "Like" button. Per the established convention (see MdFab /
 *  MdIconButton / MdButtonGroup): the generic placeholder `label="Label"` filler,
 *  the trailing-toggle `menu-label` / `aria-label` accessible names, technical
 *  enum/size/variant labels, Material Symbols icon names, the demo section
 *  headings and documentation prose, the event-log scaffolding, and the
 *  intentional static Localization / RTL (multi-locale + Arabic) showcases are
 *  all left byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'splitButton.create': { 'en-US': 'Create', 'ar-SA': 'إنشاء', 'he-IL': 'יצירה', 'ja-JP': '作成', 'de-DE': 'Erstellen', 'fr-FR': 'Créer', 'zh-CN': '创建' },
  'splitButton.newDocument': { 'en-US': 'New document', 'ar-SA': 'مستند جديد', 'he-IL': 'מסמך חדש', 'ja-JP': '新しいドキュメント', 'de-DE': 'Neues Dokument', 'fr-FR': 'Nouveau document', 'zh-CN': '新建文档' },
  'splitButton.newFolder': { 'en-US': 'New folder', 'ar-SA': 'مجلد جديد', 'he-IL': 'תיקייה חדשה', 'ja-JP': '新しいフォルダ', 'de-DE': 'Neuer Ordner', 'fr-FR': 'Nouveau dossier', 'zh-CN': '新建文件夹' },
  'splitButton.fromTemplate': { 'en-US': 'From template…', 'ar-SA': 'من قالب…', 'he-IL': 'מתבנית…', 'ja-JP': 'テンプレートから…', 'de-DE': 'Aus Vorlage…', 'fr-FR': 'À partir d\'un modèle…', 'zh-CN': '从模板…' },
  'splitButton.upload': { 'en-US': 'Upload', 'ar-SA': 'رفع', 'he-IL': 'העלאה', 'ja-JP': 'アップロード', 'de-DE': 'Hochladen', 'fr-FR': 'Téléverser', 'zh-CN': '上传' },
  'splitButton.saveChanges': { 'en-US': 'Save changes', 'ar-SA': 'حفظ التغييرات', 'he-IL': 'שמירת שינויים', 'ja-JP': '変更を保存', 'de-DE': 'Änderungen speichern', 'fr-FR': 'Enregistrer les modifications', 'zh-CN': '保存更改' },
  'splitButton.saveAndContinue': { 'en-US': 'Save and continue to the next step', 'ar-SA': 'حفظ والمتابعة إلى الخطوة التالية', 'he-IL': 'שמירה ומעבר לשלב הבא', 'ja-JP': '保存して次のステップに進む', 'de-DE': 'Speichern und mit dem nächsten Schritt fortfahren', 'fr-FR': 'Enregistrer et passer à l\'étape suivante', 'zh-CN': '保存并继续下一步' },
  'splitButton.like': { 'en-US': 'Like', 'ar-SA': 'إعجاب', 'he-IL': 'אהבתי', 'ja-JP': 'いいね', 'de-DE': 'Gefällt mir', 'fr-FR': 'J\'aime', 'zh-CN': '赞' },
};
