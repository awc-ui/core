import { newSpecPage } from '@stencil/core/testing';
import { MdTimePicker } from './md-time-picker';
import { installFormPlatform, presentedText, settlePresentation } from '../md-checkbox/test-utils/form-platform';

describe('md-time-picker public constraint validation', () => {
  it('distinguishes a silent required query from an interactive report, then clears the error when a value arrives', async () => {
    const page = await newSpecPage({ components: [MdTimePicker], html: '<md-time-picker name="appointment"></md-time-picker>' });
    installFormPlatform(page);
    const host = page.root as any;
    host.required = true; host.valueMissingLabel = 'Choose an appointment time';
    await page.waitForChanges();
    expect(await host.getValidity()).toEqual(expect.objectContaining({ valid: false, valueMissing: true, validationMessage: 'Choose an appointment time' }));
    expect(await host.checkValidity()).toBe(false);
    await settlePresentation(page);
    expect(presentedText(host)).not.toContain('Choose an appointment time');
    expect(await host.reportValidity()).toBe(false);
    await settlePresentation(page);
    expect(presentedText(host)).toContain('Choose an appointment time');
    host.name = 'rescheduled';
    await settlePresentation(page);
    expect(presentedText(host)).not.toContain('Choose an appointment time');
    host.value = '09:30';
    await page.waitForChanges();
    expect(await host.checkValidity()).toBe(true);
    expect((await host.getValidity()).valid).toBe(true);
  });

  it('reports both bounds for excluded daytime hours in an overnight range and localizes normal bounds', async () => {
    const page = await newSpecPage({ components: [MdTimePicker], html: '<md-time-picker value="12:00"></md-time-picker>' });
    installFormPlatform(page);
    const host = page.root as any;
    host.min = '22:00'; host.max = '06:00';
    await page.waitForChanges();
    expect(await host.getValidity()).toEqual(expect.objectContaining({ valid: false, rangeUnderflow: true, rangeOverflow: true }));
    host.value = '23:00'; await page.waitForChanges();
    expect((await host.getValidity()).valid).toBe(true);
    host.value = '05:30'; await page.waitForChanges();
    expect((await host.getValidity()).valid).toBe(true);
    host.min = '08:00'; host.max = '18:00';
    host.rangeUnderflowLabel = 'At least {min}, including {min}';
    host.rangeOverflowLabel = 'At most {max}, including {max}';
    await page.waitForChanges();
    expect((await host.getValidity()).validationMessage).toBe('At least 08:00, including 08:00');
    host.value = '19:00'; await page.waitForChanges();
    expect((await host.getValidity()).validationMessage).toBe('At most 18:00, including 18:00');
    host.value = '12:00'; await page.waitForChanges();
    expect((await host.getValidity()).valid).toBe(true);
  });
});
