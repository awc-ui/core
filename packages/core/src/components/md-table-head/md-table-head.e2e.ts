import { newE2EPage } from '@stencil/core/testing';

describe('md-table-head e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-head></md-table-head>');
    const el = await page.find('md-table-head');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('rowgroup');
  });
});
