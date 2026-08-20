import type { Entry } from '../index';

/** Sparkline demo strings — KPI-tile metric labels and table column headers
 *  shown around the sparklines. Keys are namespaced by the `sparkline.` slug. */
export const messages: Record<string, Entry> = {
  'sparkline.revenue': { 'en-US': 'Revenue', 'ar-SA': 'الإيرادات', 'he-IL': 'הכנסות', 'ja-JP': '収益', 'de-DE': 'Umsatz', 'fr-FR': 'Revenus', 'zh-CN': '营收' },
  'sparkline.activeUsers': { 'en-US': 'Active users', 'ar-SA': 'المستخدمون النشطون', 'he-IL': 'משתמשים פעילים', 'ja-JP': 'アクティブユーザー', 'de-DE': 'Aktive Nutzer', 'fr-FR': 'Utilisateurs actifs', 'zh-CN': '活跃用户' },
  'sparkline.errors': { 'en-US': 'Errors', 'ar-SA': 'الأخطاء', 'he-IL': 'שגיאות', 'ja-JP': 'エラー', 'de-DE': 'Fehler', 'fr-FR': 'Erreurs', 'zh-CN': '错误' },
  'sparkline.product': { 'en-US': 'Product', 'ar-SA': 'المنتج', 'he-IL': 'מוצר', 'ja-JP': '製品', 'de-DE': 'Produkt', 'fr-FR': 'Produit', 'zh-CN': '产品' },
  'sparkline.trend7d': { 'en-US': '7d trend', 'ar-SA': 'اتجاه 7 أيام', 'he-IL': 'מגמת 7 ימים', 'ja-JP': '7日間の推移', 'de-DE': '7-Tage-Trend', 'fr-FR': 'Tendance sur 7 j', 'zh-CN': '7天趋势' },
  'sparkline.sales': { 'en-US': 'Sales', 'ar-SA': 'المبيعات', 'he-IL': 'מכירות', 'ja-JP': '売上', 'de-DE': 'Verkäufe', 'fr-FR': 'Ventes', 'zh-CN': '销量' },
};
