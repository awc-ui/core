import { newE2EPage } from '@stencil/core/testing';

describe('md-menu-item-group browser composition', () => {
  it('keeps radio selection exclusive inside its own group for mouse and keyboard activation', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-menu-item-group label="Sort order">
        <md-menu-item id="name" type="radio" selected keep-open>Name</md-menu-item>
        <md-menu-item id="date" type="radio" keep-open>Date</md-menu-item>
      </md-menu-item-group>
      <md-menu-item-group label="View">
        <md-menu-item id="grid" type="radio" selected keep-open>Grid</md-menu-item>
        <md-menu-item id="list" type="radio" keep-open>List</md-menu-item>
      </md-menu-item-group>`);
    await page.waitForChanges();
    const selected = () => page.evaluate(() => Array.from(document.querySelectorAll('md-menu-item'))
      .filter(item => item.selected).map(item => item.id));
    await page.click('#date');
    await page.waitForChanges();
    expect(await selected()).toEqual(['date', 'grid']);
    await page.focus('#list');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(await selected()).toEqual(['date', 'list']);
    expect((await page.find('#list')).getAttribute('aria-checked')).toBe('true');
    expect((await page.find('#grid')).getAttribute('aria-checked')).toBe('false');
  });

  it('updates its visible and accessible label without replacing or disabling projected items', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-menu-item-group label="Actions"><md-menu-item id="action" keep-open>Duplicate</md-menu-item></md-menu-item-group>');
    await page.waitForChanges();
    const group = await page.find('md-menu-item-group');
    const activation = await page.spyOnEvent('mdClick');
    await group.setProperty('label', 'File actions');
    await page.waitForChanges();
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('File actions');
    const layout = await page.evaluate(() => {
      const host = document.querySelector('md-menu-item-group')!;
      const label = host.shadowRoot!.querySelector<HTMLElement>('.md-menu-item-group__label')!;
      const row = document.getElementById('action')!;
      return { label: label.textContent, labelBottom: label.getBoundingClientRect().bottom, rowTop: row.getBoundingClientRect().top };
    });
    expect(layout.label).toBe('File actions');
    expect(layout.rowTop).toBeGreaterThanOrEqual(layout.labelBottom);
    await group.setProperty('label', '');
    await page.waitForChanges();
    expect(group.getAttribute('aria-label')).toBeNull();
    expect(await page.find('md-menu-item-group >>> .md-menu-item-group__label')).toBeNull();
    await page.click('#action');
    await page.waitForChanges();
    expect(activation).toHaveReceivedEventTimes(1);
  });

  it('keeps a hidden group and its items out of the keyboard sequence', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <button id="before">Before</button>
      <md-menu-item-group hidden label="Hidden actions"><md-menu-item id="action">Action</md-menu-item></md-menu-item-group>
      <button id="after">After</button>`);
    await page.waitForChanges();
    await page.evaluate(() => { document.getElementById('action')!.tabIndex = 0; });
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
    expect(await page.evaluate(() => document.querySelector('md-menu-item-group')!.getBoundingClientRect().height)).toBe(0);
    await page.evaluate(() => { document.querySelector<HTMLElement>('md-menu-item-group')!.hidden = false; });
    await page.waitForChanges();
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('action');
  });
});
