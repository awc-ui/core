import { newE2EPage } from '@stencil/core/testing';

describe('md-table-toolbar e2e', () => {
  it('tracks real table selection, slot changes and disconnects its automatic binding', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-container><md-table-toolbar slot="top" auto-bind headline="Orders" supporting-text="This week" label-selected="%count% orders"><button slot="actions">Refresh</button></md-table-toolbar><md-table selection="multiple" columns="1"><md-table-body><md-table-row value="a"><md-table-cell>Alpha</md-table-cell></md-table-row><md-table-row value="b"><md-table-cell>Beta</md-table-cell></md-table-row></md-table-body></md-table></md-table-container>');
    const toolbar = await page.find('md-table-toolbar');
    const table = await page.find('md-table');
    await page.evaluate(() => {
      const toolbar = document.querySelector('md-table-toolbar')!;
      for (const slot of ['leading', 'selection-actions']) {
        const button = document.createElement('button');
        button.slot = slot; button.textContent = slot === 'leading' ? 'Back' : 'Delete';
        toolbar.appendChild(button);
      }
    });
    await page.waitForChanges();
    expect(await page.evaluate(() => (document.querySelector('md-table-toolbar')!.shadowRoot!.querySelector('[part="leading"]') as HTMLElement).hidden)).toBe(false);
    await table.callMethod('selectAll');
    await page.waitForChanges();
    expect(await toolbar.getProperty('numSelected')).toBe(2);
    expect((await page.find('md-table-toolbar >>> [part="selection-caption"]')).textContent).toBe('2 orders');
    await table.callMethod('deselectAll');
    await page.waitForChanges();
    expect((await page.find('md-table-toolbar >>> [part="supporting-text"]')).textContent).toBe('This week');
    await page.evaluate(() => {
      const toolbar = document.querySelector('md-table-toolbar')!;
      toolbar.querySelector('[slot="leading"]')!.remove();
      toolbar.querySelector('[slot="selection-actions"]')!.remove();
      toolbar.headline = ''; toolbar.supportingText = '';
      const title = document.createElement('span'); title.slot = 'title-area'; title.textContent = 'Custom title'; toolbar.appendChild(title);
    });
    await page.waitForChanges();
    expect((await page.find('md-table-toolbar')).getAttribute('aria-label')).toBe('Table toolbar');
    expect(await page.find('md-table-toolbar >>> slot[name="title-area"]')).not.toBeNull();
    const detachedCount = await page.evaluate(async () => {
      const toolbar = document.querySelector('md-table-toolbar')!;
      toolbar.remove();
      await document.querySelector('md-table')!.selectAll();
      return toolbar.numSelected;
    });
    expect(detachedCount).toBe(0);
  });
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
