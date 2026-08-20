import { newE2EPage } from '@stencil/core/testing';

describe('md-bottom-sheet e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bottom-sheet></md-bottom-sheet>');
    const el = await page.find('md-bottom-sheet');
    expect(el).toBeTruthy();
  });
});
