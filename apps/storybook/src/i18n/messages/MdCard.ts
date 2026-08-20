import type { Entry } from '../index';

/** Card demo strings — headlines and supporting text shown INSIDE the cards,
 *  plus content button labels and empty-state text. Keys are namespaced under
 *  `card.`. Shared verbs (save, cancel) are reused from common.ts via t().
 *  The RTL and Localization stories keep their own hardcoded per-locale text
 *  (they deliberately showcase raw locale/RTL output), so they are not routed
 *  through this catalog. */
export const messages: Record<string, Entry> = {
  // Playground
  'card.playground-title': { 'en-US': 'Playground Card', 'ar-SA': 'بطاقة تجريبية', 'he-IL': 'כרטיס ניסיוני', 'ja-JP': 'プレイグラウンドカード', 'de-DE': 'Playground-Karte', 'fr-FR': 'Carte de démonstration', 'zh-CN': '演练场卡片' },
  'card.playground-body': { 'en-US': 'Adjust the controls in the panel to explore different states and variants.', 'ar-SA': 'اضبط عناصر التحكم في اللوحة لاستكشاف الحالات والأنماط المختلفة.', 'he-IL': 'התאם את הפקדים בלוח כדי לחקור מצבים ווריאנטים שונים.', 'ja-JP': 'パネルのコントロールを調整して、さまざまな状態やバリエーションを試してみましょう。', 'de-DE': 'Passe die Steuerelemente im Bedienfeld an, um verschiedene Zustände und Varianten zu erkunden.', 'fr-FR': 'Ajustez les commandes du panneau pour explorer différents états et variantes.', 'zh-CN': '调整面板中的控件，探索不同的状态和变体。' },

  // AllVariants
  'card.elevated-title': { 'en-US': 'Elevated', 'ar-SA': 'مرتفع', 'he-IL': 'מוגבה', 'ja-JP': 'エレベーテッド', 'de-DE': 'Erhöht', 'fr-FR': 'Surélevée', 'zh-CN': '悬浮' },
  'card.elevated-body': { 'en-US': 'Drop shadow provides separation from the background.', 'ar-SA': 'يوفر الظل الساقط فصلاً عن الخلفية.', 'he-IL': 'צל מטיל מספק הפרדה מהרקע.', 'ja-JP': 'ドロップシャドウが背景との区別を生み出します。', 'de-DE': 'Der Schlagschatten sorgt für Trennung vom Hintergrund.', 'fr-FR': 'L’ombre portée assure une séparation avec l’arrière-plan.', 'zh-CN': '投影使其与背景区分开来。' },
  'card.filled-title': { 'en-US': 'Filled', 'ar-SA': 'ممتلئ', 'he-IL': 'מלא', 'ja-JP': '塗りつぶし', 'de-DE': 'Gefüllt', 'fr-FR': 'Remplie', 'zh-CN': '填充' },
  'card.filled-body': { 'en-US': 'Highest surface container tint, no elevation.', 'ar-SA': 'أعلى درجة تلوين لحاوية السطح، بدون ارتفاع.', 'he-IL': 'גוון מכל המשטח הגבוה ביותר, ללא הגבהה.', 'ja-JP': '最も高いサーフェスコンテナの色合い、影なし。', 'de-DE': 'Höchste Surface-Container-Tönung, keine Elevation.', 'fr-FR': 'Teinte de conteneur de surface la plus élevée, sans élévation.', 'zh-CN': '最高的表面容器着色，无高程。' },
  'card.outlined-title': { 'en-US': 'Outlined', 'ar-SA': 'محدد', 'he-IL': 'עם מתאר', 'ja-JP': 'アウトライン', 'de-DE': 'Umrandet', 'fr-FR': 'Contourée', 'zh-CN': '描边' },
  'card.outlined-body': { 'en-US': 'Outline-variant border on a flat surface.', 'ar-SA': 'حدّ بلون outline-variant على سطح مسطح.', 'he-IL': 'גבול בגוון outline-variant על משטח שטוח.', 'ja-JP': 'フラットなサーフェス上の outline-variant の境界線。', 'de-DE': 'Rahmen in Outline-Variant auf einer flachen Oberfläche.', 'fr-FR': 'Bordure outline-variant sur une surface plane.', 'zh-CN': '平面上的 outline-variant 边框。' },

  // InteractiveCards
  'card.elevated-interactive-title': { 'en-US': 'Elevated Interactive', 'ar-SA': 'مرتفع تفاعلي', 'he-IL': 'מוגבה אינטראקטיבי', 'ja-JP': 'エレベーテッド（インタラクティブ）', 'de-DE': 'Erhöht interaktiv', 'fr-FR': 'Surélevée interactive', 'zh-CN': '悬浮可交互' },
  'card.filled-interactive-title': { 'en-US': 'Filled Interactive', 'ar-SA': 'ممتلئ تفاعلي', 'he-IL': 'מלא אינטראקטיבי', 'ja-JP': '塗りつぶし（インタラクティブ）', 'de-DE': 'Gefüllt interaktiv', 'fr-FR': 'Remplie interactive', 'zh-CN': '填充可交互' },
  'card.outlined-interactive-title': { 'en-US': 'Outlined Interactive', 'ar-SA': 'محدد تفاعلي', 'he-IL': 'עם מתאר אינטראקטיבי', 'ja-JP': 'アウトライン（インタラクティブ）', 'de-DE': 'Umrandet interaktiv', 'fr-FR': 'Contourée interactive', 'zh-CN': '描边可交互' },
  'card.interactive-body': { 'en-US': 'Hover, focus, press, and drag states.', 'ar-SA': 'حالات التحويم والتركيز والضغط والسحب.', 'he-IL': 'מצבי ריחוף, מיקוד, לחיצה וגרירה.', 'ja-JP': 'ホバー、フォーカス、プレス、ドラッグの各状態。', 'de-DE': 'Hover-, Fokus-, Press- und Ziehzustände.', 'fr-FR': 'États survol, focus, appui et glissement.', 'zh-CN': '悬停、聚焦、按下和拖动状态。' },

  // WithImage
  'card.mountain-title': { 'en-US': 'Mountain View', 'ar-SA': 'منظر جبلي', 'he-IL': 'נוף הרים', 'ja-JP': '山の風景', 'de-DE': 'Bergblick', 'fr-FR': 'Vue sur la montagne', 'zh-CN': '山景' },
  'card.mountain-body': { 'en-US': 'Beautiful landscape photography from the Pacific Northwest.', 'ar-SA': 'تصوير مناظر طبيعية خلابة من شمال غرب المحيط الهادئ.', 'he-IL': 'צילומי נוף מרהיבים מצפון-מערב האוקיינוס השקט.', 'ja-JP': '太平洋岸北西部の美しい風景写真。', 'de-DE': 'Wunderschöne Landschaftsfotografie aus dem pazifischen Nordwesten.', 'fr-FR': 'Superbe photographie de paysage du nord-ouest du Pacifique.', 'zh-CN': '来自太平洋西北地区的美丽风景摄影。' },
  'card.image-interactive-title': { 'en-US': 'Interactive Image Card', 'ar-SA': 'بطاقة صورة تفاعلية', 'he-IL': 'כרטיס תמונה אינטראקטיבי', 'ja-JP': 'インタラクティブな画像カード', 'de-DE': 'Interaktive Bildkarte', 'fr-FR': 'Carte image interactive', 'zh-CN': '交互式图片卡片' },
  'card.image-interactive-body': { 'en-US': 'Click this card to navigate somewhere.', 'ar-SA': 'انقر على هذه البطاقة للانتقال إلى مكان ما.', 'he-IL': 'לחץ על הכרטיס כדי לנווט למקום כלשהו.', 'ja-JP': 'このカードをクリックしてどこかに移動します。', 'de-DE': 'Klicke auf diese Karte, um irgendwohin zu navigieren.', 'fr-FR': 'Cliquez sur cette carte pour naviguer quelque part.', 'zh-CN': '点击此卡片可导航到某处。' },
  'card.image-outlined-title': { 'en-US': 'Outlined Card', 'ar-SA': 'بطاقة محددة', 'he-IL': 'כרטיס עם מתאר', 'ja-JP': 'アウトラインカード', 'de-DE': 'Umrandete Karte', 'fr-FR': 'Carte contourée', 'zh-CN': '描边卡片' },
  'card.image-outlined-body': { 'en-US': 'A card with a clear border and image content.', 'ar-SA': 'بطاقة ذات حد واضح ومحتوى صوري.', 'he-IL': 'כרטיס עם גבול ברור ותוכן תמונה.', 'ja-JP': '明確な境界線と画像コンテンツを持つカード。', 'de-DE': 'Eine Karte mit klarem Rahmen und Bildinhalt.', 'fr-FR': 'Une carte avec une bordure nette et un contenu image.', 'zh-CN': '带有清晰边框和图片内容的卡片。' },

  // WithVideo — rich media card
  'card.trailer-overline': { 'en-US': 'Trailer', 'ar-SA': 'مقطع دعائي', 'he-IL': 'טריילר', 'ja-JP': '予告編', 'de-DE': 'Trailer', 'fr-FR': 'Bande-annonce', 'zh-CN': '预告片' },
  'card.sintel-body': { 'en-US': 'A girl, a dragon, and a journey through harsh worlds — created by the Blender Foundation as a showcase of the open-source 3D pipeline.', 'ar-SA': 'فتاة وتنين ورحلة عبر عوالم قاسية — من إنتاج مؤسسة Blender كعرض توضيحي لسلسلة أدوات ثلاثية الأبعاد مفتوحة المصدر.', 'he-IL': 'נערה, דרקון ומסע דרך עולמות קשוחים — נוצר על ידי Blender Foundation כהדגמה של צינור ה-3D בקוד פתוח.', 'ja-JP': '少女とドラゴン、そして過酷な世界を巡る旅 — Blender Foundation がオープンソースの3Dパイプラインのショーケースとして制作しました。', 'de-DE': 'Ein Mädchen, ein Drache und eine Reise durch raue Welten — von der Blender Foundation als Schaufenster der Open-Source-3D-Pipeline geschaffen.', 'fr-FR': 'Une fille, un dragon et un voyage à travers des mondes hostiles — créé par la Blender Foundation comme vitrine du pipeline 3D open source.', 'zh-CN': '一个女孩、一条龙，以及一段穿越严酷世界的旅程 —— 由 Blender 基金会打造，用以展示开源 3D 制作流程。' },
  'card.play': { 'en-US': 'Play', 'ar-SA': 'تشغيل', 'he-IL': 'הפעלה', 'ja-JP': '再生', 'de-DE': 'Abspielen', 'fr-FR': 'Lire', 'zh-CN': '播放' },

  // States
  'card.state-enabled-title': { 'en-US': 'Enabled', 'ar-SA': 'مُفعّل', 'he-IL': 'מופעל', 'ja-JP': '有効', 'de-DE': 'Aktiviert', 'fr-FR': 'Activée', 'zh-CN': '已启用' },
  'card.state-enabled-body': { 'en-US': 'Normal interactive state', 'ar-SA': 'حالة تفاعلية عادية', 'he-IL': 'מצב אינטראקטיבי רגיל', 'ja-JP': '通常のインタラクティブ状態', 'de-DE': 'Normaler interaktiver Zustand', 'fr-FR': 'État interactif normal', 'zh-CN': '正常交互状态' },
  'card.state-disabled-title': { 'en-US': 'Disabled', 'ar-SA': 'مُعطّل', 'he-IL': 'מושבת', 'ja-JP': '無効', 'de-DE': 'Deaktiviert', 'fr-FR': 'Désactivée', 'zh-CN': '已禁用' },
  'card.state-disabled-body': { 'en-US': 'Cannot be interacted with', 'ar-SA': 'لا يمكن التفاعل معها', 'he-IL': 'לא ניתן לבצע איתו אינטראקציה', 'ja-JP': '操作できません', 'de-DE': 'Kann nicht bedient werden', 'fr-FR': 'Aucune interaction possible', 'zh-CN': '无法进行交互' },
  'card.state-soft-disabled-title': { 'en-US': 'Soft-disabled', 'ar-SA': 'مُعطّل جزئياً', 'he-IL': 'מושבת חלקית', 'ja-JP': 'ソフト無効', 'de-DE': 'Weich deaktiviert', 'fr-FR': 'Désactivation partielle', 'zh-CN': '软禁用' },
  'card.state-soft-disabled-body': { 'en-US': 'Remains focusable for a11y', 'ar-SA': 'يبقى قابلاً للتركيز لأغراض a11y', 'he-IL': 'נשאר ניתן למיקוד עבור a11y', 'ja-JP': 'a11y のためフォーカス可能なまま', 'de-DE': 'Bleibt für a11y fokussierbar', 'fr-FR': 'Reste focusable pour l’a11y', 'zh-CN': '为无障碍（a11y）保持可聚焦' },

  // DarkTheme
  'card.dark-elevated-title': { 'en-US': 'Elevated Dark', 'ar-SA': 'مرتفع داكن', 'he-IL': 'מוגבה כהה', 'ja-JP': 'エレベーテッド（ダーク）', 'de-DE': 'Erhöht dunkel', 'fr-FR': 'Surélevée sombre', 'zh-CN': '悬浮深色' },
  'card.dark-elevated-body': { 'en-US': 'Surface container low in dark mode.', 'ar-SA': 'حاوية سطح منخفضة في الوضع الداكن.', 'he-IL': 'מכל משטח נמוך במצב כהה.', 'ja-JP': 'ダークモードでのサーフェスコンテナ Low。', 'de-DE': 'Surface Container Low im dunklen Modus.', 'fr-FR': 'Conteneur de surface bas en mode sombre.', 'zh-CN': '深色模式下的低层表面容器。' },
  'card.dark-filled-title': { 'en-US': 'Filled Dark Interactive', 'ar-SA': 'ممتلئ داكن تفاعلي', 'he-IL': 'מלא כהה אינטראקטיבי', 'ja-JP': '塗りつぶし（ダーク・インタラクティブ）', 'de-DE': 'Gefüllt dunkel interaktiv', 'fr-FR': 'Remplie sombre interactive', 'zh-CN': '填充深色可交互' },
  'card.dark-filled-body': { 'en-US': 'Surface container highest in dark mode.', 'ar-SA': 'أعلى حاوية سطح في الوضع الداكن.', 'he-IL': 'מכל משטח הגבוה ביותר במצב כהה.', 'ja-JP': 'ダークモードでのサーフェスコンテナ Highest。', 'de-DE': 'Surface Container Highest im dunklen Modus.', 'fr-FR': 'Conteneur de surface le plus élevé en mode sombre.', 'zh-CN': '深色模式下的最高层表面容器。' },
  'card.dark-outlined-title': { 'en-US': 'Outlined Dark', 'ar-SA': 'محدد داكن', 'he-IL': 'עם מתאר כהה', 'ja-JP': 'アウトライン（ダーク）', 'de-DE': 'Umrandet dunkel', 'fr-FR': 'Contourée sombre', 'zh-CN': '描边深色' },
  'card.dark-outlined-body': { 'en-US': 'Outline-variant border in dark mode.', 'ar-SA': 'حدّ outline-variant في الوضع الداكن.', 'he-IL': 'גבול outline-variant במצב כהה.', 'ja-JP': 'ダークモードでの outline-variant の境界線。', 'de-DE': 'Outline-Variant-Rahmen im dunklen Modus.', 'fr-FR': 'Bordure outline-variant en mode sombre.', 'zh-CN': '深色模式下的 outline-variant 边框。' },

  // CustomCSS
  'card.brand-title': { 'en-US': 'Brand Card', 'ar-SA': 'بطاقة العلامة التجارية', 'he-IL': 'כרטיס מותג', 'ja-JP': 'ブランドカード', 'de-DE': 'Marken-Karte', 'fr-FR': 'Carte de marque', 'zh-CN': '品牌卡片' },
  'card.brand-body': { 'en-US': 'Custom container color and larger radius.', 'ar-SA': 'لون حاوية مخصص ونصف قطر أكبر.', 'he-IL': 'צבע מכל מותאם אישית ורדיוס גדול יותר.', 'ja-JP': 'カスタムのコンテナカラーと大きめの角丸。', 'de-DE': 'Benutzerdefinierte Containerfarbe und größerer Radius.', 'fr-FR': 'Couleur de conteneur personnalisée et rayon plus grand.', 'zh-CN': '自定义容器颜色和更大的圆角半径。' },
  'card.danger-title': { 'en-US': 'Danger Card', 'ar-SA': 'بطاقة تحذير', 'he-IL': 'כרטיס סכנה', 'ja-JP': '危険カード', 'de-DE': 'Gefahren-Karte', 'fr-FR': 'Carte de danger', 'zh-CN': '危险卡片' },
  'card.danger-body': { 'en-US': 'Uses error-container tokens.', 'ar-SA': 'تستخدم رموز error-container.', 'he-IL': 'משתמש באסימוני error-container.', 'ja-JP': 'error-container トークンを使用します。', 'de-DE': 'Verwendet error-container-Tokens.', 'fr-FR': 'Utilise les jetons error-container.', 'zh-CN': '使用 error-container 令牌。' },
  'card.sharp-title': { 'en-US': 'Sharp Card', 'ar-SA': 'بطاقة حادة الزوايا', 'he-IL': 'כרטיס חד-פינות', 'ja-JP': 'シャープカード', 'de-DE': 'Scharfkantige Karte', 'fr-FR': 'Carte à angles vifs', 'zh-CN': '直角卡片' },
  'card.sharp-body': { 'en-US': 'Zero corner radius.', 'ar-SA': 'نصف قطر زوايا صفري.', 'he-IL': 'רדיוס פינה אפס.', 'ja-JP': '角丸なし（半径ゼロ）。', 'de-DE': 'Eckenradius null.', 'fr-FR': 'Rayon d’angle nul.', 'zh-CN': '圆角半径为零。' },
  'card.thick-outline-title': { 'en-US': 'Thick Outline', 'ar-SA': 'حد سميك', 'he-IL': 'מתאר עבה', 'ja-JP': '太いアウトライン', 'de-DE': 'Dicke Umrandung', 'fr-FR': 'Contour épais', 'zh-CN': '粗描边' },
  'card.thick-outline-body': { 'en-US': 'Custom outline width and color.', 'ar-SA': 'عرض ولون حد مخصصان.', 'he-IL': 'רוחב וצבע מתאר מותאמים אישית.', 'ja-JP': 'カスタムのアウトライン幅と色。', 'de-DE': 'Benutzerdefinierte Umrandungsbreite und -farbe.', 'fr-FR': 'Largeur et couleur de contour personnalisées.', 'zh-CN': '自定义描边宽度和颜色。' },

  // CSSParts
  'card.custom-state-title': { 'en-US': 'Custom State Layer', 'ar-SA': 'طبقة حالة مخصصة', 'he-IL': 'שכבת מצב מותאמת אישית', 'ja-JP': 'カスタムステートレイヤー', 'de-DE': 'Benutzerdefinierte State-Layer', 'fr-FR': 'Couche d’état personnalisée', 'zh-CN': '自定义状态层' },
  'card.custom-state-body': { 'en-US': 'Tertiary color state layer via ::part(state-layer).', 'ar-SA': 'طبقة حالة بلون ثالثي عبر ::part(state-layer).', 'he-IL': 'שכבת מצב בצבע שלישוני באמצעות ::part(state-layer).', 'ja-JP': '::part(state-layer) による第三色のステートレイヤー。', 'de-DE': 'Tertiärfarbene State-Layer über ::part(state-layer).', 'fr-FR': 'Couche d’état de couleur tertiaire via ::part(state-layer).', 'zh-CN': '通过 ::part(state-layer) 实现的第三色状态层。' },
  'card.custom-outline-title': { 'en-US': 'Custom Outline', 'ar-SA': 'حد مخصص', 'he-IL': 'מתאר מותאם אישית', 'ja-JP': 'カスタムアウトライン', 'de-DE': 'Benutzerdefinierte Umrandung', 'fr-FR': 'Contour personnalisé', 'zh-CN': '自定义描边' },
  'card.custom-outline-body': { 'en-US': 'Dashed 2px border via ::part(outline).', 'ar-SA': 'حدّ متقطع بعرض 2 بكسل عبر ::part(outline).', 'he-IL': 'גבול מקווקו בעובי 2px באמצעות ::part(outline).', 'ja-JP': '::part(outline) による 2px の破線ボーダー。', 'de-DE': 'Gestrichelter 2px-Rahmen über ::part(outline).', 'fr-FR': 'Bordure pointillée de 2px via ::part(outline).', 'zh-CN': '通过 ::part(outline) 实现的 2px 虚线边框。' },

  // ComplexContent
  'card.complex-title': { 'en-US': 'Card Title', 'ar-SA': 'عنوان البطاقة', 'he-IL': 'כותרת הכרטיס', 'ja-JP': 'カードタイトル', 'de-DE': 'Kartentitel', 'fr-FR': 'Titre de la carte', 'zh-CN': '卡片标题' },
  'card.complex-subtitle': { 'en-US': 'Subtitle', 'ar-SA': 'عنوان فرعي', 'he-IL': 'כותרת משנה', 'ja-JP': 'サブタイトル', 'de-DE': 'Untertitel', 'fr-FR': 'Sous-titre', 'zh-CN': '副标题' },
  'card.complex-body': { 'en-US': 'Cards can contain any combination of elements including images, headlines, supporting text, buttons, lists, and other components.', 'ar-SA': 'يمكن أن تحتوي البطاقات على أي مجموعة من العناصر بما في ذلك الصور والعناوين والنص الداعم والأزرار والقوائم ومكونات أخرى.', 'he-IL': 'כרטיסים יכולים להכיל כל שילוב של אלמנטים כולל תמונות, כותרות, טקסט תומך, כפתורים, רשימות ורכיבים אחרים.', 'ja-JP': 'カードには、画像、見出し、補足テキスト、ボタン、リストなど、さまざまな要素を自由に組み合わせて含めることができます。', 'de-DE': 'Karten können jede Kombination von Elementen enthalten, darunter Bilder, Überschriften, unterstützenden Text, Schaltflächen, Listen und andere Komponenten.', 'fr-FR': 'Les cartes peuvent contenir n’importe quelle combinaison d’éléments, y compris des images, des titres, du texte d’accompagnement, des boutons, des listes et d’autres composants.', 'zh-CN': '卡片可以包含任意组合的元素，包括图片、标题、辅助文本、按钮、列表和其他组件。' },
  'card.action': { 'en-US': 'Action', 'ar-SA': 'إجراء', 'he-IL': 'פעולה', 'ja-JP': 'アクション', 'de-DE': 'Aktion', 'fr-FR': 'Action', 'zh-CN': '操作' },

  // Draggable
  'card.drag-elevated-title': { 'en-US': 'Drag me (Elevated)', 'ar-SA': 'اسحبني (مرتفع)', 'he-IL': 'גרור אותי (מוגבה)', 'ja-JP': 'ドラッグしてください（エレベーテッド）', 'de-DE': 'Zieh mich (Erhöht)', 'fr-FR': 'Glissez-moi (Surélevée)', 'zh-CN': '拖动我（悬浮）' },
  'card.drag-elevated-body': { 'en-US': 'Grab and move this card. Elevation rises to level 4 while dragging.', 'ar-SA': 'أمسك هذه البطاقة وحركها. يرتفع الارتفاع إلى المستوى 4 أثناء السحب.', 'he-IL': 'תפוס והזז את הכרטיס. ההגבהה עולה לרמה 4 בזמן הגרירה.', 'ja-JP': 'このカードをつかんで動かします。ドラッグ中は影がレベル4まで上がります。', 'de-DE': 'Greife diese Karte und bewege sie. Beim Ziehen steigt die Elevation auf Stufe 4.', 'fr-FR': 'Attrapez et déplacez cette carte. L’élévation monte au niveau 4 pendant le glissement.', 'zh-CN': '抓住并移动此卡片。拖动时高程升至第 4 级。' },
  'card.drag-filled-title': { 'en-US': 'Drag me (Filled)', 'ar-SA': 'اسحبني (ممتلئ)', 'he-IL': 'גרור אותי (מלא)', 'ja-JP': 'ドラッグしてください（塗りつぶし）', 'de-DE': 'Zieh mich (Gefüllt)', 'fr-FR': 'Glissez-moi (Remplie)', 'zh-CN': '拖动我（填充）' },
  'card.drag-filled-body': { 'en-US': 'Filled card with drag support and 16% state layer.', 'ar-SA': 'بطاقة ممتلئة مع دعم السحب وطبقة حالة بنسبة 16%.', 'he-IL': 'כרטיס מלא עם תמיכת גרירה ושכבת מצב של 16%.', 'ja-JP': 'ドラッグ対応と16%のステートレイヤーを備えた塗りつぶしカード。', 'de-DE': 'Gefüllte Karte mit Ziehunterstützung und 16 % State-Layer.', 'fr-FR': 'Carte remplie avec prise en charge du glissement et couche d’état de 16 %.', 'zh-CN': '支持拖动且状态层为 16% 的填充卡片。' },
  'card.drag-outlined-title': { 'en-US': 'Drag me (Outlined)', 'ar-SA': 'اسحبني (محدد)', 'he-IL': 'גרור אותי (עם מתאר)', 'ja-JP': 'ドラッグしてください（アウトライン）', 'de-DE': 'Zieh mich (Umrandet)', 'fr-FR': 'Glissez-moi (Contourée)', 'zh-CN': '拖动我（描边）' },
  'card.drag-outlined-body': { 'en-US': 'Outlined card that can be picked up and moved.', 'ar-SA': 'بطاقة محددة يمكن التقاطها وتحريكها.', 'he-IL': 'כרטיס עם מתאר שניתן להרים ולהזיז.', 'ja-JP': 'つかんで動かせるアウトラインカード。', 'de-DE': 'Umrandete Karte, die aufgenommen und verschoben werden kann.', 'fr-FR': 'Carte contourée qui peut être saisie et déplacée.', 'zh-CN': '可拾取并移动的描边卡片。' },
  'card.drag-interactive-title': { 'en-US': 'Interactive + Draggable', 'ar-SA': 'تفاعلي + قابل للسحب', 'he-IL': 'אינטראקטיבי + ניתן לגרירה', 'ja-JP': 'インタラクティブ＋ドラッグ可能', 'de-DE': 'Interaktiv + ziehbar', 'fr-FR': 'Interactive + déplaçable', 'zh-CN': '可交互 + 可拖动' },
  'card.drag-interactive-body': { 'en-US': 'Click activates, drag moves. Both work.', 'ar-SA': 'النقر يُفعّل، والسحب يُحرّك. كلاهما يعمل.', 'he-IL': 'לחיצה מפעילה, גרירה מזיזה. שניהם עובדים.', 'ja-JP': 'クリックで起動、ドラッグで移動。両方使えます。', 'de-DE': 'Klick aktiviert, Ziehen bewegt. Beides funktioniert.', 'fr-FR': 'Le clic active, le glissement déplace. Les deux fonctionnent.', 'zh-CN': '点击激活，拖动移动。两者都有效。' },

  // DragAndDrop
  'card.dnd-alpha-body': { 'en-US': 'Drag me to the zone below.', 'ar-SA': 'اسحبني إلى المنطقة أدناه.', 'he-IL': 'גרור אותי לאזור למטה.', 'ja-JP': '下のゾーンにドラッグしてください。', 'de-DE': 'Zieh mich in den Bereich unten.', 'fr-FR': 'Glissez-moi vers la zone ci-dessous.', 'zh-CN': '将我拖到下方区域。' },
  'card.dnd-bravo-body': { 'en-US': 'Also draggable.', 'ar-SA': 'قابل للسحب أيضاً.', 'he-IL': 'גם ניתן לגרירה.', 'ja-JP': 'これもドラッグ可能。', 'de-DE': 'Ebenfalls ziehbar.', 'fr-FR': 'Également déplaçable.', 'zh-CN': '同样可拖动。' },
  'card.dnd-charlie-body': { 'en-US': 'Outlined and draggable.', 'ar-SA': 'محدد وقابل للسحب.', 'he-IL': 'עם מתאר וניתן לגרירה.', 'ja-JP': 'アウトラインでドラッグ可能。', 'de-DE': 'Umrandet und ziehbar.', 'fr-FR': 'Contourée et déplaçable.', 'zh-CN': '描边且可拖动。' },
  'card.dnd-cards-label': { 'en-US': 'Cards', 'ar-SA': 'البطاقات', 'he-IL': 'כרטיסים', 'ja-JP': 'カード', 'de-DE': 'Karten', 'fr-FR': 'Cartes', 'zh-CN': '卡片' },
  'card.dnd-dropzone-label': { 'en-US': 'Drop Zone', 'ar-SA': 'منطقة الإفلات', 'he-IL': 'אזור שחרור', 'ja-JP': 'ドロップゾーン', 'de-DE': 'Ablagezone', 'fr-FR': 'Zone de dépôt', 'zh-CN': '放置区' },
  'card.dnd-empty': { 'en-US': 'Drop cards here', 'ar-SA': 'أفلت البطاقات هنا', 'he-IL': 'שחרר כרטיסים כאן', 'ja-JP': 'ここにカードをドロップ', 'de-DE': 'Karten hier ablegen', 'fr-FR': 'Déposez les cartes ici', 'zh-CN': '将卡片放到这里' },

  // EventEmitters
  'card.ev-click-title': { 'en-US': 'Click me', 'ar-SA': 'انقر عليّ', 'he-IL': 'לחץ עליי', 'ja-JP': 'クリックしてください', 'de-DE': 'Klick mich', 'fr-FR': 'Cliquez-moi', 'zh-CN': '点击我' },
  'card.ev-drag-title': { 'en-US': 'Drag me', 'ar-SA': 'اسحبني', 'he-IL': 'גרור אותי', 'ja-JP': 'ドラッグしてください', 'de-DE': 'Zieh mich', 'fr-FR': 'Glissez-moi', 'zh-CN': '拖动我' },
  'card.ev-log-label': { 'en-US': 'Event log', 'ar-SA': 'سجل الأحداث', 'he-IL': 'יומן אירועים', 'ja-JP': 'イベントログ', 'de-DE': 'Ereignisprotokoll', 'fr-FR': 'Journal des événements', 'zh-CN': '事件日志' },
  'card.clear': { 'en-US': 'Clear', 'ar-SA': 'مسح', 'he-IL': 'ניקוי', 'ja-JP': 'クリア', 'de-DE': 'Leeren', 'fr-FR': 'Effacer', 'zh-CN': '清除' },
};
