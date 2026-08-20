import { newE2EPage } from '@stencil/core/testing';

describe('md-list e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-list></md-list>');
    const el = await page.find('md-list');
    expect(el).toBeTruthy();
  });
});
