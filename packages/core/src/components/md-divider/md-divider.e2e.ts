import { newE2EPage } from '@stencil/core/testing';

describe('md-divider e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-divider></md-divider>');
    const el = await page.find('md-divider');
    expect(el).toBeTruthy();
  });
});
