/**
 * Locale-aware dialog chrome strings used by md-dialog.
 *
 * Co-located with the component but exported separately so we can
 * unit-test label resolution without booting a Stencil page.
 */

export type DialogLabelKey = 'close' | 'cancel' | 'ok';

const EN_LABELS: Record<DialogLabelKey, string> = {
  close: 'Close',
  cancel: 'Cancel',
  ok: 'OK',
};

/** Language-code → localized labels (falls back to English). */
const TRANSLATIONS: Record<string, Partial<Record<DialogLabelKey, string>>> = {
  ar: { close: 'إغلاق', cancel: 'إلغاء', ok: 'موافق' },
  de: { close: 'Schließen', cancel: 'Abbrechen', ok: 'OK' },
  es: { close: 'Cerrar', cancel: 'Cancelar', ok: 'Aceptar' },
  fr: { close: 'Fermer', cancel: 'Annuler', ok: 'OK' },
  hi: { close: 'बंद करें', cancel: 'रद्द करें', ok: 'ठीक' },
  it: { close: 'Chiudi', cancel: 'Annulla', ok: 'OK' },
  ja: { close: '閉じる', cancel: 'キャンセル', ok: 'OK' },
  ko: { close: '닫기', cancel: '취소', ok: '확인' },
  nl: { close: 'Sluiten', cancel: 'Annuleren', ok: 'OK' },
  pl: { close: 'Zamknij', cancel: 'Anuluj', ok: 'OK' },
  pt: { close: 'Fechar', cancel: 'Cancelar', ok: 'OK' },
  ro: { close: 'Închide', cancel: 'Anulează', ok: 'OK' },
  ru: { close: 'Закрыть', cancel: 'Отмена', ok: 'ОК' },
  zh: { close: '关闭', cancel: '取消', ok: '确定' },
};

/** Extract the primary language subtag from a BCP-47 locale tag. */
function languageCode(locale: string): string {
  const tag = locale.trim();
  if (!tag) return 'en';
  try {
    return new Intl.Locale(tag).language;
  } catch {
    return tag.split('-')[0].toLowerCase();
  }
}

/**
 * Resolve a built-in dialog label for the given locale.
 * Unknown locales fall back to English.
 */
export function resolveDialogLabel(
  locale: string | undefined,
  key: DialogLabelKey,
): string {
  const lang = languageCode(locale || 'en-US');
  return TRANSLATIONS[lang]?.[key] ?? EN_LABELS[key];
}

/** All built-in labels for a locale (useful for docs and tests). */
export function resolveDialogLabels(
  locale: string | undefined,
): Record<DialogLabelKey, string> {
  return {
    close: resolveDialogLabel(locale, 'close'),
    cancel: resolveDialogLabel(locale, 'cancel'),
    ok: resolveDialogLabel(locale, 'ok'),
  };
}
