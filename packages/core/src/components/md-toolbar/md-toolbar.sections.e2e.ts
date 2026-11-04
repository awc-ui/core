import { newE2EPage } from '@stencil/core/testing';

/* Leading / trailing sections (gate-1 defect): several items in one section stay
   together, vertical strips keep section items on axis, and single-item layouts are
   unchanged. Buttons are 40×40; the docked bar is 700px wide (16px padding). */
/** Item boxes relative to the toolbar host's border box. */
const box = (page: any, ids: string[]) => page.evaluate((ids: string[]) => {
  const h = document.querySelector('md-toolbar')!.getBoundingClientRect();
  return Object.fromEntries(ids.map(id => {
    const r = document.getElementById(id)!.getBoundingClientRect();
    return [id, { left: r.left - h.left, right: r.right - h.left, cx: (r.left + r.right) / 2 - h.left, top: r.top - h.top }];
  }));
}, ids);
const btn = (id: string, slot?: string) => `<button ${slot ? `slot="${slot}"` : ''} id="${id}" style="width:40px;height:40px;padding:0;border:0">${id}</button>`;

describe('md-toolbar sections', () => {
  it.each(['ltr', 'rtl'])('keeps several leading and trailing items together (%s)', async dir => {
    const page = await newE2EPage();
    await page.setViewport({ width: 800, height: 400 });
    await page.setContent(`<div dir="${dir}"><md-toolbar aria-label="t" style="width:700px">${btn('a', 'leading')}${btn('b', 'leading')}${btn('c')}${btn('d', 'trailing')}${btn('e', 'trailing')}</md-toolbar></div>`);
    await page.waitForChanges();
    const r = await box(page, ['a', 'b', 'c', 'd', 'e']);
    const gap = (x: string, y: string) => dir === 'ltr' ? r[y].left - r[x].right : r[x].left - r[y].right;
    expect(gap('a', 'b')).toBe(32);
    expect(gap('d', 'e')).toBe(32);
    // Sections sit at the bar edges.
    expect(dir === 'ltr' ? r.a.left : 700 - r.a.right).toBe(16);
    expect(dir === 'ltr' ? 700 - r.e.right : r.e.left).toBe(16);
  });

  it('keeps the docked item gap inside a section on a space-between bar', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 800, height: 400 });
    await page.setContent(`<md-toolbar aria-label="t" alignment="space-between" style="width:700px">${btn('a', 'leading')}${btn('b', 'leading')}${btn('c')}${btn('d', 'trailing')}</md-toolbar>`);
    await page.waitForChanges();
    const r = await box(page, ['a', 'b']);
    expect(r.b.left - r.a.right).toBe(32);
  });

  it('centres leading and trailing items on a vertical floating strip', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-toolbar aria-label="t" variant="floating" layout="vertical">${btn('a', 'leading')}${btn('b', 'leading')}${btn('c')}${btn('d', 'trailing')}</md-toolbar>`);
    await page.waitForChanges();
    const r = await box(page, ['a', 'b', 'c', 'd']);
    expect(r.a.cx).toBeCloseTo(r.c.cx, 3);
    expect(r.b.cx).toBeCloseTo(r.c.cx, 3);
    expect(r.d.cx).toBeCloseTo(r.c.cx, 3);
    // Floating item gap (4px) between stacked section items.
    expect(r.b.top - r.a.top).toBe(44);
  });

  it.each([
    ['start', 330], ['center', 330], ['end', 330], ['space-between', 330],
  ])('single leading/trailing items keep their layout (%s)', async (alignment, expectedC) => {
    const page = await newE2EPage();
    await page.setViewport({ width: 800, height: 400 });
    await page.setContent(`<md-toolbar aria-label="t" alignment="${alignment}" style="width:700px">${btn('a', 'leading')}${btn('c')}${btn('d', 'trailing')}</md-toolbar>`);
    await page.waitForChanges();
    const r = await box(page, ['a', 'c', 'd']);
    expect(r.a.left).toBe(16);
    expect(r.d.right).toBe(684);
    expect(r.c.left).toBe(expectedC);
  });

  it('an empty or hidden section adds no space', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 800, height: 400 });
    await page.setContent(`<md-toolbar aria-label="t" style="width:700px">${btn('c')}${btn('x')}<button slot="trailing" id="h" hidden>h</button></md-toolbar>`);
    await page.waitForChanges();
    const r = await box(page, ['c', 'x']);
    expect(r.c.left).toBe(16);
    expect(r.x.left - r.c.right).toBe(32);
    await page.evaluate(() => document.getElementById('h')!.removeAttribute('hidden'));
    await page.waitForChanges();
    await page.waitForChanges();
    const after = await box(page, ['c', 'h']);
    expect(after.c.left).toBe(16);
    expect(after.h.right).toBe(684);
  });
});
