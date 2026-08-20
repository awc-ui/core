import { newE2EPage } from '@stencil/core/testing';

describe('md-table-foot e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-foot></md-table-foot>');
    const el = await page.find('md-table-foot');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('rowgroup');
  });
});
