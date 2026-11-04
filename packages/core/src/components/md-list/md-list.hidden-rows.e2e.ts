import { newE2EPage } from '@stencil/core/testing';

// Hidden rows are not rendered (`[hidden]` → display: none) and cannot take focus, so
// roving navigation, typeahead and the initial tab stop must skip them.
const activeHeadline = (page: any) => page.evaluate(() => (document.activeElement as any)?.headline ?? document.activeElement?.localName);
describe('md-list hidden rows', () => {
  it('skips hidden rows for arrows, Home/End, typeahead and the initial tab stop', async () => {
    const page = await newE2EPage();
    await page.setContent(`<button id="before">before</button><md-list style="width:320px">
      <md-list-item type="button" headline="Ghost" hidden></md-list-item>
      <md-list-item type="button" headline="Alpha"></md-list-item>
      <md-list-item type="button" headline="Hidden bravo" hidden></md-list-item>
      <md-list-item type="button" headline="Charlie"></md-list-item>
      <md-list-item type="button" headline="Zed" hidden></md-list-item></md-list>`);
    await page.waitForChanges();
    await page.focus('#before'); await page.keyboard.press('Tab'); await page.waitForChanges();
    expect(await activeHeadline(page)).toBe('Alpha');
    await page.keyboard.press('ArrowDown'); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    expect(await activeHeadline(page)).toBe('Charlie');
    await page.keyboard.press('End'); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    expect(await activeHeadline(page)).toBe('Charlie');
    await page.keyboard.press('Home'); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    expect(await activeHeadline(page)).toBe('Alpha');
    await page.keyboard.press('h'); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    expect(await activeHeadline(page)).toBe('Alpha');
    // Showing a row makes it reachable; hiding the current tab stop moves the stop.
    await page.$eval('md-list-item[headline="Hidden bravo"]', (el: any) => { el.hidden = false; }); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    await page.keyboard.press('ArrowDown'); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    expect(await activeHeadline(page)).toBe('Hidden bravo');
    await page.focus('#before');
    await page.$eval('md-list-item[headline="Hidden bravo"]', (el: any) => { el.hidden = true; }); await page.waitForChanges(); await new Promise(r => setTimeout(r, 50));
    await page.keyboard.press('Tab'); await page.waitForChanges();
    expect(await activeHeadline(page)).toBe('Alpha');
  });
});
