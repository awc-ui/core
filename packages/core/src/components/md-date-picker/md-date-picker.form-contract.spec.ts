import { newSpecPage } from '@stencil/core/testing';
import { MdDatePicker } from './md-date-picker';
import { installFormPlatform, presentedText, settlePresentation } from '../md-checkbox/test-utils/form-platform';

describe('md-date-picker public validation and form lifecycle', () => {
  it('separates silent validity checks from interactive reports and clears a resolved server error', async () => {
    const page = await newSpecPage({ components: [MdDatePicker], html: '<md-date-picker name="entry"></md-date-picker>' });
    const host = page.root as any;
    const platform = installFormPlatform(page);
    await host.setCustomValidity('');
    const changed = jest.fn();
    host.addEventListener('mdValidityChange', changed);
    await host.setCustomValidity('Server rejected this value');
    expect(await host.getValidity()).toEqual(expect.objectContaining({
      valid: false, validationMessage: 'Server rejected this value', flags: expect.objectContaining({ customError: true }),
    }));
    expect(changed).toHaveBeenCalledTimes(1);
    await host.setCustomValidity('Server rejected this value');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await host.checkValidity()).toBe(false);
    await settlePresentation(page);
    expect(presentedText(host)).not.toContain('Server rejected this value');
    expect(await host.reportValidity()).toBe(false);
    await settlePresentation(page);
    expect(presentedText(host)).toContain('Server rejected this value');
    expect(platform.internals.checkValidity).toHaveBeenCalledTimes(1);
    expect(platform.internals.reportValidity).toHaveBeenCalledTimes(1);
    await host.setCustomValidity('');
    await settlePresentation(page);
    expect((await host.getValidity()).valid).toBe(true);
    expect(presentedText(host)).not.toContain('Server rejected this value');
    expect(changed).toHaveBeenCalledTimes(2);
    expect(changed.mock.calls[1][0].detail.valid).toBe(true);
    expect(changed.mock.calls[1][0].composed).toBe(false);
  });

  it('resets presentation on field identity/disabled changes and restores initial value without a user change', async () => {
    const page = await newSpecPage({ components: [MdDatePicker], html: '<md-date-picker name="entry"></md-date-picker>' });
    const host = page.root as any;
    installFormPlatform(page);
    const changed = jest.fn();
    host.addEventListener('mdChange', changed);
    await host.setCustomValidity('Review required');
    await host.reportValidity();
    await settlePresentation(page);
    expect(presentedText(host)).toContain('Review required');
    host.name = 'replacement';
    await settlePresentation(page);
    expect(presentedText(host)).not.toContain('Review required');
    await host.reportValidity();
    await settlePresentation(page);
    expect(presentedText(host)).toContain('Review required');
    // Invoke the browser callback at its platform seam, as an ancestor disabled
    // fieldset would. No component-private handlers are called.
    page.rootInstance.formDisabledCallback(true);
    await settlePresentation(page);
    expect(presentedText(host)).not.toContain('Review required');
    page.rootInstance.formDisabledCallback(false);
    host.value = '2026-04-10';
    await page.waitForChanges();
    expect(host.value).toEqual('2026-04-10');
    page.rootInstance.formResetCallback();
    await page.waitForChanges();
    expect(host.value).toEqual('');
    expect(changed).not.toHaveBeenCalled();
  });
});
