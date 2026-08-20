import type { Entry } from '../index';

/** Demo strings for the Breadcrumbs stories. Only genuine user-facing crumb
 *  labels are localized. The shared `Home` and `Settings` crumbs reuse the
 *  `home` / `settings` verbs from `common.ts`. Left as-is: proper-noun sample
 *  data (Jane Doe, "Alpine 3", AWC redesign, Invoice #INV-1284), dates /
 *  date-parts (April 2026, 2026, Q1, April, May), the product spec "3-Person",
 *  aria-label attributes, separator glyphs, the explanatory demo prose /
 *  section captions, and the intentional static RTL + multi-locale showcase
 *  stories. */
export const messages: Record<string, Entry> = {
  'breadcrumbs.library': { 'en-US': 'Library', 'ar-SA': 'المكتبة', 'he-IL': 'ספרייה', 'ja-JP': 'ライブラリ', 'de-DE': 'Bibliothek', 'fr-FR': 'Bibliothèque', 'zh-CN': '库' },
  'breadcrumbs.data': { 'en-US': 'Data', 'ar-SA': 'البيانات', 'he-IL': 'נתונים', 'ja-JP': 'データ', 'de-DE': 'Daten', 'fr-FR': 'Données', 'zh-CN': '数据' },
  'breadcrumbs.breadcrumbs': { 'en-US': 'Breadcrumbs', 'ar-SA': 'مسار التنقل', 'he-IL': 'פירורי לחם', 'ja-JP': 'パンくずリスト', 'de-DE': 'Brotkrümelnavigation', 'fr-FR': 'Fil d’Ariane', 'zh-CN': '面包屑导航' },
  'breadcrumbs.docs': { 'en-US': 'Docs', 'ar-SA': 'الوثائق', 'he-IL': 'תיעוד', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokumentation', 'fr-FR': 'Documentation', 'zh-CN': '文档' },
  'breadcrumbs.reference': { 'en-US': 'Reference', 'ar-SA': 'مرجع', 'he-IL': 'סימוכין', 'ja-JP': 'リファレンス', 'de-DE': 'Referenz', 'fr-FR': 'Référence', 'zh-CN': '参考' },
  'breadcrumbs.account': { 'en-US': 'Account', 'ar-SA': 'الحساب', 'he-IL': 'חשבון', 'ja-JP': 'アカウント', 'de-DE': 'Konto', 'fr-FR': 'Compte', 'zh-CN': '账户' },
  'breadcrumbs.catalog': { 'en-US': 'Catalog', 'ar-SA': 'الكتالوج', 'he-IL': 'קטלוג', 'ja-JP': 'カタログ', 'de-DE': 'Katalog', 'fr-FR': 'Catalogue', 'zh-CN': '目录' },
  'breadcrumbs.outdoors': { 'en-US': 'Outdoors', 'ar-SA': 'الهواء الطلق', 'he-IL': 'פעילות חוץ', 'ja-JP': 'アウトドア', 'de-DE': 'Outdoor', 'fr-FR': 'Plein air', 'zh-CN': '户外' },
  'breadcrumbs.tents': { 'en-US': 'Tents', 'ar-SA': 'الخيام', 'he-IL': 'אוהלים', 'ja-JP': 'テント', 'de-DE': 'Zelte', 'fr-FR': 'Tentes', 'zh-CN': '帐篷' },
  'breadcrumbs.analytics': { 'en-US': 'Analytics', 'ar-SA': 'التحليلات', 'he-IL': 'אנליטיקה', 'ja-JP': '分析', 'de-DE': 'Analysen', 'fr-FR': 'Analytique', 'zh-CN': '分析' },
  'breadcrumbs.reports': { 'en-US': 'Reports', 'ar-SA': 'التقارير', 'he-IL': 'דוחות', 'ja-JP': 'レポート', 'de-DE': 'Berichte', 'fr-FR': 'Rapports', 'zh-CN': '报告' },
  'breadcrumbs.admin-locked': { 'en-US': 'Admin (locked)', 'ar-SA': 'الإدارة (مقفلة)', 'he-IL': 'ניהול (נעול)', 'ja-JP': '管理 (ロック中)', 'de-DE': 'Admin (gesperrt)', 'fr-FR': 'Admin (verrouillé)', 'zh-CN': '管理 (已锁定)' },
  'breadcrumbs.users': { 'en-US': 'Users', 'ar-SA': 'المستخدمون', 'he-IL': 'משתמשים', 'ja-JP': 'ユーザー', 'de-DE': 'Benutzer', 'fr-FR': 'Utilisateurs', 'zh-CN': '用户' },
  'breadcrumbs.components': { 'en-US': 'Components', 'ar-SA': 'المكوّنات', 'he-IL': 'רכיבים', 'ja-JP': 'コンポーネント', 'de-DE': 'Komponenten', 'fr-FR': 'Composants', 'zh-CN': '组件' },
  'breadcrumbs.workspace': { 'en-US': 'Workspace', 'ar-SA': 'مساحة العمل', 'he-IL': 'סביבת עבודה', 'ja-JP': 'ワークスペース', 'de-DE': 'Arbeitsbereich', 'fr-FR': 'Espace de travail', 'zh-CN': '工作区' },
  'breadcrumbs.projects': { 'en-US': 'Projects', 'ar-SA': 'المشاريع', 'he-IL': 'פרויקטים', 'ja-JP': 'プロジェクト', 'de-DE': 'Projekte', 'fr-FR': 'Projets', 'zh-CN': '项目' },
  'breadcrumbs.profile': { 'en-US': 'Profile', 'ar-SA': 'الملف الشخصي', 'he-IL': 'פרופיל', 'ja-JP': 'プロフィール', 'de-DE': 'Profil', 'fr-FR': 'Profil', 'zh-CN': '个人资料' },
  'breadcrumbs.billing': { 'en-US': 'Billing', 'ar-SA': 'الفوترة', 'he-IL': 'חיוב', 'ja-JP': '請求', 'de-DE': 'Abrechnung', 'fr-FR': 'Facturation', 'zh-CN': '账单' },
  'breadcrumbs.invoices': { 'en-US': 'Invoices', 'ar-SA': 'الفواتير', 'he-IL': 'חשבוניות', 'ja-JP': '請求書', 'de-DE': 'Rechnungen', 'fr-FR': 'Factures', 'zh-CN': '发票' },
};
