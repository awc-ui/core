import { newE2EPage } from '@stencil/core/testing';

describe('md-tabs e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-tabs></md-tabs>');
    const el = await page.find('md-tabs');
    expect(el).toBeTruthy();
  });
});
