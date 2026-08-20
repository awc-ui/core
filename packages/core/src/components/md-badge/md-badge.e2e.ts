import { newE2EPage } from '@stencil/core/testing';

describe('md-badge e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-badge value="3"></md-badge>');
    const el = await page.find('md-badge');
    expect(el).toBeTruthy();
  });
});
