import { newE2EPage } from '@stencil/core/testing';

describe('md-table-body e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-body></md-table-body>');
    const el = await page.find('md-table-body');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('rowgroup');
  });
});
