import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): the polite live region announced a hard-coded English
// "No data" when `empty` turned on, even when the author localised the visible
// empty state through the `empty` slot — sighted users read "Keine Daten",
// screen-reader users heard "No data".
const markup = (slot: string) => `<md-table columns="1"><md-table-head><md-table-row><md-table-cell head>Name</md-table-cell></md-table-row></md-table-head>
  <md-table-body><md-table-row><md-table-cell>Alpha</md-table-cell></md-table-row></md-table-body>${slot}</md-table>`;

const announcement = (page: import('@stencil/core/testing').E2EPage) =>
  page.evaluate(() => document.querySelector('md-table')!.shadowRoot!.querySelector('.md-table__sr-status')!.textContent);

describe('md-table empty-state announcement', () => {
  it('announces the slotted empty-state text', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('<div slot="empty"><strong>Keine Daten</strong>\n   gefunden</div>'));
    const table = await page.find('md-table');
    table.setProperty('empty', true);
    await page.waitForChanges();
    expect(await announcement(page)).toBe('Keine Daten gefunden');
    table.setProperty('empty', false);
    await page.waitForChanges();
    expect(await announcement(page)).toBe('');
  });

  it('falls back to the built-in "No data" without a slotted empty state (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent(markup(''));
    const table = await page.find('md-table');
    table.setProperty('empty', true);
    await page.waitForChanges();
    expect(await announcement(page)).toBe('No data');
  });
});
