import { newE2EPage } from '@stencil/core/testing';

// Authored controls inside rows (multi-action trailing controls, arbitrary expanded-content)
// keep their own keyboard behaviour: the row and the list must not consume their keys.
const activeId = (page: any) => page.evaluate(() => {
  let n: any = document.activeElement; while (n?.shadowRoot?.activeElement) n = n.shadowRoot.activeElement;
  return (document.activeElement as HTMLElement)?.id || document.activeElement?.localName;
});

describe('md-list authored-control keyboard ownership', () => {
  it('Enter / Space on a trailing icon button activate the button, not the row', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-list interaction-mode="multi-action" style="width:360px">
      <md-list-item type="button" headline="Inbox" id="row"><md-icon-button slot="trailing" id="del" icon="delete" aria-label="Delete"></md-icon-button></md-list-item>
      <md-list-item type="button" headline="Drafts"></md-list-item></md-list>`);
    await page.$eval('#row', (el: any) => { (window as any).rowClicks = 0; el.addEventListener('mdClick', (e: Event) => { if (e.target === el) (window as any).rowClicks++; }); });
    const del = await page.find('#del'); const delClick = await del.spyOnEvent('mdClick');
    await page.$eval('#del', (el: any) => el.focus()); await page.waitForChanges();
    expect(await activeId(page)).toBe('del');
    await page.keyboard.press('Enter'); await page.waitForChanges();
    await page.keyboard.press('Space'); await page.waitForChanges();
    expect(delClick).toHaveReceivedEventTimes(2);
    expect(await page.evaluate(() => (window as any).rowClicks)).toBe(0);
    expect(await activeId(page)).toBe('del');
  });

  it('typing in an input inside expanded content edits the input without toggling, typeahead or roving', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-list reorderable style="width:360px">
      <md-list-item type="button" expandable expanded headline="Form" id="row"><div slot="expanded-content"><input id="field" aria-label="Note"></div></md-list-item>
      <md-list-item type="button" headline="Beta"></md-list-item><md-list-item type="button" headline="Gamma"></md-list-item></md-list>`);
    const list = await page.find('md-list'); const reordered = await list.spyOnEvent('mdReorder');
    const row = await page.find('#row'); const rowClick = await row.spyOnEvent('mdClick');
    await page.$eval('#field', (el: any) => el.focus()); await page.waitForChanges();
    await page.keyboard.type('b g'); await page.waitForChanges();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Alt');
    await page.waitForChanges(); await new Promise(r => setTimeout(r, 100));
    expect(await activeId(page)).toBe('field');
    expect(await page.$eval('#field', (el: any) => el.value)).toBe('b g');
    expect(await page.$eval('#row', (el: any) => el.expanded)).toBe(true);
    expect(rowClick).toHaveReceivedEventTimes(0);
    expect(reordered).toHaveReceivedEventTimes(0);
    expect(await page.$$eval('md-list > md-list-item', els => els.map(el => el.getAttribute('headline')))).toEqual(['Form', 'Beta', 'Gamma']);
  });

  it('arrow keys on a trailing slider adjust the slider and keep focus there', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-list interaction-mode="multi-action" style="width:420px">
      <md-list-item type="button" headline="Volume" id="row"><md-slider slot="trailing" id="vol" value="50" slider-aria-label="Volume"></md-slider></md-list-item>
      <md-list-item type="button" headline="Bass"></md-list-item></md-list>`);
    await page.waitForChanges();
    await page.$eval('#vol', (el: any) => { const t = el.shadowRoot.querySelector('[role="slider"], input'); (t || el).focus(); });
    await page.waitForChanges();
    await page.keyboard.press('ArrowDown'); await page.waitForChanges(); await new Promise(r => setTimeout(r, 100));
    expect(await activeId(page)).toBe('vol');
    expect(await page.$eval('#vol', (el: any) => el.value)).toBe(49);
  });

  it('keys on an expanded-content child row do not toggle, collapse or reorder the parent row', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-list reorderable style="width:360px">
      <md-list-item headline="Top"></md-list-item>
      <md-list-item type="button" expandable expanded headline="Folders" id="parent">
        <md-list-item slot="expanded-content" type="button" headline="Child" id="child"></md-list-item></md-list-item></md-list>`);
    const list = await page.find('md-list'); const reordered = await list.spyOnEvent('mdReorder');
    await page.$eval('#child', (el: any) => { (window as any).childClicks = 0; el.addEventListener('mdClick', (e: Event) => { if (e.target === el) (window as any).childClicks++; }); });
    await page.$eval('#child', (el: any) => el.setFocus()); await page.waitForChanges();
    await page.keyboard.press('Enter'); await page.waitForChanges();
    expect(await page.$eval('#parent', (el: any) => el.expanded)).toBe(true);
    expect(await page.evaluate(() => (window as any).childClicks)).toBe(1);
    await page.keyboard.press('ArrowLeft'); await page.waitForChanges();
    expect(await page.$eval('#parent', (el: any) => el.expanded)).toBe(true);
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Alt'); await page.waitForChanges();
    expect(reordered).toHaveReceivedEventTimes(0);
    expect(await page.$$eval('md-list > md-list-item', els => els.map(el => el.getAttribute('headline')))).toEqual(['Top', 'Folders']);
  });
});
