import { newE2EPage } from '@stencil/core/testing';

// prefers-reduced-motion: the row snaps its shape morph, the disclosure panel, the drag
// handle and the reorder sibling shift (the stylesheet's reduced-motion block intends
// `transition: none` for them; state rules must not re-enable the transitions).
const props = (page: any, sel: string, inner?: string) => page.$eval(sel, (el: any, inner: string | undefined) => {
  const n = inner ? el.shadowRoot.querySelector(inner) : el;
  return n.getAnimations().map((a: any) => a.transitionProperty).filter(Boolean).sort();
}, inner);
const settle = () => new Promise(r => setTimeout(r, 30));
async function setup() {
  const page = await newE2EPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setContent(`<button id="before">before</button><md-list reorderable style="width:360px">
    <md-list-item id="a" type="button" headline="A"></md-list-item>
    <md-list-item id="b" type="button" headline="B" expandable><md-list-item slot="expanded-content" headline="Child"></md-list-item></md-list-item>
    <md-list-item id="c" type="button" headline="C"></md-list-item></md-list>`);
  await page.waitForChanges();
  return page;
}
describe('md-list-item reduced motion', () => {
  it('snaps the focus shape morph', async () => {
    const page = await setup();
    await page.focus('#before'); await page.keyboard.press('Tab'); await page.keyboard.press('ArrowDown'); await page.waitForChanges(); await settle();
    const morph = [...await props(page, '#b'), ...await props(page, '#b', '.md-list-item__row')];
    expect(morph.filter((p: string) => p.includes('radius'))).toEqual([]);
  });
  it('snaps the disclosure panel open', async () => {
    const page = await setup();
    await page.$eval('#b', (el: any) => { el.expanded = true; }); await page.waitForChanges(); await settle();
    expect([...await props(page, '#b', '.md-list-item__expanded-panel'), ...await props(page, '#b', '.md-list-item__expanded-panel-inner')]).toEqual([]);
  });
  it('snaps the drag handle hover', async () => {
    const page = await setup();
    const h = await page.$eval('#a', (el: any) => { const r = el.shadowRoot.querySelector('[data-list-drag-handle]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(h.x, h.y); await settle();
    expect(await props(page, '#a', '.md-list-item__drag-handle')).toEqual([]);
  });
  it('snaps the reorder sibling shift', async () => {
    const page = await setup();
    const h = await page.$eval('#a', (el: any) => { const r = el.shadowRoot.querySelector('[data-list-drag-handle]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x, h.y + 90, { steps: 6 }); await settle();
    expect(await page.$eval('#b', (el: any) => el.classList.contains('md-list-item--shifting'))).toBe(true);
    expect((await props(page, '#b')).filter((p: string) => p === 'transform')).toEqual([]);
    await page.mouse.up();
  });
});
