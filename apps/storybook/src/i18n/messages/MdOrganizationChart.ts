import type { Entry } from '../index';

/** Demo strings for the Organization Chart stories. Only user-facing node
 *  content is localized: the descriptive job-role / department / region titles
 *  (the node's supporting text) and the empty-state message. Left byte-for-byte
 *  in the story: proper-noun sample person names (Amy Elsner, Ada Lovelace, …),
 *  avatar URLs and `data-id`s, the tree `label` / `expand-label` /
 *  `collapse-label` accessible names, the API-documentation prose and keyboard
 *  contract, and the dedicated static German + Arabic (RTL) Localization
 *  showcase (which carries its own inline per-locale strings). Keys are
 *  namespaced by the `orgchart.` slug. */
export const messages: Record<string, Entry> = {
  'orgchart.founderCeo': { 'en-US': 'Founder & CEO', 'ar-SA': 'المؤسِّس والرئيس التنفيذي', 'he-IL': 'מייסד ומנכ״ל', 'ja-JP': '創業者兼CEO', 'de-DE': 'Gründer & CEO', 'fr-FR': 'Fondateur et PDG', 'zh-CN': '创始人兼首席执行官' },
  'orgchart.productLead': { 'en-US': 'Product Lead', 'ar-SA': 'قائد المنتج', 'he-IL': 'ראש תחום מוצר', 'ja-JP': 'プロダクトリード', 'de-DE': 'Produktleitung', 'fr-FR': 'Responsable produit', 'zh-CN': '产品负责人' },
  'orgchart.uxDesigner': { 'en-US': 'UX Designer', 'ar-SA': 'مصمم تجربة المستخدم', 'he-IL': 'מעצב UX', 'ja-JP': 'UXデザイナー', 'de-DE': 'UX-Designer', 'fr-FR': 'Designer UX', 'zh-CN': '用户体验设计师' },
  'orgchart.productManager': { 'en-US': 'Product Manager', 'ar-SA': 'مدير المنتج', 'he-IL': 'מנהל מוצר', 'ja-JP': 'プロダクトマネージャー', 'de-DE': 'Produktmanager', 'fr-FR': 'Chef de produit', 'zh-CN': '产品经理' },
  'orgchart.engineeringLead': { 'en-US': 'Engineering Lead', 'ar-SA': 'قائد الهندسة', 'he-IL': 'ראש תחום הנדסה', 'ja-JP': 'エンジニアリングリード', 'de-DE': 'Technische Leitung', 'fr-FR': 'Responsable ingénierie', 'zh-CN': '工程负责人' },
  'orgchart.frontendEngineer': { 'en-US': 'Frontend Engineer', 'ar-SA': 'مهندس واجهات أمامية', 'he-IL': 'מהנדס פרונטאנד', 'ja-JP': 'フロントエンドエンジニア', 'de-DE': 'Frontend-Entwickler', 'fr-FR': 'Ingénieur frontend', 'zh-CN': '前端工程师' },
  'orgchart.backendEngineer': { 'en-US': 'Backend Engineer', 'ar-SA': 'مهندس خوادم خلفية', 'he-IL': 'מהנדס בקאנד', 'ja-JP': 'バックエンドエンジニア', 'de-DE': 'Backend-Entwickler', 'fr-FR': 'Ingénieur backend', 'zh-CN': '后端工程师' },
  'orgchart.chiefScientist': { 'en-US': 'Chief Scientist', 'ar-SA': 'كبير العلماء', 'he-IL': 'מדען ראשי', 'ja-JP': '主任科学者', 'de-DE': 'Chefwissenschaftler', 'fr-FR': 'Scientifique en chef', 'zh-CN': '首席科学家' },
  'orgchart.research': { 'en-US': 'Research', 'ar-SA': 'الأبحاث', 'he-IL': 'מחקר', 'ja-JP': '研究', 'de-DE': 'Forschung', 'fr-FR': 'Recherche', 'zh-CN': '研究' },
  'orgchart.compilers': { 'en-US': 'Compilers', 'ar-SA': 'المُترجِمات', 'he-IL': 'מהדרים', 'ja-JP': 'コンパイラ', 'de-DE': 'Compiler', 'fr-FR': 'Compilateurs', 'zh-CN': '编译器' },
  'orgchart.sales': { 'en-US': 'Sales', 'ar-SA': 'المبيعات', 'he-IL': 'מכירות', 'ja-JP': '営業', 'de-DE': 'Vertrieb', 'fr-FR': 'Ventes', 'zh-CN': '销售' },
  'orgchart.regionWest': { 'en-US': 'Region West', 'ar-SA': 'المنطقة الغربية', 'he-IL': 'אזור מערב', 'ja-JP': '西部地域', 'de-DE': 'Region West', 'fr-FR': 'Région Ouest', 'zh-CN': '西部地区' },
  'orgchart.regionEast': { 'en-US': 'Region East', 'ar-SA': 'المنطقة الشرقية', 'he-IL': 'אזור מזרח', 'ja-JP': '東部地域', 'de-DE': 'Region Ost', 'fr-FR': 'Région Est', 'zh-CN': '东部地区' },
  'orgchart.teamA': { 'en-US': 'Team A', 'ar-SA': 'الفريق أ', 'he-IL': 'צוות A', 'ja-JP': 'チームA', 'de-DE': 'Team A', 'fr-FR': 'Équipe A', 'zh-CN': '团队 A' },
  'orgchart.teamB': { 'en-US': 'Team B', 'ar-SA': 'الفريق ب', 'he-IL': 'צוות B', 'ja-JP': 'チームB', 'de-DE': 'Team B', 'fr-FR': 'Équipe B', 'zh-CN': '团队 B' },
  'orgchart.empty': { 'en-US': 'No organization data yet', 'ar-SA': 'لا توجد بيانات تنظيمية بعد', 'he-IL': 'אין עדיין נתונים ארגוניים', 'ja-JP': '組織データはまだありません', 'de-DE': 'Noch keine Organisationsdaten', 'fr-FR': 'Aucune donnée d’organisation pour l’instant', 'zh-CN': '暂无组织数据' },
};
