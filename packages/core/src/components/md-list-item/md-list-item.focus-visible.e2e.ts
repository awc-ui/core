import { newE2EPage } from '@stencil/core/testing';

// Keyboard focus on button / link rows lands on the inner primary element (shadow tree);
// the row must still paint its focus indicator (inset ring + focus state layer), while a
// pointer press that focuses the primary must not.
const chrome = (page: any, sel: string) => page.$eval(sel, (el: any) => ({
  ring: getComputedStyle(el).boxShadow.includes('inset'),
  layer: +getComputedStyle(el.shadowRoot.querySelector('.md-list-item__state-layer')).opacity,
}));
const wait = (ms = 160) => new Promise(r => setTimeout(r, ms));
describe('md-list-item primary-action focus indicator', () => {
  for (const type of ['button', 'link']) {
    it(`shows the focus ring for keyboard focus on ${type} rows only`, async () => {
      const page = await newE2EPage();
      await page.setContent(`<button id="before">before</button><md-list style="width:360px">
        <md-list-item id="a" type="${type}" href="#a" headline="Alpha"></md-list-item>
        <md-list-item id="b" type="${type}" href="#b" headline="Bravo"></md-list-item>
        <md-list-item id="c" type="${type}" href="#c" headline="Charlie"></md-list-item></md-list>`);
      await page.waitForChanges();
      await page.focus('#before'); await page.keyboard.press('Tab'); await page.waitForChanges(); await wait();
      expect(await chrome(page, '#a')).toEqual({ ring: true, layer: 0.1 });
      await page.keyboard.press('ArrowDown'); await page.waitForChanges(); await wait();
      expect(await chrome(page, '#b')).toEqual({ ring: true, layer: 0.1 });
      expect(await chrome(page, '#a')).toEqual({ ring: false, layer: 0 });
      const c = await page.$eval('#c', (el: any) => { const r = el.getBoundingClientRect(); return { x: r.x + 80, y: r.y + r.height / 2 }; });
      await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.up(); await page.mouse.move(1000, 700); await page.waitForChanges(); await wait(250);
      expect((await chrome(page, '#c')).ring).toBe(false);
      expect((await chrome(page, '#b')).ring).toBe(false);
    });
  }
});
