import type { Entry } from '../index';

/** Demo strings for the Table stories. Only genuine user-facing table chrome is
 *  localized: column headers, table captions, toolbar headline/supporting-text,
 *  empty-state copy + actions, filter placeholders / date-picker labels, menu
 *  items, select-option labels, footer totals and the demo control buttons.
 *
 *  Left byte-for-byte in the story: proper-noun / neutral SAMPLE DATA (the
 *  PEOPLE rows — names, roles, teams, locations, levels, managers, ratings; the
 *  crypto symbols + prices; currency codes/names USD/US Dollar/…; the invoice
 *  line items; the blueprint machine names + status chips; the "Employee NN"
 *  server rows), numeric/date values (Intl-formatted), the md-table `label` /
 *  `summary` / `caption`-as-aria and every `aria-label` / `button-label`
 *  accessible-name attribute (kept per the project convention), technical enum
 *  / prop-value demo labels (`pin-mode="stack"`, `loading-mode="…"`,
 *  `scrollbar="…"`), Material Symbols icon names, CSS, the explanatory
 *  docs.description prose + section captions, code snippets, and the two
 *  dedicated locale showcases (the `Localization` switcher story with its own
 *  inline en/de/ja set, and the static Arabic `RTL` story). A handful of
 *  data-interleaved demo sentences (the expandable-row bio, the expressive-motion
 *  and blueprint expanded panels) also stay English — word order can't survive
 *  the mid-clause data injection. */
