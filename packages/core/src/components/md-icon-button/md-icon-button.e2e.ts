import { newE2EPage } from '@stencil/core/testing';

describe('md-icon-button e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-icon-button icon="favorite"></md-icon-button>');
    const el = await page.find('md-icon-button');
    expect(el).not.toBeNull();
  });

  it('fires mdClick', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-icon-button icon="favorite"></md-icon-button>');
    const el = await page.find('md-icon-button');
    const spy = await el.spyOnEvent('mdClick');
    await el.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });
});
