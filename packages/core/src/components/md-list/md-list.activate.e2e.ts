import { newE2EPage } from '@stencil/core/testing';

// mdActivate is documented as "emitted whenever roving focus lands on a different row".
describe('md-list mdActivate', () => {
  it('fires once per change of active row, not for keys that keep the same row', async () => {
    const page = await newE2EPage();
    await page.setContent(`<button id="before">before</button><md-list style="width:320px">
      <md-list-item type="button" headline="Alpha"></md-list-item><md-list-item type="button" headline="Bravo"></md-list-item><md-list-item type="button" headline="Charlie"></md-list-item></md-list>
      <md-list id="one" style="width:320px"><md-list-item type="button" headline="Solo"></md-list-item></md-list>`);
    const list = await page.find('md-list'); const activated = await list.spyOnEvent('mdActivate');
    await page.focus('#before'); await page.keyboard.press('Tab'); await page.waitForChanges();
    await page.keyboard.press('Home'); await page.waitForChanges();
    expect(activated).toHaveReceivedEventTimes(0);
    await page.keyboard.press('End'); await page.waitForChanges();
    expect(activated).toHaveReceivedEventTimes(1);
    await page.keyboard.press('End'); await page.waitForChanges(); await page.keyboard.press('c'); await page.waitForChanges();
    expect(activated).toHaveReceivedEventTimes(1);
    await page.keyboard.press('ArrowDown'); await page.waitForChanges();
    expect(activated).toHaveReceivedEventTimes(2);
    expect(activated.lastEvent.detail.index).toBe(0);
    const solo = await page.find('#one'); const soloActivated = await solo.spyOnEvent('mdActivate');
    await page.$eval('#one md-list-item', (el: any) => el.setFocus()); await page.waitForChanges();
    await page.keyboard.press('ArrowDown'); await page.waitForChanges(); await page.keyboard.press('ArrowUp'); await page.waitForChanges();
    expect(soloActivated).toHaveReceivedEventTimes(0);
  });
});
