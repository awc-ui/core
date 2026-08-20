import { newE2EPage } from '@stencil/core/testing';

describe('md-table-toolbar e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-toolbar headline="Users"></md-table-toolbar>');
    const el = await page.find('md-table-toolbar');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('toolbar');
  });

  it('switches to selection mode when num-selected > 0', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-toolbar headline="Users" num-selected="2"></md-table-toolbar>');
    const tb = await page.find('md-table-toolbar');
    const cls = await tb.getProperty('className');
    expect(cls).toContain('md-table-toolbar--selection-mode');
  });
});
