import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): every visible string and button name of the
// pagination is a `label-*` prop, but the navigation landmark name was a
// hard-coded "Pagination", so a localised page still exposed an English landmark.
describe('md-table-pagination landmark name', () => {
  it('uses the `label` prop for the navigation landmark', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-pagination count="100" label="Paginare tabel"></md-table-pagination>');
    const el = await page.find('md-table-pagination >>> [role="navigation"]').catch(() => null);
    const host = await page.find('md-table-pagination');
    const named = el ?? host;
    expect(named.getAttribute('aria-label')).toBe('Paginare tabel');
    host.setProperty('label', 'Seiten');
    await page.waitForChanges();
    const again = (await page.find('md-table-pagination >>> [role="navigation"]').catch(() => null)) ?? (await page.find('md-table-pagination'));
    expect(again.getAttribute('aria-label')).toBe('Seiten');
  });

  it('defaults to "Pagination" (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-pagination count="100"></md-table-pagination>');
    const el = (await page.find('md-table-pagination >>> [role="navigation"]').catch(() => null)) ?? (await page.find('md-table-pagination'));
    expect(el.getAttribute('aria-label')).toBe('Pagination');
  });
});
