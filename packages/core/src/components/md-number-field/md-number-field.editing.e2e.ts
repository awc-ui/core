import { newE2EPage } from '@stencil/core/testing';
import { exerciseNumberEditing, exerciseNumberFormats } from './test-utils/editing.browser';

describe('md-number-field editing contract', () => {
  it('keeps locale parsing, snapping, wheel modifiers, bounds and readonly consistent', async () => {
    const page = await newE2EPage({ html: '<md-number-field label="Quantity"></md-number-field>' });
    await page.evaluate(exerciseNumberEditing);
  });
  it('repeats a held stepper, stops at the bound and keeps a touch nudge from focusing the input', async () => {
    const page = await newE2EPage({ html: '<button id="outside">Outside</button><md-number-field label="Quantity" min="0" max="3" value="0"></md-number-field>' });
    await page.evaluate(async () => {
      const field = document.querySelector('md-number-field') as HTMLMdNumberFieldElement;
      await field.componentOnReady();
      document.querySelector<HTMLElement>('#outside')!.focus();
      const button = field.shadowRoot!.querySelector('[part="increment"]')!;
      button.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    });
    await page.waitForFunction(() => (document.querySelector('md-number-field') as HTMLMdNumberFieldElement).value === 3);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('outside');
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForChanges();
    expect(await (await page.find('md-number-field')).getProperty('value')).toBe(3);
    await page.evaluate(async () => {
      const field = document.querySelector('md-number-field') as HTMLMdNumberFieldElement;
      field.value = 2; await new Promise((resolve) => setTimeout(resolve, 30));
      field.shadowRoot!.querySelector('[part="decrement"]')!.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointercancel'));
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await (await page.find('md-number-field')).getProperty('value')).toBe(1);
  });
});

describe('md-number-field LocalizedFormatsContract', () => {
  it('localized formats contract', async () => {
    const page = await newE2EPage({ html: '<md-number-field label="Form value"></md-number-field>' });
    await page.evaluate(exerciseNumberFormats);
  });
});
