import { newE2EPage } from '@stencil/core/testing';

async function createTable(rowAttributes = 'expandable') {
  const page = await newE2EPage();
  await page.setContent(`
    <md-table label="Invoices" column-template="48px 1fr" selection="multiple">
      <md-table-body id="rows">
        <md-table-row id="invoice" value="inv-42" clickable ${rowAttributes}>
          <md-table-cell padding="checkbox">
            <md-table-expand-toggle button-label="Details for invoice 42"></md-table-expand-toggle>
          </md-table-cell>
          <md-table-cell>Invoice 42</md-table-cell>
          <div slot="expanded"><button id="details">Download invoice</button></div>
        </md-table-row>
        <md-table-row id="other" value="inv-43">
          <md-table-cell></md-table-cell><md-table-cell>Invoice 43</md-table-cell>
        </md-table-row>
      </md-table-body>
    </md-table>`);
  await page.waitForChanges();
  return page;
}

describe('md-table-expand-toggle browser behavior', () => {
  it('opens and closes the details with exact row events without activating or selecting the row', async () => {
    const page = await createTable();
    const row = await page.find('#invoice');
    const button = await page.find('md-table-expand-toggle >>> md-icon-button');
    const expanded = await row.spyOnEvent('mdRowExpandedChange');
    const clicked = await row.spyOnEvent('mdRowClick');
    const selected = await row.spyOnEvent('mdRowSelectionChange');
    expect(button.getAttribute('aria-label')).toBe('Details for invoice 42');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await button.click();
    await page.waitForChanges();
    expect(await row.getProperty('expanded')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(await page.$eval('#invoice', row => (row.shadowRoot!.querySelector('[part="expanded"]') as HTMLElement).inert)).toBe(false);

    await button.click();
    await page.waitForChanges();
    expect(await row.getProperty('expanded')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(await page.$eval('#invoice', row => (row.shadowRoot!.querySelector('[part="expanded"]') as HTMLElement).inert)).toBe(true);
    expect(expanded.events.map(event => event.detail)).toEqual([{ expanded: true }, { expanded: false }]);
    expect(clicked).not.toHaveReceivedEvent();
    expect(selected).not.toHaveReceivedEvent();
    expect(await row.getProperty('selected')).toBe(false);
  });

  it('owns Enter and Space inside a keyboard-activatable row', async () => {
    const page = await createTable();
    const row = await page.find('#invoice');
    const button = await page.find('md-table-expand-toggle >>> md-icon-button');
    const expanded = await row.spyOnEvent('mdRowExpandedChange');
    const clicked = await row.spyOnEvent('mdRowClick');
    await page.evaluate(() => (document.querySelector('md-table-expand-toggle')!.shadowRoot!
      .querySelector('md-icon-button') as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(expanded.events.map(event => event.detail)).toEqual([{ expanded: true }, { expanded: false }]);
    expect(clicked).not.toHaveReceivedEvent();
  });

  it('mirrors external expansion and stays wired after a row is reordered', async () => {
    const page = await createTable();
    const row = await page.find('#invoice');
    const expanded = await row.spyOnEvent('mdRowExpandedChange');
    await row.callMethod('toggle');
    await page.waitForChanges();
    expect((await page.find('md-table-expand-toggle >>> md-icon-button')).getAttribute('aria-expanded')).toBe('true');

    // The documented sorting/paging pattern disconnects and reconnects the row.
    await page.evaluate(() => document.getElementById('rows')!.appendChild(document.getElementById('invoice')!));
    await page.waitForChanges();
    expect(await page.$eval('#rows', body => body.lastElementChild?.id)).toBe('invoice');
    const button = await page.find('md-table-expand-toggle >>> md-icon-button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await button.click();
    await page.waitForChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(await row.getProperty('expanded')).toBe(false);
    expect(expanded.events.map(event => event.detail)).toEqual([{ expanded: true }, { expanded: false }]);
  });

  it('does not expand or activate a plain row that has no expandable state', async () => {
    const page = await createTable('');
    const row = await page.find('#invoice');
    const button = await page.find('md-table-expand-toggle >>> md-icon-button');
    const expanded = await row.spyOnEvent('mdRowExpandedChange');
    const clicked = await row.spyOnEvent('mdRowClick');
    await button.click();
    await button.press('Enter');
    await page.waitForChanges();
    expect(await row.getProperty('expanded')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(expanded).not.toHaveReceivedEvent();
    expect(clicked).not.toHaveReceivedEvent();
  });
});
