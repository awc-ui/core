import { newE2EPage } from '@stencil/core/testing';

describe('md-accordion public runtime policies', () => {
  for (const direction of ['down', 'up'] as const) {
    it(`reorders an item ${direction} with a real pointer drag and preserves disclosure state`, async () => {
      const page = await newE2EPage();
      await page.setContent('<md-accordion reorderable transition="none" style="width:320px"><md-accordion-item headline="A">A</md-accordion-item><md-accordion-item headline="B">B</md-accordion-item><md-accordion-item headline="C">C</md-accordion-item></md-accordion>');
      const acc = await page.find('md-accordion'); const reordered = await acc.spyOnEvent('mdReorder');
      const from = direction === 'down' ? 0 : 2; const to = direction === 'down' ? 2 : 0;
      const geometry = await page.$eval('md-accordion', (el, index: number) => {
        const rows = Array.from(el.querySelectorAll('md-accordion-item'));
        const handle = rows[index].shadowRoot!.querySelector('[part="drag-handle"]')!.getBoundingClientRect();
        return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2,
          rows: rows.map(row => { const r = row.getBoundingClientRect(); return { y: r.y, height: r.height }; }) };
      }, from);
      await page.mouse.move(geometry.x, geometry.y); await page.mouse.down();
      await page.mouse.move(geometry.x, geometry.rows[to].y + geometry.rows[to].height / 2 + (direction === 'down' ? 10 : -10), { steps: 10 });
      await page.mouse.up(); await page.waitForChanges();
      const order = direction === 'down' ? [1, 2, 0] : [2, 0, 1];
      expect(reordered).toHaveReceivedEventDetail({ from, to, order });
      expect(reordered).toHaveReceivedEventTimes(1);
      expect(await page.$eval('md-accordion', el => Array.from(el.querySelectorAll('md-accordion-item'), row => row.getAttribute('headline'))))
        .toEqual(order.map(index => ['A', 'B', 'C'][index]));
      expect(await page.$eval('md-accordion', el => Array.from(el.querySelectorAll('md-accordion-item'), row => ({
        expanded: row.expanded, transform: row.style.transform, dragging: row.classList.contains('md-accordion-item--dragging'),
      })))).toEqual(order.map(() => ({ expanded: false, transform: '', dragging: false })));
    });
  }

  it('reconciles exclusive expansion, region limits and inherited presentation', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion transition="none" default-expanded="0,1"><md-accordion-item headline="A">A</md-accordion-item><md-accordion-item headline="B">B</md-accordion-item></md-accordion>');
    const acc = await page.find('md-accordion');
    acc.setProperty('exclusive', true); acc.setProperty('keepOneExpanded', true); acc.setProperty('headingLevel', 2); acc.setProperty('regionThreshold', 1); acc.setProperty('density', -2); acc.setProperty('elevation', 2); await page.waitForChanges();
    expect((await page.findAll('md-accordion-item[expanded]')).length).toBe(1);
    const items = await page.findAll('md-accordion-item');
    expect(await items[1].getProperty('headingLevel')).toBe(2); expect(await items[1].getProperty('regionRole')).toBe('group');
    await items[1].callMethod('toggle'); await page.waitForChanges();
    expect(await items[1].getProperty('expanded')).toBe(true); expect(await items[1].getProperty('collapsible')).toBe(false);
    await (await page.find('md-accordion-item:nth-child(2) >>> [part="header"]')).click(); await page.waitForChanges(); expect(await items[1].getProperty('expanded')).toBe(true);
    acc.setProperty('region', 'always'); acc.setProperty('keepOneExpanded', false); await page.waitForChanges();
    expect(await items[1].getProperty('regionRole')).toBe('region');
    await items[1].callMethod('toggle'); await page.waitForChanges(); expect(await items[1].getProperty('expanded')).toBe(false);
  });

  it('navigates Home, End and reverse wrapping around disabled headers, and reorders upward', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion reorderable transition="none"><md-accordion-item headline="A">A</md-accordion-item><md-accordion-item headline="Disabled" disabled>Disabled</md-accordion-item><md-accordion-item headline="C">C</md-accordion-item></md-accordion>');
    const items = await page.findAll('md-accordion-item'); const acc = await page.find('md-accordion'); const reordered = await acc.spyOnEvent('mdReorder');
    await items[0].callMethod('focusHeader'); await page.keyboard.press('ArrowUp');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('headline'))).toBe('C');
    await page.keyboard.press('Home'); expect(await page.evaluate(() => document.activeElement?.getAttribute('headline'))).toBe('A');
    await page.keyboard.press('End'); expect(await page.evaluate(() => document.activeElement?.getAttribute('headline'))).toBe('C');
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Alt'); await page.waitForChanges();
    expect(reordered).toHaveReceivedEventDetail({ from: 2, to: 1, order: [0, 2, 1] });
  });

  it('drags a floating chassis with real pointer input and reports its final coordinates', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion floating initial-x="30" initial-y="40" transition="none"><md-accordion-item headline="Tools">Body</md-accordion-item></md-accordion>');
    const acc = await page.find('md-accordion'); const end = await acc.spyOnEvent('mdDragEnd');
    const handle = await page.find('md-accordion-item >>> [part="chassis-handle"]');
    expect(handle).not.toBeNull(); const box = await page.$eval('md-accordion-item', el => { const r = el.shadowRoot!.querySelector('[part="chassis-handle"]')!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 50, { steps: 8 }); await page.mouse.up(); await page.waitForChanges();
    expect(end).toHaveReceivedEventTimes(1);
    expect(await page.$eval('md-accordion', el => (el as HTMLElement).style.transform)).toMatch(/100px, 90px/);
  });
});
