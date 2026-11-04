import { newE2EPage } from '@stencil/core/testing';

describe('md-tab-panels browser binding lifecycle', () => {
  it('rebinds to another tablist, ignores the former list, and reconnects with authored ARIA preserved', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-tabs id="one"><md-tab label="A"></md-tab><md-tab label="B"></md-tab></md-tabs><md-tabs id="two" active-tab-index="1"><md-tab id="authored-a" label="C"></md-tab><md-tab id="authored-b" label="D"></md-tab></md-tabs><md-tab-panels for="one" sizing="active"><md-tab-panel id="panel-a">A</md-tab-panel><md-tab-panel id="panel-b">B</md-tab-panel></md-tab-panels>');
    const panels = await page.find('md-tab-panels'); panels.setProperty('for', 'two'); await page.waitForChanges();
    expect((await page.find('#panel-b')).getAttribute('active')).not.toBeNull();
    expect((await page.find('#panel-b')).getAttribute('aria-labelledby')).toBe('authored-b');
    await (await page.find('#one')).callMethod('selectTab', 1); await page.waitForChanges();
    await (await page.find('#two')).callMethod('selectTab', 0); await page.waitForChanges();
    expect((await page.find('#panel-a')).getAttribute('active')).not.toBeNull();
    await page.$eval('md-tab-panels', el => { el.remove(); document.body.append(el); }); await page.waitForChanges();
    await (await page.find('#two')).callMethod('selectTab', 1); await page.waitForChanges();
    expect((await page.find('#panel-b')).getAttribute('active')).not.toBeNull();
    panels.setProperty('for', 'missing'); await page.waitForChanges();
    expect((await page.find('#panel-a')).getAttribute('active')).not.toBeNull();
  });
});
