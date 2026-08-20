import {
  resolveDialogLabel,
  resolveDialogLabels,
} from './dialog-utils';

describe('dialog-utils', () => {
  describe('resolveDialogLabel', () => {
    it('returns English defaults for en-US', () => {
      expect(resolveDialogLabel('en-US', 'close')).toBe('Close');
      expect(resolveDialogLabel('en-US', 'cancel')).toBe('Cancel');
      expect(resolveDialogLabel('en-US', 'ok')).toBe('OK');
    });

    it('returns German labels for de-DE', () => {
      expect(resolveDialogLabel('de-DE', 'close')).toBe('Schließen');
      expect(resolveDialogLabel('de-DE', 'cancel')).toBe('Abbrechen');
      expect(resolveDialogLabel('de-DE', 'ok')).toBe('OK');
    });

    it('returns Japanese labels for ja-JP', () => {
      expect(resolveDialogLabel('ja-JP', 'close')).toBe('閉じる');
      expect(resolveDialogLabel('ja-JP', 'cancel')).toBe('キャンセル');
    });

    it('returns Arabic labels for ar', () => {
      expect(resolveDialogLabel('ar', 'close')).toBe('إغلاق');
      expect(resolveDialogLabel('ar', 'cancel')).toBe('إلغاء');
      expect(resolveDialogLabel('ar', 'ok')).toBe('موافق');
    });

    it('falls back to English for unknown locales', () => {
      expect(resolveDialogLabel('xx-YY', 'close')).toBe('Close');
    });

    it('falls back to en-US when locale is empty', () => {
      expect(resolveDialogLabel('', 'cancel')).toBe('Cancel');
      expect(resolveDialogLabel(undefined, 'ok')).toBe('OK');
    });
  });

  describe('resolveDialogLabels', () => {
    it('returns all labels for a locale', () => {
      expect(resolveDialogLabels('fr-FR')).toEqual({
        close: 'Fermer',
        cancel: 'Annuler',
        ok: 'OK',
      });
    });
  });
});
