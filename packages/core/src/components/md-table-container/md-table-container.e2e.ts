import { newE2EPage } from '@stencil/core/testing';

describe('md-table-container e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-container><div>content</div></md-table-container>');
    const el = await page.find('md-table-container');
    expect(el).toBeTruthy();
  });
});
