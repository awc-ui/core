import type { Entry } from '../index';

/** Demo strings for the Transfer List stories. Only genuine user-facing chrome is
 *  localized: the source/target column titles, the empty-state text, and the
 *  count-pill template (with its `{checked}`/`{total}` placeholders preserved).
 *  The shared `roles` / `skills` sample datasets (Administrator, Editor, Skill 1…)
 *  are neutral demo fixtures reused across stories and asserted on by play(), so
 *  they stay as-is, as do the intentional static locale showcases (the Arabic RTL
 *  story, the Japanese Localization story, and the German instance in Icon
 *  customization) and all developer/API demo prose. */
export const messages: Record<string, Entry> = {
  'transfer.available': { 'en-US': 'Available', 'ar-SA': 'متاح', 'he-IL': 'זמינים', 'ja-JP': '利用可能', 'de-DE': 'Verfügbar', 'fr-FR': 'Disponibles', 'zh-CN': '可用' },
  'transfer.assigned': { 'en-US': 'Assigned', 'ar-SA': 'مُعيَّن', 'he-IL': 'משויכים', 'ja-JP': '割り当て済み', 'de-DE': 'Zugewiesen', 'fr-FR': 'Assignés', 'zh-CN': '已分配' },
  'transfer.skills': { 'en-US': 'Skills', 'ar-SA': 'المهارات', 'he-IL': 'כישורים', 'ja-JP': 'スキル', 'de-DE': 'Fähigkeiten', 'fr-FR': 'Compétences', 'zh-CN': '技能' },
  'transfer.selected': { 'en-US': 'Selected', 'ar-SA': 'المحددة', 'he-IL': 'נבחרים', 'ja-JP': '選択済み', 'de-DE': 'Ausgewählt', 'fr-FR': 'Sélectionnés', 'zh-CN': '已选择' },
  'transfer.available-roles': { 'en-US': 'Available roles', 'ar-SA': 'الأدوار المتاحة', 'he-IL': 'תפקידים זמינים', 'ja-JP': '利用可能なロール', 'de-DE': 'Verfügbare Rollen', 'fr-FR': 'Rôles disponibles', 'zh-CN': '可用角色' },
  'transfer.assigned-roles': { 'en-US': 'Assigned roles', 'ar-SA': 'الأدوار المُعيَّنة', 'he-IL': 'תפקידים משויכים', 'ja-JP': '割り当て済みのロール', 'de-DE': 'Zugewiesene Rollen', 'fr-FR': 'Rôles assignés', 'zh-CN': '已分配角色' },
  'transfer.backlog': { 'en-US': 'Backlog', 'ar-SA': 'قائمة المهام', 'he-IL': 'מאגר משימות', 'ja-JP': 'バックログ', 'de-DE': 'Backlog', 'fr-FR': 'Backlog', 'zh-CN': '待办列表' },
  'transfer.sprint': { 'en-US': 'Sprint', 'ar-SA': 'سبرنت', 'he-IL': 'ספרינט', 'ja-JP': 'スプリント', 'de-DE': 'Sprint', 'fr-FR': 'Sprint', 'zh-CN': '冲刺' },
  'transfer.empty': { 'en-US': 'Nothing assigned yet', 'ar-SA': 'لا شيء مُعيَّن بعد', 'he-IL': 'עדיין לא הוקצה דבר', 'ja-JP': 'まだ割り当てられていません', 'de-DE': 'Noch nichts zugewiesen', 'fr-FR': "Rien d'assigné pour l'instant", 'zh-CN': '尚未分配任何内容' },
  'transfer.count-picked': { 'en-US': '{checked} of {total} picked', 'ar-SA': 'تم اختيار {checked} من {total}', 'he-IL': '{checked} מתוך {total} נבחרו', 'ja-JP': '{total} 件中 {checked} 件選択', 'de-DE': '{checked} von {total} ausgewählt', 'fr-FR': '{checked} sur {total} sélectionné(s)', 'zh-CN': '已选 {checked}/{total} 项' },
};
