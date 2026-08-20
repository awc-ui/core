import { newE2EPage } from '@stencil/core/testing';

describe('md-menu e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-menu></md-menu>');
    const el = await page.find('md-menu');
    expect(el).toBeTruthy();
  });
});
