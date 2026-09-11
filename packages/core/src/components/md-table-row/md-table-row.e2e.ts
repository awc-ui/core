import { newE2EPage } from '@stencil/core/testing';

// Exercise row behavior in its normal table/cell composition.

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

  it('lets nested controls own Enter and Space while the row remains keyboard-activatable', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table label="Actions" column-template="1fr">
        <md-table-body><md-table-row clickable value="record">
          <md-table-cell>
            <md-button id="core-action">Core action</md-button>
            <button id="native-action">Native action</button>
            <input id="check" type="checkbox" aria-label="Select record">
            <textarea id="editor" aria-label="Note"></textarea>
          </md-table-cell>
        </md-table-row></md-table-body>
      </md-table>`);
    await page.waitForChanges();
    const row = await page.find('md-table-row');
    const onRow = await row.spyOnEvent('mdRowClick');
    const coreAction = await page.find('#core-action');
    const onCoreAction = await coreAction.spyOnEvent('mdClick');
    const nativeAction = await page.find('#native-action');
    const onNativeAction = await nativeAction.spyOnEvent('click');

    await page.$eval('#core-action', (element) => (element as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(onCoreAction).toHaveReceivedEventTimes(2);
    await page.$eval('#native-action', (element) => (element as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(onNativeAction).toHaveReceivedEventTimes(2);

    await page.$eval('#check', (element) => (element as HTMLElement).focus());
    await page.keyboard.press('Space');
    expect(await page.$eval('#check', (element) => (element as HTMLInputElement).checked)).toBe(true);
    await page.$eval('#editor', (element) => (element as HTMLElement).focus());
    await page.keyboard.type('one');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two');
    expect(await page.$eval('#editor', (element) => (element as HTMLTextAreaElement).value)).toBe('one \ntwo');
    expect(onRow).not.toHaveReceivedEvent();

    await page.$eval('md-table-row', (element) => (element as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(onRow).toHaveReceivedEventTimes(2);
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
