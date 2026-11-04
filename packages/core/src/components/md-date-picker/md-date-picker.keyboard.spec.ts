import { newSpecPage } from '@stencil/core/testing';
import { MdDatePicker } from './md-date-picker';

describe('md-date-picker calendar and entry state', () => {
  it('navigates by day, week, month and year, stages Space, rejects disabled dates and commits Enter', async () => {
    const page = await newSpecPage({ components: [MdDatePicker], html: '<md-date-picker variant="modal" value="2025-06-15" min="2024-01-01" max="2026-12-31"></md-date-picker>' });
    const picker = page.root as HTMLMdDatePickerElement;
    await picker.show(); await page.waitForChanges();
    const key = async (date: string, key: string, shiftKey = false) => {
      const cell = picker.shadowRoot!.querySelector(`[data-date="${date}"]`)!;
      expect(cell).not.toBeNull();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })); await page.waitForChanges();
    };
    for (const [from, to, name, shift] of [
      ['2025-06-15', '2025-06-14', 'ArrowLeft', false],
      ['2025-06-14', '2025-06-21', 'ArrowDown', false],
      ['2025-06-21', '2025-06-14', 'ArrowUp', false],
      ['2025-06-14', '2025-06-15', 'ArrowRight', false],
      ['2025-06-15', '2025-06-01', 'Home', false],
      ['2025-06-01', '2025-06-30', 'End', false],
      ['2025-06-30', '2025-05-30', 'PageUp', false],
      ['2025-05-30', '2025-06-30', 'PageDown', false],
      ['2025-06-30', '2024-06-30', 'PageUp', true],
      ['2024-06-30', '2025-06-30', 'PageDown', true],
    ] as const) {
      await key(from, name, shift);
      expect(picker.shadowRoot!.querySelector(`[data-date="${to}"]`)!.getAttribute('groupTabindex')).toBe('0');
    }
    picker.isDateDisabled = (date: Date) => date.getDate() === 30; await page.waitForChanges();
    await key('2025-06-30', 'Enter'); expect(picker.value).toBe('2025-06-15'); expect(picker.open).toBe(true);
    await key('2025-06-30', 'ArrowLeft'); await key('2025-06-29', ' ');
    expect(picker.value).toBe('2025-06-15');
    const closed = new Promise<void>((resolve) => picker.addEventListener('mdClose', () => resolve(), { once: true }));
    await key('2025-06-29', 'Enter');
    expect(picker.value).toBe('2025-06-29'); await closed; await page.waitForChanges();
  });

  it('keeps a typed invalid or consumer-disabled date separate from the committed value and clears it with empty input', async () => {
    const page = await newSpecPage({ components: [MdDatePicker], html: '<md-date-picker locale="en-GB" date-separator="." value="2025-06-15"></md-date-picker>' });
    const picker = page.root as HTMLMdDatePickerElement;
    const field = picker.shadowRoot!.querySelector('md-text-field')!;
    const commit = async (detail: string) => { field.dispatchEvent(new CustomEvent('mdChange', { detail })); await page.waitForChanges(); };
    await commit('31.02.2025'); expect(picker.error).toBe(true); expect(picker.value).toBe('2025-06-15');
    await commit('16.06.2025'); expect(picker.error).toBe(false); expect(picker.value).toBe('2025-06-16');
    picker.isDateDisabled = (date: Date) => date.getDate() === 17; await page.waitForChanges();
    await commit('17.06.2025'); expect(picker.error).toBe(true); expect(picker.value).toBe('2025-06-16');
    await commit(''); expect(picker.error).toBe(false); expect(picker.value).toBe('');
    picker.value = '2025-06-15'; picker.disabled = true; await page.waitForChanges();
    await picker.clear(); await picker.show(); expect(picker.value).toBe('2025-06-15'); expect(picker.open).toBe(false);
  });
});
