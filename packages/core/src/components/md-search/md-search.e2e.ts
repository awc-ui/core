import { newE2EPage } from '@stencil/core/testing';

describe('md-search e2e', () => {
  it('renders with defaults', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search placeholder="Find anything"></md-search>');
    const el = await page.find('md-search');
    expect(el).toBeTruthy();
    expect(await el.getProperty('open')).toBe(false);
    expect(await el.getProperty('value')).toBe('');
    expect(await el.getProperty('variant')).toBe('contained');
    expect(await el.getProperty('layout')).toBe('full-screen');
  });

  it('opens via show() and closes via close()', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search></md-search>');
    const el = await page.find('md-search');

    await el.callMethod('show');
    await page.waitForChanges();
    expect(await el.getProperty('open')).toBe(true);

    await el.callMethod('close');
    await page.waitForChanges();
    expect(await el.getProperty('open')).toBe(false);
  });

  it('emits mdSubmit on Enter from the input', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search open value="hello"></md-search>');
    const spy = await page.spyOnEvent('mdSubmit');

    await page.evaluate(() => {
      const search = document.querySelector('md-search') as HTMLElement;
      const input = search.shadowRoot?.querySelector('[part="input"]') as HTMLInputElement;
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    });

    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
    expect(spy.lastEvent.detail).toEqual({ value: 'hello' });
  });

  it('clears the input via the built-in clear button', async () => {
    const page = await newE2EPage();
    // The clear (×) button renders inside the OPEN search bar — a collapsed
    // trigger has no input row at all.
    await page.setContent('<md-search value="hello" open></md-search>');
    const el = await page.find('md-search');
    const clearSpy = await page.spyOnEvent('mdClear');

    await page.evaluate(() => {
      const search = document.querySelector('md-search') as HTMLElement;
      const clear = search.shadowRoot?.querySelector(
        '[part="clear-button"]',
      ) as HTMLButtonElement;
      clear.click();
    });

    await page.waitForChanges();
    expect(await el.getProperty('value')).toBe('');
    expect(clearSpy).toHaveReceivedEvent();
  });
});
