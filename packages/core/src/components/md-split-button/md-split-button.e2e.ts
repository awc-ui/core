import { newE2EPage } from '@stencil/core/testing';

describe('md-split-button accessible alternate actions', () => {
  it('uses an external accessible label and supports a trailing action without a popup', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-split-button aria-label="Send" icon="send" haspopup="false" menu-label="Choose delivery"></md-split-button>');
    const leading = await page.find('md-split-button >>> [part="leading"]');
    const trailing = await page.find('md-split-button >>> [part="trailing"]');
    expect(leading.getAttribute('aria-label')).toBe('Send');
    expect(trailing.getAttribute('aria-haspopup')).toBeNull();
    expect(trailing.getAttribute('aria-label')).toBe('Choose delivery');
    const host = await page.find('md-split-button');
    const primary = await host.spyOnEvent('mdLeadingClick');
    const secondary = await host.spyOnEvent('mdTrailingClick');
    for (const control of [leading, trailing]) {
      await control.focus();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
    }
    await page.waitForChanges();
    expect(primary).toHaveReceivedEventTimes(2);
    expect(secondary.events.map(event => event.detail.checked)).toEqual([true, false]);
    host.setProperty('softDisabled', true);
    await page.waitForChanges();
    for (const control of [leading, trailing]) {
      await control.click();
      await control.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
    }
    await page.waitForChanges();
    expect(primary).toHaveReceivedEventTimes(2);
    expect(secondary).toHaveReceivedEventTimes(2);
    expect(trailing.getAttribute('aria-expanded')).toBe('false');
  });
});
