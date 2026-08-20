import { newE2EPage } from '@stencil/core/testing';

// `<md-table-row>` uses `display: contents`. To give Puppeteer a sized
// surface to interact with, we wrap rows inside a fully-built table.

const TABLE = `
  <md-table label="t" columns="1" style="display:block; min-block-size:60px;">
    <md-table-body>
      <md-table-row __ROW_ATTRS__>
        <md-table-cell style="display:flex; min-block-size:48px; padding:8px;">cell</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>
`;

describe('md-table-row e2e', () => {
  it('renders with role=row', async () => {
    const page = await newE2EPage();
    await page.setContent(TABLE.replace('__ROW_ATTRS__', ''));
    const row = await page.find('md-table-row');
    expect(row).toBeTruthy();
    expect(row.getAttribute('role')).toBe('row');
  });

  it('emits mdRowClick when clickable (via JS click)', async () => {
    const page = await newE2EPage();
    await page.setContent(TABLE.replace('__ROW_ATTRS__', 'clickable value="42"'));
    const row = await page.find('md-table-row');
    const ev = await row.spyOnEvent('mdRowClick');
    await page.$eval('md-table-row', (el: HTMLElement) => el.click());
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
    const detail = ev.events[0].detail as { value: string };
    expect(detail.value).toBe('42');
  });

  it('aria-selected is stamped only in selection-enabled tables', async () => {
    // md-table owns aria-selected (syncRows/syncSelectionUI): body rows of a
    // selection-enabled table get it; read-only tables must stay silent.
    const page = await newE2EPage();
    await page.setContent(
      TABLE.replace('<md-table ', '<md-table selection="multiple" ').replace('__ROW_ATTRS__', 'selected'),
    );
    await page.waitForChanges();
    const row = await page.find('md-table-row');
    expect(row.getAttribute('aria-selected')).toBe('true');

    const readOnly = await newE2EPage();
    await readOnly.setContent(TABLE.replace('__ROW_ATTRS__', 'selected'));
    await readOnly.waitForChanges();
    const bare = await readOnly.find('md-table-row');
    expect(bare.getAttribute('aria-selected')).toBeNull();
  });

  it('toggles expanded via toggle()', async () => {
    const page = await newE2EPage();
    await page.setContent(TABLE.replace('__ROW_ATTRS__', 'expandable'));
    const row = await page.find('md-table-row');
    await row.callMethod('toggle');
    await page.waitForChanges();
    expect(await row.getProperty('expanded')).toBe(true);
  });
});
