import type { Entry } from '../index';

/** Demo strings for the Toolbar stories. Only genuine user-facing visible copy
 *  is localized: the slotted text-button labels (Yes / Maybe, Cut / Copy /
 *  Paste) and the Email-app demo's mailbox header + message-preview supporting
 *  text. Shared verbs reuse common.ts: `back`, `next` (Back / Next nav buttons)
 *  and `save` (MixedContent Save button). Left byte-for-byte, per the
 *  established convention (see MdIconButton / MdAppBar / MdList): icon-button
 *  `aria-label`s (accessible names, not visible text), Material Symbols icon
 *  names, the technical enum/variant labels, the explanatory caption / section
 *  prose that documents the component and its dp spacing, the TextEditor hint /
 *  sample-body instructions and its native `window.prompt` copy, the "Canvas
 *  area" / "Content area" layout placeholders, sample person names
 *  (Alice / Bob / Carol), and the intentional static Arabic RTL showcase. */
export const messages: Record<string, Entry> = {
  // ── DockedConfigurations — slotted text-button labels ─────────────────────
  'toolbar.yes': { 'en-US': 'Yes', 'ar-SA': 'نعم', 'he-IL': 'כן', 'ja-JP': 'はい', 'de-DE': 'Ja', 'fr-FR': 'Oui', 'zh-CN': '是' },
  'toolbar.maybe': { 'en-US': 'Maybe', 'ar-SA': 'ربما', 'he-IL': 'אולי', 'ja-JP': '未定', 'de-DE': 'Vielleicht', 'fr-FR': 'Peut-être', 'zh-CN': '待定' },

  // ── MixedContent — clipboard action buttons ───────────────────────────────
  'toolbar.cut': { 'en-US': 'Cut', 'ar-SA': 'قص', 'he-IL': 'גזירה', 'ja-JP': '切り取り', 'de-DE': 'Ausschneiden', 'fr-FR': 'Couper', 'zh-CN': '剪切' },
  'toolbar.copy': { 'en-US': 'Copy', 'ar-SA': 'نسخ', 'he-IL': 'העתקה', 'ja-JP': 'コピー', 'de-DE': 'Kopieren', 'fr-FR': 'Copier', 'zh-CN': '复制' },
  'toolbar.paste': { 'en-US': 'Paste', 'ar-SA': 'لصق', 'he-IL': 'הדבקה', 'ja-JP': '貼り付け', 'de-DE': 'Einfügen', 'fr-FR': 'Coller', 'zh-CN': '粘贴' },

  // ── EmailApp — mailbox header + message-preview supporting text ────────────
  'toolbar.inbox': { 'en-US': 'Inbox', 'ar-SA': 'البريد الوارد', 'he-IL': 'דואר נכנס', 'ja-JP': '受信トレイ', 'de-DE': 'Posteingang', 'fr-FR': 'Boîte de réception', 'zh-CN': '收件箱' },
  'toolbar.emailMeeting': { 'en-US': 'Meeting tomorrow at 10am', 'ar-SA': 'اجتماع غدًا الساعة ١٠ صباحًا', 'he-IL': 'פגישה מחר בשעה 10 בבוקר', 'ja-JP': '明日午前10時に会議', 'de-DE': 'Meeting morgen um 10 Uhr', 'fr-FR': 'Réunion demain à 10h', 'zh-CN': '明天上午10点开会' },
  'toolbar.emailReview': { 'en-US': 'PR review requested', 'ar-SA': 'مطلوب مراجعة PR', 'he-IL': 'התבקשה סקירת PR', 'ja-JP': 'PRレビューの依頼', 'de-DE': 'PR-Review angefordert', 'fr-FR': 'Revue de PR demandée', 'zh-CN': '请求 PR 审查' },
  'toolbar.emailLunch': { 'en-US': 'Lunch plans?', 'ar-SA': 'خطط الغداء؟', 'he-IL': 'תוכניות לצהריים?', 'ja-JP': 'ランチの予定は？', 'de-DE': 'Mittagspläne?', 'fr-FR': 'Des plans pour déjeuner ?', 'zh-CN': '午餐有安排吗？' },
};
