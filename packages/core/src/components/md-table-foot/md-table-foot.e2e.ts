import { newE2EPage } from '@stencil/core/testing';

describe('md-table-foot e2e', () => {
  it('uses presentation inside a frozen table and regains rowgroup semantics when unfrozen', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table frozen-header columns="1"><md-table-body><md-table-row><md-table-cell>Item</md-table-cell></md-table-row></md-table-body><md-table-foot><md-table-row><md-table-cell>Total</md-table-cell></md-table-row></md-table-foot></md-table>');
    const foot = await page.find('md-table-foot');
    expect(foot.getAttribute('role')).toBe('presentation');
    const table = await page.find('md-table');
    await table.setProperty('frozenHeader', false);
    await page.waitForChanges();
    expect((await page.find('md-table-foot')).getAttribute('role')).toBe('rowgroup');
  });
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-foot></md-table-foot>');
    const el = await page.find('md-table-foot');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('rowgroup');
  });
});
