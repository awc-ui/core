import { newE2EPage } from '@stencil/core/testing';

/**
 * Focusing a field must not resize it.
 *
 * The focus ring thickens from 1px to 3px, and it used to also expand to
 * `inset: -2px` — so a focused field's outline was 4px taller and wider than
 * its own box, and visibly bigger than the untouched fields around it. In a
 * form that reads as the focused row growing and breaking alignment.
 *
 * The reason recorded for expanding outward was to hold the ring's INNER edge
 * still so the input text could not shift. It could not have: the fieldset is
 * `position: absolute; pointer-events: none`, a decorative overlay, and the
 * input and label are laid out by the container. The test below asserts both
 * halves — the outer box stays put AND the text stays put — so the trade the
 * old default was making is measured rather than assumed.
 */
describe('md-text-field · focus ring does not resize the field', () => {
  it('keeps the outer box identical, focused and not', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-text-field id="a" label="Full name" variant="outlined"></md-text-field>
      <md-text-field id="b" label="Street address" variant="outlined"></md-text-field>
    `);
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 200));

    const ring = (id: string) =>
      page.evaluate((elId: string) => {
        const el = document.getElementById(elId)!;
        const fs = el.shadowRoot!.querySelector('fieldset.md-text-field__fieldset')!;
        const h = el.getBoundingClientRect();
        const f = fs.getBoundingClientRect();
        return {
          border: getComputedStyle(fs).borderTopWidth,
          spillTop: Math.round(h.top - f.top),
          spillLeft: Math.round(h.left - f.left),
          spillBottom: Math.round(f.bottom - h.bottom),
          spillRight: Math.round(f.right - h.right),
        };
      }, id);

    const resting = await ring('b');
    expect(resting.border).toBe('1px');

    await page.focus('#a');
    await new Promise(r => setTimeout(r, 350));
    const focused = await ring('a');

    // The ring really did thicken...
    expect(focused.border).toBe('3px');
    // ...inward: it must not escape the host on any edge.
    expect(focused.spillTop).toBe(0);
    expect(focused.spillLeft).toBe(0);
    expect(focused.spillBottom).toBe(0);
    expect(focused.spillRight).toBe(0);

    // And a focused field is exactly as big as its unfocused neighbour.
    const heights = await page.evaluate(() => {
      const a = document.getElementById('a')!.getBoundingClientRect();
      const b = document.getElementById('b')!.getBoundingClientRect();
      return { a: Math.round(a.height), b: Math.round(b.height), aw: Math.round(a.width), bw: Math.round(b.width) };
    });
    expect(heights.a).toBe(heights.b);
    expect(heights.aw).toBe(heights.bw);
  }, 60000);

  it('does not move the input text when the ring thickens', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-text-field id="a" label="Full name" variant="outlined"></md-text-field>`);
    await page.waitForChanges();

    const pos = () =>
      page.evaluate(() => {
        const el = document.getElementById('a')!;
        const inp = el.shadowRoot!.querySelector('input.md-text-field__input')!;
        const h = el.getBoundingClientRect();
        const r = inp.getBoundingClientRect();
        return { left: Math.round((r.left - h.left) * 10) / 10, top: Math.round((r.top - h.top) * 10) / 10 };
      });

    const before = await pos();
    await page.focus('#a');
    await new Promise(r => setTimeout(r, 350));
    expect(await pos()).toEqual(before);
  }, 60000);

  it('an error field focuses without growing either', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-text-field id="a" label="Full name" variant="outlined" error error-text="Required"></md-text-field>`,
    );
    await page.waitForChanges();
    await page.focus('#a');
    await new Promise(r => setTimeout(r, 350));

    const spill = await page.evaluate(() => {
      const el = document.getElementById('a')!;
      const fs = el.shadowRoot!.querySelector('fieldset.md-text-field__fieldset')!;
      const h = el.getBoundingClientRect();
      const f = fs.getBoundingClientRect();
      return Math.round(h.top - f.top) + Math.round(h.left - f.left);
    });
    expect(spill).toBe(0);
  }, 60000);
});
