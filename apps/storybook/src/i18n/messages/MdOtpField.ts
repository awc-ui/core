import type { Entry } from '../index';

/** OTP field demo strings — the group label, supporting/error copy and the
 *  per-cell aria-label template an end-user (or their screen reader) meets
 *  around the code cells. Variant captions, developer/API prose and the
 *  intentional static RTL showcase (which carries its own inline per-locale
 *  content) stay byte-for-byte in the story. */
export const messages: Record<string, Entry> = {
  'otpField.heading': { 'en-US': 'Verify your identity', 'ar-SA': 'التحقق من هويتك', 'he-IL': 'אימות הזהות שלך', 'ja-JP': '本人確認', 'de-DE': 'Identität bestätigen', 'fr-FR': 'Vérifiez votre identité', 'zh-CN': '验证您的身份' },
  'otpField.label': { 'en-US': 'One-time code', 'ar-SA': 'رمز التحقق لمرة واحدة', 'he-IL': 'קוד חד-פעמי', 'ja-JP': 'ワンタイムコード', 'de-DE': 'Einmalcode', 'fr-FR': 'Code à usage unique', 'zh-CN': '一次性验证码' },
  'otpField.supporting': { 'en-US': 'Enter the 6-digit code we sent to your phone', 'ar-SA': 'أدخل الرمز المكوَّن من 6 أرقام الذي أرسلناه إلى هاتفك', 'he-IL': 'הזינו את הקוד בן 6 הספרות ששלחנו לטלפון שלכם', 'ja-JP': '携帯電話に送信された6桁のコードを入力してください', 'de-DE': 'Geben Sie den 6-stelligen Code ein, den wir an Ihr Telefon gesendet haben', 'fr-FR': 'Saisissez le code à 6 chiffres envoyé sur votre téléphone', 'zh-CN': '请输入我们发送到您手机的6位验证码' },
  'otpField.errorText': { 'en-US': 'That code is incorrect — try again', 'ar-SA': 'الرمز غير صحيح — حاول مرة أخرى', 'he-IL': 'הקוד שגוי — נסו שוב', 'ja-JP': 'コードが正しくありません。もう一度お試しください', 'de-DE': 'Der Code ist falsch — versuchen Sie es erneut', 'fr-FR': 'Ce code est incorrect — réessayez', 'zh-CN': '验证码不正确，请重试' },
  'otpField.incomplete': { 'en-US': 'Please enter the complete code.', 'ar-SA': 'الرجاء إدخال الرمز كاملاً.', 'he-IL': 'נא להזין את הקוד המלא.', 'ja-JP': 'コードをすべて入力してください。', 'de-DE': 'Bitte geben Sie den vollständigen Code ein.', 'fr-FR': 'Veuillez saisir le code complet.', 'zh-CN': '请输入完整的验证码。' },
  'otpField.cellLabel': { 'en-US': 'Character {index} of {length}', 'ar-SA': 'الحرف {index} من {length}', 'he-IL': 'תו {index} מתוך {length}', 'ja-JP': '{length}文字中{index}文字目', 'de-DE': 'Zeichen {index} von {length}', 'fr-FR': 'Caractère {index} sur {length}', 'zh-CN': '第{index}位，共{length}位' },
};
