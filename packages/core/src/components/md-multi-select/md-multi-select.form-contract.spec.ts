import { newSpecPage } from '@stencil/core/testing';
import { MdMultiSelect } from './md-multi-select';
import { installFormPlatform, presentedText, settlePresentation } from '../md-checkbox/test-utils/form-platform';

describe('md-multi-select public validation and form lifecycle', () => {
  it('uses the localized required message until selection exists, while a custom error takes priority', async () => {
    const page = await newSpecPage({ components: [MdMultiSelect], html: '<md-multi-select name="entry"></md-multi-select>' });
    const host = page.root as HTMLMdMultiSelectElement;
    installFormPlatform(page);
    host.required = true; host.valueMissingLabel = 'Choose an ingredient';
    await page.waitForChanges();
    expect(await host.getValidity()).toEqual(expect.objectContaining({ valid: false, validationMessage: 'Choose an ingredient' }));
    await host.setCustomValidity('Ingredient unavailable');
    expect((await host.getValidity()).validationMessage).toBe('Ingredient unavailable');
    await host.setCustomValidity('');
    host.errorText = 'Selection is required'; await host.setCustomValidity(''); await page.waitForChanges();
    expect((await host.getValidity()).validationMessage).toBe('Selection is required');
    host.value = ['tomato']; await page.waitForChanges();
    expect((await host.getValidity()).valid).toBe(true);
    host.required = false; host.value = []; await page.waitForChanges();
    expect((await host.getValidity()).valid).toBe(true);
  });
  it('separates silent validity checks from interactive reports and clears a resolved server error', async () => {
    const page = await newSpecPage({ components: [MdMultiSelect], html: '<md-multi-select name="entry"></md-multi-select>' });
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
    const page = await newSpecPage({ components: [MdMultiSelect], html: '<md-multi-select name="entry"></md-multi-select>' });
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
    host.value = ['changed'];
    await page.waitForChanges();
    expect(host.value).toEqual(['changed']);
    page.rootInstance.formResetCallback();
    await page.waitForChanges();
    expect(host.value).toEqual([]);
    expect(changed).not.toHaveBeenCalled();
  });
});
