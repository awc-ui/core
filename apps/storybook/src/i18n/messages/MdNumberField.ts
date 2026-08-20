import type { Entry } from '../index';

/** Demo strings for the Text Inputs/Number Field stories. Only user-facing
 *  labels, supporting text and the validation message are localized; the
 *  intentional static locale demos (de-DE currency, ar-SA numerals) and the
 *  developer keyboard-contract notes stay as-is. The Submit button reuses the
 *  shared `submit` verb from `common.ts`. */
export const messages: Record<string, Entry> = {
  'numberField.quantity': { 'en-US': 'Quantity', 'ar-SA': 'الكمية', 'he-IL': 'כמות', 'ja-JP': '数量', 'de-DE': 'Menge', 'fr-FR': 'Quantité', 'zh-CN': '数量' },
  'numberField.price': { 'en-US': 'Price', 'ar-SA': 'السعر', 'he-IL': 'מחיר', 'ja-JP': '価格', 'de-DE': 'Preis', 'fr-FR': 'Prix', 'zh-CN': '价格' },
  'numberField.discount': { 'en-US': 'Discount', 'ar-SA': 'الخصم', 'he-IL': 'הנחה', 'ja-JP': '割引', 'de-DE': 'Rabatt', 'fr-FR': 'Remise', 'zh-CN': '折扣' },
  'numberField.increment': { 'en-US': 'Increment', 'ar-SA': 'زيادة', 'he-IL': 'הוספה', 'ja-JP': '増やす', 'de-DE': 'Erhöhen', 'fr-FR': 'Augmenter', 'zh-CN': '增加' },
  'numberField.decrement': { 'en-US': 'Decrement', 'ar-SA': 'إنقاص', 'he-IL': 'הפחתה', 'ja-JP': '減らす', 'de-DE': 'Verringern', 'fr-FR': 'Diminuer', 'zh-CN': '减少' },
  'numberField.between0and10': { 'en-US': 'Between 0 and 10', 'ar-SA': 'بين 0 و10', 'he-IL': 'בין 0 ל-10', 'ja-JP': '0から10まで', 'de-DE': 'Zwischen 0 und 10', 'fr-FR': 'Entre 0 et 10', 'zh-CN': '介于0和10之间' },
  'numberField.enterQuantityError': { 'en-US': 'Please enter a quantity', 'ar-SA': 'يرجى إدخال الكمية', 'he-IL': 'נא להזין כמות', 'ja-JP': '数量を入力してください', 'de-DE': 'Bitte geben Sie eine Menge ein', 'fr-FR': 'Veuillez saisir une quantité', 'zh-CN': '请输入数量' },
};
