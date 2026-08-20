import type { Entry } from '../index';

/** Demo strings for the Navigation Menu stories. Only genuine user-facing
 *  trigger labels and panel link labels are localized. Left as-is: the
 *  intentional static RTL showcase story (hand-written Arabic), aria-label
 *  attributes that double as test anchors, section captions/demo prose, and
 *  proper-noun sample data. */
export const messages: Record<string, Entry> = {
  'navmenu.main': { 'en-US': 'Main navigation', 'ar-SA': 'التنقل الرئيسي', 'he-IL': 'ניווט ראשי', 'ja-JP': 'メインナビゲーション', 'de-DE': 'Hauptnavigation', 'fr-FR': 'Navigation principale', 'zh-CN': '主导航' },
  'navmenu.products': { 'en-US': 'Products', 'ar-SA': 'المنتجات', 'he-IL': 'מוצרים', 'ja-JP': '製品', 'de-DE': 'Produkte', 'fr-FR': 'Produits', 'zh-CN': '产品' },
  'navmenu.solutions': { 'en-US': 'Solutions', 'ar-SA': 'الحلول', 'he-IL': 'פתרונות', 'ja-JP': 'ソリューション', 'de-DE': 'Lösungen', 'fr-FR': 'Solutions', 'zh-CN': '解决方案' },
  'navmenu.pricing': { 'en-US': 'Pricing', 'ar-SA': 'التسعير', 'he-IL': 'תמחור', 'ja-JP': '料金', 'de-DE': 'Preise', 'fr-FR': 'Tarifs', 'zh-CN': '定价' },
  'navmenu.docs': { 'en-US': 'Docs', 'ar-SA': 'الوثائق', 'he-IL': 'תיעוד', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokumentation', 'fr-FR': 'Documentation', 'zh-CN': '文档' },
  'navmenu.analytics': { 'en-US': 'Analytics', 'ar-SA': 'التحليلات', 'he-IL': 'אנליטיקה', 'ja-JP': '分析', 'de-DE': 'Analysen', 'fr-FR': 'Analytique', 'zh-CN': '分析' },
  'navmenu.reports': { 'en-US': 'Reports', 'ar-SA': 'التقارير', 'he-IL': 'דוחות', 'ja-JP': 'レポート', 'de-DE': 'Berichte', 'fr-FR': 'Rapports', 'zh-CN': '报告' },
  'navmenu.dashboards': { 'en-US': 'Dashboards', 'ar-SA': 'لوحات المعلومات', 'he-IL': 'לוחות מחוונים', 'ja-JP': 'ダッシュボード', 'de-DE': 'Dashboards', 'fr-FR': 'Tableaux de bord', 'zh-CN': '仪表板' },
  'navmenu.alerts': { 'en-US': 'Alerts', 'ar-SA': 'التنبيهات', 'he-IL': 'התראות', 'ja-JP': 'アラート', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Alertes', 'zh-CN': '警报' },
  'navmenu.integrations': { 'en-US': 'Integrations', 'ar-SA': 'عمليات التكامل', 'he-IL': 'אינטגרציות', 'ja-JP': '連携', 'de-DE': 'Integrationen', 'fr-FR': 'Intégrations', 'zh-CN': '集成' },
  'navmenu.automation': { 'en-US': 'Automation', 'ar-SA': 'الأتمتة', 'he-IL': 'אוטומציה', 'ja-JP': '自動化', 'de-DE': 'Automatisierung', 'fr-FR': 'Automatisation', 'zh-CN': '自动化' },
  'navmenu.for-startups': { 'en-US': 'For startups', 'ar-SA': 'للشركات الناشئة', 'he-IL': 'לסטארטאפים', 'ja-JP': 'スタートアップ向け', 'de-DE': 'Für Start-ups', 'fr-FR': 'Pour les start-ups', 'zh-CN': '面向初创公司' },
  'navmenu.for-enterprise': { 'en-US': 'For enterprise', 'ar-SA': 'للمؤسسات', 'he-IL': 'לארגונים', 'ja-JP': 'エンタープライズ向け', 'de-DE': 'Für Unternehmen', 'fr-FR': 'Pour les entreprises', 'zh-CN': '面向企业' },
  'navmenu.overview': { 'en-US': 'Overview', 'ar-SA': 'نظرة عامة', 'he-IL': 'סקירה כללית', 'ja-JP': '概要', 'de-DE': 'Überblick', 'fr-FR': 'Aperçu', 'zh-CN': '概览' },
  'navmenu.getting-started': { 'en-US': 'Getting started', 'ar-SA': 'البدء', 'he-IL': 'תחילת העבודה', 'ja-JP': 'はじめに', 'de-DE': 'Erste Schritte', 'fr-FR': 'Premiers pas', 'zh-CN': '快速入门' },
  'navmenu.changelog': { 'en-US': 'Changelog', 'ar-SA': 'سجل التغييرات', 'he-IL': 'יומן שינויים', 'ja-JP': '変更履歴', 'de-DE': 'Änderungsprotokoll', 'fr-FR': 'Journal des modifications', 'zh-CN': '更新日志' },
  'navmenu.blog': { 'en-US': 'Blog', 'ar-SA': 'المدونة', 'he-IL': 'בלוג', 'ja-JP': 'ブログ', 'de-DE': 'Blog', 'fr-FR': 'Blog', 'zh-CN': '博客' },
};
