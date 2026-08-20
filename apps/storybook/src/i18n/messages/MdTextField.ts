import type { Entry } from '../index';

/** Text-field demo strings — only genuine, visible field content a user reads is
 *  localized: real field labels (Password, Email, Phone, Website, Amount, Weight,
 *  Domain, Bio, Location, Voice search…), real placeholders (Start typing…, Write
 *  your review…), guidance supporting-text (Brief description, Choose a username)
 *  and error messages (Please enter a valid email, This field is required…), plus
 *  the native-form button labels (Submit via common.ts, Reset). The plain
 *  "Search" labels reuse the shared `search` verb from common.ts.
 *
 *  Everything else stays byte-for-byte: section headings and state/variant
 *  captions (Filled/Outlined, Empty/Populated/With Placeholder, Filled Dark,
 *  Both icons, Custom leading/trailing, All slots, Empty Field, With clear,
 *  German input), density labels (Default (56dp), Density -1 (52dp)),
 *  restriction- and formatter-demo labels + example output (Numeric only,
 *  132,000.00, HELLO WORLD, getUserName…), debounce/throttle timing-demo labels,
 *  behavior-describing supporting-text (Expands as you type, Fixed height, scrolls
 *  vertically, Works with multiline too), developer/API prose, sample data
 *  (Hello World, user@example.com, s3cret!, ada…), imperative script status/log
 *  text, and the intentional static RTL locale showcase (its own Arabic copy). */
