import { newE2EPage } from '@stencil/core/testing';

describe('md-radio e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-radio value="option1"></md-radio>');
    const el = await page.find('md-radio');
    expect(el).not.toBeNull();
  });

  it('fires mdChange on click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-radio value="option1"></md-radio>');
    const el = await page.find('md-radio');
    const spy = await el.spyOnEvent('mdChange');
    await el.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });
});
