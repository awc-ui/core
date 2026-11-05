import { newSpecPage } from '@stencil/core/testing';
import { MdSlider } from './md-slider';
import { installFormPlatform } from '../md-checkbox/test-utils/form-platform';

describe('md-slider form restoration', () => {
  it('restores a finite scalar, ignores malformed session state, and resets to the authored value', async () => {
    const page = await newSpecPage({ components: [MdSlider], html: '<md-slider name="volume" value="20"></md-slider>' });
    const platform = installFormPlatform(page);
    page.rootInstance.formStateRestoreCallback('65');
    await page.waitForChanges();
    expect((page.root as any).value).toBe(65);
    expect(platform.submitted()).toBe('65');
    page.rootInstance.formStateRestoreCallback('not a number');
    page.rootInstance.formStateRestoreCallback(null);
    await page.waitForChanges();
    expect((page.root as any).value).toBe(65);
    page.rootInstance.formResetCallback();
    await page.waitForChanges();
    expect((page.root as any).value).toBe(20);
    expect(platform.submitted()).toBe('20');
  });

  it('restores both range endpoints and republishes their renamed form fields', async () => {
    const page = await newSpecPage({ components: [MdSlider], html: '<md-slider range name="window" value-start="20" value-end="70"></md-slider>' });
    const platform = installFormPlatform(page);
    const restored = new FormData(); restored.append('window', '30'); restored.append('window', '90');
    page.rootInstance.formStateRestoreCallback(restored);
    await page.waitForChanges();
    const host = page.root as any;
    expect([host.valueStart, host.valueEnd]).toEqual([30, 90]);
    host.nameStart = 'lower'; host.nameEnd = 'upper';
    await page.waitForChanges();
    expect(Array.from((platform.submitted() as FormData).entries())).toEqual([['lower', '30'], ['upper', '90']]);
    const malformed = new FormData(); malformed.append('lower', 'invalid');
    page.rootInstance.formStateRestoreCallback(malformed);
    await page.waitForChanges();
    expect([host.valueStart, host.valueEnd]).toEqual([30, 90]);
    page.rootInstance.formResetCallback();
    await page.waitForChanges();
    expect([host.valueStart, host.valueEnd]).toEqual([20, 70]);
    expect(Array.from((platform.submitted() as FormData).entries())).toEqual([['lower', '20'], ['upper', '70']]);
  });
});
