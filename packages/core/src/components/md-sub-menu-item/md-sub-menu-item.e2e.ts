import { newE2EPage } from '@stencil/core/testing';

describe('md-sub-menu-item e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-sub-menu-item headline="Item"></md-sub-menu-item>');
    const el = await page.find('md-sub-menu-item');
    expect(el).toBeTruthy();
  });
});
