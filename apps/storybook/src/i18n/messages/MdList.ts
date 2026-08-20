import type { Entry } from '../index';

/** Demo strings for the List stories. Only genuine user-facing row content is
 *  localized: list-item headlines / supporting-text / overlines, list labels
 *  (aria-label), menu-item labels, and empty-state copy. Technical enum-demo
 *  labels ("List item", "Item 1", "Plain label", "With leading icon", "Headline
 *  + supporting", "Bold headline"…), CSS / ::part() / shape-morph demo labels,
 *  Material Symbols icon names, sample data (person names, file names, album /
 *  artist / playlist names, country & fruit filler), the explanatory
 *  caption() / sectionLabel() prose, and the intentional static multi-locale
 *  Localization + Arabic RTL demos all stay byte-for-byte. Shared verbs reuse
 *  common.ts: `delete` (Edit-menu Delete) and `home` (Home nav row). */
export const messages: Record<string, Entry> = {
  // ── Container labels (aria-label) ─────────────────────────────────────────
  'list.playgroundList': { 'en-US': 'Playground list', 'ar-SA': 'قائمة تجريبية', 'he-IL': 'רשימה לדוגמה', 'ja-JP': 'プレイグラウンドリスト', 'de-DE': 'Playground-Liste', 'fr-FR': 'Liste de démonstration', 'zh-CN': '演示列表' },
  'list.networkSettings': { 'en-US': 'Network settings', 'ar-SA': 'إعدادات الشبكة', 'he-IL': 'הגדרות רשת', 'ja-JP': 'ネットワーク設定', 'de-DE': 'Netzwerkeinstellungen', 'fr-FR': 'Paramètres réseau', 'zh-CN': '网络设置' },
  'list.subscriptionPlan': { 'en-US': 'Subscription plan', 'ar-SA': 'خطة الاشتراك', 'he-IL': 'תוכנית מנוי', 'ja-JP': 'サブスクリプションプラン', 'de-DE': 'Abonnement', 'fr-FR': 'Formule d\'abonnement', 'zh-CN': '订阅套餐' },
  'list.notifications': { 'en-US': 'Notifications', 'ar-SA': 'الإشعارات', 'he-IL': 'התראות', 'ja-JP': '通知', 'de-DE': 'Benachrichtigungen', 'fr-FR': 'Notifications', 'zh-CN': '通知' },
  'list.mediaLibrary': { 'en-US': 'Media library', 'ar-SA': 'مكتبة الوسائط', 'he-IL': 'ספריית מדיה', 'ja-JP': 'メディアライブラリ', 'de-DE': 'Medienbibliothek', 'fr-FR': 'Médiathèque', 'zh-CN': '媒体库' },
  'list.editMenu': { 'en-US': 'Edit menu', 'ar-SA': 'قائمة التحرير', 'he-IL': 'תפריט עריכה', 'ja-JP': '編集メニュー', 'de-DE': 'Bearbeitungsmenü', 'fr-FR': 'Menu Édition', 'zh-CN': '编辑菜单' },
  'list.system': { 'en-US': 'System', 'ar-SA': 'النظام', 'he-IL': 'מערכת', 'ja-JP': 'システム', 'de-DE': 'System', 'fr-FR': 'Système', 'zh-CN': '系统' },
  'list.notificationPreferences': { 'en-US': 'Notification preferences', 'ar-SA': 'تفضيلات الإشعارات', 'he-IL': 'העדפות התראות', 'ja-JP': '通知設定', 'de-DE': 'Benachrichtigungseinstellungen', 'fr-FR': 'Préférences de notification', 'zh-CN': '通知偏好' },

  // ── Playground rows ───────────────────────────────────────────────────────
  'list.inbox': { 'en-US': 'Inbox', 'ar-SA': 'البريد الوارد', 'he-IL': 'דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'list.inbox12New': { 'en-US': '12 new messages', 'ar-SA': '١٢ رسالة جديدة', 'he-IL': '12 הודעות חדשות', 'ja-JP': '新着メッセージ12件', 'de-DE': '12 neue Nachrichten', 'fr-FR': '12 nouveaux messages', 'zh-CN': '12 条新消息' },
  'list.starred': { 'en-US': 'Starred', 'ar-SA': 'المميز بنجمة', 'he-IL': 'מסומן בכוכב', 'ja-JP': 'スター付き', 'de-DE': 'Markiert', 'fr-FR': 'Favoris', 'zh-CN': '已加星标' },
  'list.markedImportant': { 'en-US': 'Marked important', 'ar-SA': 'مُعلَّم كمهم', 'he-IL': 'סומן כחשוב', 'ja-JP': '重要としてマーク', 'de-DE': 'Als wichtig markiert', 'fr-FR': 'Marqué comme important', 'zh-CN': '标为重要' },
  'list.drafts': { 'en-US': 'Drafts', 'ar-SA': 'المسودات', 'he-IL': 'טיוטות', 'ja-JP': '下書き', 'de-DE': 'Entwürfe', 'fr-FR': 'Brouillons', 'zh-CN': '草稿' },
  'list.draftsResume': { 'en-US': 'Resume where you left off', 'ar-SA': 'تابع من حيث توقفت', 'he-IL': 'המשך מהמקום שבו הפסקת', 'ja-JP': '続きから再開', 'de-DE': 'Dort weitermachen, wo Sie aufgehört haben', 'fr-FR': 'Reprenez où vous en étiez', 'zh-CN': '从上次中断处继续' },
  'list.sent': { 'en-US': 'Sent', 'ar-SA': 'المرسلة', 'he-IL': 'נשלח', 'ja-JP': '送信済み', 'de-DE': 'Gesendet', 'fr-FR': 'Envoyés', 'zh-CN': '已发送' },
  'list.sentOutgoing': { 'en-US': 'Outgoing items', 'ar-SA': 'العناصر الصادرة', 'he-IL': 'פריטים יוצאים', 'ja-JP': '送信アイテム', 'de-DE': 'Ausgehende Elemente', 'fr-FR': 'Éléments sortants', 'zh-CN': '发件内容' },

  // ── ListStyles rows ───────────────────────────────────────────────────────
  'list.profile': { 'en-US': 'Profile', 'ar-SA': 'الملف الشخصي', 'he-IL': 'פרופיל', 'ja-JP': 'プロフィール', 'de-DE': 'Profil', 'fr-FR': 'Profil', 'zh-CN': '个人资料' },
  'list.privacy': { 'en-US': 'Privacy', 'ar-SA': 'الخصوصية', 'he-IL': 'פרטיות', 'ja-JP': 'プライバシー', 'de-DE': 'Datenschutz', 'fr-FR': 'Confidentialité', 'zh-CN': '隐私' },
  'list.signOut': { 'en-US': 'Sign out', 'ar-SA': 'تسجيل الخروج', 'he-IL': 'התנתקות', 'ja-JP': 'ログアウト', 'de-DE': 'Abmelden', 'fr-FR': 'Se déconnecter', 'zh-CN': '退出登录' },
  'list.photos': { 'en-US': 'Photos', 'ar-SA': 'الصور', 'he-IL': 'תמונות', 'ja-JP': '写真', 'de-DE': 'Fotos', 'fr-FR': 'Photos', 'zh-CN': '照片' },
  'list.videos': { 'en-US': 'Videos', 'ar-SA': 'مقاطع الفيديو', 'he-IL': 'סרטונים', 'ja-JP': '動画', 'de-DE': 'Videos', 'fr-FR': 'Vidéos', 'zh-CN': '视频' },
  'list.music': { 'en-US': 'Music', 'ar-SA': 'الموسيقى', 'he-IL': 'מוזיקה', 'ja-JP': '音楽', 'de-DE': 'Musik', 'fr-FR': 'Musique', 'zh-CN': '音乐' },

  // ── WithIcons rows (network) ──────────────────────────────────────────────
  'list.wifi': { 'en-US': 'Wi-Fi', 'ar-SA': 'Wi-Fi', 'he-IL': 'Wi-Fi', 'ja-JP': 'Wi-Fi', 'de-DE': 'WLAN', 'fr-FR': 'Wi-Fi', 'zh-CN': 'Wi-Fi' },
  'list.homeNetwork': { 'en-US': 'Home Network', 'ar-SA': 'الشبكة المنزلية', 'he-IL': 'רשת ביתית', 'ja-JP': 'ホームネットワーク', 'de-DE': 'Heimnetzwerk', 'fr-FR': 'Réseau domestique', 'zh-CN': '家庭网络' },
  'list.bluetooth': { 'en-US': 'Bluetooth', 'ar-SA': 'البلوتوث', 'he-IL': 'Bluetooth', 'ja-JP': 'Bluetooth', 'de-DE': 'Bluetooth', 'fr-FR': 'Bluetooth', 'zh-CN': '蓝牙' },
  'list.devicesConnected2': { 'en-US': '2 devices connected', 'ar-SA': 'جهازان متصلان', 'he-IL': '2 מכשירים מחוברים', 'ja-JP': '2台のデバイスが接続済み', 'de-DE': '2 Geräte verbunden', 'fr-FR': '2 appareils connectés', 'zh-CN': '已连接 2 台设备' },
  'list.mobileData': { 'en-US': 'Mobile data', 'ar-SA': 'بيانات الجوال', 'he-IL': 'נתונים סלולריים', 'ja-JP': 'モバイルデータ', 'de-DE': 'Mobile Daten', 'fr-FR': 'Données mobiles', 'zh-CN': '移动数据' },
  'list.on': { 'en-US': 'On', 'ar-SA': 'تشغيل', 'he-IL': 'פועל', 'ja-JP': 'オン', 'de-DE': 'Ein', 'fr-FR': 'Activé', 'zh-CN': '开启' },
  'list.vpn': { 'en-US': 'VPN', 'ar-SA': 'VPN', 'he-IL': 'VPN', 'ja-JP': 'VPN', 'de-DE': 'VPN', 'fr-FR': 'VPN', 'zh-CN': 'VPN' },
  'list.disconnected': { 'en-US': 'Disconnected', 'ar-SA': 'غير متصل', 'he-IL': 'מנותק', 'ja-JP': '未接続', 'de-DE': 'Getrennt', 'fr-FR': 'Déconnecté', 'zh-CN': '已断开连接' },
  'list.airplaneMode': { 'en-US': 'Airplane mode', 'ar-SA': 'وضع الطيران', 'he-IL': 'מצב טיסה', 'ja-JP': '機内モード', 'de-DE': 'Flugmodus', 'fr-FR': 'Mode avion', 'zh-CN': '飞行模式' },

  // ── TrailingContent rows ──────────────────────────────────────────────────
  'list.connectedToHomeNetwork': { 'en-US': 'Connected to Home Network', 'ar-SA': 'متصل بالشبكة المنزلية', 'he-IL': 'מחובר לרשת הביתית', 'ja-JP': 'ホームネットワークに接続済み', 'de-DE': 'Mit Heimnetzwerk verbunden', 'fr-FR': 'Connecté au réseau domestique', 'zh-CN': '已连接到家庭网络' },
  'list.off': { 'en-US': 'Off', 'ar-SA': 'إيقاف', 'he-IL': 'כבוי', 'ja-JP': 'オフ', 'de-DE': 'Aus', 'fr-FR': 'Désactivé', 'zh-CN': '关闭' },
  'list.subscribeToDigest': { 'en-US': 'Subscribe to digest', 'ar-SA': 'الاشتراك في الملخص', 'he-IL': 'הרשמה לתקציר', 'ja-JP': 'ダイジェストを購読', 'de-DE': 'Zusammenfassung abonnieren', 'fr-FR': 'S\'abonner au résumé', 'zh-CN': '订阅摘要' },
  'list.weeklySummaryEmail': { 'en-US': 'Weekly summary email', 'ar-SA': 'بريد الملخص الأسبوعي', 'he-IL': 'אימייל סיכום שבועי', 'ja-JP': '週次サマリーメール', 'de-DE': 'Wöchentliche Zusammenfassung per E-Mail', 'fr-FR': 'E-mail récapitulatif hebdomadaire', 'zh-CN': '每周摘要邮件' },
  'list.autoUpdateApps': { 'en-US': 'Auto-update apps', 'ar-SA': 'تحديث التطبيقات تلقائيًا', 'he-IL': 'עדכון אוטומטי של אפליקציות', 'ja-JP': 'アプリを自動更新', 'de-DE': 'Apps automatisch aktualisieren', 'fr-FR': 'Mettre à jour les applis automatiquement', 'zh-CN': '自动更新应用' },
  'list.overWifiOnly': { 'en-US': 'Over Wi-Fi only', 'ar-SA': 'عبر Wi-Fi فقط', 'he-IL': 'רק ב-Wi-Fi', 'ja-JP': 'Wi-Fi接続時のみ', 'de-DE': 'Nur über WLAN', 'fr-FR': 'Via Wi-Fi uniquement', 'zh-CN': '仅通过 Wi-Fi' },
  'list.accountSettings': { 'en-US': 'Account settings', 'ar-SA': 'إعدادات الحساب', 'he-IL': 'הגדרות חשבון', 'ja-JP': 'アカウント設定', 'de-DE': 'Kontoeinstellungen', 'fr-FR': 'Paramètres du compte', 'zh-CN': '账户设置' },
  'list.lastEdited2Days': { 'en-US': 'Last edited 2 days ago', 'ar-SA': 'آخر تعديل قبل يومين', 'he-IL': 'נערך לאחרונה לפני יומיים', 'ja-JP': '2日前に最終編集', 'de-DE': 'Zuletzt vor 2 Tagen bearbeitet', 'fr-FR': 'Modifié il y a 2 jours', 'zh-CN': '2 天前最后编辑' },
  'list.unread42': { 'en-US': '42 unread', 'ar-SA': '٤٢ غير مقروءة', 'he-IL': '42 לא נקראו', 'ja-JP': '未読42件', 'de-DE': '42 ungelesen', 'fr-FR': '42 non lus', 'zh-CN': '42 条未读' },

  // ── SingleSelect (subscription plans) ─────────────────────────────────────
  'list.free': { 'en-US': 'Free', 'ar-SA': 'مجاني', 'he-IL': 'חינם', 'ja-JP': '無料', 'de-DE': 'Kostenlos', 'fr-FR': 'Gratuit', 'zh-CN': '免费' },
  'list.upTo3Projects': { 'en-US': 'Up to 3 projects', 'ar-SA': 'حتى ٣ مشاريع', 'he-IL': 'עד 3 פרויקטים', 'ja-JP': '最大3プロジェクト', 'de-DE': 'Bis zu 3 Projekte', 'fr-FR': 'Jusqu\'à 3 projets', 'zh-CN': '最多 3 个项目' },
  'list.pro': { 'en-US': 'Pro', 'ar-SA': 'احترافي', 'he-IL': 'Pro', 'ja-JP': 'Pro', 'de-DE': 'Pro', 'fr-FR': 'Pro', 'zh-CN': '专业版' },
  'list.unlimitedProjects': { 'en-US': 'Unlimited projects', 'ar-SA': 'مشاريع غير محدودة', 'he-IL': 'פרויקטים ללא הגבלה', 'ja-JP': 'プロジェクト無制限', 'de-DE': 'Unbegrenzte Projekte', 'fr-FR': 'Projets illimités', 'zh-CN': '无限项目' },
  'list.team': { 'en-US': 'Team', 'ar-SA': 'فريق', 'he-IL': 'צוות', 'ja-JP': 'チーム', 'de-DE': 'Team', 'fr-FR': 'Équipe', 'zh-CN': '团队版' },
  'list.collaborationSso': { 'en-US': 'Collaboration + SSO', 'ar-SA': 'التعاون + الدخول الموحّد (SSO)', 'he-IL': 'שיתוף פעולה + SSO', 'ja-JP': 'コラボレーション + SSO', 'de-DE': 'Zusammenarbeit + SSO', 'fr-FR': 'Collaboration + SSO', 'zh-CN': '协作 + 单点登录 (SSO)' },
  'list.enterprise': { 'en-US': 'Enterprise', 'ar-SA': 'المؤسسات', 'he-IL': 'ארגוני', 'ja-JP': 'エンタープライズ', 'de-DE': 'Enterprise', 'fr-FR': 'Entreprise', 'zh-CN': '企业版' },
  'list.customContracts': { 'en-US': 'Custom contracts, dedicated support', 'ar-SA': 'عقود مخصّصة ودعم مخصّص', 'he-IL': 'חוזים מותאמים אישית, תמיכה ייעודית', 'ja-JP': 'カスタム契約、専任サポート', 'de-DE': 'Individuelle Verträge, dedizierter Support', 'fr-FR': 'Contrats personnalisés, assistance dédiée', 'zh-CN': '定制合同，专属支持' },

  // ── MultiSelect (notification channels) ───────────────────────────────────
  'list.email': { 'en-US': 'Email', 'ar-SA': 'البريد الإلكتروني', 'he-IL': 'אימייל', 'ja-JP': 'メール', 'de-DE': 'E-Mail', 'fr-FR': 'E-mail', 'zh-CN': '电子邮件' },
  'list.sms': { 'en-US': 'SMS', 'ar-SA': 'رسالة نصية', 'he-IL': 'SMS', 'ja-JP': 'SMS', 'de-DE': 'SMS', 'fr-FR': 'SMS', 'zh-CN': '短信' },
  'list.push': { 'en-US': 'Push', 'ar-SA': 'إشعارات فورية', 'he-IL': 'התראות פוש', 'ja-JP': 'プッシュ', 'de-DE': 'Push', 'fr-FR': 'Push', 'zh-CN': '推送' },
  'list.inAppBanner': { 'en-US': 'In-app banner', 'ar-SA': 'شعار داخل التطبيق', 'he-IL': 'באנר בתוך האפליקציה', 'ja-JP': 'アプリ内バナー', 'de-DE': 'In-App-Banner', 'fr-FR': 'Bannière dans l\'appli', 'zh-CN': '应用内横幅' },

  // ── SegmentedSelection ────────────────────────────────────────────────────
  'list.documents': { 'en-US': 'Documents', 'ar-SA': 'المستندات', 'he-IL': 'מסמכים', 'ja-JP': 'ドキュメント', 'de-DE': 'Dokumente', 'fr-FR': 'Documents', 'zh-CN': '文档' },

  // ── EdgeCases (empty state + nav sections) ────────────────────────────────
  'list.noResults': { 'en-US': 'No results', 'ar-SA': 'لا توجد نتائج', 'he-IL': 'אין תוצאות', 'ja-JP': '結果がありません', 'de-DE': 'Keine Ergebnisse', 'fr-FR': 'Aucun résultat', 'zh-CN': '无结果' },
  'list.tryDifferentSearch': { 'en-US': 'Try a different search term', 'ar-SA': 'جرّب مصطلح بحث مختلفًا', 'he-IL': 'נסה מונח חיפוש אחר', 'ja-JP': '別の検索語を試してください', 'de-DE': 'Versuchen Sie einen anderen Suchbegriff', 'fr-FR': 'Essayez un autre terme de recherche', 'zh-CN': '请尝试其他搜索词' },
  'list.favorites': { 'en-US': 'FAVORITES', 'ar-SA': 'المفضلة', 'he-IL': 'מועדפים', 'ja-JP': 'お気に入り', 'de-DE': 'FAVORITEN', 'fr-FR': 'FAVORIS', 'zh-CN': '收藏夹' },
  'list.work': { 'en-US': 'Work', 'ar-SA': 'العمل', 'he-IL': 'עבודה', 'ja-JP': '仕事', 'de-DE': 'Arbeit', 'fr-FR': 'Travail', 'zh-CN': '工作' },
  'list.other': { 'en-US': 'OTHER', 'ar-SA': 'أخرى', 'he-IL': 'אחר', 'ja-JP': 'その他', 'de-DE': 'ANDERE', 'fr-FR': 'AUTRES', 'zh-CN': '其他' },
  'list.gym': { 'en-US': 'Gym', 'ar-SA': 'النادي الرياضي', 'he-IL': 'חדר כושר', 'ja-JP': 'ジム', 'de-DE': 'Fitnessstudio', 'fr-FR': 'Salle de sport', 'zh-CN': '健身房' },
  'list.cafe': { 'en-US': 'Cafe', 'ar-SA': 'مقهى', 'he-IL': 'בית קפה', 'ja-JP': 'カフェ', 'de-DE': 'Café', 'fr-FR': 'Café', 'zh-CN': '咖啡馆' },

  // ── RoleOverride (edit menu items) ────────────────────────────────────────
  'list.cut': { 'en-US': 'Cut', 'ar-SA': 'قص', 'he-IL': 'גזירה', 'ja-JP': '切り取り', 'de-DE': 'Ausschneiden', 'fr-FR': 'Couper', 'zh-CN': '剪切' },
  'list.copy': { 'en-US': 'Copy', 'ar-SA': 'نسخ', 'he-IL': 'העתקה', 'ja-JP': 'コピー', 'de-DE': 'Kopieren', 'fr-FR': 'Copier', 'zh-CN': '复制' },
  'list.paste': { 'en-US': 'Paste', 'ar-SA': 'لصق', 'he-IL': 'הדבקה', 'ja-JP': '貼り付け', 'de-DE': 'Einfügen', 'fr-FR': 'Coller', 'zh-CN': '粘贴' },

  // ── SettingsRecipe rows ───────────────────────────────────────────────────
  'list.display': { 'en-US': 'Display', 'ar-SA': 'العرض', 'he-IL': 'תצוגה', 'ja-JP': 'ディスプレイ', 'de-DE': 'Anzeige', 'fr-FR': 'Affichage', 'zh-CN': '显示' },
  'list.adaptiveBrightness': { 'en-US': 'Adaptive brightness on', 'ar-SA': 'السطوع التكيّفي مفعّل', 'he-IL': 'בהירות מותאמת פועלת', 'ja-JP': '自動明るさ調整オン', 'de-DE': 'Adaptive Helligkeit ein', 'fr-FR': 'Luminosité adaptative activée', 'zh-CN': '自适应亮度已开启' },
  'list.sound': { 'en-US': 'Sound', 'ar-SA': 'الصوت', 'he-IL': 'צליל', 'ja-JP': 'サウンド', 'de-DE': 'Ton', 'fr-FR': 'Son', 'zh-CN': '声音' },
  'list.mediaVolume80': { 'en-US': 'Media volume 80 %', 'ar-SA': 'مستوى صوت الوسائط ٨٠ ٪', 'he-IL': 'עוצמת מדיה 80 %', 'ja-JP': 'メディア音量 80 %', 'de-DE': 'Medienlautstärke 80 %', 'fr-FR': 'Volume multimédia 80 %', 'zh-CN': '媒体音量 80 %' },
  'list.battery': { 'en-US': 'Battery', 'ar-SA': 'البطارية', 'he-IL': 'סוללה', 'ja-JP': 'バッテリー', 'de-DE': 'Akku', 'fr-FR': 'Batterie', 'zh-CN': '电池' },
  'list.battery68': { 'en-US': '68 % — about 6 hours left', 'ar-SA': '٦٨ ٪ — يتبقى نحو ٦ ساعات', 'he-IL': '68 % — נותרו כ-6 שעות', 'ja-JP': '68 % — 残り約6時間', 'de-DE': '68 % — noch etwa 6 Stunden', 'fr-FR': '68 % — environ 6 heures restantes', 'zh-CN': '68 % — 剩余约 6 小时' },

  // ── NotificationPreferencesRecipe rows ────────────────────────────────────
  'list.dailyDigestActivity': { 'en-US': 'Daily digest of new activity', 'ar-SA': 'ملخص يومي للنشاط الجديد', 'he-IL': 'תקציר יומי של פעילות חדשה', 'ja-JP': '新しいアクティビティの日次ダイジェスト', 'de-DE': 'Tägliche Zusammenfassung neuer Aktivitäten', 'fr-FR': 'Résumé quotidien de la nouvelle activité', 'zh-CN': '新动态每日摘要' },
  'list.realTimeMobileAlerts': { 'en-US': 'Real-time mobile alerts', 'ar-SA': 'تنبيهات فورية على الجوال', 'he-IL': 'התראות מובייל בזמן אמת', 'ja-JP': 'リアルタイムのモバイル通知', 'de-DE': 'Echtzeit-Benachrichtigungen aufs Handy', 'fr-FR': 'Alertes mobiles en temps réel', 'zh-CN': '实时移动提醒' },
  'list.criticalAlertsOnly': { 'en-US': 'Critical alerts only', 'ar-SA': 'التنبيهات الحرجة فقط', 'he-IL': 'התראות קריטיות בלבד', 'ja-JP': '重要な通知のみ', 'de-DE': 'Nur kritische Benachrichtigungen', 'fr-FR': 'Alertes critiques uniquement', 'zh-CN': '仅限重要提醒' },
  'list.doNotDisturb': { 'en-US': 'Do not disturb', 'ar-SA': 'عدم الإزعاج', 'he-IL': 'נא לא להפריע', 'ja-JP': 'サイレント', 'de-DE': 'Nicht stören', 'fr-FR': 'Ne pas déranger', 'zh-CN': '勿扰' },
  'list.silenceAll': { 'en-US': 'Silence all between 22:00 – 07:00', 'ar-SA': 'كتم الكل بين ٢٢:٠٠ و٠٧:٠٠', 'he-IL': 'השתקת הכול בין 22:00 ל-07:00', 'ja-JP': '22:00～07:00はすべて消音', 'de-DE': 'Alles zwischen 22:00 – 07:00 stummschalten', 'fr-FR': 'Tout mettre en silence entre 22h00 et 07h00', 'zh-CN': '在 22:00 – 07:00 之间静音所有' },
};
