import type { Entry } from '../index';

/** Demo strings for the Selection/Multi Select stories. Only genuine user-facing
 *  field labels, the instruction label, the placeholder, the validation / support
 *  copy and the custom empty-state text are localized. Sample option data (topic /
 *  brand names like Design, Engineering, Brand 1), technical enum-demo labels
 *  (Filled/Outlined, Chips/Count/Text, Top/Bottom/Left/Right, Enabled/Disabled/
 *  Error, Dark, Pill chips/Wide, Custom caret/Custom empty, None/Some/Many
 *  selected), developer prose / captions and the intentional static RTL + multi-
 *  locale demos stay as-is. The Submit button reuses the shared `submit` verb from
 *  `common.ts`. */
export const messages: Record<string, Entry> = {
  'multiselect.topics': { 'en-US': 'Topics', 'ar-SA': 'المواضيع', 'he-IL': 'נושאים', 'ja-JP': 'トピック', 'de-DE': 'Themen', 'fr-FR': 'Sujets', 'zh-CN': '主题' },
  'multiselect.brands': { 'en-US': 'Brands', 'ar-SA': 'العلامات التجارية', 'he-IL': 'מותגים', 'ja-JP': 'ブランド', 'de-DE': 'Marken', 'fr-FR': 'Marques', 'zh-CN': '品牌' },
  'multiselect.filters': { 'en-US': 'Filters', 'ar-SA': 'عوامل التصفية', 'he-IL': 'מסננים', 'ja-JP': 'フィルター', 'de-DE': 'Filter', 'fr-FR': 'Filtres', 'zh-CN': '筛选器' },
  'multiselect.regions': { 'en-US': 'Regions', 'ar-SA': 'المناطق', 'he-IL': 'אזורים', 'ja-JP': '地域', 'de-DE': 'Regionen', 'fr-FR': 'Régions', 'zh-CN': '地区' },
  'multiselect.teams': { 'en-US': 'Teams', 'ar-SA': 'الفرق', 'he-IL': 'צוותים', 'ja-JP': 'チーム', 'de-DE': 'Teams', 'fr-FR': 'Équipes', 'zh-CN': '团队' },
  'multiselect.option': { 'en-US': 'Option', 'ar-SA': 'خيار', 'he-IL': 'אפשרות', 'ja-JP': 'オプション', 'de-DE': 'Option', 'fr-FR': 'Option', 'zh-CN': '选项' },
  'multiselect.pickUpTo3': { 'en-US': 'Pick up to 3', 'ar-SA': 'اختر حتى 3', 'he-IL': 'בחר עד 3', 'ja-JP': '最大3件まで選択', 'de-DE': 'Bis zu 3 auswählen', 'fr-FR': 'Sélectionnez jusqu\'à 3', 'zh-CN': '最多选择3个' },
  'multiselect.pickTopics': { 'en-US': 'Pick topics…', 'ar-SA': 'اختر المواضيع…', 'he-IL': 'בחר נושאים…', 'ja-JP': 'トピックを選択…', 'de-DE': 'Themen auswählen…', 'fr-FR': 'Choisir des sujets…', 'zh-CN': '选择主题…' },
  'multiselect.pickAtLeastOne': { 'en-US': 'Pick at least one', 'ar-SA': 'اختر واحدًا على الأقل', 'he-IL': 'בחר לפחות אחד', 'ja-JP': '少なくとも1つ選択してください', 'de-DE': 'Mindestens eine Option auswählen', 'fr-FR': 'Choisissez-en au moins un', 'zh-CN': '至少选择一个' },
  'multiselect.selectAtLeastOneTopic': { 'en-US': 'Select at least one topic', 'ar-SA': 'اختر موضوعًا واحدًا على الأقل', 'he-IL': 'בחר לפחות נושא אחד', 'ja-JP': '少なくとも1つのトピックを選択してください', 'de-DE': 'Wählen Sie mindestens ein Thema aus', 'fr-FR': 'Sélectionnez au moins un sujet', 'zh-CN': '请至少选择一个主题' },
  'multiselect.chooseRegions': { 'en-US': 'Choose all regions you ship to', 'ar-SA': 'اختر جميع المناطق التي تشحن إليها', 'he-IL': 'בחר את כל האזורים שאליהם אתה שולח', 'ja-JP': '配送するすべての地域を選択してください', 'de-DE': 'Wählen Sie alle Regionen aus, in die Sie liefern', 'fr-FR': 'Choisissez toutes les régions où vous expédiez', 'zh-CN': '选择您配送的所有地区' },
  'multiselect.noTopicsAvailable': { 'en-US': 'No topics available yet', 'ar-SA': 'لا توجد مواضيع متاحة بعد', 'he-IL': 'אין עדיין נושאים זמינים', 'ja-JP': '利用可能なトピックはまだありません', 'de-DE': 'Noch keine Themen verfügbar', 'fr-FR': 'Aucun sujet disponible pour le moment', 'zh-CN': '暂无可用主题' },
};
