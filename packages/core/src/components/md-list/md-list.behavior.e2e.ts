import { newE2EPage } from '@stencil/core/testing';

describe('md-list coordinated selection and reorder', () => {
  it('selects by keyboard, skips disabled rows, wraps, and switches selection mode', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-list selection-mode="single-select" label="Files"><md-list-item headline="Alpha" value="a"></md-list-item><md-list-item headline="Blocked" disabled></md-list-item><md-list-item headline="Charlie" value="c"></md-list-item></md-list>');
    const list = await page.find('md-list'); const selected = await list.spyOnEvent('mdSelect');
    await (await page.find('md-list-item')).callMethod('setFocus');
    await page.waitForFunction(() => document.activeElement === document.querySelector('md-list-item'));
    await page.waitForChanges();
    await page.keyboard.press('ArrowDown'); await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Charlie'); await page.keyboard.press('Enter'); await page.waitForChanges();
    expect(await list.callMethod('getSelectedIndices')).toEqual([2]);
    expect(selected.lastEvent.detail).toMatchObject({ index: 2, value: 'Charlie', selected: true });
    await page.keyboard.press('ArrowDown'); await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Alpha'); await page.keyboard.press('Space'); await page.waitForChanges();
    expect(await list.callMethod('getSelectedIndices')).toEqual([0]);
    await page.keyboard.press('End'); await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Charlie'); await page.keyboard.press('Home'); await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Alpha');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('headline'))).toBe('Alpha');
    list.setProperty('selectionMode', 'multi-select'); await page.waitForChanges();
    await list.callMethod('selectItem', 2); await page.waitForChanges();
    expect(await list.callMethod('getSelectedIndices')).toEqual([0, 2]);
    await list.callMethod('selectItem', 0); await page.waitForChanges();
    expect(await list.callMethod('getSelectedIndices')).toEqual([2]);
  });

  it('keyboard reorders maintain original indices after a dynamic row insertion', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-list reorderable><md-list-item type="button" headline="A"></md-list-item><md-list-item type="button" headline="B"></md-list-item></md-list>');
    const list = await page.find('md-list'); const reordered = await list.spyOnEvent('mdReorder');
    await page.$eval('md-list', el => { const row = document.createElement('md-list-item'); row.setAttribute('type', 'button'); row.setAttribute('headline', 'C'); el.append(row); });
    await page.waitForChanges();
    const rows = await page.findAll('md-list-item'); await rows[2].callMethod('setFocus');
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Alt'); await page.waitForChanges();
    expect(await page.$$eval('md-list-item', els => els.map(el => el.getAttribute('headline')))).toEqual(['A', 'C', 'B']);
    expect(reordered).toHaveReceivedEventDetail({ from: 2, to: 1, order: [0, 2, 1] });
    list.setProperty('reorderable', false); await page.waitForChanges();
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Alt'); await page.waitForChanges();
    expect(reordered).toHaveReceivedEventTimes(1);
  });

  it('moves rows through the actual pointer drag handle and emits the committed order', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-list reorderable style="width:320px"><md-list-item type="button" headline="A"></md-list-item><md-list-item type="button" headline="B"></md-list-item><md-list-item type="button" headline="C"></md-list-item></md-list>');
    const list = await page.find('md-list'); const reordered = await list.spyOnEvent('mdReorder');
    const target = await page.$$eval('md-list-item', els => { const r = els[2].getBoundingClientRect(); return { y: r.y, height: r.height }; });
    const source = await page.$eval('md-list-item', el => { const r = el.shadowRoot!.querySelector('[data-list-drag-handle]')!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2, target.y + target.height / 2 + 5, { steps: 10 });
    await page.mouse.up(); await page.waitForChanges();
    expect(await page.$$eval('md-list-item', els => els.map(el => el.getAttribute('headline')))).toEqual(['B', 'C', 'A']);
    expect(reordered).toHaveReceivedEventDetail({ from: 0, to: 2, order: [1, 2, 0] });
  });

  it('typeahead uses live labels while public activation handles an empty list', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-list><md-list-item type="button" headline="Alpha"></md-list-item><md-list-item type="button" headline="Beta"></md-list-item></md-list>');
    const list = await page.find('md-list'); const rows = await page.findAll('md-list-item');
    await rows[0].callMethod('setFocus'); rows[1].setProperty('headline', 'Zulu'); await page.waitForChanges();
    await page.keyboard.press('z');
    await page.waitForFunction(() => (document.activeElement as HTMLMdListItemElement)?.headline === 'Zulu');
    await page.keyboard.press('q'); expect(await page.evaluate(() => (document.activeElement as HTMLMdListItemElement)?.headline)).toBe('Zulu');
    await page.$eval('md-list', el => el.replaceChildren()); await page.waitForChanges();
    expect(await list.callMethod('activateNext')).toBeNull(); expect(await list.callMethod('activatePrevious')).toBeNull();
    expect(await list.callMethod('getSelectedIndices')).toEqual([]);
  });
});