export const messages: Record<string, Entry> = {
  // ── Column headers ──────────────────────────────────────────────────────
  'table.name': { 'en-US': 'Name', 'ar-SA': 'الاسم', 'he-IL': 'שם', 'ja-JP': '名前', 'de-DE': 'Name', 'fr-FR': 'Nom', 'zh-CN': '姓名' },
  'table.role': { 'en-US': 'Role', 'ar-SA': 'الدور', 'he-IL': 'תפקיד', 'ja-JP': '役職', 'de-DE': 'Rolle', 'fr-FR': 'Rôle', 'zh-CN': '角色' },
  'table.team': { 'en-US': 'Team', 'ar-SA': 'الفريق', 'he-IL': 'צוות', 'ja-JP': 'チーム', 'de-DE': 'Team', 'fr-FR': 'Équipe', 'zh-CN': '团队' },
  'table.salary': { 'en-US': 'Salary', 'ar-SA': 'الراتب', 'he-IL': 'שכר', 'ja-JP': '給与', 'de-DE': 'Gehalt', 'fr-FR': 'Salaire', 'zh-CN': '薪资' },
  'table.joined': { 'en-US': 'Joined', 'ar-SA': 'تاريخ الالتحاق', 'he-IL': 'תאריך הצטרפות', 'ja-JP': '入社日', 'de-DE': 'Eingestellt', 'fr-FR': 'Arrivée', 'zh-CN': '入职日期' },
  'table.code': { 'en-US': 'Code', 'ar-SA': 'الرمز', 'he-IL': 'קוד', 'ja-JP': 'コード', 'de-DE': 'Code', 'fr-FR': 'Code', 'zh-CN': '代码' },
  'table.rate': { 'en-US': 'Rate', 'ar-SA': 'السعر', 'he-IL': 'שער', 'ja-JP': 'レート', 'de-DE': 'Kurs', 'fr-FR': 'Taux', 'zh-CN': '汇率' },
  'table.sym': { 'en-US': 'Sym', 'ar-SA': 'الرمز', 'he-IL': 'סמל', 'ja-JP': '銘柄', 'de-DE': 'Sym.', 'fr-FR': 'Sym.', 'zh-CN': '代号' },
  'table.bid': { 'en-US': 'Bid', 'ar-SA': 'عرض الشراء', 'he-IL': 'ביקוש', 'ja-JP': '買値', 'de-DE': 'Geldkurs', 'fr-FR': 'Achat', 'zh-CN': '买入' },
  'table.ask': { 'en-US': 'Ask', 'ar-SA': 'عرض البيع', 'he-IL': 'היצע', 'ja-JP': '売値', 'de-DE': 'Briefkurs', 'fr-FR': 'Vente', 'zh-CN': '卖出' },
  'table.symbol': { 'en-US': 'Symbol', 'ar-SA': 'الرمز', 'he-IL': 'סמל', 'ja-JP': 'シンボル', 'de-DE': 'Symbol', 'fr-FR': 'Symbole', 'zh-CN': '代号' },
  'table.price': { 'en-US': 'Price', 'ar-SA': 'السعر', 'he-IL': 'מחיר', 'ja-JP': '価格', 'de-DE': 'Preis', 'fr-FR': 'Prix', 'zh-CN': '价格' },
  'table.field': { 'en-US': 'Field', 'ar-SA': 'الحقل', 'he-IL': 'שדה', 'ja-JP': '項目', 'de-DE': 'Feld', 'fr-FR': 'Champ', 'zh-CN': '字段' },
  'table.value': { 'en-US': 'Value', 'ar-SA': 'القيمة', 'he-IL': 'ערך', 'ja-JP': '値', 'de-DE': 'Wert', 'fr-FR': 'Valeur', 'zh-CN': '值' },
  'table.notes': { 'en-US': 'Notes', 'ar-SA': 'ملاحظات', 'he-IL': 'הערות', 'ja-JP': '備考', 'de-DE': 'Notizen', 'fr-FR': 'Notes', 'zh-CN': '备注' },
  'table.active': { 'en-US': 'Active', 'ar-SA': 'نشط', 'he-IL': 'פעיל', 'ja-JP': '有効', 'de-DE': 'Aktiv', 'fr-FR': 'Actif', 'zh-CN': '启用' },
  'table.availability': { 'en-US': 'Availability', 'ar-SA': 'التوفّر', 'he-IL': 'זמינות', 'ja-JP': '稼働状況', 'de-DE': 'Verfügbarkeit', 'fr-FR': 'Disponibilité', 'zh-CN': '可用性' },
  'table.location': { 'en-US': 'Location', 'ar-SA': 'الموقع', 'he-IL': 'מיקום', 'ja-JP': '勤務地', 'de-DE': 'Standort', 'fr-FR': 'Lieu', 'zh-CN': '地点' },
  'table.level': { 'en-US': 'Level', 'ar-SA': 'المستوى', 'he-IL': 'רמה', 'ja-JP': 'レベル', 'de-DE': 'Stufe', 'fr-FR': 'Niveau', 'zh-CN': '级别' },
  'table.projects': { 'en-US': 'Projects', 'ar-SA': 'المشاريع', 'he-IL': 'פרויקטים', 'ja-JP': 'プロジェクト', 'de-DE': 'Projekte', 'fr-FR': 'Projets', 'zh-CN': '项目' },
  'table.manager': { 'en-US': 'Manager', 'ar-SA': 'المدير', 'he-IL': 'מנהל', 'ja-JP': 'マネージャー', 'de-DE': 'Manager', 'fr-FR': 'Responsable', 'zh-CN': '经理' },
  'table.rating': { 'en-US': 'Rating', 'ar-SA': 'التقييم', 'he-IL': 'דירוג', 'ja-JP': '評価', 'de-DE': 'Bewertung', 'fr-FR': 'Note', 'zh-CN': '评分' },
  'table.id': { 'en-US': 'ID', 'ar-SA': 'المعرّف', 'he-IL': 'מזהה', 'ja-JP': 'ID', 'de-DE': 'ID', 'fr-FR': 'ID', 'zh-CN': '编号' },
  'table.actions': { 'en-US': 'Actions', 'ar-SA': 'الإجراءات', 'he-IL': 'פעולות', 'ja-JP': '操作', 'de-DE': 'Aktionen', 'fr-FR': 'Actions', 'zh-CN': '操作' },
  'table.class': { 'en-US': 'Class', 'ar-SA': 'الفئة', 'he-IL': 'סוג', 'ja-JP': '種別', 'de-DE': 'Klasse', 'fr-FR': 'Classe', 'zh-CN': '类别' },
  'table.status': { 'en-US': 'Status', 'ar-SA': 'الحالة', 'he-IL': 'סטטוס', 'ja-JP': 'ステータス', 'de-DE': 'Status', 'fr-FR': 'Statut', 'zh-CN': '状态' },
  'table.machine': { 'en-US': 'Machine', 'ar-SA': 'الآلة', 'he-IL': 'מכונה', 'ja-JP': '機械', 'de-DE': 'Maschine', 'fr-FR': 'Machine', 'zh-CN': '机器' },
  'table.massT': { 'en-US': 'Mass (t)', 'ar-SA': 'الكتلة (طن)', 'he-IL': 'מסה (טון)', 'ja-JP': '質量 (t)', 'de-DE': 'Masse (t)', 'fr-FR': 'Masse (t)', 'zh-CN': '质量 (吨)' },
  'table.desc': { 'en-US': 'Desc', 'ar-SA': 'الوصف', 'he-IL': 'תיאור', 'ja-JP': '説明', 'de-DE': 'Bez.', 'fr-FR': 'Desc.', 'zh-CN': '说明' },
  'table.qty': { 'en-US': 'Qty.', 'ar-SA': 'الكمية', 'he-IL': 'כמות', 'ja-JP': '数量', 'de-DE': 'Menge', 'fr-FR': 'Qté', 'zh-CN': '数量' },
  'table.unit': { 'en-US': 'Unit', 'ar-SA': 'الوحدة', 'he-IL': 'יחידה', 'ja-JP': '単価', 'de-DE': 'Einzel', 'fr-FR': 'Unité', 'zh-CN': '单价' },
  'table.sum': { 'en-US': 'Sum', 'ar-SA': 'المجموع', 'he-IL': 'סכום', 'ja-JP': '金額', 'de-DE': 'Summe', 'fr-FR': 'Montant', 'zh-CN': '金额' },
  'table.details': { 'en-US': 'Details', 'ar-SA': 'التفاصيل', 'he-IL': 'פרטים', 'ja-JP': '詳細', 'de-DE': 'Details', 'fr-FR': 'Détails', 'zh-CN': '详情' },
  'table.total': { 'en-US': 'Total', 'ar-SA': 'الإجمالي', 'he-IL': 'סה״כ', 'ja-JP': '合計', 'de-DE': 'Gesamt', 'fr-FR': 'Total', 'zh-CN': '合计' },
  'table.subtotal': { 'en-US': 'Subtotal', 'ar-SA': 'المجموع الفرعي', 'he-IL': 'סכום ביניים', 'ja-JP': '小計', 'de-DE': 'Zwischensumme', 'fr-FR': 'Sous-total', 'zh-CN': '小计' },
  'table.tax': { 'en-US': 'Tax', 'ar-SA': 'الضريبة', 'he-IL': 'מס', 'ja-JP': '税', 'de-DE': 'Steuer', 'fr-FR': 'Taxe', 'zh-CN': '税' },
  'table.profile': { 'en-US': 'Profile', 'ar-SA': 'الملف الشخصي', 'he-IL': 'פרופיל', 'ja-JP': 'プロフィール', 'de-DE': 'Profil', 'fr-FR': 'Profil', 'zh-CN': '个人资料' },
  'table.employment': { 'en-US': 'Employment', 'ar-SA': 'التوظيف', 'he-IL': 'העסקה', 'ja-JP': '雇用', 'de-DE': 'Beschäftigung', 'fr-FR': 'Emploi', 'zh-CN': '雇佣' },

  // ── Toolbar headlines / supporting text ─────────────────────────────────
  'table.employees': { 'en-US': 'Employees', 'ar-SA': 'الموظفون', 'he-IL': 'עובדים', 'ja-JP': '従業員', 'de-DE': 'Mitarbeiter', 'fr-FR': 'Employés', 'zh-CN': '员工' },
  'table.manageTeam': { 'en-US': 'Manage team members', 'ar-SA': 'إدارة أعضاء الفريق', 'he-IL': 'ניהול חברי הצוות', 'ja-JP': 'チームメンバーの管理', 'de-DE': 'Teammitglieder verwalten', 'fr-FR': 'Gérer les membres de l’équipe', 'zh-CN': '管理团队成员' },
  'table.motionDemo': { 'en-US': 'Motion demo', 'ar-SA': 'عرض الحركة', 'he-IL': 'הדגמת תנועה', 'ja-JP': 'モーションデモ', 'de-DE': 'Motion-Demo', 'fr-FR': 'Démo de mouvement', 'zh-CN': '动效演示' },
  'table.serverPaginated': { 'en-US': 'Server-side paginated + sorted', 'ar-SA': 'ترقيم وفرز من جانب الخادم', 'he-IL': 'דפדוף ומיון בצד השרת', 'ja-JP': 'サーバー側でのページ分割＋並べ替え', 'de-DE': 'Serverseitig paginiert + sortiert', 'fr-FR': 'Pagination et tri côté serveur', 'zh-CN': '服务端分页 + 排序' },
  'table.darkMode': { 'en-US': 'Dark mode', 'ar-SA': 'الوضع الداكن', 'he-IL': 'מצב כהה', 'ja-JP': 'ダークモード', 'de-DE': 'Dunkelmodus', 'fr-FR': 'Mode sombre', 'zh-CN': '深色模式' },
  'table.brand': { 'en-US': 'Brand', 'ar-SA': 'العلامة التجارية', 'he-IL': 'מותג', 'ja-JP': 'ブランド', 'de-DE': 'Marke', 'fr-FR': 'Marque', 'zh-CN': '品牌' },
  'table.vibrantTonality': { 'en-US': 'Vibrant tonality', 'ar-SA': 'درجات لونية نابضة', 'he-IL': 'גוון תוסס', 'ja-JP': '鮮やかなトーン', 'de-DE': 'Kräftige Tonalität', 'fr-FR': 'Tonalité vibrante', 'zh-CN': '鲜艳色调' },

  // ── Demo controls (chips / buttons / labels) ────────────────────────────
  'table.density': { 'en-US': 'Density', 'ar-SA': 'الكثافة', 'he-IL': 'צפיפות', 'ja-JP': '密度', 'de-DE': 'Dichte', 'fr-FR': 'Densité', 'zh-CN': '密度' },
  'table.compact': { 'en-US': 'Compact', 'ar-SA': 'مضغوط', 'he-IL': 'קומפקטי', 'ja-JP': 'コンパクト', 'de-DE': 'Kompakt', 'fr-FR': 'Compact', 'zh-CN': '紧凑' },
  'table.phone': { 'en-US': 'Phone', 'ar-SA': 'هاتف', 'he-IL': 'טלפון', 'ja-JP': 'スマホ', 'de-DE': 'Smartphone', 'fr-FR': 'Téléphone', 'zh-CN': '手机' },
  'table.tablet': { 'en-US': 'Tablet', 'ar-SA': 'جهاز لوحي', 'he-IL': 'טאבלט', 'ja-JP': 'タブレット', 'de-DE': 'Tablet', 'fr-FR': 'Tablette', 'zh-CN': '平板' },
  'table.desktop': { 'en-US': 'Desktop', 'ar-SA': 'سطح المكتب', 'he-IL': 'שולחני', 'ja-JP': 'デスクトップ', 'de-DE': 'Desktop', 'fr-FR': 'Ordinateur', 'zh-CN': '桌面' },
  'table.pinUnpinName': { 'en-US': 'pin/unpin Name', 'ar-SA': 'تثبيت/إلغاء تثبيت الاسم', 'he-IL': 'הצמד/בטל הצמדת שם', 'ja-JP': '名前を固定/固定解除', 'de-DE': 'Name anheften/lösen', 'fr-FR': 'Épingler/désépingler Nom', 'zh-CN': '固定/取消固定 姓名' },
  'table.hideShowTeam': { 'en-US': 'hide/show Team', 'ar-SA': 'إخفاء/إظهار الفريق', 'he-IL': 'הסתר/הצג צוות', 'ja-JP': 'チームを非表示/表示', 'de-DE': 'Team aus-/einblenden', 'fr-FR': 'Masquer/afficher Équipe', 'zh-CN': '隐藏/显示 团队' },

  // ── Select-option labels (editable cells) ───────────────────────────────
  'table.individualContributor': { 'en-US': 'Individual Contributor', 'ar-SA': 'مساهم فردي', 'he-IL': 'תורם עצמאי', 'ja-JP': '個人担当者', 'de-DE': 'Fachkraft', 'fr-FR': 'Contributeur individuel', 'zh-CN': '个人贡献者' },
  'table.lead': { 'en-US': 'Lead', 'ar-SA': 'قائد', 'he-IL': 'מוביל', 'ja-JP': 'リード', 'de-DE': 'Leitung', 'fr-FR': 'Chef d’équipe', 'zh-CN': '主管' },

  // ── Expandable-row field labels ─────────────────────────────────────────
  'table.joinedColon': { 'en-US': 'Joined:', 'ar-SA': 'تاريخ الالتحاق:', 'he-IL': 'תאריך הצטרפות:', 'ja-JP': '入社日:', 'de-DE': 'Eingestellt:', 'fr-FR': 'Arrivée :', 'zh-CN': '入职日期：' },
  'table.employeeIdColon': { 'en-US': 'Employee ID:', 'ar-SA': 'معرّف الموظف:', 'he-IL': 'מזהה עובד:', 'ja-JP': '従業員ID:', 'de-DE': 'Mitarbeiter-ID:', 'fr-FR': 'ID employé :', 'zh-CN': '员工编号：' },
  'table.bioColon': { 'en-US': 'Bio:', 'ar-SA': 'نبذة:', 'he-IL': 'תקציר:', 'ja-JP': '経歴:', 'de-DE': 'Bio:', 'fr-FR': 'Bio :', 'zh-CN': '简介：' },

  // ── Empty-state copy + actions ──────────────────────────────────────────
  'table.noEmployeesMatch': { 'en-US': 'No employees match your filters', 'ar-SA': 'لا يوجد موظفون يطابقون عوامل التصفية', 'he-IL': 'אין עובדים התואמים את הסינון', 'ja-JP': 'フィルターに一致する従業員はいません', 'de-DE': 'Keine Mitarbeiter entsprechen Ihren Filtern', 'fr-FR': 'Aucun employé ne correspond à vos filtres', 'zh-CN': '没有符合筛选条件的员工' },
  'table.tryAdjusting': { 'en-US': 'Try adjusting or clearing your filters.', 'ar-SA': 'حاول تعديل عوامل التصفية أو مسحها.', 'he-IL': 'נסו לשנות או לנקות את הסינון.', 'ja-JP': 'フィルターを調整またはクリアしてください。', 'de-DE': 'Passen Sie Ihre Filter an oder setzen Sie sie zurück.', 'fr-FR': 'Essayez d’ajuster ou d’effacer vos filtres.', 'zh-CN': '请尝试调整或清除筛选条件。' },
  'table.clearFilters': { 'en-US': 'Clear filters', 'ar-SA': 'مسح عوامل التصفية', 'he-IL': 'ניקוי הסינון', 'ja-JP': 'フィルターをクリア', 'de-DE': 'Filter zurücksetzen', 'fr-FR': 'Effacer les filtres', 'zh-CN': '清除筛选' },
  'table.noEmployeesYet': { 'en-US': 'No employees yet', 'ar-SA': 'لا يوجد موظفون بعد', 'he-IL': 'עדיין אין עובדים', 'ja-JP': 'まだ従業員がいません', 'de-DE': 'Noch keine Mitarbeiter', 'fr-FR': 'Aucun employé pour l’instant', 'zh-CN': '暂无员工' },
  'table.addFirstMember': { 'en-US': 'Add your first team member to get started.', 'ar-SA': 'أضف أول عضو في الفريق للبدء.', 'he-IL': 'הוסיפו את חבר הצוות הראשון כדי להתחיל.', 'ja-JP': '最初のチームメンバーを追加して始めましょう。', 'de-DE': 'Fügen Sie Ihr erstes Teammitglied hinzu, um zu beginnen.', 'fr-FR': 'Ajoutez votre premier membre d’équipe pour commencer.', 'zh-CN': '添加第一位团队成员即可开始。' },
  'table.addEmployee': { 'en-US': 'Add employee', 'ar-SA': 'إضافة موظف', 'he-IL': 'הוספת עובד', 'ja-JP': '従業員を追加', 'de-DE': 'Mitarbeiter hinzufügen', 'fr-FR': 'Ajouter un employé', 'zh-CN': '添加员工' },
  'table.couldntLoad': { 'en-US': 'Couldn’t load employees', 'ar-SA': 'تعذّر تحميل الموظفين', 'he-IL': 'טעינת העובדים נכשלה', 'ja-JP': '従業員を読み込めませんでした', 'de-DE': 'Mitarbeiter konnten nicht geladen werden', 'fr-FR': 'Impossible de charger les employés', 'zh-CN': '无法加载员工' },
  'table.checkConnection': { 'en-US': 'Check your connection and try again.', 'ar-SA': 'تحقق من اتصالك وحاول مرة أخرى.', 'he-IL': 'בדקו את החיבור ונסו שוב.', 'ja-JP': '接続を確認して、もう一度お試しください。', 'de-DE': 'Überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.', 'fr-FR': 'Vérifiez votre connexion et réessayez.', 'zh-CN': '请检查网络连接后重试。' },
  'table.retry': { 'en-US': 'Retry', 'ar-SA': 'إعادة المحاولة', 'he-IL': 'נסו שוב', 'ja-JP': '再試行', 'de-DE': 'Erneut versuchen', 'fr-FR': 'Réessayer', 'zh-CN': '重试' },
  'table.nothingToSee': { 'en-US': 'Nothing to see here 🫙', 'ar-SA': 'لا شيء هنا 🫙', 'he-IL': 'אין כאן כלום 🫙', 'ja-JP': 'ここには何もありません 🫙', 'de-DE': 'Hier gibt es nichts zu sehen 🫙', 'fr-FR': 'Rien à voir ici 🫙', 'zh-CN': '这里什么都没有 🫙' },
  'table.noEmployeesFound': { 'en-US': 'No employees found', 'ar-SA': 'لم يتم العثور على موظفين', 'he-IL': 'לא נמצאו עובדים', 'ja-JP': '従業員が見つかりません', 'de-DE': 'Keine Mitarbeiter gefunden', 'fr-FR': 'Aucun employé trouvé', 'zh-CN': '未找到员工' },
  'table.noDataMatches': { 'en-US': 'No data matches your filters — please refine your search.', 'ar-SA': 'لا توجد بيانات تطابق عوامل التصفية — يرجى تحسين بحثك.', 'he-IL': 'אין נתונים התואמים את הסינון — נא לחדד את החיפוש.', 'ja-JP': 'フィルターに一致するデータがありません — 検索条件を絞り込んでください。', 'de-DE': 'Keine Daten entsprechen Ihren Filtern – bitte verfeinern Sie Ihre Suche.', 'fr-FR': 'Aucune donnée ne correspond à vos filtres — veuillez affiner votre recherche.', 'zh-CN': '没有符合筛选条件的数据 — 请优化您的搜索。' },

  // ── Captions ────────────────────────────────────────────────────────────
  'table.commonCurrencies': { 'en-US': 'Common currencies', 'ar-SA': 'العملات الشائعة', 'he-IL': 'מטבעות נפוצים', 'ja-JP': '主要通貨', 'de-DE': 'Gängige Währungen', 'fr-FR': 'Devises courantes', 'zh-CN': '常用货币' },
  'table.blueprintCaption': { 'en-US': 'Blueprint // registry of machines', 'ar-SA': 'مخطط // سجل الآلات', 'he-IL': 'שרטוט // מרשם מכונות', 'ja-JP': 'ブループリント // 機械登録簿', 'de-DE': 'Blaupause // Maschinenregister', 'fr-FR': 'Plan // registre des machines', 'zh-CN': '蓝图 // 机器登记簿' },

  // ── Full data-grid: filters, menu, pagination ───────────────────────────
  'table.searchNameRole': { 'en-US': 'Search name or role…', 'ar-SA': 'ابحث بالاسم أو الدور…', 'he-IL': 'חיפוש לפי שם או תפקיד…', 'ja-JP': '名前または役職で検索…', 'de-DE': 'Nach Name oder Rolle suchen…', 'fr-FR': 'Rechercher par nom ou rôle…', 'zh-CN': '搜索姓名或角色…' },
  'table.joinedFrom': { 'en-US': 'Joined from', 'ar-SA': 'تاريخ الالتحاق من', 'he-IL': 'הצטרף מ־', 'ja-JP': '入社日（開始）', 'de-DE': 'Eingestellt ab', 'fr-FR': 'Arrivée à partir du', 'zh-CN': '入职起始' },
  'table.joinedTo': { 'en-US': 'Joined to', 'ar-SA': 'تاريخ الالتحاق إلى', 'he-IL': 'הצטרף עד', 'ja-JP': '入社日（終了）', 'de-DE': 'Eingestellt bis', 'fr-FR': 'Arrivée jusqu’au', 'zh-CN': '入职截止' },
  'table.exportCsv': { 'en-US': 'Export CSV', 'ar-SA': 'تصدير CSV', 'he-IL': 'ייצוא CSV', 'ja-JP': 'CSVをエクスポート', 'de-DE': 'CSV exportieren', 'fr-FR': 'Exporter en CSV', 'zh-CN': '导出 CSV' },
  'table.selectAll': { 'en-US': 'Select all', 'ar-SA': 'تحديد الكل', 'he-IL': 'בחירת הכול', 'ja-JP': 'すべて選択', 'de-DE': 'Alle auswählen', 'fr-FR': 'Tout sélectionner', 'zh-CN': '全选' },
  'table.columns': { 'en-US': 'Columns', 'ar-SA': 'الأعمدة', 'he-IL': 'עמודות', 'ja-JP': '列', 'de-DE': 'Spalten', 'fr-FR': 'Colonnes', 'zh-CN': '列' },
  'table.fixColumn': { 'en-US': 'Fix column', 'ar-SA': 'تثبيت العمود', 'he-IL': 'קיבוע עמודה', 'ja-JP': '列を固定', 'de-DE': 'Spalte fixieren', 'fr-FR': 'Figer la colonne', 'zh-CN': '固定列' },
  'table.left': { 'en-US': 'Left', 'ar-SA': 'يسار', 'he-IL': 'שמאל', 'ja-JP': '左', 'de-DE': 'Links', 'fr-FR': 'Gauche', 'zh-CN': '左' },
  'table.right': { 'en-US': 'Right', 'ar-SA': 'يمين', 'he-IL': 'ימין', 'ja-JP': '右', 'de-DE': 'Rechts', 'fr-FR': 'Droite', 'zh-CN': '右' },
  'table.compactDensity': { 'en-US': 'Compact density', 'ar-SA': 'كثافة مضغوطة', 'he-IL': 'צפיפות קומפקטית', 'ja-JP': 'コンパクト密度', 'de-DE': 'Kompakte Dichte', 'fr-FR': 'Densité compacte', 'zh-CN': '紧凑密度' },
  'table.stackPinned': { 'en-US': 'Stack pinned columns', 'ar-SA': 'تكديس الأعمدة المثبّتة', 'he-IL': 'ערימת עמודות מקובעות', 'ja-JP': '固定列を重ねる', 'de-DE': 'Fixierte Spalten stapeln', 'fr-FR': 'Empiler les colonnes figées', 'zh-CN': '堆叠固定列' },
  'table.unstackPinned': { 'en-US': 'Unstack pinned columns', 'ar-SA': 'إلغاء تكديس الأعمدة المثبّتة', 'he-IL': 'ביטול ערימת עמודות מקובעות', 'ja-JP': '固定列の重なりを解除', 'de-DE': 'Fixierte Spalten entstapeln', 'fr-FR': 'Désempiler les colonnes figées', 'zh-CN': '取消堆叠固定列' },
  'table.person': { 'en-US': 'person', 'ar-SA': 'شخص', 'he-IL': 'איש', 'ja-JP': '人', 'de-DE': 'Person', 'fr-FR': 'personne', 'zh-CN': '人' },
  'table.people': { 'en-US': 'people', 'ar-SA': 'أشخاص', 'he-IL': 'אנשים', 'ja-JP': '人', 'de-DE': 'Personen', 'fr-FR': 'personnes', 'zh-CN': '人' },
  'table.of': { 'en-US': 'of', 'ar-SA': 'من', 'he-IL': 'מתוך', 'ja-JP': '/', 'de-DE': 'von', 'fr-FR': 'sur', 'zh-CN': '/' },
  'table.fdgDisplayedRows': { 'en-US': 'Showing %from%–%to% of %count% people', 'ar-SA': 'عرض %from%–%to% من %count% شخص', 'he-IL': 'מציג %from%–%to% מתוך %count% אנשים', 'ja-JP': '%count%人中 %from%–%to%人を表示', 'de-DE': '%from%–%to% von %count% Personen', 'fr-FR': 'Affichage de %from%–%to% sur %count% personnes', 'zh-CN': '显示 %from%–%to%，共 %count% 人' },

  // ── Virtualized data grid ───────────────────────────────────────────────
  'table.searchNameRoleTeamManager': { 'en-US': 'Search name, role, team, manager…', 'ar-SA': 'ابحث بالاسم أو الدور أو الفريق أو المدير…', 'he-IL': 'חיפוש לפי שם, תפקיד, צוות, מנהל…', 'ja-JP': '名前・役職・チーム・マネージャーで検索…', 'de-DE': 'Nach Name, Rolle, Team, Manager suchen…', 'fr-FR': 'Rechercher nom, rôle, équipe, responsable…', 'zh-CN': '搜索姓名、角色、团队、经理…' },
  'table.countSelected': { 'en-US': '%count% selected', 'ar-SA': 'تم تحديد %count%', 'he-IL': '%count% נבחרו', 'ja-JP': '%count% 件選択中', 'de-DE': '%count% ausgewählt', 'fr-FR': '%count% sélectionné(s)', 'zh-CN': '已选 %count% 项' },
};
