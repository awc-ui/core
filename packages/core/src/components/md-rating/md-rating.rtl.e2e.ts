import { newE2EPage } from '@stencil/core/testing';

// Right-to-left layout: the items follow the reading direction (first item at the inline
// start = right) and a partial item fills from its inline-start side, so the picture agrees
// with the RTL keyboard (ArrowLeft increases) and the RTL-aware half-step pointer mapping.
// Computed `inset()` → the clipped share (0…100 %) taken from the [right, left] edges.
const insets = (clip: string) => {
  const parts = clip.replace(/^inset\(|\)$/g, '').trim().split(/\s+/);
  const [t, r = t, , l = r] = parts;
  const pct = (v: string) => (v.endsWith('%') ? Number(v.slice(0, -1)) : Number(v.replace('px', '')) === 0 ? 0 : NaN);
  return { right: pct(r), left: pct(l) };
};
const geometry = async (page: any, sel: string) => {
  const raw = await page.$eval(sel, (el: any) => {
    const items = [...el.shadowRoot.querySelectorAll('.md-rating__item')] as HTMLElement[];
    const xs = items.map(i => Math.round(i.getBoundingClientRect().x));
    const fills = [...el.shadowRoot.querySelectorAll('.md-rating__icon--fg')].map((f: Element) => getComputedStyle(f).clipPath);
    return { xs, fills };
  });
  return { xs: raw.xs as number[], fills: (raw.fills as string[]).map(insets) };
};

describe('md-rating right-to-left', () => {
  for (const [label, html] of [
    ['inherited dir', '<div dir="rtl" style="width:600px"><md-rating id="r" value="2.5" precision="0.5"></md-rating></div>'],
    ['host dir', '<div style="width:600px"><md-rating id="r" dir="rtl" value="2.5" precision="0.5"></md-rating></div>'],
  ]) {
    it(`mirrors item order and the partial fill (${label})`, async () => {
      const page = await newE2EPage();
      await page.setContent(html);
      const { xs, fills } = await geometry(page, '#r');
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThan(xs[i - 1]);
      // Full items show the whole glyph; the half item keeps its right (inline-start) half.
      expect(fills[0]).toEqual({ right: 0, left: 0 });
      expect(fills[2]).toEqual({ right: 0, left: 50 });
      expect(fills[3]).toEqual({ right: 0, left: 100 });
    });
  }

  it('ArrowLeft in RTL fills the next item towards the left', async () => {
    const page = await newE2EPage();
    await page.setContent('<div dir="rtl" style="width:600px"><md-rating id="r" value="2"></md-rating></div>');
    await page.$eval('#r', (el: any) => el.focusRating());
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    const state = await page.$eval('#r', (el: any) => {
      const items = [...el.shadowRoot.querySelectorAll('.md-rating__item')] as HTMLElement[];
      return items.map(i => ({ x: Math.round(i.getBoundingClientRect().x), full: i.classList.contains('md-rating__item--full') }));
    });
    const filledXs = state.filter(s => s.full).map(s => s.x);
    const emptyXs = state.filter(s => !s.full).map(s => s.x);
    expect(filledXs).toHaveLength(3);
    expect(Math.min(...filledXs)).toBeGreaterThan(Math.max(...emptyXs));
  });

  it('a pointer on the inline-start half previews the half value that is painted there', async () => {
    const page = await newE2EPage();
    await page.setContent('<div dir="rtl" style="width:600px"><md-rating id="r" precision="0.5"></md-rating></div>');
    const host = await page.find('#r');
    const hover = await host.spyOnEvent('mdHover');
    const r = await page.$eval('#r', (el: any) => { const b = el.shadowRoot.querySelectorAll('.md-rating__item')[2].getBoundingClientRect(); return { x: b.x, y: b.y + b.height / 2, w: b.width }; });
    await page.mouse.move(r.x + r.w * 0.8, r.y);
    await page.waitForChanges();
    expect(hover.events[hover.events.length - 1].detail).toBe(2.5);
    const half = await page.$eval('#r', (el: any) => {
      const item = el.shadowRoot.querySelectorAll('.md-rating__item')[2] as HTMLElement;
      const fg = item.querySelector('.md-rating__icon--fg') as HTMLElement;
      const b = item.getBoundingClientRect();
      return { clip: getComputedStyle(fg).clipPath, mid: b.x + b.width / 2 };
    });
    // The painted half is the right half — the half the pointer is on.
    expect(insets(half.clip)).toEqual({ right: 0, left: 50 });
    expect(r.x + r.w * 0.8).toBeGreaterThan(half.mid);
  });

  it('left-to-right is unchanged (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent('<div style="width:600px"><md-rating id="r" value="2.5" precision="0.5"></md-rating></div>');
    const { xs, fills } = await geometry(page, '#r');
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(fills[0]).toEqual({ right: 0, left: 0 });
    expect(fills[2]).toEqual({ right: 50, left: 0 });
    expect(fills[3]).toEqual({ right: 100, left: 0 });
  });
});
