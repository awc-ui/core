import type { Entry } from '../index';

/** Demo strings for the Segmented Button stories. Only genuine user-facing
 *  segment labels are localized: time ranges (Day/Week/Month/Year), text
 *  formatting (Bold/Italic/Underline/Strike), transport modes
 *  (Car/Bus/Train/Walk), view modes (List/Grid), severity levels
 *  (Low/Medium/High) and sizes (Small/Medium/Large). Left as-is, matching the
 *  Button Group precedent: segment/set `aria-label`s (accessible names, not
 *  visible text), positional/enum filler labels (Alpha/Beta/Gamma, S/M/L/XL),
 *  number-word filler (One–Five), technical enum-demo values (PDF/CSV/XLSX,
 *  Ascending/Descending/Custom in the pedagogical Accessibility story), the
 *  explanatory demo prose/headings, and the intentional static Localization
 *  (multi-locale) and RTL (Arabic) demos. The shared verbs Day..Strike mirror
 *  the vetted `MdButtonGroup.ts` catalog for cross-component consistency. */
export const messages: Record<string, Entry> = {
  'segmentedButton.day': { 'en-US': 'Day', 'ar-SA': 'يوم', 'he-IL': 'יום', 'ja-JP': '日', 'de-DE': 'Tag', 'fr-FR': 'Jour', 'zh-CN': '日' },
  'segmentedButton.week': { 'en-US': 'Week', 'ar-SA': 'أسبوع', 'he-IL': 'שבוע', 'ja-JP': '週', 'de-DE': 'Woche', 'fr-FR': 'Semaine', 'zh-CN': '周' },
  'segmentedButton.month': { 'en-US': 'Month', 'ar-SA': 'شهر', 'he-IL': 'חודש', 'ja-JP': '月', 'de-DE': 'Monat', 'fr-FR': 'Mois', 'zh-CN': '月' },
  'segmentedButton.year': { 'en-US': 'Year', 'ar-SA': 'سنة', 'he-IL': 'שנה', 'ja-JP': '年', 'de-DE': 'Jahr', 'fr-FR': 'Année', 'zh-CN': '年' },
  'segmentedButton.bold': { 'en-US': 'Bold', 'ar-SA': 'عريض', 'he-IL': 'מודגש', 'ja-JP': '太字', 'de-DE': 'Fett', 'fr-FR': 'Gras', 'zh-CN': '粗体' },
  'segmentedButton.italic': { 'en-US': 'Italic', 'ar-SA': 'مائل', 'he-IL': 'נטוי', 'ja-JP': '斜体', 'de-DE': 'Kursiv', 'fr-FR': 'Italique', 'zh-CN': '斜体' },
  'segmentedButton.underline': { 'en-US': 'Underline', 'ar-SA': 'تسطير', 'he-IL': 'קו תחתון', 'ja-JP': '下線', 'de-DE': 'Unterstrichen', 'fr-FR': 'Souligné', 'zh-CN': '下划线' },
  'segmentedButton.strike': { 'en-US': 'Strike', 'ar-SA': 'يتوسطه خط', 'he-IL': 'קו חוצה', 'ja-JP': '取り消し線', 'de-DE': 'Durchgestrichen', 'fr-FR': 'Barré', 'zh-CN': '删除线' },
  'segmentedButton.car': { 'en-US': 'Car', 'ar-SA': 'سيارة', 'he-IL': 'מכונית', 'ja-JP': '車', 'de-DE': 'Auto', 'fr-FR': 'Voiture', 'zh-CN': '汽车' },
  'segmentedButton.bus': { 'en-US': 'Bus', 'ar-SA': 'حافلة', 'he-IL': 'אוטובוס', 'ja-JP': 'バス', 'de-DE': 'Bus', 'fr-FR': 'Bus', 'zh-CN': '公交车' },
  'segmentedButton.train': { 'en-US': 'Train', 'ar-SA': 'قطار', 'he-IL': 'רכבת', 'ja-JP': '電車', 'de-DE': 'Zug', 'fr-FR': 'Train', 'zh-CN': '火车' },
  'segmentedButton.walk': { 'en-US': 'Walk', 'ar-SA': 'مشي', 'he-IL': 'הליכה', 'ja-JP': '徒歩', 'de-DE': 'Zu Fuß', 'fr-FR': 'À pied', 'zh-CN': '步行' },
  'segmentedButton.list': { 'en-US': 'List', 'ar-SA': 'قائمة', 'he-IL': 'רשימה', 'ja-JP': 'リスト', 'de-DE': 'Liste', 'fr-FR': 'Liste', 'zh-CN': '列表' },
  'segmentedButton.grid': { 'en-US': 'Grid', 'ar-SA': 'شبكة', 'he-IL': 'רשת', 'ja-JP': 'グリッド', 'de-DE': 'Raster', 'fr-FR': 'Grille', 'zh-CN': '网格' },
  'segmentedButton.low': { 'en-US': 'Low', 'ar-SA': 'منخفض', 'he-IL': 'נמוך', 'ja-JP': '低', 'de-DE': 'Niedrig', 'fr-FR': 'Faible', 'zh-CN': '低' },
  'segmentedButton.medium': { 'en-US': 'Medium', 'ar-SA': 'متوسط', 'he-IL': 'בינוני', 'ja-JP': '中', 'de-DE': 'Mittel', 'fr-FR': 'Moyen', 'zh-CN': '中' },
  'segmentedButton.high': { 'en-US': 'High', 'ar-SA': 'مرتفع', 'he-IL': 'גבוה', 'ja-JP': '高', 'de-DE': 'Hoch', 'fr-FR': 'Élevé', 'zh-CN': '高' },
  'segmentedButton.small': { 'en-US': 'Small', 'ar-SA': 'صغير', 'he-IL': 'קטן', 'ja-JP': '小', 'de-DE': 'Klein', 'fr-FR': 'Petit', 'zh-CN': '小' },
  'segmentedButton.large': { 'en-US': 'Large', 'ar-SA': 'كبير', 'he-IL': 'גדול', 'ja-JP': '大', 'de-DE': 'Groß', 'fr-FR': 'Grand', 'zh-CN': '大' },
};
