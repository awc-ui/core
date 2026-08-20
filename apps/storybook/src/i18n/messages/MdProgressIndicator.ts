import type { Entry } from '../index';

/** User-facing labels in the Progress Indicator demos: the icon-button
 *  accessible names (stop / pause / play) and the completion-demo controls
 *  (start / reset). Namespaced under the `progress` slug. */
export const messages: Record<string, Entry> = {
  'progress.stop': { 'en-US': 'Stop', 'ar-SA': 'إيقاف', 'he-IL': 'עצירה', 'ja-JP': '停止', 'de-DE': 'Stopp', 'fr-FR': 'Arrêter', 'zh-CN': '停止' },
  'progress.pause': { 'en-US': 'Pause', 'ar-SA': 'إيقاف مؤقت', 'he-IL': 'השהיה', 'ja-JP': '一時停止', 'de-DE': 'Pause', 'fr-FR': 'Pause', 'zh-CN': '暂停' },
  'progress.play': { 'en-US': 'Play', 'ar-SA': 'تشغيل', 'he-IL': 'הפעלה', 'ja-JP': '再生', 'de-DE': 'Wiedergabe', 'fr-FR': 'Lecture', 'zh-CN': '播放' },
  'progress.start': { 'en-US': 'Start', 'ar-SA': 'بدء', 'he-IL': 'התחלה', 'ja-JP': '開始', 'de-DE': 'Start', 'fr-FR': 'Démarrer', 'zh-CN': '开始' },
  'progress.reset': { 'en-US': 'Reset', 'ar-SA': 'إعادة تعيين', 'he-IL': 'איפוס', 'ja-JP': 'リセット', 'de-DE': 'Zurücksetzen', 'fr-FR': 'Réinitialiser', 'zh-CN': '重置' },
};