export const messages: Record<string, Entry> = {
  // Field labels
  'textfield.password': { 'en-US': 'Password', 'ar-SA': 'كلمة المرور', 'he-IL': 'סיסמה', 'ja-JP': 'パスワード', 'de-DE': 'Passwort', 'fr-FR': 'Mot de passe', 'zh-CN': '密码' },
  'textfield.email': { 'en-US': 'Email', 'ar-SA': 'البريد الإلكتروني', 'he-IL': 'אימייל', 'ja-JP': 'メール', 'de-DE': 'E-Mail', 'fr-FR': 'E-mail', 'zh-CN': '电子邮件' },
  'textfield.phone': { 'en-US': 'Phone', 'ar-SA': 'الهاتف', 'he-IL': 'טלפון', 'ja-JP': '電話', 'de-DE': 'Telefon', 'fr-FR': 'Téléphone', 'zh-CN': '电话' },
  'textfield.website': { 'en-US': 'Website', 'ar-SA': 'الموقع الإلكتروني', 'he-IL': 'אתר אינטרנט', 'ja-JP': 'ウェブサイト', 'de-DE': 'Webseite', 'fr-FR': 'Site web', 'zh-CN': '网站' },
  'textfield.amount': { 'en-US': 'Amount', 'ar-SA': 'المبلغ', 'he-IL': 'סכום', 'ja-JP': '金額', 'de-DE': 'Betrag', 'fr-FR': 'Montant', 'zh-CN': '金额' },
  'textfield.weight': { 'en-US': 'Weight', 'ar-SA': 'الوزن', 'he-IL': 'משקל', 'ja-JP': '重量', 'de-DE': 'Gewicht', 'fr-FR': 'Poids', 'zh-CN': '重量' },
  'textfield.domain': { 'en-US': 'Domain', 'ar-SA': 'النطاق', 'he-IL': 'דומיין', 'ja-JP': 'ドメイン', 'de-DE': 'Domain', 'fr-FR': 'Domaine', 'zh-CN': '域名' },
  'textfield.username': { 'en-US': 'Username', 'ar-SA': 'اسم المستخدم', 'he-IL': 'שם משתמש', 'ja-JP': 'ユーザー名', 'de-DE': 'Benutzername', 'fr-FR': 'Nom d\'utilisateur', 'zh-CN': '用户名' },
  'textfield.bio': { 'en-US': 'Bio', 'ar-SA': 'نبذة', 'he-IL': 'אודות', 'ja-JP': '自己紹介', 'de-DE': 'Bio', 'fr-FR': 'Bio', 'zh-CN': '个人简介' },
  'textfield.location': { 'en-US': 'Location', 'ar-SA': 'الموقع', 'he-IL': 'מיקום', 'ja-JP': '場所', 'de-DE': 'Standort', 'fr-FR': 'Emplacement', 'zh-CN': '位置' },
  'textfield.voiceInput': { 'en-US': 'Voice input', 'ar-SA': 'إدخال صوتي', 'he-IL': 'קלט קולי', 'ja-JP': '音声入力', 'de-DE': 'Spracheingabe', 'fr-FR': 'Saisie vocale', 'zh-CN': '语音输入' },
  'textfield.voiceSearch': { 'en-US': 'Voice search', 'ar-SA': 'البحث الصوتي', 'he-IL': 'חיפוש קולי', 'ja-JP': '音声検索', 'de-DE': 'Sprachsuche', 'fr-FR': 'Recherche vocale', 'zh-CN': '语音搜索' },
  'textfield.dictation': { 'en-US': 'Dictation', 'ar-SA': 'إملاء', 'he-IL': 'הכתבה', 'ja-JP': 'ディクテーション', 'de-DE': 'Diktat', 'fr-FR': 'Dictée', 'zh-CN': '听写' },
  'textfield.voiceNote': { 'en-US': 'Voice note', 'ar-SA': 'ملاحظة صوتية', 'he-IL': 'הערה קולית', 'ja-JP': 'ボイスメモ', 'de-DE': 'Sprachnotiz', 'fr-FR': 'Note vocale', 'zh-CN': '语音备注' },
  'textfield.description': { 'en-US': 'Description', 'ar-SA': 'الوصف', 'he-IL': 'תיאור', 'ja-JP': '説明', 'de-DE': 'Beschreibung', 'fr-FR': 'Description', 'zh-CN': '描述' },
  'textfield.notes': { 'en-US': 'Notes', 'ar-SA': 'ملاحظات', 'he-IL': 'הערות', 'ja-JP': 'メモ', 'de-DE': 'Notizen', 'fr-FR': 'Notes', 'zh-CN': '备注' },
  'textfield.comment': { 'en-US': 'Comment', 'ar-SA': 'تعليق', 'he-IL': 'תגובה', 'ja-JP': 'コメント', 'de-DE': 'Kommentar', 'fr-FR': 'Commentaire', 'zh-CN': '评论' },
  'textfield.message': { 'en-US': 'Message', 'ar-SA': 'الرسالة', 'he-IL': 'הודעה', 'ja-JP': 'メッセージ', 'de-DE': 'Nachricht', 'fr-FR': 'Message', 'zh-CN': '留言' },
  'textfield.feedback': { 'en-US': 'Feedback', 'ar-SA': 'التعليقات', 'he-IL': 'משוב', 'ja-JP': 'フィードバック', 'de-DE': 'Feedback', 'fr-FR': 'Commentaires', 'zh-CN': '反馈' },
  'textfield.address': { 'en-US': 'Address', 'ar-SA': 'العنوان', 'he-IL': 'כתובת', 'ja-JP': '住所', 'de-DE': 'Adresse', 'fr-FR': 'Adresse', 'zh-CN': '地址' },
  'textfield.review': { 'en-US': 'Review', 'ar-SA': 'مراجعة', 'he-IL': 'ביקורת', 'ja-JP': 'レビュー', 'de-DE': 'Bewertung', 'fr-FR': 'Avis', 'zh-CN': '评价' },
  'textfield.requiredField': { 'en-US': 'Required Field', 'ar-SA': 'حقل مطلوب', 'he-IL': 'שדה חובה', 'ja-JP': '必須項目', 'de-DE': 'Pflichtfeld', 'fr-FR': 'Champ obligatoire', 'zh-CN': '必填字段' },
  'textfield.age': { 'en-US': 'Age', 'ar-SA': 'العمر', 'he-IL': 'גיל', 'ja-JP': '年齢', 'de-DE': 'Alter', 'fr-FR': 'Âge', 'zh-CN': '年龄' },
  'textfield.code': { 'en-US': 'Code', 'ar-SA': 'الرمز', 'he-IL': 'קוד', 'ja-JP': 'コード', 'de-DE': 'Code', 'fr-FR': 'Code', 'zh-CN': '代码' },
  'textfield.pin': { 'en-US': 'PIN', 'ar-SA': 'رقم التعريف الشخصي', 'he-IL': 'קוד PIN', 'ja-JP': '暗証番号', 'de-DE': 'PIN', 'fr-FR': 'Code PIN', 'zh-CN': 'PIN 码' },
  'textfield.note': { 'en-US': 'Note', 'ar-SA': 'ملاحظة', 'he-IL': 'הערה', 'ja-JP': 'メモ', 'de-DE': 'Notiz', 'fr-FR': 'Note', 'zh-CN': '备注' },
  'textfield.reset': { 'en-US': 'Reset', 'ar-SA': 'إعادة تعيين', 'he-IL': 'איפוס', 'ja-JP': 'リセット', 'de-DE': 'Zurücksetzen', 'fr-FR': 'Réinitialiser', 'zh-CN': '重置' },

  // Supporting / placeholder / error copy
  'textfield.briefDescription': { 'en-US': 'Brief description', 'ar-SA': 'وصف موجز', 'he-IL': 'תיאור קצר', 'ja-JP': '簡単な説明', 'de-DE': 'Kurze Beschreibung', 'fr-FR': 'Brève description', 'zh-CN': '简短描述' },
  'textfield.chooseUsername': { 'en-US': 'Choose a username', 'ar-SA': 'اختر اسم مستخدم', 'he-IL': 'בחר שם משתמש', 'ja-JP': 'ユーザー名を選択', 'de-DE': 'Benutzernamen wählen', 'fr-FR': 'Choisissez un nom d\'utilisateur', 'zh-CN': '选择用户名' },
  'textfield.startTyping': { 'en-US': 'Start typing...', 'ar-SA': 'ابدأ الكتابة...', 'he-IL': 'התחל להקליד...', 'ja-JP': '入力を開始...', 'de-DE': 'Tippen beginnen...', 'fr-FR': 'Commencez à saisir...', 'zh-CN': '开始输入...' },
  'textfield.tellUsThink': { 'en-US': 'Tell us what you think...', 'ar-SA': 'أخبرنا برأيك...', 'he-IL': 'ספר לנו מה דעתך...', 'ja-JP': 'ご意見をお聞かせください...', 'de-DE': 'Sagen Sie uns Ihre Meinung...', 'fr-FR': 'Dites-nous ce que vous en pensez...', 'zh-CN': '告诉我们您的想法...' },
  'textfield.writeReview': { 'en-US': 'Write your review...', 'ar-SA': 'اكتب مراجعتك...', 'he-IL': 'כתוב את הביקורת שלך...', 'ja-JP': 'レビューを書く...', 'de-DE': 'Schreiben Sie Ihre Bewertung...', 'fr-FR': 'Rédigez votre avis...', 'zh-CN': '撰写您的评价...' },
  'textfield.micSpeak': { 'en-US': 'Click mic and speak — text is appended automatically', 'ar-SA': 'انقر على الميكروفون وتحدث — تتم إضافة النص تلقائيًا', 'he-IL': 'לחץ על המיקרופון ודבר — הטקסט מתווסף אוטומטית', 'ja-JP': 'マイクをクリックして話す — テキストは自動的に追加されます', 'de-DE': 'Auf das Mikrofon klicken und sprechen — Text wird automatisch angehängt', 'fr-FR': 'Cliquez sur le micro et parlez — le texte est ajouté automatiquement', 'zh-CN': '点击麦克风说话 — 文本会自动追加' },
  'textfield.invalidEmail': { 'en-US': 'Please enter a valid email', 'ar-SA': 'الرجاء إدخال بريد إلكتروني صالح', 'he-IL': 'אנא הזן אימייל תקין', 'ja-JP': '有効なメールアドレスを入力してください', 'de-DE': 'Bitte geben Sie eine gültige E-Mail-Adresse ein', 'fr-FR': 'Veuillez saisir une adresse e-mail valide', 'zh-CN': '请输入有效的电子邮件' },
  'textfield.fieldRequired': { 'en-US': 'This field is required', 'ar-SA': 'هذا الحقل مطلوب', 'he-IL': 'שדה זה הוא חובה', 'ja-JP': 'この項目は必須です', 'de-DE': 'Dieses Feld ist erforderlich', 'fr-FR': 'Ce champ est obligatoire', 'zh-CN': '此字段为必填项' },
  'textfield.min8Chars': { 'en-US': 'Must be at least 8 characters', 'ar-SA': 'يجب أن تكون 8 أحرف على الأقل', 'he-IL': 'חייב להכיל לפחות 8 תווים', 'ja-JP': '8文字以上で入力してください', 'de-DE': 'Muss mindestens 8 Zeichen lang sein', 'fr-FR': 'Doit contenir au moins 8 caractères', 'zh-CN': '至少需要8个字符' },
  'textfield.usernameTaken': { 'en-US': 'Username already taken', 'ar-SA': 'اسم المستخدم مأخوذ بالفعل', 'he-IL': 'שם המשתמש כבר תפוס', 'ja-JP': 'このユーザー名は既に使用されています', 'de-DE': 'Benutzername bereits vergeben', 'fr-FR': 'Nom d\'utilisateur déjà pris', 'zh-CN': '用户名已被占用' },
  'textfield.invalidPhone': { 'en-US': 'Invalid phone number', 'ar-SA': 'رقم هاتف غير صالح', 'he-IL': 'מספר טלפון לא תקין', 'ja-JP': '無効な電話番号です', 'de-DE': 'Ungültige Telefonnummer', 'fr-FR': 'Numéro de téléphone invalide', 'zh-CN': '无效的电话号码' },
  'textfield.urlHttps': { 'en-US': 'URL must start with https://', 'ar-SA': 'يجب أن يبدأ الرابط بـ https://', 'he-IL': 'הכתובת חייבת להתחיל ב-https://', 'ja-JP': 'URLはhttps://で始まる必要があります', 'de-DE': 'URL muss mit https:// beginnen', 'fr-FR': 'L\'URL doit commencer par https://', 'zh-CN': '网址必须以 https:// 开头' },
  'textfield.min18': { 'en-US': 'Must be 18 or older', 'ar-SA': 'يجب أن يكون العمر 18 عامًا أو أكثر', 'he-IL': 'חובה להיות בן 18 ומעלה', 'ja-JP': '18歳以上である必要があります', 'de-DE': 'Muss 18 Jahre oder älter sein', 'fr-FR': 'Doit avoir 18 ans ou plus', 'zh-CN': '必须年满18岁' },
  'textfield.invalidCode': { 'en-US': 'Invalid code', 'ar-SA': 'رمز غير صالح', 'he-IL': 'קוד לא תקין', 'ja-JP': '無効なコードです', 'de-DE': 'Ungültiger Code', 'fr-FR': 'Code invalide', 'zh-CN': '无效代码' },
};
